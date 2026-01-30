import { douyinSign } from './sign';

export const getBaseParams = () => {
    // 生成随机 verifyFp (简化版，模拟 amagi 的 verify_... 格式)
    const generateVerifyFp = () => {
        const e = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".split("");
        const t = e.length;
        const n = new Date().getTime().toString(36);
        const r: (string | number)[] = [];
        r[8] = r[13] = r[18] = r[23] = "_";
        r[14] = "4";
        for (let i = 0; i < 36; i++) {
            if (!r[i]) {
                const o = 0 | Math.random() * t;
                r[i] = e[19 === i ? 3 & o | 8 : o];
            }
        }
        return "verify_" + n + "_" + r.join("");
    };

    const fp = generateVerifyFp();

    return {
        device_platform: 'webapp',
        aid: '6383',
        channel: 'channel_pc_web',
        pc_client_type: '1',
        update_version_code: '170400',
        version_code: '170400',
        version_name: '17.4.0',
        cookie_enabled: 'true',
        screen_width: '1920',
        screen_height: '1080',
        browser_language: 'zh-CN',
        browser_platform: 'Win32',
        browser_name: 'Chrome',
        browser_version: '144.0.0.0', // 匹配你的 USER_AGENT
        browser_online: 'true',
        engine_name: 'Blink',
        engine_version: '144.0.0.0', // 匹配你的 USER_AGENT
        os_name: 'Windows',
        os_version: '10',
        cpu_core_num: '12', // 匹配你的 USER_AGENT
        device_memory: '8',
        platform: 'PC',
        downlink: '10',
        effective_type: '4g',
        round_trip_time: '50',
        webid: '7327957959955580467',
        msToken: douyinSign.Mstoken(107),
        verifyFp: fp,
        fp: fp,
    };
};