import _ from 'lodash'

import { mergeConfig } from '@/utils'

export const DEFAULT_CONFIG = {
  emoticons: [],
  customCss: '',
  minGiftPrice: 0, // ￥0.0
  minTickerPrice: 0.1, // ￥0.1
  showDanmaku: true,
  showInteractWordEnter: false,
  showInteractWordFollow: false,
  showInteractWordShare: false,
  showTranslateDanmakuOnly: false,
  allowTextColorSetting: true,
  blockTranslateDanmaku: false,
  translationSign: '【',
  showSuperchat: true,
  showNewMember: true,
  showGift: true,
  showGiftInfo: true,
  mergeSameUserDanmaku: false,
  mergeSameUserDanmakuInterval: 60,
  mergeSimilarDanmaku: false,
  mergeGift: false,
  danmakuAtBottom: true,
  tickerAtButtom: false,
  randomXOffset: false,
  randomXRangeMin: 0,
  randomXRangeMax: 100,
  randomYOffset: false,
  randomYRangeMin: 250,
  randomYRangeMax: 500,
  randomXInitialOffset: 0,
  randomYInitialOffset: 0,
  floatDistanceXMin: 0,
  floatDistanceXMax: 0,
  floatDistanceYMin: 0,
  floatDistanceYMax: 0,
  floatDistanceThreshold: 0,
  floatTime: 60,
  maxNumber: 30,
  fadeOutNum: 3,
  pinTime: 0,

  useLocalEmoticonSetting: false,
  autoRenderOfficialSmallEmoji: true,
  autoRenderOfficialGeneralEmoji: true,
  autoRenderStreamerEmoji: true,
  autoRenderPersonalEmoji: true,


  isGreedyMatch: true,
  isSkipSameImage: false,
  imageShowType: 0,
  maxEmoji: 5,
  maxImage: 1,

  blockGiftDanmaku: true,
  blockLevel: 0,
  blockNewbie: false,
  blockNotMobileVerified: false,
  blockKeywords: '',
  blockUsers: '',
  blockUsersByKeywords: '',
  blockMedalLevel: 0,

  minDanmakuInterval: 400,
  maxDanmakuInterval: 1200,

  relayMessagesByServer: false,
  autoTranslate: false,
  giftUsernamePronunciation: ''
  // [{ keyword: '', url: '' }, ...]
}

export function deepCloneDefaultConfig() {
  return _.cloneDeep(DEFAULT_CONFIG)
}

export function setLocalConfig(config) {
  config = mergeConfig(config, DEFAULT_CONFIG)
  window.localStorage.config = JSON.stringify(config)
}

export function getLocalConfig() {
  try {
    let config = JSON.parse(window.localStorage.config)
    config = mergeConfig(config, deepCloneDefaultConfig())
    sanitizeConfig(config)
    return config
  } catch {
    return deepCloneDefaultConfig()
  }
}

export function sanitizeConfig(config) {
  let newEmoticons = []
  if (config.emoticons instanceof Array) {
    for (let emoticon of config.emoticons) {
      try {
        let newEmoticon = {
          keyword: emoticon.keyword,
          level: emoticon.level,
          align: emoticon.align,
          height: emoticon.height,
          url: emoticon.url
        }
        if ((typeof newEmoticon.keyword !== 'string') || (typeof newEmoticon.url !== 'string') || (typeof newEmoticon.align !== 'string') || (typeof newEmoticon.height !== 'number') || (typeof newEmoticon.level !== 'number')) {
          continue
        }
        newEmoticons.push(newEmoticon)
      } catch {
        continue
      }
    }
  }
  config.emoticons = newEmoticons
}
