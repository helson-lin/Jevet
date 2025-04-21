export interface ModelOptionItem {
    width: number;
    height: number;
    feedInput: string;
}

export interface ModelOption {
    [key: string]: ModelOptionItem
}

export const MODEL_OPTION: ModelOption = {
    'model.onnx': {
        width: 1024,
        height: 1024,
        feedInput: 'input'
    },
    'BEN2_Base.onnx': {
        width: 1024,
        height: 1024,
        feedInput: 'input.1'
    },
    'isnet-general-use.onnx': {
        width: 1024,
        height: 1024,
        feedInput: 'input_image'
    }
}