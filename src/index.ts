import { Context } from 'koishi'
import { Config, CCBConfig } from './config'
import { applyDatabase } from './model'
import { CcbState } from './utils'
import { applyCommands } from './commands'

export const name = 'ccb-plus'

// --- 注入数据库依赖 ---
export const inject = ['database']

// 导出相关配置和模型供其他地方扩展使用
export { Config }
export * from './config'
export * from './model'

export function apply(ctx: Context, config: CCBConfig) {
  // 1. 初始化数据库及迁移逻辑
  applyDatabase(ctx)

  // 2. 初始化缓存和状态
  const state = new CcbState(ctx)

  // 3. 注册命令
  applyCommands(ctx, config, state)
}