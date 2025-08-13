const fs = require('fs');
const path = require('path');

/**
 * electron-builder afterPack hook
 * 确保 onnxruntime-node 原生模块在 Windows 打包后能正确工作
 */
module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') {
    return; // 只处理 Windows 平台
  }

  const { appOutDir, packager } = context;
  const resourcesPath = path.join(appOutDir, 'resources');
  const unpackedPath = path.join(resourcesPath, 'app.asar.unpacked');
  
  console.log('AfterPack: Checking onnxruntime-node for Windows...');
  console.log('App output directory:', appOutDir);
  console.log('Resources path:', resourcesPath);
  console.log('Unpacked path:', unpackedPath);

  // 检查 ASAR unpacked 目录中的 onnxruntime-node
  const ortUnpackedPath = path.join(unpackedPath, 'node_modules', 'onnxruntime-node');
  const ortBinaryPath = path.join(ortUnpackedPath, 'bin', 'napi-v3', 'win32', 'x64', 'onnxruntime_binding.node');

  if (fs.existsSync(ortBinaryPath)) {
    console.log('✓ Found onnxruntime_binding.node in unpacked directory');
    
    // 检查文件大小
    const stats = fs.statSync(ortBinaryPath);
    console.log(`✓ Binary size: ${stats.size} bytes`);
    
    if (stats.size === 0) {
      console.error('✗ Binary file is empty! This will cause runtime errors.');
      throw new Error('onnxruntime_binding.node is empty');
    }
    
    // 可选：复制到主目录作为备用
    const backupPath = path.join(appOutDir, 'onnxruntime_binding.node');
    try {
      fs.copyFileSync(ortBinaryPath, backupPath);
      console.log('✓ Created backup copy in main directory');
    } catch (e) {
      console.warn('⚠ Could not create backup copy:', e.message);
    }
    
  } else {
    console.error('✗ onnxruntime_binding.node not found in expected location:', ortBinaryPath);
    
    // 尝试查找其他可能的位置
    const searchPaths = [
      path.join(unpackedPath, 'node_modules', 'onnxruntime-node'),
      path.join(resourcesPath, 'node_modules', 'onnxruntime-node'),
    ];
    
    let found = false;
    for (const searchPath of searchPaths) {
      if (fs.existsSync(searchPath)) {
        console.log('Found onnxruntime-node at:', searchPath);
        try {
          const contents = listDirectoryRecursive(searchPath, 3); // 限制递归深度
          console.log('Contents:', JSON.stringify(contents, null, 2));
        } catch (e) {
          console.log('Error listing contents:', e.message);
        }
        found = true;
      }
    }
    
    if (!found) {
      console.error('✗ onnxruntime-node module not found anywhere!');
      throw new Error('onnxruntime-node module missing from build');
    }
  }
  
  console.log('AfterPack: onnxruntime-node check completed');
};

/**
 * 递归列出目录内容（限制深度避免无限递归）
 */
function listDirectoryRecursive(dirPath, maxDepth = 2) {
  if (maxDepth <= 0) return '[max depth reached]';
  
  try {
    const items = fs.readdirSync(dirPath);
    const result = {};
    
    for (const item of items.slice(0, 10)) { // 限制每层最多10个项目
      const itemPath = path.join(dirPath, item);
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory()) {
        result[item + '/'] = listDirectoryRecursive(itemPath, maxDepth - 1);
      } else {
        result[item] = `${stat.size} bytes`;
      }
    }
    
    return result;
  } catch (e) {
    return `[error: ${e.message}]`;
  }
}
