import zh from './locales/zh';
import en from './locales/en';

type MessageKeys = keyof typeof zh;
type NestedMessageKeys<T> = T extends Record<string, any>
  ? {
      [K in keyof T]: T[K] extends Record<string, any>
        ? `${K & string}.${NestedMessageKeys<T[K]> & string}`
        : K & string;
    }[keyof T]
  : never;

type AllMessageKeys = NestedMessageKeys<typeof zh>;

const messages = {
  zh,
  en
};

let currentLocale: 'zh' | 'en' = 'zh';

/**
 * 设置当前语言
 */
export function setLocale(locale: 'zh' | 'en') {
  currentLocale = locale;
}

/**
 * 获取当前语言
 */
export function getCurrentLocale(): 'zh' | 'en' {
  return currentLocale;
}

/**
 * 获取嵌套对象的值
 */
function getNestedValue(obj: any, path: string): string {
  return path.split('.').reduce((current, key) => current?.[key], obj) || path;
}

/**
 * 翻译函数
 */
export function t(key: AllMessageKeys | string, params?: Record<string, any>): string {
  const message = getNestedValue(messages[currentLocale], key);
  
  if (typeof message !== 'string') {
    return key;
  }
  
  if (!params) {
    return message;
  }
  
  // 简单的参数替换
  return message.replace(/\{(\w+)\}/g, (match, paramKey) => {
    return params[paramKey] != null ? String(params[paramKey]) : match;
  });
}

/**
 * 从配置中初始化语言设置
 */
export async function initializeI18n() {
  try {
    // 从前端配置中获取语言设置
    const { getConfig } = await import('../ipc/config/index');
    const config = await getConfig();
    if (config.success && config.data?.language) {
      setLocale(config.data.language as 'zh' | 'en');
    }
  } catch (error) {
    console.warn('Failed to initialize i18n from config:', error);
    // 使用默认语言 'zh'
  }
}
