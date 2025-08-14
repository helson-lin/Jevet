<template>
  <div class="log-viewer-container p-6 h-full flex flex-col bg-zinc-50 dark:bg-zinc-900">
    <!-- 头部工具栏 -->
    <div class="bg-white dark:bg-zinc-800 rounded-lg p-4 mb-4 shadow-sm border border-zinc-200 dark:border-zinc-700">
      <div class="flex justify-between items-center mb-4">
        <h1 class="text-xl font-semibold text-zinc-800 dark:text-zinc-200">
          📋 {{ $t('logs.title') }}
        </h1>
        <div class="flex gap-2">
          <a-select 
            v-model:value="selectedLevel" 
            :placeholder="$t('logs.level')"
            class="w-32"
            @change="loadLogs"
          >
            <a-select-option value="">{{ $t('logs.all') }}</a-select-option>
            <a-select-option value="DEBUG">{{ $t('logs.debug') }}</a-select-option>
            <a-select-option value="INFO">{{ $t('logs.info') }}</a-select-option>
            <a-select-option value="WARN">{{ $t('logs.warn') }}</a-select-option>
            <a-select-option value="ERROR">{{ $t('logs.error') }}</a-select-option>
          </a-select>
          
          <a-input-search
            v-model:value="searchQuery"
            :placeholder="$t('logs.search')"
            class="w-64"
            @search="searchLogs"
            @change="handleSearchChange"
          />
          
          <a-button @click="loadLogs" :loading="loading" class="hover:opacity-90 transition-opacity">
            <template #icon><ReloadOutlined /></template>
            <span>{{ $t('logs.refresh') }}</span>
          </a-button>
          
          <a-button @click="exportLogs" class="hover:opacity-90 transition-opacity">
            <template #icon><DownloadOutlined /></template>
            <span>{{ $t('logs.export') }}</span>
          </a-button>
          
          <a-button @click="clearLogs" danger class="hover:opacity-90 transition-opacity">
            <template #icon><DeleteOutlined /></template>
            <span>{{ $t('logs.clear') }}</span>
          </a-button>
        </div>
      </div>

      <!-- API状态检查 -->
      <div v-if="!isElectronAPIAvailable" class="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <div class="flex items-start justify-between">
          <div class="flex items-center gap-2 text-red-600 dark:text-red-400">
            <span class="text-lg">⚠️</span>
            <div>
              <div class="font-medium">ElectronAPI 不可用</div>
              <div class="text-sm">请重启应用以加载最新的预加载脚本</div>
              <div class="text-xs mt-1">
                调试信息: {{ debugInfo }}
              </div>
            </div>
          </div>
          <a-button 
            size="small" 
            @click="checkApiAndRetry"
            class="flex-shrink-0">
            重试检查
          </a-button>
        </div>
      </div>

      <!-- 日志统计 -->
      <div class="grid grid-cols-4 gap-4">
        <div class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
          <div class="text-sm text-blue-600 dark:text-blue-400">总日志数</div>
          <div class="text-lg font-semibold text-blue-700 dark:text-blue-300">{{ stats.total }}</div>
        </div>
        <div class="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <div class="text-sm text-yellow-600 dark:text-yellow-400">警告</div>
          <div class="text-lg font-semibold text-yellow-700 dark:text-yellow-300">{{ stats.warn }}</div>
        </div>
        <div class="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
          <div class="text-sm text-red-600 dark:text-red-400">错误</div>
          <div class="text-lg font-semibold text-red-700 dark:text-red-300">{{ stats.error }}</div>
        </div>
        <div class="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
          <div class="text-sm text-green-600 dark:text-green-400">日志目录</div>
          <div class="text-xs font-mono text-green-700 dark:text-green-300 truncate" :title="logDirectory || '未获取'">
            {{ logDirectory || (isElectronAPIAvailable ? '加载中...' : 'API不可用') }}
          </div>
        </div>
      </div>
    </div>

    <!-- 日志内容 -->
    <div class="flex-1 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm overflow-hidden">
      <div class="h-full flex flex-col">
        <!-- 日志表格头部 -->
        <div class="bg-zinc-50 dark:bg-zinc-700/50 px-4 py-3 border-b border-zinc-200 dark:border-zinc-600 flex justify-between items-center">
          <span class="text-sm font-medium text-zinc-600 dark:text-zinc-300">
            {{ filteredLogs.length }} 条日志
          </span>
          <a-switch 
            v-model:checked="autoRefresh" 
            checked-children="自动刷新" 
            un-checked-children="手动刷新"
            @change="handleAutoRefreshChange"
          />
        </div>
        
        <!-- 日志列表 -->
        <div class="flex-1 overflow-auto">
          <div v-if="loading" class="flex justify-center items-center h-32">
            <a-spin size="large" tip="加载日志中..." />
          </div>
          
          <div v-else-if="filteredLogs.length === 0" class="flex justify-center items-center h-32 text-zinc-500 dark:text-zinc-400">
            <div class="text-center">
              <div class="text-4xl mb-2">📋</div>
              <div class="text-sm">暂无日志数据</div>
            </div>
          </div>
          
          <div v-else class="space-y-2 p-4">
            <div
              v-for="(log, index) in filteredLogs"
              :key="index"
              class="log-entry p-3 rounded-lg border-l-4 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-all duration-200 hover:shadow-sm"
              :class="getLogLevelClass(log.level)"
            >
              <div class="flex items-start justify-between">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-2">
                    <span class="log-level-badge px-2 py-1 rounded-full text-xs font-medium"
                          :class="getLogLevelBadgeClass(log.level)">
                      {{ log.level }}
                    </span>
                    <span class="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                      {{ log.category }}
                    </span>
                    <span class="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-700 px-2 py-1 rounded">
                      {{ formatTime(log.timestamp) }}
                    </span>
                  </div>
                  
                  <div class="text-sm text-zinc-800 dark:text-zinc-200 mb-2 leading-relaxed">
                    {{ log.message }}
                  </div>
                  
                  <div v-if="log.data && Object.keys(log.data).length > 0" 
                       class="text-xs bg-zinc-100 dark:bg-zinc-700 p-3 rounded-lg font-mono overflow-x-auto border border-zinc-200 dark:border-zinc-600">
                    <pre class="text-zinc-700 dark:text-zinc-300">{{ JSON.stringify(log.data, null, 2) }}</pre>
                  </div>
                  
                  <div v-if="log.stack" 
                       class="text-xs text-red-600 dark:text-red-400 mt-2 font-mono">
                    <details class="bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-200 dark:border-red-800">
                      <summary class="cursor-pointer hover:text-red-700 dark:hover:text-red-300 font-medium mb-1">
                        🔍 堆栈信息
                      </summary>
                      <pre class="mt-2 whitespace-pre-wrap text-red-700 dark:text-red-300 text-xs">{{ log.stack }}</pre>
                    </details>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { message } from 'ant-design-vue'
