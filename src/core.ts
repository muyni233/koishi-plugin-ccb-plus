import { Context, Session, segment } from 'koishi'
import { CCBRecord } from './model'

export async function createNewCCBRecord(ctx: Context, session: Session, groupId: string, targetUserId: string, duration: number, V: number, nickname: string, crit: boolean, pic: string): Promise<string> {
    const newRecord: CCBRecord = {
        groupId,
        userId: targetUserId,
        num: 1,
        vol: V,
        max: V,
        ccb_by: { [session.userId]: { count: 1, first: true, max: true } }
    }

    await ctx.database.upsert('ccb_record', [newRecord])

    const resultMessage = crit
        ? `你和${nickname}发生了${duration}min长的ccb行为，向ta注入了 💥 暴击！${V.toFixed(2)}ml的生命因子`
        : `你和${nickname}发生了${duration}min长的ccb行为，向ta注入了${V.toFixed(2)}ml的生命因子`
    const message = [
        resultMessage,
        segment.image(pic),
        '这是ta的初体验。'
    ].join('\n')

    return message
}

export async function updateCCBRecord(ctx: Context, session: Session, groupId: string, targetUserId: string, duration: number, V: number, nickname: string, crit: boolean, pic: string): Promise<string> {
    // 获取现有记录
    const [record] = await ctx.database.get('ccb_record', { groupId, userId: targetUserId })

    // 如果没有记录，调用创建新记录逻辑
    if (!record) {
        return await createNewCCBRecord(ctx, session, groupId, targetUserId, duration, V, nickname, crit, pic)
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
