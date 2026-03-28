# koishi-plugin-ccb-plus

[![npm](https://img.shields.io/npm/v/koishi-plugin-ccb-plus?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-ccb-plus)

Koishi 插件，与群友发生 ccb 行为。移植自 [astrbot_plugin_ccb_plus](https://github.com/Koikokokokoro/astrbot_plugin_ccb_plus)

## 功能特性

- 🎲 随机生成 ccb 时长和注入量
- 💥 暴击机制
- 🛡️ 保护模式（默认开启，需手动关闭）
- 👥 支持全局/针对性开关
- 📊 排行榜和个人数据查询
- 💾 数据库持久化存储

## 安装

```bash
npm install koishi-plugin-ccb-plus
```

## 使用说明

### 基础命令

- `ccb [@用户]` - 对指定用户进行 ccb（需要双方都关闭保护模式）
- `ccb.rank` - 查看群内 ccb 排行榜
- `ccb.info [@用户]` - 查看指定用户的 ccb 数据
- `ccb.charm` - 查看自己的魅力值

### 保护模式

**默认所有用户处于保护模式，需要手动关闭才能参与。**

#### 全局开关
- `ccb --on` - 关闭保护模式，允许所有人对你 ccb
- `ccb --off` - 开启保护模式，禁止所有人对你 ccb

#### 针对性开关（优先级更高）
- `ccb --on @用户` - 允许指定用户对你 ccb
- `ccb --off @用户` - 禁止指定用户对你 ccb

**注意：** 处于保护模式的用户无法 ccb 他人，需先使用 `ccb --on` 解除。

### 管理功能

管理员可以在插件配置界面进行批量管理：

**批量操作：**
- 无操作 - 默认选项，操作完成后请改回此项
- 重置为开放模式 - 将所有用户的全局状态设为开放
- 重置为保护模式 - 将所有用户的全局状态设为保护
- 清空所有设置 - 删除所有用户的设置记录，恢复初始状态

**说明：**
- 重置操作只影响全局状态，用户的针对性设置不受影响
- 清空操作会删除所有设置，包括针对性设置
- 操作完成后请将选项改回"无操作"，避免重复执行

## 配置项

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `selfCcb` | boolean | false | 是否允许自己 ccb 自己 |
| `critProb` | number | 0.1 | 暴击概率 (0-1) |
| `ywWindow` | number | 60 | 冷却检测时间窗口（秒）|
| `ywThreshold` | number | 5 | 冷却检测次数阈值 |
| `ywBanDuration` | number | 300 | 冷却时长（秒）|
| `ywProbability` | number | 0.05 | 炸膛概率 (0-1) |
| `toggleCooldown` | number | 10 | 开关冷却时间（秒）|
| `whiteList` | string[] | [] | 永久保护名单（用户ID）|
| `defaultOptOut` | boolean | true | 新用户默认状态（true=保护，false=开放）|

---

> 使用 Claude Opus 4.6 协助开发