import { ReloadOutlined, DownloadOutlined, DeleteOutlined } from '@ant-design/icons-vue'

interface LogEntry {
  timestamp: string
  level: string
  category: string
  message: string
  data?: any
  stack?: string
}

const logs = ref<LogEntry[]>([])
const loading = ref(false)
const selectedLevel = ref<string>('')
const searchQuery = ref<string>('')
const autoRefresh = ref(false)
const logDirectory = ref<string>('')
let refreshInterval: NodeJS.Timeout | null = null

// 检查 ElectronAPI 可用性的辅助函数
const checkElectronAPI = (): boolean => {
  if (typeof window === 'undefined' || !window.electronAPI) {
    console.error('ElectronAPI 检查失败:', {
      windowExists: typeof window !== 'undefined',
      electronAPI: typeof window !== 'undefined' ? !!window.electronAPI : false,
      ipcRenderer: typeof window !== 'undefined' ? !!window.ipcRenderer : false,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'undefined',
      isElectron: typeof navigator !== 'undefined' ? /Electron/.test(navigator.userAgent) : false
    })
    message.error('ElectronAPI 不可用，请重启应用或确保在 Electron 环境中运行')
    return false
  }
  return true
}

// 计算属性：安全地检查 ElectronAPI 状态
const isElectronAPIAvailable = computed(() => {
  return typeof window !== 'undefined' && !!window.electronAPI
})

