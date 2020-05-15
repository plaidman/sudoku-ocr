import { createWorker, createScheduler } from 'tesseract.js';
import Jimp from 'jimp';
import solve from '@mattflow/sudoku-solver';
import { readdirSync } from 'fs';

type Image = {
    buffer: Buffer,
    cellWidth: number,
    cellHeight: number,
};

async function processImage(filename: string): Promise<Image> {
    console.log(`optimizing ${filename}`);

    const image = await Jimp.read(filename);
    image.greyscale().contrast(1).autocrop().autocrop();

    // image.write('processed.png');

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
                left: col * image.cellWidth + image.cellWidth * .08,
                top: row * image.cellHeight + image.cellHeight * .08,
                width: image.cellWidth * .84,
                height: image.cellHeight * .84,
            };

            jobs.push(scheduler.addJob('recognize', image.buffer, { rectangle }));
        }
    }

    const results = await Promise.all<Tesseract.RecognizeResult>(jobs);
    for (let { data: { text } } of results) {
        text = text.trim();
        if (text.length != 1) text = '.';
        puzzle = `${puzzle}${text}`;
    }

    return puzzle;
}

async function controller(): Promise<void> {
    const scheduler = createScheduler();
    for (let i = 0; i < 3; i++) {
        await loadWorker(scheduler, i);
    }

    const files = readdirSync('sudokus').filter((file) => {
        return file.substring(file.length - 4) === '.png';
    });
    
    for (const file of files) {
        console.log('');

        const image = await processImage(`sudokus/${file}`);

        const puzzle = await parseImage(scheduler, image);
        console.log(puzzle);

        try {
            const solution = solve(puzzle, { emptyValue: '.' });
            console.log(solution);
            console.log('valid');
        } catch (error) {
            console.log('invalid', error);
        }
    }

    await scheduler.terminate();
}

controller().then(() => {
    console.log('done');
}) .catch((error) => {
    console.log('error', error);
    process.exit(1);
});
