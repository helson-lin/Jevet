const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * 检查构建后的应用是否包含必要的原生模块
 */
function checkBuild() {
  console.log('Checking build outputs...');
  
  // 查找最新的构建输出
  const releaseDir = findReleaseDir();
  if (!releaseDir) {
    console.error('✗ No release directory found. Please run "npm run app:dist" first.');
    return;
  }
  
  console.log(`✓ Found release directory: ${releaseDir}`);
  
  // 检查 Windows 构建
  checkWindowsBuild(releaseDir);
  
  console.log('\nBuild check completed!');
}

function findReleaseDir() {
  const baseReleaseDir = path.join(process.cwd(), 'release');
  if (!fs.existsSync(baseReleaseDir)) {
    return null;
  }
  
  // 找到最新的版本目录
  const versions = fs.readdirSync(baseReleaseDir)
    .filter(name => fs.statSync(path.join(baseReleaseDir, name)).isDirectory())
    .sort()
    .reverse();
    
  return versions.length > 0 ? path.join(baseReleaseDir, versions[0]) : null;
}

function checkWindowsBuild(releaseDir) {
  console.log('\n--- Checking Windows Build ---');
  
  // 查找 Windows 可执行文件
  const winFiles = fs.readdirSync(releaseDir)
    .filter(name => name.includes('Windows') && name.endsWith('.exe'));
    
  if (winFiles.length === 0) {
    console.log('⚠ No Windows executable found');
    return;
  }
  
  console.log(`✓ Found Windows executable: ${winFiles[0]}`);
  
  // 查找 unpacked 目录
  const unpackedDirs = fs.readdirSync(releaseDir)
    .filter(name => name.includes('win-unpacked'))
    .map(name => path.join(releaseDir, name));
    
  if (unpackedDirs.length === 0) {
    console.log('⚠ No win-unpacked directory found. Checking installer only.');
    return;
  }
  
  const unpackedDir = unpackedDirs[0];
  console.log(`✓ Found unpacked directory: ${path.basename(unpackedDir)}`);
  
  // 检查关键文件
  checkCriticalFiles(unpackedDir);
}

function checkCriticalFiles(unpackedDir) {
  const checks = [
    {
      name: 'Main executable',
      path: path.join(unpackedDir, 'Jevet.exe'),
      required: true
    },
    {
      name: 'Resources directory',
      path: path.join(unpackedDir, 'resources'),
      required: true
    },
    {
      name: 'ASAR archive',
      path: path.join(unpackedDir, 'resources', 'app.asar'),
      required: true
    },
    {
      name: 'ASAR unpacked directory',
      path: path.join(unpackedDir, 'resources', 'app.asar.unpacked'),
      required: true
    },
    {
      name: 'Sharp module (unpacked)',
      path: path.join(unpackedDir, 'resources', 'app.asar.unpacked', 'node_modules', 'sharp'),
      required: true
    },
    {
      name: 'ONNX Runtime module (unpacked)',
      path: path.join(unpackedDir, 'resources', 'app.asar.unpacked', 'node_modules', 'onnxruntime-node'),
      required: true
    },
    {
      name: 'ONNX Runtime native binding',
      path: path.join(unpackedDir, 'resources', 'app.asar.unpacked', 'node_modules', 'onnxruntime-node', 'bin', 'napi-v3', 'win32', 'x64', 'onnxruntime_binding.node'),
      required: true
    }
  ];
  
  console.log('\n--- Critical Files Check ---');
  let allPassed = true;
  
  for (const check of checks) {
    const exists = fs.existsSync(check.path);
    const status = exists ? '✓' : (check.required ? '✗' : '⚠');
    console.log(`${status} ${check.name}: ${exists ? 'Found' : 'Missing'}`);
    
    if (exists && check.name === 'ONNX Runtime native binding') {
      const stats = fs.statSync(check.path);
      console.log(`  └─ Size: ${stats.size} bytes`);
      if (stats.size === 0) {
        console.log('  └─ ✗ Warning: File is empty!');
        allPassed = false;
      }
    }
    
    if (!exists && check.required) {
      allPassed = false;
    }
  }
  
  if (allPassed) {
    console.log('\n✅ All critical files found! The build should work correctly.');
  } else {
    console.log('\n❌ Some critical files are missing. The app may not work correctly.');
    console.log('\nTroubleshooting steps:');
    console.log('1. Run: npm run reinstall');
    console.log('2. Run: npm run setup:win');
    console.log('3. Run: npm run app:dist:debug');
  }
}

// 运行检查
if (require.main === module) {
  checkBuild();
}

module.exports = { checkBuild };
