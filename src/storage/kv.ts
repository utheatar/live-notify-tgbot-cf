const KEY_UPLIST = 'uplist';

/**
 * Generic: write a value to KV. If `value` is not a string it will be JSON-stringified.
 */
export async function writeKV(kv: KVNamespace, key: string, value: any) {
    if (!kv) return;
    const toStore = typeof value === 'string' ? value : JSON.stringify(value);
    await kv.put(key, toStore);
}

/**
 * Generic: read a value by key from KV. If the stored value parses as JSON, the parsed value is returned,
 * otherwise the raw string is returned. Returns null when key not present or on error.
 */
export async function readByKey(kv: KVNamespace, key: string): Promise<any> {
    if (!kv) return null;
    const raw = await kv.get(key);
    if (raw === null || raw === undefined) return null;
    try {
        return JSON.parse(raw as string);
    } catch (e) {
        return raw;
    }
}

/**
 * Generic: delete a key from KV.
 */
export async function deleteByKey(kv: KVNamespace, key: string) {
    if (!kv) return;
    await kv.delete(key);
}

// --- uplist helpers (keep backwards compatibility) ---
export async function getList(kv: KVNamespace) {
    const raw = await readByKey(kv, KEY_UPLIST);
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try {
        return JSON.parse(raw as string) as any[];
    } catch (e) {
        return [];
    }
}

export async function addToList(kv: KVNamespace, uid: string) {
    if (!kv) return;
    const list = await getList(kv);
    if (!list.includes(uid)) list.push(uid);
    await writeKV(kv, KEY_UPLIST, list);
}

export async function removeFromList(kv: KVNamespace, uid: string) {
    if (!kv) return;
    const list = await getList(kv);
    const idx = list.indexOf(uid);
    if (idx !== -1) {
        list.splice(idx, 1);
        await writeKV(kv, KEY_UPLIST, list);
    }
}


