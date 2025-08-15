export default {
  // IPC 处理器相关
  ipc: {
    initStart: '图像处理IPC处理器初始化开始',
    initComplete: '图像处理IPC处理器初始化完成',
    sessionCacheCleared: '会话缓存已清理',
    sessionCacheClearFailed: '清理会话缓存失败',
    gcExecuted: '垃圾回收已执行',
    gcNotAvailable: '垃圾回收不可用或非Windows平台'
  },

  // 图像压缩相关
  imageCompress: {
    start: '开始图片压缩处理',
    success: '成功并行处理了{count}张图片',
    failed: '图片压缩处理失败'
  },

  // 背景移除相关
  removeBg: {
    start: '开始抠图处理',
    batchConfig: '分批处理配置',
    batchStart: '开始处理第{batch}批',
    batchComplete: '第{batch}批处理完成',
    singleImageFailed: '单张图片处理失败 {uid}',
    gcAfterBatch: '批次{batch}后执行垃圾回收',
    complete: '抠图处理完成',
    failed: '抠图处理失败',
    
    // 任务处理相关
    taskStart: '开始处理抠图任务 {uid}',
    taskComplete: '抠图任务完成 {uid}',
    taskFailed: '抠图任务失败 {uid}',
    
    // 模型相关
    modelConfigGet: '获取模型配置 {uid}',
    modelPathDetermined: '模型路径确定 {uid}',
    modelLoaded: '模型加载完成 {uid}',
    modelInputMetadataFailed: '读取模型输入元数据失败 {uid}',
    
    // 预处理相关
    imagePreprocessStart: '开始图像预处理 {uid}',
    imageReadComplete: '图像读取完成 {uid}',
    channelAbnormal: '通道数异常 {uid}',
    dataPreprocessStart: '开始预处理图像数据 {uid}',
    inputMetadataFailed: '读取输入元数据失败 {uid}',
    
    // 推理相关
    inferenceStart: '开始ONNX推理 {uid}',
    inferenceSuccess: 'ONNX推理成功 {uid}',
    inferenceAlternativeSuccess: '备选格式推理成功 {uid}',
    preferredFormatFailed: '首选格式推理失败，尝试备选格式 {uid}',
    allFormatsFailed: '所有格式推理失败 {uid}',
    inferenceFormatFailed: 'ONNX推理失败：无法识别正确的输入格式',
    noOutputTensor: 'ONNX 推理未返回任何输出张量',
    
    // 后处理相关
    postProcessStart: '开始后处理 {uid}',
    maskExtractComplete: '掩码提取完成 {uid}',
    saveCutoutResult: '保存抠图结果 {uid}',
    restoreOriginalSize: '恢复原始尺寸 {uid}',
    originalImageSize: '原图尺寸 {uid}',
    modelInputSizeCompressed: '模型输入尺寸过大，已压缩 {uid}',
    
    // 优化配置相关
    optimizedSessionConfig: '使用优化的会话配置 {uid}',
    
    // 垃圾回收相关
    executeGC: '执行垃圾回收 {uid}',
    executeFinalGC: '执行最终垃圾回收 {uid}'
  },

  // CUDA 检测相关
  cuda: {
    checkStart: '开始CUDA状态检查',
    checkComplete: 'CUDA状态检查完成',
    checkFailed: 'CUDA状态检查失败',
    checkFailed2: 'CUDA 检查失败',
    providerDetection: 'CUDA 执行提供程序检测 {uid}',
    envDetectionComplete: 'CUDA 环境检测完成 {uid}',
    envDetectionException: 'CUDA 环境检测异常 {uid}',
    functionVerificationTest: 'CUDA 功能验证测试 {uid}',
    functionVerificationFailed: 'CUDA 功能验证失败 {uid}',
    notAvailable: 'CUDA 不可用，将从执行提供程序中移除 {uid}',
    
    // 错误消息
    providerNotAvailable: 'CUDA 执行提供程序不可用。可能原因：CUDA 驱动未安装、版本不兼容、或 cuDNN 缺失',
    verificationFailed: 'CUDA 功能验证失败: {error}',
    detectionException: 'CUDA 环境检测异常: {error}',
    
    // 推荐解决方案
    recommendations: {
      envNormal: 'CUDA 环境正常，GPU 加速可用',
      checkDriver: '检查 NVIDIA 显卡驱动程序是否已安装',
      checkCuda: '确保 CUDA >= 11.4 已正确安装',
      checkCudnn: '确保 cuDNN >= 8.2 已正确安装',
      restart: '重启应用程序或计算机',
      reinstall: '如果问题持续存在，请尝试重新安装 CUDA 和 cuDNN',
      checkOnnx: '检查 onnxruntime-node 是否正确安装',
      runDiagnosis: '运行 npm run check:ort 进行诊断',
      reinstallDeps: '尝试重新安装依赖: npm run reinstall'
    }
  },

  // 会话缓存相关
  sessionCache: {
    useCached: '使用缓存会话 {uid}',
    createNew: '创建新会话 {uid}',
    createSuccess: '会话创建成功，实际执行提供程序 {uid}',
    releaseOldFailed: '释放旧会话失败',
    releaseSessionFailed: '释放会话失败',
    removeOld: '移除旧会话',
    cached: '会话已缓存 {uid}',
    clearStart: '开始清理会话缓存',
    cleared: '会话缓存已清理'
  },

  // ONNX Runtime 相关
  onnxRuntime: {
    loadSuccess: 'onnxruntime-node 加载成功 {uid}',
    firstLoadFailed: 'onnxruntime-node 首次加载失败 {uid}',
    windowsPathLoadSuccess: 'Windows路径加载成功 {uid}',
    windowsPathLoadFailed: 'Windows路径加载失败 {uid}',
    loadFailed: '无法加载 onnxruntime-node，请运行 npm run check:ort 进行诊断'
  },

  // 会话创建相关
  session: {
    createFailed: '会话创建失败，尝试CPU回退 {uid}',
    cpuFallbackSuccess: 'CPU回退会话创建成功 {uid}',
    cpuFallbackFailed: 'CPU回退也失败 {uid}',
    createCompletelyFailed: '会话创建完全失败：原始错误 [{originalError}]，CPU回退错误 [{fallbackError}]',
    userGpuNotUsed: '用户启用了GPU但未使用CUDA {uid}',
    gpuNotEffective: 'GPU加速未生效，性能可能受影响',
    normalCpuMode: '正常CPU处理模式',
    checkCudaInstallation: '请检查CUDA安装：1) NVIDIA驱动程序 2) CUDA >= 11.4 3) cuDNN >= 8.2'
  },

  // 内存监控相关
  memory: {
    startProcessing: '开始处理',
    sessionCreationBefore: '会话创建前',
    sessionCreationAfter: '会话创建后',
    imageProcessingBefore: '图像处理前',
    imageProcessingAfter: '图像处理后',
    preprocessingBefore: '预处理前',
    inferenceBefore: '推理前',
    inferenceAfter: '推理后',
    postProcessingBefore: '后处理前',
    saveCompleted: '保存完成',
    taskCompleted: '任务完成'
  }
};
