import { Context, Schema, Session, segment } from 'koishi'
import { promises as fs } from 'fs'
import * as path from 'path'

export const name = 'ccb-plus'

// --- 注入数据库依赖 ---
export const inject = ['database']

// --- 配置接口 ---
export interface CheatConfig {
  userId: string
  ywWindow: number
  ywThreshold: number
  ywProbability: number
  critProb: number
  ywBanDuration: number
}

export interface CCBConfig {
  ywWindow: number
  ywThreshold: number
  ywBanDuration: number
  ywProbability: number
  whiteList: string[]
  selfCcb: boolean
  critProb: number
  cheatList: CheatConfig[]
}

// --- 数据库表结构定义 ---

// 记录表：对应原来的 groupData 中的每一项
export interface CCBRecord {
  groupId: string
  userId: string // 即 targetId
  num: number
  vol: number
  max: number
  ccb_by: {
    [actorId: string]: {
      count: number
      first: boolean
      max: boolean
    }
  }
}

// 用户设置表：用于存储 -off/-on 的状态
export interface CCBUserSetting {
  userId: string
  optOut: boolean // true 表示拒绝被 ccb
}

declare module 'koishi' {
  interface Tables {
    ccb_record: CCBRecord
    ccb_setting: CCBUserSetting
  }
}

export const Config: Schema<CCBConfig> = Schema.object({
  ywWindow: Schema.number().default(60).description('全局触发赛博阳痿的窗口时间（秒）'),
  ywThreshold: Schema.number().default(5).description('全局窗口时间内最大ccb数'),
  ywBanDuration: Schema.number().default(900).description('全局养胃时长（秒）'),
  ywProbability: Schema.number().default(0.1).min(0).max(1).description('全局随机养胃概率'),
  whiteList: Schema.array(String).default([]).description('全局配置的黑名单'),
  selfCcb: Schema.boolean().default(false).description('是否允许对自己ccb'),
  critProb: Schema.number().default(0.2).min(0).max(1).description('全局暴击概率'),
  cheatList: Schema.array(Schema.object({
    userId: Schema.string().required().description('用户ID'),
    ywWindow: Schema.number().default(10).description('特权窗口时间（秒）'),
    ywThreshold: Schema.number().default(999).description('特权窗口内最大次数'),
    ywProbability: Schema.number().default(0).min(0).max(1).description('特权养胃概率'),
    critProb: Schema.number().default(0.8).min(0).max(1).description('特权暴击概率'),
    ywBanDuration: Schema.number().default(60).description('特权养胃时长（秒）')
  })).role('table').description('开挂名单（优先级高于全局设置）')
})

