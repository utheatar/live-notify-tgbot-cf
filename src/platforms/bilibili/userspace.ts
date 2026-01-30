import { wbi_sign } from './sign/wbi.js';

const BASEURL = 'https://api.bilibili.com/x/space/wbi/acc/info';

export type UserSpaceInfo = {
    mid: number;
}
export async function fetchUserSpace(uid: string | number, cookie: string): Promise<Response> {
    const reqUrl = new URL(BASEURL);
    reqUrl.searchParams.append('mid', uid.toString());
    // Sign the request URL
    const wbiSignQuery = await wbi_sign(reqUrl, cookie)
    const reqUrlSigned = new URL(reqUrl.toString() + wbiSignQuery);
    // Fetch the user space info
    try {
        const response = await fetch(reqUrlSigned.toString(), {
            headers: {
                'Cookie': cookie,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36'
            }
        });
        const result = await response.json();

        return new Response(JSON.stringify(result), { status: response.status, headers: response.headers });
    } catch (error) {
        return new Response('Internal Server Error:' + error, { status: 500 });
    }
}