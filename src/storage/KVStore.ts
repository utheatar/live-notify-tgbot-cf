/**
 * 一个用于抽象 Cloudflare KV 操作的类。
 * 提供了字符串和 JSON 对象的存取、删除、列表。
 */
export class KVStore {
    private readonly namespace: KVNamespace;
    private readonly keyPrefix: string;

    /**
     * 创建一个 KVStore 实例。
     * @param {KVNamespace} namespace - 从 `env` 对象中获取的 KV 命名空间。
     * @param {string} [keyPrefix=''] - 可选的键前缀，用于在同一个 KV 命名空间中隔离数据。
     */
    constructor(namespace: KVNamespace, keyPrefix: string = '') {
        this.namespace = namespace;
        this.keyPrefix = keyPrefix.trim();
    }

    /**
     * 为键添加前缀。
     * @private
     */
    private getKey(key: string): string {
        return this.keyPrefix ? `${this.keyPrefix}_${key}` : key;
    }

    // --- 基础字符串操作 ---

    /**
     * 获取一个字符串值。
     * @param {string} key - 键名。
     * @returns {Promise<string | null>} string 或 null。
     */
    async get(key: string): Promise<string | null> {
        key = key.trim();
        if (!key) throw new Error('KVStore.get: key cannot be empty');
        return this.namespace.get(this.getKey(key));
    }

    /**
     * 设置一个字符串值。
     * @param {string} key - 键名。
     * @param {string} value - 值。
     * @returns {Promise<void>}
     */
    async set(key: string, value: string): Promise<void> {
        key = key.trim();
        if (!key) throw new Error('KVStore.set: key cannot be empty');
        await this.namespace.put(this.getKey(key), value);
    }

    /**
     * 删除一个键。
     * @param {string} key - 要删除的键名。
     * @returns {Promise<void>}
     */
    async delete(key: string): Promise<void> {
        key = key.trim();
        if (!key) throw new Error('KVStore.delete: key cannot be empty');
        await this.namespace.delete(this.getKey(key));
    }

    // --- 高级 JSON 对象操作 ---

    /**
     * 获取一个 JSON 对象。
     * @template T
     * @param {string} key - 键名。
     * @returns {Promise<T | null>} 解析后的对象或 null。
     */
    async getJson<T = any>(key: string): Promise<T | null> {
        try {
            return JSON.parse(await this.get(key) as string) as T;
        } catch (error) {
            console.error(`Failed to parse JSON for key "${key}":`, error);
            return null; // 或者你可以选择抛出错误
        }
    }

    /**
     * 设置一个 JSON 对象。
     * @template T
     * @param {string} key - 键名。
     * @param {T} value - 要存储的对象。
     * @returns {Promise<void>}
     */
    async setJson<T = any>(key: string, value: T): Promise<void> {
        try {
            await this.set(key, JSON.stringify(value));
        } catch (error) {
            console.error(`Failed to stringify JSON for key "${key}":`, error);
            throw error;
        }
    }
}