export function apply(ctx: Context, config: CCBConfig) {
  // --- 1. 定义数据库模型 ---
  ctx.model.extend('ccb_record', {
    groupId: 'string',
    userId: 'string',
    num: 'unsigned',
    vol: 'double',
    max: 'double',
    ccb_by: 'json',
  }, {
    primary: ['groupId', 'userId'], // 联合主键
  })

  ctx.model.extend('ccb_setting', {
    userId: 'string',
    optOut: 'boolean',
  }, {
    primary: 'userId',
  })

  // --- 变量初始化 ---
  const actionTimes: { [userId: string]: number[] } = {}
  const banList: { [userId: string]: number } = {}
  
  // 昵称缓存
  const nicknameCache = new Map<string, { name: string, timestamp: number }>()
  const CACHE_DURATION = 5 * 60 * 1000 

  // --- 2. 数据迁移逻辑 (Old JSON -> Database) ---
  ctx.on('ready', async () => {
    const DATA_FILE = path.join(ctx.baseDir, 'data', 'ccb.json')
    try {
      await fs.access(DATA_FILE) // 检查文件是否存在
      console.log('[ccb-plus] 检测到旧版数据文件，正在迁移至数据库...')
      
      const fileContent = await fs.readFile(DATA_FILE, 'utf-8')
      const jsonData = JSON.parse(fileContent)
      
      const ops = []
      for (const groupId in jsonData) {
        const groupRecords = jsonData[groupId]
        if (Array.isArray(groupRecords)) {
          for (const record of groupRecords) {
            ops.push(
              ctx.database.upsert('ccb_record', [{
                groupId: groupId,
                userId: record.id,
                num: record.num,
                vol: record.vol,
                max: record.max,
                ccb_by: record.ccb_by
              }])
            )
          }
        }
      }
      
      await Promise.all(ops)
      
      // 迁移完成后重命名文件，防止下次启动重复迁移
      const BACKUP_FILE = path.join(ctx.baseDir, 'data', 'ccb.json.migrated')
      await fs.rename(DATA_FILE, BACKUP_FILE)
      console.log(`[ccb-plus] 数据迁移完成，旧文件已重命名为 ${BACKUP_FILE}`)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('[ccb-plus] 数据迁移过程中出错:', error)
      }
      // 文件不存在则无需迁移
    }
  })

  // --- 辅助函数 ---

  function getAvatar(userId: string): string {
    return `https://q4.qlogo.cn/headimg_dl?dst_uin=${userId}&spec=640`
  }

  async function getUserNickname(session: Session, userId: string): Promise<string> {
    const cacheKey = `${session.guildId}:${userId}`
    const cached = nicknameCache.get(cacheKey)
    const now = Date.now()
    
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      return cached.name
    }
    
    const setAndReturnName = (name: string | undefined) => {
      if (name && name !== userId) {
        const actualName = name.trim()
        if (actualName) {
          nicknameCache.set(cacheKey, { name: actualName, timestamp: now })
          return actualName
        }
      }
      return null
    }

    if (session.guildId && userId) {
      try {
        const memberInfo = await session.bot.getGuildMember(session.guildId, userId)
        const displayName = memberInfo?.nick || memberInfo?.user?.name || memberInfo?.name
        const result = setAndReturnName(displayName)
        if (result) return result
      } catch (error) {}
    }

    try {
      const userInfo = await session.bot.getUser(userId)
      const displayName = userInfo?.name || userInfo?.nick || userInfo?.nickname
      const result = setAndReturnName(displayName)
      if (result) return result
    } catch (e) {}

    try {
      if (session.event?.user?.id === userId) {
        const result = setAndReturnName(session.event?.user?.name)
        if (result) return result
      }
    } catch (nestedError) {}

    const friendlyName = `用户${userId}`
    nicknameCache.set(cacheKey, { name: friendlyName, timestamp: now })
    return friendlyName
  }

  function checkGroupCommand(session: Session): string | null {
    if (!session.guildId) {
      return '此命令只能在群聊中使用。'
    }
    return null
  }

  async function validateTargetUser(session: Session, target: string): Promise<string> {
    let targetUserId = session.userId
    if (target) {
      const match = target.match(/^[^:]+:(.+)$/)
      if (match) {
        targetUserId = match[1]
        try {
          const memberInfo = await session.bot.getGuildMember(session.guildId, targetUserId)
          if (!memberInfo) {
            return '无法找到指定用户，请检查输入是否正确。'
          }
        } catch (error) {
          return '无法找到指定用户，请检查输入是否正确。'
        }
      }
    } else if (session.quote?.user?.id) {
      targetUserId = session.quote.user.id
      try {
        const memberInfo = await session.bot.getGuildMember(session.guildId, targetUserId)
        if (!memberInfo) {
          return '无法找到指定用户，请检查输入是否正确。'
        }
      } catch (error) {
        return '无法找到指定用户，请检查输入是否正确。'
      }
    }
    return targetUserId
  }

  async function updateCCBRecord(session: Session, groupId: string, targetUserId: string, duration: number, V: number, nickname: string, crit: boolean, pic: string): Promise<string> {
    // 获取现有记录
    const [record] = await ctx.database.get('ccb_record', { groupId, userId: targetUserId })
    
    // 如果没有记录，调用创建新记录逻辑
    if (!record) {
      return await createNewCCBRecord(session, groupId, targetUserId, duration, V, nickname, pic)
    }

    const senderId = session.userId
    const newNum = (record.num || 0) + 1
    const newVol = parseFloat(((record.vol || 0) + V).toFixed(2))

    let ccb_by = record.ccb_by || {}
    // 深拷贝以防引用问题
    ccb_by = JSON.parse(JSON.stringify(ccb_by))

    if (senderId in ccb_by) {
      const current = ccb_by[senderId]
      ccb_by[senderId] = {
        count: (current?.count || 0) + 1,
        first: current?.first || false,
        max: current?.max || false
      }
    } else {
      ccb_by[senderId] = { count: 1, first: false, max: false }
    }

    let prev_max = record.max || 0.0
    if (prev_max === 0.0 && (record.num || 0) > 0) {
      prev_max = parseFloat(((record.vol || 0) / (record.num || 0)).toFixed(2))
    }

    let newMax = prev_max
    if (V > prev_max) {
      newMax = V
      // 重置 max 标记
      for (const k in ccb_by) {
        if (ccb_by[k]) ccb_by[k].max = false
      }
      if (ccb_by[senderId]) ccb_by[senderId].max = true
    } else {
        // 保持原样，清除其他意外的max标记(如果有)
        for (const k in ccb_by) {
            if (ccb_by[k] && !ccb_by[k].max) {
                ccb_by[k].max = false
            }
        }
    }

    // 更新数据库
    await ctx.database.set('ccb_record', { groupId, userId: targetUserId }, {
      num: newNum,
      vol: newVol,
      max: newMax,
      ccb_by: ccb_by
    })

    const resultMessage = crit
      ? `你和${nickname}发生了${duration}min长的ccb行为，向ta注入了 💥 暴击！${V.toFixed(2)}ml的生命因子`
      : `你和${nickname}发生了${duration}min长的ccb行为，向ta注入了${V.toFixed(2)}ml的生命因子`
    
    const message = [
      resultMessage,
      segment.image(pic),
      `这是ta的第${newNum}次。`
    ].join('\n')

    return message
  }

  async function createNewCCBRecord(session: Session, groupId: string, targetUserId: string, duration: number, V: number, nickname: string, pic: string): Promise<string> {
    const newRecord: CCBRecord = {
      groupId,
      userId: targetUserId,
      num: 1,
      vol: V,
      max: V,
      ccb_by: { [session.userId]: { count: 1, first: true, max: true } }
    }
    
    await ctx.database.upsert('ccb_record', [newRecord])

    const resultMessage = `你和${nickname}发生了${duration}min长的ccb行为，向ta注入了${V.toFixed(2)}ml的生命因子`
    const message = [
      resultMessage,
      segment.image(pic),
      '这是ta的初体验。'
    ].join('\n')

    return message
  }

  // --- 3. 命令定义 ---

  ctx.command('ccb [target:user]', '给群友注入生命因子')
    .option('off', '--off 将自己加入白名单（禁止被人ccb）')
    .option('on', '--on 将自己移出白名单（允许被人ccb）')
    .action(async ({ session, options }, target: string) => {
      const checkResult = checkGroupCommand(session)
      if (checkResult) return checkResult
      
      const senderId = session.userId

      // --- 处理开关选项 ---
      if (options.off) {
        await ctx.database.upsert('ccb_setting', [{ userId: senderId, optOut: true }])
        return '已加入保护名单，阻止你被ccb。'
      }
      if (options.on) {
        await ctx.database.upsert('ccb_setting', [{ userId: senderId, optOut: false }])
        return '已移出保护名单，允许你被ccb。'
      }
      // ------------------

      const actorId = senderId
      const now = Date.now() / 1000

      // 获取开挂/全局配置
      const cheatSetting = config.cheatList.find(c => c.userId === actorId)
      const currentConfig = {
        ywWindow: cheatSetting ? cheatSetting.ywWindow : config.ywWindow,
        ywThreshold: cheatSetting ? cheatSetting.ywThreshold : config.ywThreshold,
        ywBanDuration: cheatSetting ? cheatSetting.ywBanDuration : config.ywBanDuration,
        ywProbability: cheatSetting ? cheatSetting.ywProbability : config.ywProbability,
        critProb: cheatSetting ? cheatSetting.critProb : config.critProb,
      }

      const banEnd = banList[actorId] || 0
      if (now < banEnd) {
        const remain = Math.floor(banEnd - now)
        const m = Math.floor(remain / 60)
        const s = remain % 60
        return `嘻嘻，你已经一滴不剩了，填充还剩 ${m}分${s}秒`
      }

      const times = actionTimes[actorId] = actionTimes[actorId] || []
      const cutoff = now - currentConfig.ywWindow
      while (times.length > 0 && times[0] < cutoff) {
        times.shift()
      }
      times.push(now)

      if (times.length > currentConfig.ywThreshold) {
        banList[actorId] = now + currentConfig.ywBanDuration
        actionTimes[actorId] = [] 
        return '冲得出来吗你就冲，再冲就给你折了'
      }

      let targetUserId = await validateTargetUser(session, target)
      if (targetUserId.startsWith('无法找到')) {
        return targetUserId 
      }

      // --- 检查目标是否在白名单 ---
      // 1. 检查 Config 白名单
      if (config.whiteList.includes(targetUserId)) {
        const nickname = await getUserNickname(session, targetUserId) || targetUserId
        return `${nickname} 拒绝了和你ccb。`
      }
      // 2. 检查 数据库 用户自定义设置
      const [targetSetting] = await ctx.database.get('ccb_setting', { userId: targetUserId })
      if (targetSetting && targetSetting.optOut) {
        const nickname = await getUserNickname(session, targetUserId) || targetUserId
        return `${nickname} 拒绝了和你ccb`
      }
      // ------------------------

      if (targetUserId === actorId && !config.selfCcb) {
        return '怎么还能捅到自己的啊（恼）'
      }

      const duration = parseFloat((Math.random() * 59 + 1).toFixed(2))
      let V = parseFloat((Math.random() * 99 + 1).toFixed(2))
      
      const prob = currentConfig.critProb
      let crit = false
      if (Math.random() < prob) {
        V = parseFloat((V * 2).toFixed(2))
        crit = true
      }
      
      const pic = getAvatar(targetUserId)

      // 查询数据库中该群该用户的记录
      const exists = await ctx.database.get('ccb_record', {
        groupId: session.guildId,
        userId: targetUserId
      })

      let message: string
      try {
        const nickname = await getUserNickname(session, targetUserId)
        if (exists.length > 0) {
          message = await updateCCBRecord(session, session.guildId, targetUserId, duration, V, nickname, crit, pic)
        } else {
          message = await createNewCCBRecord(session, session.guildId, targetUserId, duration, V, nickname, pic)
        }
      } catch (e) {
        console.error(`报错: ${e}`)
        return '对方拒绝了和你ccb'
      }

      if (Math.random() < currentConfig.ywProbability) {
        banList[actorId] = now + currentConfig.ywBanDuration
        await session.send(message)
        return '💥你炸膛了！再也不能ccb了（悲）'
      }

      return message
    })

  ctx.command('ccbtop', '按次数排行')
    .action(async ({ session }) => {
      const checkResult = checkGroupCommand(session)
      if (checkResult) return checkResult

      // 获取当前群所有数据
      const groupData = await ctx.database.get('ccb_record', { groupId: session.guildId })
      if (!groupData.length) return '当前群暂无ccb记录。'

      // 排序
      const top5 = groupData.sort((a, b) => b.num - a.num).slice(0, 5)

      const nicknamePromises = top5.map(r => getUserNickname(session, r.userId))
      const nicknames = await Promise.all(nicknamePromises)

      let msg = '被ccb排行榜 TOP5：\n'
      for (let i = 0; i < top5.length; i++) {
        const r = top5[i]
        const nick = nicknames[i] || r.userId
        msg += `${i + 1}. ${nick} - 次数：${r.num}\n`
      }
      return msg.trim()
    })

  ctx.command('ccbvol', '按注入量排行')
    .action(async ({ session }) => {
      const checkResult = checkGroupCommand(session)
      if (checkResult) return checkResult

      const groupData = await ctx.database.get('ccb_record', { groupId: session.guildId })
      if (!groupData.length) return '当前群暂无ccb记录。'

      const top5 = groupData.sort((a, b) => b.vol - a.vol).slice(0, 5)
      const nicknamePromises = top5.map(r => getUserNickname(session, r.userId))
      const nicknames = await Promise.all(nicknamePromises)

      let msg = '被注入量排行榜 TOP5：\n'
      for (let i = 0; i < top5.length; i++) {
        const r = top5[i]
        const nick = nicknames[i] || r.userId
        msg += `${i + 1}. ${nick} - 累计注入：${r.vol.toFixed(2)}ml\n`
      }
      return msg.trim()
    })

  ctx.command('ccbmax', '按max值排行并输出产生者')
    .action(async ({ session }) => {
      const checkResult = checkGroupCommand(session)
      if (checkResult) return checkResult

      const groupData = await ctx.database.get('ccb_record', { groupId: session.guildId })
      if (!groupData.length) return '当前群暂无ccb记录。'

      // 计算并排序
      const entries = groupData.map(r => {
        let max_val = r.max
        if (!max_val) {
          if (r.num > 0) max_val = parseFloat((r.vol / r.num).toFixed(2))
          else max_val = 0.0
        }
        return { record: r, max: max_val }
      }).sort((a, b) => b.max - a.max).slice(0, 5)

      const userIds: string[] = []
      const producerIds: (string | null)[] = []
      
      for (const item of entries) {
        const r = item.record
        userIds.push(r.userId)
        
        let producer_id = null
        const ccb_by = r.ccb_by || {}
        
        // 优先找 max 标记
        for (const actor_id in ccb_by) {
          if (ccb_by[actor_id].max) {
            producer_id = actor_id
            break
          }
        }
        
        // 没找到标记则找次数最多的
        if (!producer_id && Object.keys(ccb_by).length > 0) {
          let maxCount = -1
          for (const actor_id in ccb_by) {
            if (ccb_by[actor_id].count > maxCount) {
              maxCount = ccb_by[actor_id].count
              producer_id = actor_id
            }
          }
        }
        
        producerIds.push(producer_id)
        if (producer_id) userIds.push(producer_id)
      }

      // 批量获取昵称
      const uniqueUserIds = [...new Set(userIds)]
      const nicknameMap = new Map<string, string>()
      await Promise.all(uniqueUserIds.map(async uid => {
        nicknameMap.set(uid, await getUserNickname(session, uid))
      }))

      let msg = '单次最大注入排行榜 TOP5：\n'
      for (let i = 0; i < entries.length; i++) {
        const { record, max } = entries[i]
        const nick = nicknameMap.get(record.userId) || record.userId
        const pid = producerIds[i]
        const producer_nick = pid ? (nicknameMap.get(pid) || '未知') : '未知'
        msg += `${i + 1}. ${nick} - 单次最大：${max.toFixed(2)}ml（${producer_nick}）\n`
      }

      return msg.trim()
    })

  ctx.command('ccbinfo [target:user]', '查询某人ccb信息')
    .action(async ({ session }, target: string) => {
      const checkResult = checkGroupCommand(session)
      if (checkResult) return checkResult

      let targetUserId = session.userId
      if (target) {
        const match = target.match(/^[^:]+:(.+)$/)
        if (match) targetUserId = match[1]
      }

      const [record] = await ctx.database.get('ccb_record', { groupId: session.guildId, userId: targetUserId })
      if (!record) return '该用户暂无ccb记录。'

      const total_num = record.num
      const total_vol = record.vol
      let max_val = record.max || (total_num > 0 ? total_vol / total_num : 0)

      // 计算主动 ccb 次数 (需要全表扫描该群数据)
      const groupData = await ctx.database.get('ccb_record', { groupId: session.guildId })
      let cb_total = 0
      for (const r of groupData) {
        const info = r.ccb_by?.[targetUserId]
        if (info) cb_total += info.count
      }

      // 找第一次 ccb 的人
      let first_actor = null
      const ccb_by = record.ccb_by || {}
      for (const actor_id in ccb_by) {
        if (ccb_by[actor_id].first) {
          first_actor = actor_id
          break
        }
      }
      if (!first_actor && Object.keys(ccb_by).length > 0) {
        // Fallback: max count
        let maxCount = -1
        for (const actor_id in ccb_by) {
            if (ccb_by[actor_id].count > maxCount) {
                maxCount = ccb_by[actor_id].count
                first_actor = actor_id
            }
        }
      }

      const target_nick = await getUserNickname(session, targetUserId)
      const first_nick = first_actor ? await getUserNickname(session, first_actor) : '未知'

      const msg = [
        `【${target_nick} 】`,
        `• 破壁人：${first_nick}`,
        `• 北朝：${total_num}`,
        `• 朝壁：${cb_total}`,
        `• 诗经：${total_vol.toFixed(2)}ml`,
        `• 马克思：${max_val.toFixed(2)}ml`
      ].join('\n')

      return msg
    })

  ctx.command('xnn', 'XNN榜 - 计算群中最xnn特质的群友')
    .action(async ({ session }) => {
      const checkResult = checkGroupCommand(session)
      if (checkResult) return checkResult

      const w_num = 1.0
      const w_vol = 0.1
      const w_action = 0.5

      const groupData = await ctx.database.get('ccb_record', { groupId: session.guildId })
      if (!groupData.length) return '当前群暂无ccb记录。'

      // 预计算所有人的主动操作次数
      const actorActions: { [userId: string]: number } = {}
      for (const record of groupData) {
        const ccb_by = record.ccb_by || {}
        for (const actor_id in ccb_by) {
          actorActions[actor_id] = (actorActions[actor_id] || 0) + ccb_by[actor_id].count
        }
      }

      const ranking = groupData.map(r => {
        const actions = actorActions[r.userId] || 0
        const val = r.num * w_num + r.vol * w_vol - actions * w_action
        return { userId: r.userId, val }
      }).sort((a, b) => b.val - a.val).slice(0, 5)

      const nicknameMap = new Map<string, string>()
      await Promise.all(ranking.map(async r => {
        nicknameMap.set(r.userId, await getUserNickname(session, r.userId))
      }))

      let msg = '💎 XNN TOP5 💎\n'
      for (let i = 0; i < ranking.length; i++) {
        const { userId, val } = ranking[i]
        const nick = nicknameMap.get(userId) || userId
        msg += `${i + 1}. ${nick} - XNN值：${val.toFixed(2)}\n`
      }

      return msg.trim()
    })
}