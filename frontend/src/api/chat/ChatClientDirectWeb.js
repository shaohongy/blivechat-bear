import axios from 'axios'

import { getUuid4Hex } from '@/utils'
import * as chat from '.'
import * as base from './ChatClientOfficialBase'
import ChatClientOfficialBase from './ChatClientOfficialBase'

export default class ChatClientDirectWeb extends ChatClientOfficialBase {
  constructor(roomId) {
    super()
    this.CMD_CALLBACK_MAP = CMD_CALLBACK_MAP

    // 调用initRoom后初始化，如果失败，使用这里的默认值
    this.roomId = roomId
    this.roomOwnerUid = -1
    this.hostServerList = [
      { host: "broadcastlv.chat.bilibili.com", port: 2243, wss_port: 443, ws_port: 2244 }
    ]
  }

  async initRoom() {
    let res
    try {
      res = (await axios.get('/api/room_info', { params: {
        roomId: this.roomId
      } })).data
    } catch {
      return true
    }
    this.roomId = res.roomId
    this.roomOwnerUid = res.ownerUid
    console.log(res)
    if (res.hostServerList.length !== 0) {
      this.hostServerList = res.hostServerList
    }
    return true
  }

  async onBeforeWsConnect() {
    // 重连次数太多则重新init_room，保险
    let reinitPeriod = Math.max(3, (this.hostServerList || []).length)
    if (this.retryCount > 0 && this.retryCount % reinitPeriod === 0) {
      this.needInitRoom = true
    }
    return super.onBeforeWsConnect()
  }

  getWsUrl() {
    let hostServer = this.hostServerList[this.retryCount % this.hostServerList.length]
    return `wss://${hostServer.host}:${hostServer.wss_port}/sub`
  }

  sendAuth() {
    let authParams = {
      uid: 0,
      roomid: this.roomId,
      protover: 3,
      platform: 'web',
      type: 2,
      buvid: '',
    }
    this.websocket.send(this.makePacket(authParams, base.OP_AUTH))
  }

  async danmuMsgCallback(command) {
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

    let authorName = info[2][1]
    let content = info[1]
    let data = {
      avatarUrl: await chat.getAvatarUrl(uid, authorName),
      timestamp: info[0][4] / 1000,
      authorName: authorName,
      authorType: authorType,
      content: content,
      privilegeType: privilegeType,
      isGiftDanmaku: Boolean(info[0][9]) || chat.isGiftDanmakuByContent(content),
      authorLevel: info[4][0],
      isNewbie: info[2][5] < 10000,
      isMobileVerified: Boolean(info[2][6]),
      medalName: medalName,
      medalLevel: medalLevel,
      isFanGroup: roomId === this.roomId ? true : false,  // 是否是粉丝团（即粉丝勋章为当前直播间的粉丝勋章）
      id: getUuid4Hex(),
      translation: '',
      emoticon: info[0][13].url || null,
    }
    // 增加区分表情的细节数据
    if (info[0][13]) {
      data.emoticonDetail = info[0][13]
    } console.log(info[0][15])
    if (info[0][15] && info[0][15].extra) {

      const extraMap = JSON.parse(info[0][15].extra)
      if (extraMap.emots) {
        data.emots = extraMap.emots
      }
    }
    this.onAddText(data)
  }

  sendGiftCallback(command) {
    if (!this.onAddGift) {
      return
    }
    let data = command.data
    //  if (data.coin_type !== 'gold') { // 白嫖不丢人
    //    return
    //  }

    data = {
      id: getUuid4Hex(),
      avatarUrl: chat.processAvatarUrl(data.face),
      timestamp: data.timestamp,
      authorName: data.uname,
      paid: data.coinType == 'gold' ? true : false,
      totalCoin: data.total_coin,
      giftName: data.giftName,
      num: data.num
    }
    this.onAddGift(data)
  }

  async guardBuyCallback(command) {
    if (!this.onAddMember) {
      return
    }

    let data = command.data
    data = {
      id: getUuid4Hex(),
      avatarUrl: await chat.getAvatarUrl(data.uid, data.username),
      timestamp: data.start_time,
      authorName: data.username,
      privilegeType: data.guard_level,
      guardNum: 1,
      guardUnit: '月'
    }
    this.onAddMember(data)
  }

  superChatMessageCallback(command) {
    if (!this.onAddSuperChat) {
      return
    }

    let data = command.data
    data = {
      id: data.id.toString(),
      avatarUrl: chat.processAvatarUrl(data.user_info.face),
      timestamp: data.start_time,
      authorName: data.user_info.uname,
      price: data.price,
      content: data.message,
      translation: ''
    }
    this.onAddSuperChat(data)
  }

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

  async interactWordCallback(command) {
    if (!this.onInteractWord) {
      return
    }
    if (command.data.text_large) {
      return
    }
    let data = command.data
    // console.log(`interactWordCallback data 是 ${JSON.stringify(data, null, 4)}`)

    data = {
      id: getUuid4Hex(),
      roomId: data.roomid,
      timestamp: data.timestamp,
      avatarUrl: await chat.getAvatarUrl(data.uid, data.uname),
      msgType: data.msg_type,
      authorName: data.uname,
      medalName: data.fans_medal.medal_level === 0 ? undefined : data.fans_medal.medal_name,
      medalLevel: data.fans_medal.medal_level === 0 ? undefined : data.fans_medal.medal_level,
      isFanGroup: data.roomid === data.fans_medal.medal_room_id ? true : false,  // 是否是粉丝团（即粉丝勋章为当前直播间的粉丝勋章）
      privilegeType: data.fans_medal.guard_level // 所带勋章牌子的舰队等级，0非舰队，1总督，2提督，3舰长（不一定是当前直播间的粉丝勋章）
    }
    this.onInteractWord(data)
  }

}

const CMD_CALLBACK_MAP = {
  DANMU_MSG: ChatClientDirectWeb.prototype.danmuMsgCallback,
  SEND_GIFT: ChatClientDirectWeb.prototype.sendGiftCallback,
  GUARD_BUY: ChatClientDirectWeb.prototype.guardBuyCallback,
  SUPER_CHAT_MESSAGE: ChatClientDirectWeb.prototype.superChatMessageCallback,
  SUPER_CHAT_MESSAGE_DELETE: ChatClientDirectWeb.prototype.superChatMessageDeleteCallback,
  INTERACT_WORD: ChatClientDirectWeb.prototype.interactWordCallback,
}
