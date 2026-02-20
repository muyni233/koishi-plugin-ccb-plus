import { Schema } from 'koishi'

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
    toggleCooldown: number
    cheatList: CheatConfig[]
}

export const Config: Schema<CCBConfig> = Schema.object({
    ywWindow: Schema.number().default(60).description('全局触发冷却的窗口时间（秒）'),
    ywThreshold: Schema.number().default(5).description('全局窗口时间内最大ccb数'),
    ywBanDuration: Schema.number().default(900).description('全局冷却时长（秒）'),
    ywProbability: Schema.number().default(0.1).min(0).max(1).description('全局随机冷却概率'),
    whiteList: Schema.array(String).default([]).description('全局配置的黑名单'),
    selfCcb: Schema.boolean().default(false).description('是否允许对自己ccb'),
    critProb: Schema.number().default(0.2).min(0).max(1).description('全局暴击概率'),
    toggleCooldown: Schema.number().default(1800).description('开关保护模式的冷却时间（秒）'),
    cheatList: Schema.array(Schema.object({
        userId: Schema.string().required().description('用户ID'),
        ywWindow: Schema.number().default(10).description('特权窗口时间（秒）'),
        ywThreshold: Schema.number().default(999).description('特权窗口内最大次数'),
        ywProbability: Schema.number().default(0).min(0).max(1).description('特权冷却概率'),
        critProb: Schema.number().default(0.8).min(0).max(1).description('特权暴击概率'),
        ywBanDuration: Schema.number().default(60).description('特权冷却时长（秒）')
    })).role('table').description('开挂名单（优先级高于全局设置）')
})
