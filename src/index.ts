import { createWorker } from 'tesseract.js';
import Jimp from 'jimp';
import { readSync } from 'clipboardy';
import solve from '@mattflow/sudoku-solver';

// todo break this up into multiple functions
(async () => {
    // todo read from clipboard
    // or read multiple files from a folder?
    const thing = readSync();
    console.log(thing);

    const filename = process.argv[2];
    console.log(`optimizing ${filename}`);
    const image = await Jimp.read(filename);
    image.greyscale().contrast(1).autocrop().autocrop();
    image.write('processed.png');
    const buffer = await image.getBufferAsync(Jimp.MIME_PNG);

    const cellWidth = image.getWidth() / 9;
    const cellHeight = image.getHeight() / 9;

    console.log('loading worker');
    const worker = createWorker();
    await worker.load();
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    await worker.setParameters({
        tessedit_char_whitelist: '123456789',
    });

    console.log('parsing image');
    let puzzle = '';
    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            const rectangle = {
                left: col * cellWidth + cellWidth * .08,
                top: row * cellHeight + cellHeight * .08,
                width: cellWidth * .84,
                height: cellHeight * .84,
            };

            let { data: { text } } = await worker.recognize(buffer, { rectangle });
            text = text.trim();
            if (text.length != 1) text = '.';
            puzzle = `${puzzle}${text}`;
        }
    }

    await worker.terminate();

    console.log(puzzle);
    const result = solve(puzzle, { emptyValue: '.' });
    console.log(result);
    console.log('valid');
})().then(() => {
    console.log('done');
}) .catch((error) => {
    console.log('error', error);
    process.exit(1);
});
