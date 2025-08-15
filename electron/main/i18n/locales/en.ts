export default {
  // IPC handlers
  ipc: {
    initStart: 'Image processing IPC processor initialization starts',
    initComplete: 'Image processing IPC processor initialization completed',
    sessionCacheCleared: 'Session cache cleared',
    sessionCacheClearFailed: 'Failed to clear session cache',
    gcExecuted: 'GC has been performed',
    gcNotAvailable: 'GC is not available or not on Windows platform'
  },

  // Image compression
  imageCompress: {
    start: 'Start image compression processing',
    success: 'Successfully processed {count} images in parallel',
    failed: 'Image compression processing failed'
  },

  // Background removal
  removeBg: {
    start: 'Start image background removal processing',
    batchConfig: 'Batch processing configuration',
    batchStart: 'Start processing batch {batch}',
    batchComplete: 'Batch {batch} processing completed',
    singleImageFailed: 'Single image processing failed {uid}',
    gcAfterBatch: 'After batch {batch}, garbage collection is performed',
    complete: 'Image background removal processing completed',
    failed: 'Cutout processing failed',
    
    // Task processing
    taskStart: 'Start processing cutout task {uid}',
    taskComplete: 'Cutout task completed {uid}',
    taskFailed: 'Cutout task failed {uid}',
    
    // Model related
    modelConfigGet: 'Get model configuration {uid}',
    modelPathDetermined: 'Model path determined {uid}',
    modelLoaded: 'Model loaded successfully {uid}',
    modelInputMetadataFailed: 'Failed to read model input metadata {uid}',
    
    // Preprocessing
    imagePreprocessStart: 'Start image preprocessing {uid}',
    imageReadComplete: 'Image read completed {uid}',
    channelAbnormal: 'Channel number abnormal {uid}',
    dataPreprocessStart: 'Start preprocessing image data {uid}',
    inputMetadataFailed: 'Failed to read input metadata {uid}',
    
    // Inference
    inferenceStart: 'Start ONNX inference {uid}',
    inferenceSuccess: 'ONNX inference successfully {uid}',
    inferenceAlternativeSuccess: 'Alternative format inference successfully {uid}',
    preferredFormatFailed: 'Preferred format inference failed, try alternative format {uid}',
    allFormatsFailed: 'All formats inference failed {uid}',
    inferenceFormatFailed: 'ONNX inference failed: cannot recognize the correct input format',
    noOutputTensor: 'ONNX inference did not return any output tensor',
    
    // Post-processing
    postProcessStart: 'Start post-processing {uid}',
    maskExtractComplete: 'Mask extraction completed {uid}',
    saveCutoutResult: 'Save cutout result {uid}',
    restoreOriginalSize: 'Restore original size {uid}',
    originalImageSize: 'Original image size {uid}',
    modelInputSizeCompressed: 'Model input size too large, compressed {uid}',
    
    // Optimized configuration
    optimizedSessionConfig: 'Use optimized session configuration {uid}',
    
    // Garbage collection
    executeGC: 'Execute garbage collection {uid}',
    executeFinalGC: 'Execute final garbage collection {uid}'
  },

  // CUDA detection
  cuda: {
    checkStart: 'Start CUDA status check',
    checkComplete: 'CUDA status check completed',
    checkFailed: 'CUDA status check failed',
    checkFailed2: 'CUDA check failed',
    providerDetection: 'CUDA execution provider detection {uid}',
    envDetectionComplete: 'CUDA environment detection completed {uid}',
    envDetectionException: 'CUDA environment detection exception {uid}',
    functionVerificationTest: 'CUDA function verification test {uid}',
    functionVerificationFailed: 'CUDA function verification failed {uid}',
    notAvailable: 'CUDA is not available, it will be removed from the execution provider {uid}',
    
    // Error messages
    providerNotAvailable: 'CUDA execution provider is not available. Possible reasons: CUDA driver not installed, version incompatible, or cuDNN missing',
    verificationFailed: 'CUDA function verification failed: {error}',
    detectionException: 'CUDA environment detection exception: {error}',
    
    // Recommendations
    recommendations: {
      envNormal: 'CUDA environment is normal, GPU acceleration is available',
      checkDriver: 'Check if NVIDIA GPU driver is installed',
      checkCuda: 'Ensure CUDA >= 11.4 is correctly installed',
      checkCudnn: 'Ensure cuDNN >= 8.2 is correctly installed',
      restart: 'Restart the application or computer',
      reinstall: 'If the problem persists, try reinstalling CUDA and cuDNN',
      checkOnnx: 'Check if onnxruntime-node is correctly installed',
      runDiagnosis: 'Run npm run check:ort for diagnosis',
      reinstallDeps: 'Try reinstalling dependencies: npm run reinstall'
    }
  },

  // Session cache
  sessionCache: {
    useCached: 'Use cached session {uid}',
    createNew: 'Create new session {uid}',
    createSuccess: 'Session created successfully, actual execution provider {uid}',
    releaseOldFailed: 'Failed to release old session',
    releaseSessionFailed: 'Failed to release session',
    removeOld: 'Remove old session',
    cached: 'Session cached {uid}',
    clearStart: 'Start clearing session cache',
    cleared: 'Session cache cleared'
  },

  // ONNX Runtime
  onnxRuntime: {
    loadSuccess: 'onnxruntime-node loaded successfully {uid}',
    firstLoadFailed: 'onnxruntime-node first load failed {uid}',
    windowsPathLoadSuccess: 'Windows path loaded successfully {uid}',
    windowsPathLoadFailed: 'Windows path loaded failed {uid}',
    loadFailed: 'Failed to load onnxruntime-node, please run npm run check:ort for diagnosis'
  },

  // Session creation
  session: {
    createFailed: 'Session creation failed, try CPU fallback {uid}',
    cpuFallbackSuccess: 'CPU fallback session created successfully {uid}',
    cpuFallbackFailed: 'CPU fallback also failed {uid}',
    createCompletelyFailed: 'Session creation completely failed: original error [{originalError}], CPU fallback error [{fallbackError}]',
    userGpuNotUsed: 'User enabled GPU but did not use CUDA {uid}',
    gpuNotEffective: 'GPU acceleration not effective, performance may be affected',
    normalCpuMode: 'Normal CPU processing mode',
    checkCudaInstallation: 'Please check CUDA installation: 1) NVIDIA driver 2) CUDA >= 11.4 3) cuDNN >= 8.2'
  },

  // Memory monitoring
  memory: {
    startProcessing: 'Start processing',
    sessionCreationBefore: 'Session creation before',
    sessionCreationAfter: 'Session creation after',
    imageProcessingBefore: 'Image processing before',
    imageProcessingAfter: 'Image processing after',
    preprocessingBefore: 'Preprocessing before',
    inferenceBefore: 'Inference before',
    inferenceAfter: 'Inference after',
    postProcessingBefore: 'Post-processing before',
    saveCompleted: 'Save completed',
    taskCompleted: 'Task completed'
  }
};