// 计算属性：获取调试信息
const debugInfo = computed(() => {
  if (typeof window === 'undefined') {
    return 'Window对象不可用'
  }
  
  return `ElectronAPI=${!!window.electronAPI}, IpcRenderer=${!!window.ipcRenderer}, Electron环境=${typeof navigator !== 'undefined' ? /Electron/.test(navigator.userAgent) : false}`
})

// 监听API状态变化，当API变为可用时自动加载
watch(isElectronAPIAvailable, (newVal, oldVal) => {
  if (newVal && !oldVal) {
    console.log('ElectronAPI 变为可用，开始加载日志')
    loadLogs()
    getLogDirectory()
  }
}, { immediate: false })

// 手动检查API状态并重试
const checkApiAndRetry = () => {
  console.log('手动检查API状态')
  
  // 强制重新检查计算属性
  if (isElectronAPIAvailable.value) {
    message.success('API已可用，开始加载日志')
    loadLogs()
    getLogDirectory()
  } else {
    message.warning('API仍不可用，请尝试刷新页面(Ctrl+R)或重启应用')
    console.log('当前API状态:', debugInfo.value)
  }
}

// 统计信息
const stats = computed(() => ({
  total: logs.value.length,
  warn: logs.value.filter(log => log.level === 'WARN').length,
  error: logs.value.filter(log => log.level === 'ERROR').length,
  info: logs.value.filter(log => log.level === 'INFO').length
}))

// 过滤后的日志
const filteredLogs = computed(() => {
  let filtered = logs.value

  // 级别过滤
  if (selectedLevel.value) {
    filtered = filtered.filter(log => log.level === selectedLevel.value)
  }

  // 搜索过滤
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(log => 
      log.message.toLowerCase().includes(query) ||
      log.category.toLowerCase().includes(query) ||
      (log.data && JSON.stringify(log.data).toLowerCase().includes(query))
    )
  }

  return filtered
})

// 获取日志级别样式
const getLogLevelClass = (level: string) => {
  switch (level) {
    case 'ERROR':
      return 'border-red-400 bg-red-50 dark:bg-red-900/10 shadow-red-100 dark:shadow-red-900/20'
    case 'WARN':
      return 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/10 shadow-yellow-100 dark:shadow-yellow-900/20'
    case 'INFO':
      return 'border-blue-400 bg-blue-50 dark:bg-blue-900/10 shadow-blue-100 dark:shadow-blue-900/20'
    case 'DEBUG':
      return 'border-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 shadow-zinc-100 dark:shadow-zinc-800/20'
    default:
      return 'border-zinc-300 bg-zinc-50 dark:bg-zinc-800/50'
  }
}

// 获取日志级别徽章样式
const getLogLevelBadgeClass = (level: string) => {
  switch (level) {
    case 'ERROR':
      return 'bg-red-500 text-white shadow-sm hover:bg-red-600 transition-colors'
    case 'WARN':
      return 'bg-yellow-500 text-white shadow-sm hover:bg-yellow-600 transition-colors'
    case 'INFO':
      return 'bg-blue-500 text-white shadow-sm hover:bg-blue-600 transition-colors'
    case 'DEBUG':
      return 'bg-zinc-500 text-white shadow-sm hover:bg-zinc-600 transition-colors'
    default:
      return 'bg-zinc-400 text-white shadow-sm hover:bg-zinc-500 transition-colors'
  }
}

// 格式化时间
const formatTime = (timestamp: string) => {
  return new Date(timestamp).toLocaleString('zh-CN')
}

// 加载日志
const loadLogs = async () => {
  if (!checkElectronAPI()) return
  
  loading.value = true
  try {
    const result = await window.electronAPI.invoke('logger:getCurrentLogs', 1000)
    if (result.success) {
      logs.value = result.data.reverse() // 最新的在前面
    } else {
      message.error(`加载日志失败: ${result.error}`)
    }
  } catch (error) {
    message.error(`加载日志失败: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    loading.value = false
  }
}

// 搜索日志
const searchLogs = async () => {
  if (!checkElectronAPI()) return
  
  if (!searchQuery.value.trim()) {
    await loadLogs()
    return
  }

  loading.value = true
  try {
    const result = await window.electronAPI.invoke('logger:searchLogs', searchQuery.value, selectedLevel.value, 1000)
    if (result.success) {
      logs.value = result.data.reverse()
    } else {
      message.error(`搜索日志失败: ${result.error}`)
    }
  } catch (error) {
    message.error(`搜索日志失败: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    loading.value = false
  }
}

// 处理搜索输入变化
const handleSearchChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (!target.value.trim()) {
    loadLogs()
  }
}

