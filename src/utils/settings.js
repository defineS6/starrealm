import { sanitizeUrl } from './html.js';

// 系统设置的默认值：博客不预填地址且默认隐藏，代码仓库入口默认开启。
export const DEFAULT_SETTINGS = {
  blog_url: '',
  blog_enabled: false,
  git_url: 'https://github.com/defineS6/starrealm',
  git_enabled: true,
};

// 需要持久化的设置项，统一在此登记避免读写两侧遗漏。
const URL_KEYS = ['blog_url', 'git_url'];
const FLAG_KEYS = ['blog_enabled', 'git_enabled'];

// 将数据库或 KV 中的字符串值转换为布尔开关。
function toBool(value, fallback) {
  if (value === undefined || value === null) return fallback;
  return String(value).trim().toLowerCase() === 'true';
}

// 读取系统设置，优先读取数据库配置，兼容未建表与 KV 存储。
export async function readSettings(env) {
  const settings = { ...DEFAULT_SETTINGS };

  // 1. 尝试从 D1 数据库读取
  try {
    if (env && env.NAV_DB) {
      const { results } = await env.NAV_DB.prepare('SELECT key, value FROM settings').all();
      if (Array.isArray(results) && results.length > 0) {
        for (const row of results) {
          if (URL_KEYS.includes(row.key) && typeof row.value === 'string') {
            settings[row.key] = row.value.trim();
          } else if (FLAG_KEYS.includes(row.key)) {
            settings[row.key] = toBool(row.value, settings[row.key]);
          }
        }
        return settings;
      }
    }
  } catch (error) {
    if (!/no such table/i.test(error.message || '')) throw error;
  }

  // 2. 数据库无表或无记录时，尝试从 KV 读取兜底配置
  try {
    if (env && env.NAV_AUTH && typeof env.NAV_AUTH.get === 'function') {
      const kvData = await env.NAV_AUTH.get('settings:site');
      if (kvData) {
        const parsed = JSON.parse(kvData);
        for (const key of URL_KEYS) {
          if (typeof parsed[key] === 'string') settings[key] = parsed[key].trim();
        }
        for (const key of FLAG_KEYS) {
          if (parsed[key] !== undefined) settings[key] = Boolean(parsed[key]);
        }
        return settings;
      }
    }
  } catch (_) {}

  return settings;
}

// 管理员保存设置时调用，将博客与仓库入口写入数据库并同步至 KV。
export async function saveSettings(env, input) {
  const payload = {};
  for (const key of URL_KEYS) {
    const raw = (input[key] || '').trim();
    payload[key] = sanitizeUrl(raw) || raw;
  }
  for (const key of FLAG_KEYS) {
    payload[key] = Boolean(input[key]);
  }

  // 写入 D1
  if (env && env.NAV_DB) {
    const doBatch = async () => {
      await env.NAV_DB.batch(
        Object.entries(payload).map(([key, value]) =>
          env.NAV_DB.prepare(
            'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
          ).bind(key, String(value))
        )
      );
    };

    try {
      await doBatch();
    } catch (error) {
      if (/no such table/i.test(error.message || '')) {
        await env.NAV_DB.prepare(
          'CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)'
        ).run();
        await doBatch();
      } else {
        throw error;
      }
    }
  }

  // 同步写入 KV 兜底
  if (env && env.NAV_AUTH && typeof env.NAV_AUTH.put === 'function') {
    try {
      await env.NAV_AUTH.put('settings:site', JSON.stringify(payload));
    } catch (_) {}
  }

  return payload;
}
