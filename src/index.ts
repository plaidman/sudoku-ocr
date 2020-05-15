import { createWorker } from 'tesseract.js';
import Jimp from 'jimp';

const filename = process.argv[2];
console.log(filename);

let puzzle = '';

(async () => {
    const image = await Jimp.read(filename);
    image.greyscale().contrast(1).autocrop().autocrop();
    image.write('processed.png');
    const buffer = await image.getBufferAsync(Jimp.MIME_PNG);

    const cellWidth = image.getWidth() / 9;
    const cellHeight = image.getHeight() / 9;

    const worker = createWorker();
    console.log('loading 1/4');
    await worker.load();
    console.log('loading 2/4');
    await worker.loadLanguage('eng');
    console.log('loading 3/4');
    await worker.initialize('eng');
    console.log('loading 4/4');
    await worker.setParameters({
        tessedit_char_whitelist: '123456789',
    });

    console.log('parsing');
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
            console.log(`${row}, ${col}: ${text}`);
        }
    }

    await worker.terminate();
    console.log(puzzle);
})().then(() => {
    console.log('done');
}) .catch((error) => {
    console.log('error', error);
});
