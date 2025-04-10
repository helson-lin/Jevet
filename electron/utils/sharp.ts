import type { Sharp } from "sharp";
import sharp from "sharp";

type INPUT_ACCEPT_TYPE = Buffer | ArrayBuffer | Uint8Array | Uint8ClampedArray | Int8Array | Uint16Array | Int16Array | Uint32Array | Int32Array | Float32Array | Float64Array | string;
type INPUT_TYPE = Array<INPUT_ACCEPT_TYPE> | INPUT_ACCEPT_TYPE
class SharpExtend {
    sharp: Sharp
    constructor(INPUT_FILE: INPUT_TYPE) {
        this.sharp = sharp(INPUT_FILE)
    }

    resize () {
        this.sharp.resize()
        return this;
    }
}