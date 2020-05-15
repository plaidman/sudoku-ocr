import { createWorker } from 'tesseract.js';
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

async function loadWorker(): Promise<Tesseract.Worker> {
    console.log('loading worker');

    const worker = createWorker();

    await worker.load();
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    await worker.setParameters({
        tessedit_char_whitelist: '123456789',
    });

    return worker;
}

async function parseImage(worker: Tesseract.Worker, image: Image): Promise<string> {
    console.log('parsing image');

    let puzzle = '';

    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            const rectangle = {
                left: col * image.cellWidth + image.cellWidth * .08,
                top: row * image.cellHeight + image.cellHeight * .08,
                width: image.cellWidth * .84,
                height: image.cellHeight * .84,
            };

            let { data: { text } } = await worker.recognize(image.buffer, { rectangle });
            text = text.trim();
            if (text.length != 1) text = '.';
            puzzle = `${puzzle}${text}`;
        }
    }

    return puzzle;
}

async function controller(): Promise<void> {
    const worker = await loadWorker();

    const files = readdirSync('sudokus').filter((file) => {
        return file.substring(file.length - 4) === '.png';
    });
    
    for (const file of files) {
        console.log('');

        const image = await processImage(`sudokus/${file}`);

        const puzzle = await parseImage(worker, image);
        console.log(puzzle);

        try {
            const solution = solve(puzzle, { emptyValue: '.' });
            console.log(solution);
            console.log('valid');
        } catch (error) {
            console.log('invalid', error);
        }
    }

    await worker.terminate();
}

controller().then(() => {
    console.log('done');
}) .catch((error) => {
    console.log('error', error);
    process.exit(1);
});