// 导出日志
const exportLogs = async () => {
  if (!checkElectronAPI()) return
  
  try {
    const result = await window.electronAPI.invoke('logger:exportLogs')
    if (result.success) {
      message.success(result.data)
    } else {
      message.error(`导出日志失败: ${result.error}`)
    }
  } catch (error) {
    message.error(`导出日志失败: ${error instanceof Error ? error.message : String(error)}`)
  }
}

// 清空日志
const clearLogs = async () => {
  if (!checkElectronAPI()) return
  
  try {
    const result = await window.electronAPI.invoke('logger:clearAllLogs')
    if (result.success) {
      message.success('日志已清空')
      logs.value = []
    } else {
      message.error(`清空日志失败: ${result.error}`)
    }
  } catch (error) {
    message.error(`清空日志失败: ${error instanceof Error ? error.message : String(error)}`)
  }
}

// 处理自动刷新切换
const handleAutoRefreshChange = (checked: boolean) => {
  if (checked) {
    refreshInterval = setInterval(loadLogs, 5000) // 每5秒刷新
  } else {
    if (refreshInterval) {
      clearInterval(refreshInterval)
      refreshInterval = null
    }
  }
}

// 获取日志目录
const getLogDirectory = async () => {
  if (!checkElectronAPI()) return
  
  try {
    const result = await window.electronAPI.invoke('logger:getLogDirectory')
    if (result.success) {
      logDirectory.value = result.data
    } else {
      console.error('获取日志目录失败:', result.error)
      message.error(`获取日志目录失败: ${result.error}`)
    }
  } catch (error) {
    console.error('获取日志目录失败:', error)
    message.error(`获取日志目录失败: ${error instanceof Error ? error.message : String(error)}`)
  }
}

onMounted(() => {
  // 延迟一下确保DOM完全加载
  setTimeout(() => {
    console.log('LogViewer mounted - API状态检查:', {
      windowExists: typeof window !== 'undefined',
      electronAPI: typeof window !== 'undefined' ? !!window.electronAPI : false,
      ipcRenderer: typeof window !== 'undefined' ? !!window.ipcRenderer : false
    })
    
    if (isElectronAPIAvailable.value) {
      loadLogs()
      getLogDirectory()
    } else {
      console.warn('ElectronAPI 不可用，跳过初始化加载')
    }
  }, 100)
})

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})
</script>

<style scoped>

.log-entry {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.log-entry:hover {
  transform: translateX(2px);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

pre {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.4;
}

/* 自定义滚动条样式 */
.log-viewer-container ::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.log-viewer-container ::-webkit-scrollbar-track {
  background-color: #f4f4f5;
  border-radius: 0.5rem;
}

.dark .log-viewer-container ::-webkit-scrollbar-track {
  background-color: #3f3f46;
}

.log-viewer-container ::-webkit-scrollbar-thumb {
  background-color: #d4d4d8;
  border-radius: 0.5rem;
}

.dark .log-viewer-container ::-webkit-scrollbar-thumb {
  background-color: #6b7280;
}

.log-viewer-container ::-webkit-scrollbar-thumb:hover {
  background-color: #a1a1aa;
}

.dark .log-viewer-container ::-webkit-scrollbar-thumb:hover {
  background-color: #9ca3af;
}

/* 动画效果 */
.log-entry {
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 按钮内容对齐 - 仅影响日志查看器页面 */
.log-viewer-container .ant-btn {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 6px !important;
  min-height: 32px !important;
}

.log-viewer-container .ant-btn .anticon {
  display: flex !important;
  align-items: center !important;
  margin-right: 0 !important;
}

.log-viewer-container .ant-btn span {
  display: inline-flex !important;
  align-items: center !important;
  line-height: 1.2 !important;
  vertical-align: middle !important;
}

.log-viewer-container .ant-btn-loading .anticon {
  margin-right: 0 !important;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .log-viewer-container {
    padding: 1rem;
  }
  
  .grid-cols-4 {
    grid-template-columns: repeat(1, minmax(0, 1fr));
    gap: 0.5rem;
  }
}
</style>
