import * as ort from "onnxruntime-node";


import sharp from "sharp";

export async function processBEN2(inputBuffer: Buffer, session: ort.InferenceSession) {
    const image = await sharp(inputBuffer).resize(1024, 1024, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });

    const inputData = new Float32Array(3 * 1024 * 1024);

    for (let i = 0;
        i < image.data.length;
        i += 3) {
        const pixel = Math.floor(i / 3);

        inputData[pixel] = image.data[i] / 255;

        inputData[pixel + 1024 * 1024] = image.data[i + 1] / 255;
        inputData[pixel + 2 * 1024 * 1024] = image.data[i + 2] / 255;
    } const tensor = new ort.Tensor("float32", inputData, [1, 3, 1024, 1024]);
    const results = await session.run({ [session.inputNames[0]]: tensor });
    const maskData = results[session.outputNames[0]].data as Float32Array;
    const original = await sharp(inputBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const resizedMask = await sharp(Buffer.from(maskData.buffer), { raw: { width: 1024, height: 1024, channels: 1 } }).resize(original.info.width, original.info.height).raw().toBuffer();
    const outputBuffer = Buffer.alloc(original.data.length);
    for (let i = 0;
        i < original.data.length;
        i += 4) {
            outputBuffer[i] = original.data[i];
        outputBuffer[i + 1] = original.data[i + 1];
        outputBuffer[i + 2] = original.data[i + 2];
        outputBuffer[i + 3] = resizedMask[Math.floor(i / 4)];
    } return { buffer: outputBuffer, width: original.info.width, height: original.info.height };

}
