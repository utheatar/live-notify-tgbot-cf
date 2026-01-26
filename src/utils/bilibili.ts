const BLLIVEINFOS_ENDPOINT_Vercel = 'https://api-forwarding-vc.vercel.app/api/bili/liveinfos';
const URL_LIVE_INFOS_BY_UIDS = 'https://api.live.bilibili.com/room/v1/Room/get_status_info_by_uids';

/**
 * Fetch liveinfos for given uids via GET (uids[] params)
 */
export async function fetchLiveInfosVC(uids: string[] | number[]) {
    if (!uids || uids.length === 0) return null;
    // Use POST with JSON body to avoid excessively long URLs
    const url = BLLIVEINFOS_ENDPOINT_Vercel;
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