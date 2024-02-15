import axios from 'axios'

import * as chat from '.'
import * as base from './ChatClientOfficialBase'
import ChatClientOfficialBase from './ChatClientOfficialBase'
import { getUuid4Hex } from '@/utils'
import * as avatar from './avatar'

const GAME_HEARTBEAT_INTERVAL = 20 * 1000

export default class ChatClientDirectOpenLive extends ChatClientOfficialBase {
  constructor(roomOwnerAuthCode) {
    super()
    this.CMD_CALLBACK_MAP = CMD_CALLBACK_MAP

    this.roomOwnerAuthCode = roomOwnerAuthCode

    // 调用initRoom后初始化
    this.roomOwnerUid = null
    this.hostServerUrlList = []
    this.authBody = null
    this.gameId = null

    this.gameHeartbeatTimerId = null
  }

  stop() {
    super.stop()

    if (this.gameHeartbeatTimerId) {
      window.clearInterval(this.gameHeartbeatTimerId)
      this.gameHeartbeatTimerId = null
    }
    this.endGame()
  }

  async initRoom() {
    if (!await this.startGame()) {
      return false
    }

    if (this.gameId && this.gameHeartbeatTimerId === null) {
      this.gameHeartbeatTimerId = window.setInterval(this.sendGameHeartbeat.bind(this), GAME_HEARTBEAT_INTERVAL)
    }
    return true
  }

  async startGame() {
    let res
    try {
      res = (await axios.post('/api/open_live/start_game', {
        code: this.roomOwnerAuthCode,
        app_id: 0
      })).data
      if (res.code !== 0) {
        let msg = `code=${res.code}, message=${res.message}, request_id=${res.request_id}`
        if (res.code === 7007) {
          // 身份码错误
          throw new chat.ChatClientFatalError(chat.FATAL_ERROR_TYPE_AUTH_CODE_ERROR, msg)
        }
        throw Error(msg)
      }
    } catch (e) {
      console.error('startGame failed:', e)
      if (e instanceof chat.ChatClientFatalError) {
        throw e
      }
      return false
    }

    let data = res.data
    this.gameId = data.game_info.game_id
    let websocketInfo = data.websocket_info
    this.authBody = websocketInfo.auth_body
    this.hostServerUrlList = websocketInfo.wss_link
    console.log(this.hostServerUrlList)
    let anchorInfo = data.anchor_info
    // this.roomId = anchorInfo.room_id
    this.roomOwnerUid = anchorInfo.uid
    return true
  }

  async endGame() {
    if (!this.gameId) {
      return true
    }

    try {
      let res = (await axios.post('/api/open_live/end_game', {
        app_id: 0,
        game_id: this.gameId
      })).data
      if (res.code !== 0) {
        if (res.code === 7000 || res.code === 7003) {
          // 项目已经关闭了也算成功
          return true
        }
        throw Error(`code=${res.code}, message=${res.message}, request_id=${res.request_id}`)
      }
    } catch (e) {
      console.error('endGame failed:', e)
      return false
    }
    return true
  }

  async sendGameHeartbeat() {
    if (!this.gameId) {
      return false
    }

    // 保存一下，防止await之后gameId改变
    let gameId = this.gameId
    try {
      let res = (await axios.post('/api/open_live/game_heartbeat', {
        game_id: this.gameId
      })).data
      if (res.code !== 0) {
        console.error(`sendGameHeartbeat failed: code=${res.code}, message=${res.message}, request_id=${res.request_id}`)

        if (res.code === 7003 && this.gameId === gameId) {
          // 项目异常关闭，可能是心跳超时，需要重新开启项目
          this.needInitRoom = true
          this.discardWebsocket()
        }

        return false
      }
    } catch (e) {
      console.error('sendGameHeartbeat failed:', e)
      return false
    }
    return true
  }

  async onBeforeWsConnect() {
    // 重连次数太多则重新init_room，保险
    let reinitPeriod = Math.max(3, (this.hostServerUrlList || []).length)
    if (this.retryCount > 0 && this.retryCount % reinitPeriod === 0) {
      this.needInitRoom = true
    }
    return super.onBeforeWsConnect()
  }

  getWsUrl() {
    let url = this.hostServerUrlList[this.retryCount % this.hostServerUrlList.length]
    console.log(url)
    return url
  }

  sendAuth() {
    this.websocket.send(this.makePacket(this.authBody, base.OP_AUTH))
  }

  // cmd:"INTERACT_WORD"
  // TODO: 欢迎入场 ws 的信息，然后给到 Room.vue
  async interactWordCallback(command) {
    if (!this.onInteractWord) {
      return
    }
    let data = command.data
    // console.log(`interactWordCallback data 是 ${JSON.stringify(data, null, 4)}`)

    data = {
      id: getUuid4Hex(),
      roomId: data.roomid,
      timestamp: data.timestamp,
      avatarUrl: await avatar.getAvatarUrl(data.uid),
      msgType: data.msg_type,
      authorName: data.uname,
      medalName: data.fans_medal.medal_name,
      medalLevel: data.fans_medal.medal_level,
      isFanGroup: data.roomid === data.fans_medal.medal_room_id ? true : false,  // 是否是粉丝团（即粉丝勋章为当前直播间的粉丝勋章）
      privilegeType: data.fans_medal.guard_level // 所带勋章牌子的舰队等级，0非舰队，1总督，2提督，3舰长（不一定是当前直播间的粉丝勋章）
    }
    this.onInteractWord(data)
  }


