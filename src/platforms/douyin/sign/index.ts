import exp from 'constants'
import { crypto } from '../../lib.js'

import a_bogus from './a_bogus'
import XBogus from './x_bogus'

const defaultUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'

export class douyinSign {
  /**
   * 生成一个指定长度的随机字符串
   * @param length 字符串长度，默认为116
   * @returns
   */
  static Mstoken(length: number): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    const randomBytes = crypto.randomBytes(length ?? 116)
    return Array.from(randomBytes, (byte) => characters[byte % characters.length]).join('')
  }

  /**
   * a_bogus 签名算法
   * @param url 需要签名的地址
   * @returns 对此地址签名后的URL查询参数
   */
  static AB(url: string, userAgent?: string): string {
    return a_bogus(url, userAgent ?? defaultUserAgent)
  }

  /**
   * X-Bogus 签名算法
   * @param url 需要签名的地址
   * @returns 对此地址签名后的URL查询参数
   */
  static XB(url: string, userAgent?: string): string {
    const xbogusResult = new XBogus().getXBogus(url, userAgent ?? defaultUserAgent)
    return xbogusResult.xbogus
  }

  /** 生成一个唯一的验证字符串 */
  static VerifyFpManager(): string {
    const e = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('')
    const t = e.length
    const n = new Date().getTime().toString(36)
    const r: (string | number)[] = []

    r[8] = '_'
    r[13] = '_'
    r[18] = '_'
    r[23] = '_'
    r[14] = '4'

    for (let o, i = 0; i < 36; i++) {
      if (!r[i]) {
        o = 0 | (Math.random() * t)
        r[i] = e[i === 19 ? (3 & o) | 8 : o]
      }
    }

    return 'verify_' + n + '_' + r.join('')
  }
}

/**
 * 签名算法类型
 */
export type DYSignType = 'a_bogus' | 'x_bogus'

/**
 * 获取签名参数
 * @param url - 需要签名的URL
 * @param signType - 签名算法类型
 * @param userAgent - 用户代理
 * @returns 签名后的参数字符串
 */
const getSignature = (url: string, signType: DYSignType = 'a_bogus', userAgent: string): string => {
  switch (signType) {
    case 'x_bogus':
      return douyinSign.XB(url, userAgent)
    case 'a_bogus':
    default:
      return douyinSign.AB(url, userAgent)
  }
}

/**
 * 获取签名参数名称
 * @param signType - 签名算法类型
 * @returns 签名参数名称
 */
const getSignParamName = (signType: DYSignType = 'a_bogus'): string => {
  switch (signType) {
    case 'x_bogus':
      return 'X-Bogus'
    case 'a_bogus':
    default:
      return 'a_bogus'
  }
}

/**
 * 构建带签名的URL
 * @param url - 基础URL
 * @param signType - 签名算法类型
 * @param userAgent - 用户代理
 * @returns 带签名的完整URL
 */
export const buildSignedUrl = (url: string, signType: DYSignType = 'a_bogus', userAgent: string): string => {
  const signature = getSignature(url, signType, userAgent)
  const paramName = getSignParamName(signType)
  return `${url}&${paramName}=${signature}`
}
