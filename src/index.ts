import { createWorker, createScheduler } from 'tesseract.js';
import Jimp from 'jimp';
import solve from '@mattflow/sudoku-solver';
import { readdirSync, writeFileSync, readFileSync } from 'fs';
import { runCommand } from './runCommand';
import { writeSync } from 'clipboardy';

type Image = {
    buffer: Buffer,
    cellWidth: number,
    cellHeight: number,
};

async function processImage(filename: string, saveProcessed: boolean): Promise<Image> {
    console.log(`optimizing ${filename}`);

    const image = await Jimp.read(filename);
    image.greyscale().contrast(1).autocrop().autocrop();

    if (saveProcessed) {
        image.write('processed.png');
    }

    return {
        buffer: await image.getBufferAsync(Jimp.MIME_PNG),
        cellWidth: image.getWidth() / 9,
        cellHeight: image.getHeight() / 9,
    };
}

async function loadWorker(scheduler: Tesseract.Scheduler, i: number): Promise<void> {
    console.log(`loading worker ${i}`);

    const worker = createWorker();

    await worker.load();
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    await worker.setParameters({
        tessedit_char_whitelist: '123456789',
    });

    scheduler.addWorker(worker);
}

async function parseImage(scheduler: Tesseract.Scheduler, image: Image): Promise<string> {
    console.log('parsing image');

    let puzzle = '';
    const jobs = [];

    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            const rectangle = {
                left: col * image.cellWidth + image.cellWidth * .1,
                top: row * image.cellHeight + image.cellHeight * .1,
                width: image.cellWidth * .8,
                height: image.cellHeight * .8,
            };

            jobs.push(scheduler.addJob('recognize', image.buffer, { rectangle }));
        }
    }

    const results = await Promise.all<Tesseract.RecognizeResult>(jobs);
    for (let { data: { text } } of results) {
        text = text.trim();
        if (text.length != 1) text = '0';
        puzzle = `${puzzle}${text}`;
    }

    return puzzle;
}

async function controller(): Promise<void> {
    const scheduler = createScheduler();
    for (let i = 0; i < 3; i++) {
        await loadWorker(scheduler, i);
    }

    let files = [];
    if (process.argv[2] !== undefined) {
        files = [process.argv[2]];
    } else {
        files = readdirSync('sudokus').filter((file) => {
            return file.substring(file.length - 4) === '.png';
        }).map(file => `sudokus/${file}`);
    }
    
    const valids: string[] = [];
    const fails: string[] = []; 
    for (const file of files) {
        console.log('');

        const image = await processImage(file, files.length === 1);

        const puzzle = await parseImage(scheduler, image);
        console.log(puzzle);

        try {
            const solution = solve(puzzle, { maxIterations: 1<<22, emptyValue: '0' });
            console.log(solution);
            console.log('valid');
            valids.push(puzzle);
        } catch (error) {
            console.log('invalid', error);
            fails.push(file);
        }
    }

    await scheduler.terminate();

    console.log('\n-------------------------------------------------');

    if (fails.length > 0) {
        console.log(`\nfail: ${fails.length}\n---------`);
        for (const fail of fails) {
            console.log(fail);
        }

        process.exit(1);
    }

    writeFileSync('sudokus/puzzles.in.txt', valids.join('\n'));

    await runCommand('java', [
        '-jar', 'bin/hodoku.jar',
        '/bs', 'sudokus/puzzles.in.txt',
        '/o', 'sudokus/puzzles.out.txt'
    ]);

    const puzzles = readFileSync('sudokus/puzzles.out.txt').toString();
    writeSync(puzzles);
}

controller().then(() => {
    console.log('\ndone');
    console.log('results are in sudokus/puzzles.out.txt and in your clipboard');
}) .catch((error) => {
    console.log('\nerror', error);
    process.exit(1);
});