  // cmd:"DANMU_MSG"
  async danmuMsgCallback(command) {
    console.log(command)
    if (!this.onAddText) {
      return
    }
    let info = command.info

    let roomId, medalLevel, medalName
    if (info[3]) {
      roomId = info[3][3]
      medalLevel = info[3][0]
      medalName = info[3][1]
    } else {
      medalName = roomId = medalLevel = 0
    }
    let uid = info[2][0]
    let isAdmin = info[2][2]
    let privilegeType = info[7]
    let authorType
    if (uid === this.roomOwnerUid) {
      authorType = 3
    } else if (isAdmin) {
      authorType = 2
    } else if (privilegeType !== 0) {
      authorType = 1
    } else {
      authorType = 0
    }


    let data = {
      avatarUrl: await avatar.getAvatarUrl(uid),
      timestamp: info[0][4] / 1000,
      authorName: info[2][1],
      authorType: authorType,
      content: info[1],
      privilegeType: privilegeType,
      isGiftDanmaku: Boolean(info[0][9]),
      authorLevel: info[4][0],
      isNewbie: info[2][5] < 10000,
      isMobileVerified: Boolean(info[2][6]),
      medalName: medalName,
      medalLevel: medalLevel,
      isFanGroup: roomId === this.roomId ? true : false,  // 是否是粉丝团（即粉丝勋章为当前直播间的粉丝勋章）
      id: getUuid4Hex(),
      translation: '',
      emoticon: info[0][13].url || null
    }
    // 存储emoji占位符和图片对应关系
    console.log(info[0][15])
    if (info[0][15] && info[0][15].extra) {

      const extraMap = JSON.parse(info[0][15].extra)
      if (extraMap.emots) {
        data.emots = extraMap.emots
      }
    // TODO: Json Example
    //   {
    //     "[哇]": {
    //         "emoticon_id": 211,
    //         "emoji": "[哇]",
    //         "descript": "[哇]",
    //         "url": "http://i0.hdslb.com/bfs/live/650c3e22c06edcbca9756365754d38952fc019c3.png",
    //         "width": 20,
    //         "height": 20,
    //         "emoticon_unique": "emoji_211"
    //     },
    //     "[妙]": {
    //         "emoticon_id": 210,
    //         "emoji": "[妙]",
    //         "descript": "[妙]",
    //         "url": "http://i0.hdslb.com/bfs/live/08f735d950a0fba267dda140673c9ab2edf6410d.png",
    //         "width": 20,
    //         "height": 20,
    //         "emoticon_unique": "emoji_210"
    //     }
    //  }
    }
    this.onAddText(data)
  }

  // cmd： "SEND_GIFT"
  // sendGiftCallback(command) {
  //   if (!this.onAddGift) {
  //     return
  //   }
  //   let data = command.data
  //   //  if (data.coin_type !== 'gold') { // 白嫖不丢人
  //   //    return
  //   //  }

  //   data = {
  //     id: getUuid4Hex(),
  //     avatarUrl: avatar.processAvatarUrl(data.face),
  //     timestamp: data.timestamp,
  //     authorName: data.uname,
  //     coinType: data.coin_type,
  //     totalCoin: data.total_coin,
  //     giftName: data.giftName,
  //     num: data.num
  //   }
  //   this.onAddGift(data)
  // }


  // cmd:"GUARD_BUY"
  async guardBuyCallback(command) {
    if (!this.onAddMember) {
      return
    }

    let data = command.data
    data = {
      id: getUuid4Hex(),
      avatarUrl: await avatar.getAvatarUrl(data.uid),
      timestamp: data.start_time,
      authorName: data.username,
      privilegeType: data.guard_level
    }
    this.onAddMember(data)
  }
  
  // cmd:"SUPER_CHAT_MESSAGE"
  superChatMessageCallback(command) {
    if (!this.onAddSuperChat) {
      return
    }

    let data = command.data
    data = {
      id: data.id.toString(),
      avatarUrl: avatar.processAvatarUrl(data.user_info.face),
      timestamp: data.start_time,
      authorName: data.user_info.uname,
      price: data.price,
      content: data.message,
      translation: ''
    }
    this.onAddSuperChat(data)
  }

  // cmd:"SUPER_CHAT_MESSAGE_DELETE"
  superChatMessageDeleteCallback(command) {
    if (!this.onDelSuperChat) {
      return
    }

    let ids = []
    for (let id of command.data.ids) {
      ids.push(id.toString())
    }
    this.onDelSuperChat({ ids })
  }

