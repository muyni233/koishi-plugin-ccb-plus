var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  Config: () => Config,
  apply: () => apply,
  applyDatabase: () => applyDatabase,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(src_exports);

// src/config.ts
var import_koishi = require("koishi");
var Config = import_koishi.Schema.object({
  ywWindow: import_koishi.Schema.number().default(60).description("全局触发冷却的窗口时间（秒）"),
  ywThreshold: import_koishi.Schema.number().default(5).description("全局窗口时间内最大ccb数"),
  ywBanDuration: import_koishi.Schema.number().default(900).description("全局冷却时长（秒）"),
  ywProbability: import_koishi.Schema.number().default(0.1).min(0).max(1).description("全局随机冷却概率"),
  whiteList: import_koishi.Schema.array(String).default([]).description("全局配置的黑名单"),
  selfCcb: import_koishi.Schema.boolean().default(false).description("是否允许对自己ccb"),
  critProb: import_koishi.Schema.number().default(0.2).min(0).max(1).description("全局暴击概率"),
  toggleCooldown: import_koishi.Schema.number().default(1800).description("开关保护模式的冷却时间（秒）"),
  cheatList: import_koishi.Schema.array(import_koishi.Schema.object({
    userId: import_koishi.Schema.string().required().description("用户ID"),
    ywWindow: import_koishi.Schema.number().default(10).description("特权窗口时间（秒）"),
    ywThreshold: import_koishi.Schema.number().default(999).description("特权窗口内最大次数"),
    ywProbability: import_koishi.Schema.number().default(0).min(0).max(1).description("特权冷却概率"),
    critProb: import_koishi.Schema.number().default(0.8).min(0).max(1).description("特权暴击概率"),
    ywBanDuration: import_koishi.Schema.number().default(60).description("特权冷却时长（秒）")
  })).role("table").description("开挂名单（优先级高于全局设置）")
});

// src/model.ts
var import_fs = require("fs");
var path = __toESM(require("path"));
function applyDatabase(ctx) {
  ctx.model.extend("ccb_record", {
    groupId: "string",
    userId: "string",
    num: "unsigned",
    vol: "double",
    max: "double",
    ccb_by: "json"
  }, {
    primary: ["groupId", "userId"]
    // 联合主键
  });
  ctx.model.extend("ccb_setting", {
    userId: "string",
    optOut: "boolean",
    lastToggleTime: "unsigned",
    overrides: "json"
  }, {
    primary: "userId"
  });
  ctx.on("ready", async () => {
    const DATA_FILE = path.join(ctx.baseDir, "data", "ccb.json");
    try {
      await import_fs.promises.access(DATA_FILE);
      console.log("[ccb-plus] 检测到旧版数据文件，正在迁移至数据库...");
      const fileContent = await import_fs.promises.readFile(DATA_FILE, "utf-8");
      const jsonData = JSON.parse(fileContent);
      const ops = [];
      for (const groupId in jsonData) {
        const groupRecords = jsonData[groupId];
        if (Array.isArray(groupRecords)) {
          for (const record of groupRecords) {
            ops.push(
              ctx.database.upsert("ccb_record", [{
                groupId,
                userId: record.id,
                num: record.num,
                vol: record.vol,
                max: record.max,
                ccb_by: record.ccb_by
              }])
            );
          }
        }
      }
      await Promise.all(ops);
      const BACKUP_FILE = path.join(ctx.baseDir, "data", "ccb.json.migrated");
      await import_fs.promises.rename(DATA_FILE, BACKUP_FILE);
      console.log(`[ccb-plus] 数据迁移完成，旧文件已重命名为 ${BACKUP_FILE}`);
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.error("[ccb-plus] 数据迁移过程中出错:", error);
      }
    }
  });
}
__name(applyDatabase, "applyDatabase");

