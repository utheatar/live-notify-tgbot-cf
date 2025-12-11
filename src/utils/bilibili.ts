const LIVEINFOS_ENDPOINT = 'https://api-forwarding-vc.vercel.app/api/bili/liveinfos';

/**
 * Fetch liveinfos for given uids via GET (uids[] params)
 */
export async function fetchLiveInfos(uids: string[] | number[]) {
    if (!uids || uids.length === 0) return null;
    // Use POST with JSON body to avoid excessively long URLs
    const url = LIVEINFOS_ENDPOINT;
    const body = { uids: uids.map((u) => Number(u)) };
    const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error(`liveinfos fetch failed: ${resp.status}`);
    const json = await resp.json();
    return json;
}