  // cmd:"LIVE_OPEN_PLATFORM_DM"
  async dmCallback(command) {
    console.log(command)
    if (!this.onAddText) {
      return
    }
    let data = command.data

    let authorType
    if (data.uid === this.roomOwnerUid) {
      authorType = 3
    } else if (data.guard_level !== 0) {
      authorType = 1
    } else {
      authorType = 0
    }

    let emoticon = null
    if (data.dm_type === 1) {
      emoticon = data.emoji_img_url
    }

    data = {
      avatarUrl: chat.processAvatarUrl(data.uface),
      timestamp: data.timestamp,
      authorName: data.uname,
      authorType: authorType,
      content: data.msg,
      privilegeType: data.guard_level,
      isGiftDanmaku: chat.isGiftDanmakuByContent(data.msg),
      authorLevel: 1,
      isNewbie: false,
      isMobileVerified: true,
      medalName: data.fans_medal_name,
      medalLevel: data.fans_medal_level,
      isFanGroup: data.fans_medal_wearing_status ? true : false,
      id: data.msg_id,
      translation: '',
      emoticon: emoticon,
    }
    this.onAddText(data)
  }

  // cmd: "LIVE_OPEN_PLATFORM_SEND_GIFT"
  sendGiftCallback(command) {
    if (!this.onAddGift) {
      return
    }
    let data = command.data
    if (!data.paid) { // 丢人
      data.price = 0
    }

    data = {
      id: data.msg_id,
      avatarUrl: chat.processAvatarUrl(data.uface),
      timestamp: data.timestamp,
      authorName: data.uname,
      privilegeType: data.guard_level,
      paid: data.paid,
      totalCoin: data.price * data.gift_num,
      giftName: data.gift_name,
      num: data.gift_num,
      medalName: data.fans_medal_name,
      medalLevel: data.fans_medal_level,
      isFanGroup: data.fans_medal_wearing_status ? true : false
    }
    this.onAddGift(data)
  }

  // cmd:"LIVE_OPEN_PLATFORM_GUARD"
  async guardCallback(command) {
    if (!this.onAddMember) {
      return
    }

    let data = command.data
    data = {
      id: data.msg_id,
      avatarUrl: chat.processAvatarUrl(data.user_info.uface),
      timestamp: data.timestamp,
      authorName: data.user_info.uname,
      privilegeType: data.guard_level,
      guardNum: data.guard_num,
      guardUnit: data.guard_unit,
      medalName: data.fans_medal_name,
      medalLevel: data.fans_medal_level,
      isFanGroup: data.fans_medal_wearing_status ? true : false
    }
    this.onAddMember(data)
  }

  // cmd:"LIVE_OPEN_PLATFORM_SUPER_CHAT"
  superChatCallback(command) {
    if (!this.onAddSuperChat) {
      return
    }

    let data = command.data
    data = {
      id: data.message_id.toString(),
      avatarUrl: chat.processAvatarUrl(data.uface),
      timestamp: data.start_time,
      authorName: data.uname,
      price: data.rmb,
      content: data.message,
      translation: '',
      medalName: data.fans_medal_name,
      medalLevel: data.fans_medal_level,
      isFanGroup: data.fans_medal_wearing_status ? true : false
    }
    this.onAddSuperChat(data)
  }

  // cmd:"LIVE_OPEN_PLATFORM_SUPER_CHAT_DEL"
  superChatDelCallback(command) {
    if (!this.onDelSuperChat) {
      return
    }

    let ids = []
    for (let id of command.data.message_ids) {
      ids.push(id.toString())
    }
    this.onDelSuperChat({ ids })
  }
}

const CMD_CALLBACK_MAP = {
  // 通过房间号
  INTERACT_WORD: ChatClientDirectOpenLive.prototype.interactWordCallback,
  DANMU_MSG: ChatClientDirectOpenLive.prototype.danmuMsgCallback,
  // SEND_GIFT: ChatClientDirectOpenLive.prototype.sendGiftCallback,
  GUARD_BUY: ChatClientDirectOpenLive.prototype.guardBuyCallback,
  SUPER_CHAT_MESSAGE: ChatClientDirectOpenLive.prototype.superChatMessageCallback,
  SUPER_CHAT_MESSAGE_DELETE: ChatClientDirectOpenLive.prototype.superChatMessageDeleteCallback,

  // 身份码改版的
  LIVE_OPEN_PLATFORM_DM: ChatClientDirectOpenLive.prototype.dmCallback,
  LIVE_OPEN_PLATFORM_SEND_GIFT: ChatClientDirectOpenLive.prototype.sendGiftCallback,
  LIVE_OPEN_PLATFORM_GUARD: ChatClientDirectOpenLive.prototype.guardCallback,
  LIVE_OPEN_PLATFORM_SUPER_CHAT: ChatClientDirectOpenLive.prototype.superChatCallback,
  LIVE_OPEN_PLATFORM_SUPER_CHAT_DEL: ChatClientDirectOpenLive.prototype.superChatDelCallback
}