// src/utils.ts
var import_koishi2 = require("koishi");
var CcbState = class _CcbState {
  static {
    __name(this, "CcbState");
  }
  actionTimes = {};
  banList = {};
  nicknameCache = /* @__PURE__ */ new Map();
  static MAX_CACHE_SIZE = 2e3;
  static CACHE_DURATION = 5 * 60 * 1e3;
  cleanupTimer;
  constructor(ctx) {
    const CLEANUP_INTERVAL = 10 * 60 * 1e3;
    this.cleanupTimer = setInterval(() => this.cleanup(), CLEANUP_INTERVAL);
    ctx.on("dispose", () => {
      clearInterval(this.cleanupTimer);
    });
  }
  cleanup() {
    const nowMs = Date.now();
    const nowSec = nowMs / 1e3;
    for (const userId in this.banList) {
      if (this.banList[userId] < nowSec) {
        delete this.banList[userId];
      }
    }
    for (const userId in this.actionTimes) {
      if (!this.actionTimes[userId]?.length) {
        delete this.actionTimes[userId];
      }
    }
    for (const [key, value] of this.nicknameCache) {
      if (nowMs - value.timestamp > _CcbState.CACHE_DURATION) {
        this.nicknameCache.delete(key);
      }
    }
  }
  getAvatar(userId) {
    return `https://q4.qlogo.cn/headimg_dl?dst_uin=${userId}&spec=640`;
  }
  async getUserNickname(session, userId) {
    const cacheKey = `${session.guildId}:${userId}`;
    const cached = this.nicknameCache.get(cacheKey);
    const now = Date.now();
    if (cached && now - cached.timestamp < _CcbState.CACHE_DURATION) {
      return cached.name;
    }
    const setAndReturnName = /* @__PURE__ */ __name((name2) => {
      if (name2 && name2 !== userId) {
        const actualName = name2.trim();
        if (actualName) {
          if (this.nicknameCache.size >= _CcbState.MAX_CACHE_SIZE) {
            const oldestKey = this.nicknameCache.keys().next().value;
            if (oldestKey) this.nicknameCache.delete(oldestKey);
          }
          this.nicknameCache.set(cacheKey, { name: actualName, timestamp: now });
          return actualName;
        }
      }
      return null;
    }, "setAndReturnName");
    if (session.guildId && userId) {
      try {
        const memberInfo = await session.bot.getGuildMember(session.guildId, userId);
        const displayName = memberInfo?.nick || memberInfo?.user?.name || memberInfo?.name;
        const result = setAndReturnName(displayName);
        if (result) return result;
      } catch (error) {
      }
    }
    try {
      const userInfo = await session.bot.getUser(userId);
      const displayName = userInfo?.name || userInfo?.nick;
      const result = setAndReturnName(displayName);
      if (result) return result;
    } catch (e) {
    }
    try {
      if (session.event?.user?.id === userId) {
        const result = setAndReturnName(session.event?.user?.name);
        if (result) return result;
      }
    } catch (nestedError) {
    }
    const friendlyName = `用户${userId}`;
    this.nicknameCache.set(cacheKey, { name: friendlyName, timestamp: now });
    return friendlyName;
  }
  checkGroupCommand(session) {
    if (!session.guildId) {
      return "此命令只能在群聊中使用。";
    }
    return null;
  }
  async findTargetUser(session, input) {
    if (!input) return null;
    try {
      const elements = import_koishi2.h.parse(input);
      const atEl = elements.find((el) => el.type === "at");
      if (atEl?.attrs?.id) {
        return String(atEl.attrs.id);
      }
    } catch (e) {
      const atMatch = input.match(/<at\s+(?:.*?\s+)?id=(["'])(.*?)\1/i);
      if (atMatch) return atMatch[2];
    }
    const colonIndex = input.indexOf(":");
    if (colonIndex > 0 && colonIndex < input.length - 1) {
      return input.slice(colonIndex + 1);
    }
    if (/^\d+$/.test(input)) {
      return input;
    }
    try {
      const list = await session.bot.getGuildMemberList(session.guildId);
      const members = list?.data;
      if (!members?.length) return null;
      const targetName = input.replace(/\s/g, "").toLowerCase();
      let exactMatchId;
      let partialMatchId;
      for (const m of members) {
        const nick = m.nick || m.user?.name || m.name || "";
        if (!nick) continue;
        const cleanNick = nick.replace(/\s/g, "").toLowerCase();
        if (cleanNick === targetName) {
          exactMatchId = m.user?.id;
          break;
        }
        if (!partialMatchId && cleanNick.includes(targetName)) {
          partialMatchId = m.user?.id;
        }
      }
      const finalMatch = exactMatchId || partialMatchId;
      if (finalMatch) return finalMatch;
    } catch (e) {
    }
    return null;
  }
  async validateTargetUser(session, target) {
    if (target) {
      const foundId = await this.findTargetUser(session, target);
      if (foundId) {
        try {
          const member = await session.bot.getGuildMember(session.guildId, foundId);
          if (!member) return "无法找到指定用户，请检查输入是否正确。";
        } catch {
          return "无法找到指定用户，请检查输入是否正确。";
        }
        return foundId;
      }
      return "无法找到指定用户，请检查输入是否正确。";
    }
    if (session.quote?.user?.id) {
      return session.quote.user.id;
    }
    return session.userId;
  }
};

// src/core.ts
var import_koishi3 = require("koishi");
async function createNewCCBRecord(ctx, session, groupId, targetUserId, duration, V, nickname, crit, pic) {
  const newRecord = {
    groupId,
    userId: targetUserId,
    num: 1,
    vol: V,
    max: V,
    ccb_by: { [session.userId]: { count: 1, first: true, max: true } }
  };
  await ctx.database.upsert("ccb_record", [newRecord]);
  const resultMessage = crit ? `你和${nickname}发生了${duration}min长的ccb行为，向ta注入了 💥 暴击！${V.toFixed(2)}ml的生命因子` : `你和${nickname}发生了${duration}min长的ccb行为，向ta注入了${V.toFixed(2)}ml的生命因子`;
  const message = [
    resultMessage,
    import_koishi3.segment.image(pic),
    "这是ta的初体验。"
  ].join("\n");
  return message;
}
__name(createNewCCBRecord, "createNewCCBRecord");
async function updateCCBRecord(ctx, session, groupId, targetUserId, duration, V, nickname, crit, pic) {
  const [record] = await ctx.database.get("ccb_record", { groupId, userId: targetUserId });
  if (!record) {
    return await createNewCCBRecord(ctx, session, groupId, targetUserId, duration, V, nickname, crit, pic);
  }
  const senderId = session.userId;
  const newNum = (record.num || 0) + 1;
  const newVol = parseFloat(((record.vol || 0) + V).toFixed(2));
  let ccb_by = record.ccb_by || {};
  ccb_by = JSON.parse(JSON.stringify(ccb_by));
  if (senderId in ccb_by) {
    const current = ccb_by[senderId];
    ccb_by[senderId] = {
      count: (current?.count || 0) + 1,
      first: current?.first || false,
      max: current?.max || false
    };
  } else {
    ccb_by[senderId] = { count: 1, first: false, max: false };
  }
  let prev_max = record.max || 0;
  if (prev_max === 0 && (record.num || 0) > 0) {
    prev_max = parseFloat(((record.vol || 0) / (record.num || 0)).toFixed(2));
  }
  let newMax = prev_max;
  if (V > prev_max) {
    newMax = V;
    for (const k in ccb_by) {
      if (ccb_by[k]) ccb_by[k].max = false;
    }
    if (ccb_by[senderId]) ccb_by[senderId].max = true;
  }
  await ctx.database.set("ccb_record", { groupId, userId: targetUserId }, {
    num: newNum,
    vol: newVol,
    max: newMax,
    ccb_by
  });
  const resultMessage = crit ? `你和${nickname}发生了${duration}min长的ccb行为，向ta注入了 💥 暴击！${V.toFixed(2)}ml的生命因子` : `你和${nickname}发生了${duration}min长的ccb行为，向ta注入了${V.toFixed(2)}ml的生命因子`;
  const message = [
    resultMessage,
    import_koishi3.segment.image(pic),
    `这是ta的第${newNum}次。`
  ].join("\n");
  return message;
}
__name(updateCCBRecord, "updateCCBRecord");

// src/commands/ccb.ts
function applyCcbCommand(ctx, config, state) {
  ctx.command("ccb [target:user]", "给群友注入生命因子").option("off", "--off [user:string] 将自己加入白名单（禁止被人ccb），可指定用户").option("on", "--on [user:string] 将自己移出白名单（允许被人ccb），可指定用户").action(async ({ session, options }, target) => {
    const checkResult = state.checkGroupCommand(session);
    if (checkResult) return checkResult;
    const senderId = session.userId;
    const checkCooldown = /* @__PURE__ */ __name((lastToggle) => {
      const now2 = Date.now();
      const cooldownMs = config.toggleCooldown * 1e3;
      if (now2 - lastToggle < cooldownMs) {
        const remain = Math.ceil((cooldownMs - (now2 - lastToggle)) / 1e3);
        const m = Math.floor(remain / 60);
        const s = remain % 60;
        return `操作太频繁了，请等待 ${m}分${s}秒 后再试。`;
      }
      return null;
    }, "checkCooldown");
    const hasOff = "off" in options;
    const hasOn = "on" in options;
    if (hasOff || hasOn) {
      const isOff = hasOff;
      const optionVal = isOff ? options.off : options.on;
      let targetUserStr = null;
      if (typeof optionVal === "string" && optionVal.trim()) {
        targetUserStr = await state.findTargetUser(session, optionVal.trim());
      }
      if (!targetUserStr) {
        const atEl = session.elements?.find((el) => el.type === "at");
        if (atEl?.attrs?.id) {
          targetUserStr = String(atEl.attrs.id);
        }
      }
      if (!targetUserStr && typeof optionVal === "string" && optionVal.trim()) {
        return `无法找到用户「${optionVal}」，请检查输入是否正确。`;
      }
      if (targetUserStr) {
        try {
          const memberInfo = await session.bot.getGuildMember(session.guildId, targetUserStr);
          if (!memberInfo) return "无法找到指定用户，请检查输入是否正确。";
        } catch (error) {
          return "无法找到指定用户，请检查输入是否正确。";
        }
      }
      const [userSetting] = await ctx.database.get("ccb_setting", { userId: senderId });
      const lastToggle = userSetting?.lastToggleTime || 0;
      const cooldownResult = checkCooldown(lastToggle);
      if (cooldownResult) return cooldownResult;
      const nowMs = Date.now();
      if (!targetUserStr) {
        const newOptOut = !!isOff;
        await ctx.database.upsert("ccb_setting", [{
          userId: senderId,
          optOut: newOptOut,
          lastToggleTime: nowMs,
          overrides: userSetting?.overrides || {}
        }]);
        return newOptOut ? "已开启全局保护模式，阻止你被ccb。" : "已关闭全局保护模式，允许你被ccb。";
      } else {
        const targetId = targetUserStr;
        const overrides = userSetting?.overrides || {};
        overrides[targetId] = !isOff;
        await ctx.database.upsert("ccb_setting", [{
          userId: senderId,
          overrides,
          optOut: userSetting?.optOut ?? false,
          lastToggleTime: nowMs
        }]);
        const targetNick = await state.getUserNickname(session, targetId).catch(() => targetId) || targetId;
        return isOff ? `已禁止用户 ${targetNick} 对你ccb。` : `已允许用户 ${targetNick} 对你ccb。`;
      }
    }
    const [senderSetting] = await ctx.database.get("ccb_setting", { userId: senderId });
    if (senderSetting?.optOut) {
      return "你已开启保护模式，无法ccb他人。请先使用 --on 解除保护。";
    }
    const actorId = senderId;
    const now = Date.now() / 1e3;
    const cheatSetting = config.cheatList.find((c) => c.userId === actorId);
    const currentConfig = {
      ywWindow: cheatSetting ? cheatSetting.ywWindow : config.ywWindow,
      ywThreshold: cheatSetting ? cheatSetting.ywThreshold : config.ywThreshold,
      ywBanDuration: cheatSetting ? cheatSetting.ywBanDuration : config.ywBanDuration,
      ywProbability: cheatSetting ? cheatSetting.ywProbability : config.ywProbability,
      critProb: cheatSetting ? cheatSetting.critProb : config.critProb
    };
    const banEnd = state.banList[actorId] || 0;
    if (now < banEnd) {
      const remain = Math.floor(banEnd - now);
      const m = Math.floor(remain / 60);
      const s = remain % 60;
      return `嘻嘻，你已经一滴不剩了，填充还剩 ${m}分${s}秒`;
    }
    const times = state.actionTimes[actorId] = state.actionTimes[actorId] || [];
    const cutoff = now - currentConfig.ywWindow;
    while (times.length > 0 && times[0] < cutoff) {
      times.shift();
    }
    times.push(now);
    if (times.length > currentConfig.ywThreshold) {
      state.banList[actorId] = now + currentConfig.ywBanDuration;
      state.actionTimes[actorId] = [];
      return "冲得出来吗你就冲，再冲就给你折了";
    }
    let targetUserId = await state.validateTargetUser(session, target);
    if (targetUserId.startsWith("无法找到")) {
      return targetUserId;
    }
    if (config.whiteList.includes(targetUserId)) {
      const nickname = await state.getUserNickname(session, targetUserId) || targetUserId;
      return `${nickname} 拒绝了和你ccb。`;
    }
    if (senderSetting?.overrides?.[targetUserId] === false) {
      const nickname = await state.getUserNickname(session, targetUserId) || targetUserId;
      return `你已禁止与 ${nickname} 进行ccb。`;
    }
    const [targetSetting] = await ctx.database.get("ccb_setting", { userId: targetUserId });
    if (targetSetting) {
      const overrides = targetSetting.overrides || {};
      if (overrides[actorId] === false) {
        const nickname = await state.getUserNickname(session, targetUserId) || targetUserId;
        return `${nickname} 拒绝了和你ccb`;
      }
      if (overrides[actorId] !== true && targetSetting.optOut) {
        const nickname = await state.getUserNickname(session, targetUserId) || targetUserId;
        return `${nickname} 拒绝了和你ccb`;
      }
    }
    if (targetUserId === actorId && !config.selfCcb) {
      return "怎么还能对自己下手啊（恼）";
    }
    const duration = parseFloat((Math.random() * 59 + 1).toFixed(2));
    let V = parseFloat((Math.random() * 99 + 1).toFixed(2));
    const prob = currentConfig.critProb;
    let crit = false;
    if (Math.random() < prob) {
      V = parseFloat((V * 2).toFixed(2));
      crit = true;
    }
    const pic = state.getAvatar(targetUserId);
    let message;
    try {
      const nickname = await state.getUserNickname(session, targetUserId);
      message = await updateCCBRecord(ctx, session, session.guildId, targetUserId, duration, V, nickname, crit, pic);
    } catch (e) {
      console.error(`报错: ${e}`);
      return "对方拒绝了和你ccb";
    }
    if (Math.random() < currentConfig.ywProbability) {
      state.banList[actorId] = now + currentConfig.ywBanDuration;
      await session.send(message);
      return "💥你炸膛了！不能ccb了（悲）";
    }
    return message;
  });
}
__name(applyCcbCommand, "applyCcbCommand");

// src/commands/rank.ts
function applyRankCommands(ctx, state) {
  async function buildRanking(session, title, data, formatLine) {
    const nicknameMap = /* @__PURE__ */ new Map();
    await Promise.all(data.map(async (r) => {
      nicknameMap.set(r.userId, await state.getUserNickname(session, r.userId));
    }));
    let msg = `${title}
`;
    for (let i = 0; i < data.length; i++) {
      const nick = nicknameMap.get(data[i].userId) || data[i].userId;
      msg += formatLine(data[i], nick, i);
    }
    return msg.trim();
  }
  __name(buildRanking, "buildRanking");
  ctx.command("ccbtop", "按次数排行").action(async ({ session }) => {
    const checkResult = state.checkGroupCommand(session);
    if (checkResult) return checkResult;
    const groupData = await ctx.database.get("ccb_record", { groupId: session.guildId });
    if (!groupData.length) return "当前群暂无ccb记录。";
    const top5 = groupData.sort((a, b) => b.num - a.num).slice(0, 5);
    return buildRanking(
      session,
      "被ccb排行榜 TOP5：",
      top5,
      (r, nick, i) => `${i + 1}. ${nick} - 次数：${r.num}
`
    );
  });
  ctx.command("ccbvol", "按注入量排行").action(async ({ session }) => {
    const checkResult = state.checkGroupCommand(session);
    if (checkResult) return checkResult;
    const groupData = await ctx.database.get("ccb_record", { groupId: session.guildId });
    if (!groupData.length) return "当前群暂无ccb记录。";
    const top5 = groupData.sort((a, b) => b.vol - a.vol).slice(0, 5);
    return buildRanking(
      session,
      "被注入量排行榜 TOP5：",
      top5,
      (r, nick, i) => `${i + 1}. ${nick} - 累计注入：${r.vol.toFixed(2)}ml
`
    );
  });
  ctx.command("ccbmax", "按max值排行并输出产生者").action(async ({ session }) => {
    const checkResult = state.checkGroupCommand(session);
    if (checkResult) return checkResult;
    const groupData = await ctx.database.get("ccb_record", { groupId: session.guildId });
    if (!groupData.length) return "当前群暂无ccb记录。";
    const entries = groupData.map((r) => {
      let max_val = r.max;
      if (!max_val) {
        if (r.num > 0) max_val = parseFloat((r.vol / r.num).toFixed(2));
        else max_val = 0;
      }
      return { record: r, max: max_val };
    }).sort((a, b) => b.max - a.max).slice(0, 5);
    const userIds = [];
    const producerIds = [];
    for (const item of entries) {
      const r = item.record;
      userIds.push(r.userId);
      let producer_id = null;
      const ccb_by = r.ccb_by || {};
      for (const actor_id in ccb_by) {
        if (ccb_by[actor_id].max) {
          producer_id = actor_id;
          break;
        }
      }
      if (!producer_id && Object.keys(ccb_by).length > 0) {
        let maxCount = -1;
        for (const actor_id in ccb_by) {
          if (ccb_by[actor_id].count > maxCount) {
            maxCount = ccb_by[actor_id].count;
            producer_id = actor_id;
          }
        }
      }
      producerIds.push(producer_id);
      if (producer_id) userIds.push(producer_id);
    }
    const uniqueUserIds = [...new Set(userIds)];
    const nicknameMap = /* @__PURE__ */ new Map();
    await Promise.all(uniqueUserIds.map(async (uid) => {
      nicknameMap.set(uid, await state.getUserNickname(session, uid));
    }));
    let msg = "单次最大注入排行榜 TOP5：\n";
    for (let i = 0; i < entries.length; i++) {
      const { record, max } = entries[i];
      const nick = nicknameMap.get(record.userId) || record.userId;
      const pid = producerIds[i];
      const producer_nick = pid ? nicknameMap.get(pid) || "未知" : "未知";
      msg += `${i + 1}. ${nick} - 单次最大：${max.toFixed(2)}ml（${producer_nick}）
`;
    }
    return msg.trim();
  });
}
__name(applyRankCommands, "applyRankCommands");

// src/commands/info.ts
function applyInfoCommand(ctx, state) {
  ctx.command("ccbinfo [target:user]", "查询某人ccb信息").action(async ({ session }, target) => {
    const checkResult = state.checkGroupCommand(session);
    if (checkResult) return checkResult;
    let targetUserId = await state.validateTargetUser(session, target);
    if (targetUserId.startsWith("无法找到")) {
      return targetUserId;
    }
    const [record] = await ctx.database.get("ccb_record", { groupId: session.guildId, userId: targetUserId });
    if (!record) return "该用户暂无ccb记录。";
    const total_num = record.num;
    const total_vol = record.vol;
    const max_val = record.max || (total_num > 0 ? total_vol / total_num : 0);
    const groupData = await ctx.database.get("ccb_record", { groupId: session.guildId });
    let cb_total = 0;
    for (const r of groupData) {
      const info = r.ccb_by?.[targetUserId];
      if (info) cb_total += info.count;
    }
    let first_actor = null;
    const ccb_by = record.ccb_by || {};
    for (const actor_id in ccb_by) {
      if (ccb_by[actor_id].first) {
        first_actor = actor_id;
        break;
      }
    }
    if (!first_actor && Object.keys(ccb_by).length > 0) {
      let maxCount = -1;
      for (const actor_id in ccb_by) {
        if (ccb_by[actor_id].count > maxCount) {
          maxCount = ccb_by[actor_id].count;
          first_actor = actor_id;
        }
      }
    }
    const target_nick = await state.getUserNickname(session, targetUserId);
    const first_nick = first_actor ? await state.getUserNickname(session, first_actor) : "未知";
    const msg = [
      `【${target_nick} 】`,
      `• 开拓者：${first_nick}`,
      `• 被注入次数：${total_num}`,
      `• 主动出击：${cb_total}`,
      `• 累计容量：${total_vol.toFixed(2)}ml`,
      `• 单次最高：${max_val.toFixed(2)}ml`
    ].join("\n");
    return msg;
  });
}
__name(applyInfoCommand, "applyInfoCommand");

// src/commands/charm.ts
function applyCharmCommand(ctx, state) {
  ctx.command("ccbcharm", "魅力榜 - 计算群中最受欢迎的群友").action(async ({ session }) => {
    const checkResult = state.checkGroupCommand(session);
    if (checkResult) return checkResult;
    const w_num = 1;
    const w_vol = 0.1;
    const w_action = 0.5;
    const groupData = await ctx.database.get("ccb_record", { groupId: session.guildId });
    if (!groupData.length) return "当前群暂无ccb记录。";
    const actorActions = {};
    for (const record of groupData) {
      const ccb_by = record.ccb_by || {};
      for (const actor_id in ccb_by) {
        actorActions[actor_id] = (actorActions[actor_id] || 0) + ccb_by[actor_id].count;
      }
    }
    const ranking = groupData.map((r) => {
      const actions = actorActions[r.userId] || 0;
      const val = r.num * w_num + r.vol * w_vol - actions * w_action;
      return { userId: r.userId, val };
    }).sort((a, b) => b.val - a.val).slice(0, 5);
    const nicknameMap = /* @__PURE__ */ new Map();
    await Promise.all(ranking.map(async (r) => {
      nicknameMap.set(r.userId, await state.getUserNickname(session, r.userId));
    }));
    let msg = "💎 魅力榜 TOP5 💎\n";
    for (let i = 0; i < ranking.length; i++) {
      const { userId, val } = ranking[i];
      const nick = nicknameMap.get(userId) || userId;
      msg += `${i + 1}. ${nick} - 魅力值：${val.toFixed(2)}
`;
    }
    return msg.trim();
  });
}
__name(applyCharmCommand, "applyCharmCommand");

// src/commands/index.ts
function applyCommands(ctx, config, state) {
  applyCcbCommand(ctx, config, state);
  applyRankCommands(ctx, state);
  applyInfoCommand(ctx, state);
  applyCharmCommand(ctx, state);
}
__name(applyCommands, "applyCommands");

// src/index.ts
var name = "ccb-plus";
var inject = ["database"];
function apply(ctx, config) {
  applyDatabase(ctx);
  const state = new CcbState(ctx);
  applyCommands(ctx, config, state);
}
__name(apply, "apply");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Config,
  apply,
  applyDatabase,
  inject,
  name
});
