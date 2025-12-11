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
     * 设置一个带 TTL 的字符串值。
     * @param {string} key - 键名。
     * @param {string} value - 值。
     * @param {number} ttlSeconds - 生存时间（秒）。
     * @returns {Promise<void>}
     */
    // async setWithTtl(key: string, value: string, ttlSeconds: number): Promise<void> {
    //     await this.namespace.put(this.getKey(key), value, { expirationTtl: ttlSeconds });
    // }

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

    /**
     * 列出所有键。
     * @param {KVListOptions} [options] - 列表选项，如 limit, cursor 等。
     * @returns {Promise<KVListResult<unknown, string>>}
     */
    // async list(options?: KVListOptions): Promise<KVListResult<unknown, string>> {
    //     // 如果类有前缀，需要将其与 list 的 prefix 结合
    //     const listPrefix = this.keyPrefix ? `${this.keyPrefix}:${options?.prefix || ''}` : options?.prefix;

    //     const finalOptions: KVListOptions = {
    //         ...options,
    //         prefix: listPrefix,
    //     };

    //     const result = await this.namespace.list(finalOptions);

    //     // 返回的键名需要去掉我们添加的前缀
    //     const strippedKeys = result.keys.map(key => ({
    //         name: key.name.substring(this.keyPrefix.length + 1), // +1 for ':'
    //         expiration: key.expiration,
    //         metadata: key.metadata
    //     }));

    //     return {
    //         keys: strippedKeys,
    //         list_complete: result.list_complete,
    //         cursor: result.cursor
    //     };
    // }

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

    /**
     * 设置一个带 TTL 的 JSON 对象。
     * @template T
     * @param {string} key - 键名。
     * @param {T} value - 要存储的对象。
     * @param {number} ttlSeconds - 生存时间（秒）。
     * @returns {Promise<void>}
     */
    // async setJsonWithTtl<T = any>(key: string, value: T, ttlSeconds: number): Promise<void> {
    //     await this.setWithTtl(key, JSON.stringify(value), ttlSeconds);
    // }
}