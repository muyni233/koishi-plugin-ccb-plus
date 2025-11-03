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
  name: () => name
});
module.exports = __toCommonJS(src_exports);
var import_koishi = require("koishi");
var import_fs = require("fs");
var path = __toESM(require("path"));
var name = "ccb-plus";
var Config = import_koishi.Schema.object({
  ywWindow: import_koishi.Schema.number().default(60).description("触发赛博阳痿的窗口时间（秒）"),
  ywThreshold: import_koishi.Schema.number().default(5).description("窗口时间内最大ccb数"),
  ywBanDuration: import_koishi.Schema.number().default(900).description("养胃时长（秒）"),
  ywProbability: import_koishi.Schema.number().default(0.1).min(0).max(1).description("随机养胃概率"),
  whiteList: import_koishi.Schema.array(String).default([]).description("不能进行ccb的id列表"),
  selfCcb: import_koishi.Schema.boolean().default(false).description("是否允许对自己ccb"),
  critProb: import_koishi.Schema.number().default(0.2).min(0).max(1).description("暴击概率"),
  isLog: import_koishi.Schema.boolean().default(false).description("完整日志记录")
});
function apply(ctx, config) {
  const DATA_FILE = path.join(ctx.baseDir, "data", "ccb.json");
  const LOG_FILE = path.join(ctx.baseDir, "data", "ccb_log.json");
  const actionTimes = {};
  const banList = {};
  const nicknameCache = /* @__PURE__ */ new Map();
  const CACHE_DURATION = 5 * 60 * 1e3;
  function getAvatar(userId) {
    return `https://q4.qlogo.cn/headimg_dl?dst_uin=${userId}&spec=640`;
  }
  __name(getAvatar, "getAvatar");
  function makeit(groupData, targetUserId) {
    return groupData.some((item) => item.id === targetUserId) ? 1 : 2;
  }
  __name(makeit, "makeit");
  async function readData() {
    try {
      const data = await import_fs.promises.readFile(DATA_FILE, "utf-8");
      return JSON.parse(data);
    } catch (error) {
      if (error.code === "ENOENT") {
        return {};
      }
      console.error("读取CCB数据出错:", error);
      return {};
    }
  }
  __name(readData, "readData");
  async function writeData(data) {
    try {
      const dataDir = path.dirname(DATA_FILE);
      await import_fs.promises.mkdir(dataDir, { recursive: true });
      await import_fs.promises.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (error) {
      console.error("写入CCB数据出错:", error);
    }
  }
  __name(writeData, "writeData");
  async function appendLog(group_id, executor_id, target_id, time, vol) {
    try {
      let logs = [];
      try {
        const logData = await import_fs.promises.readFile(LOG_FILE, "utf-8");
        logs = JSON.parse(logData);
        if (!Array.isArray(logs)) {
          logs = [];
        }
      } catch (error) {
        if (error.code !== "ENOENT") {
          console.error("读取CCB日志出错:", error);
        }
      }
      const entry = {
        group: group_id,
        executor: executor_id,
        target: target_id,
        time,
        vol: vol.toFixed(2)
      };
      logs.push(entry);
      const logDir = path.dirname(LOG_FILE);
      await import_fs.promises.mkdir(logDir, { recursive: true });
      await import_fs.promises.writeFile(LOG_FILE, JSON.stringify(logs, null, 2), "utf-8");
    } catch (error) {
      console.error("append_log 失败:", error);
    }
  }
  __name(appendLog, "appendLog");
  async function getUserNickname(session, userId) {
    const cacheKey = `${session.guildId}:${userId}`;
    const cached = nicknameCache.get(cacheKey);
    const now = Date.now();
    if (cached && now - cached.timestamp < CACHE_DURATION) {
      return cached.name;
    }
    const setAndReturnName = /* @__PURE__ */ __name((name2) => {
      if (name2 && name2 !== userId) {
        const actualName = name2.trim();
        if (actualName) {
          nicknameCache.set(cacheKey, { name: actualName, timestamp: now });
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
      const displayName = userInfo?.name || userInfo?.nick || userInfo?.nickname;
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
    try {
      const userData = await session.getUser(userId);
      const result = setAndReturnName(userData?.name);
      if (result) return result;
    } catch (dbError) {
    }
    const friendlyName = `用户${userId}`;
    nicknameCache.set(cacheKey, { name: friendlyName, timestamp: now });
    return friendlyName;
  }
  __name(getUserNickname, "getUserNickname");
  function checkGroupCommand(session) {
    if (!session.guildId) {
      return "此命令只能在群聊中使用。";
    }
    return null;
  }
  __name(checkGroupCommand, "checkGroupCommand");
  async function validateTargetUser(session, target) {
    let targetUserId = session.userId;
    if (target) {
      const match = target.match(/^[^:]+:(.+)$/);
      if (match) {
        targetUserId = match[1];
        try {
          const memberInfo = await session.bot.getGuildMember(session.guildId, targetUserId);
          if (!memberInfo) {
            return "无法找到指定用户，请检查输入是否正确。";
          }
        } catch (error) {
          return "无法找到指定用户，请检查输入是否正确。";
        }
      }
    } else if (session.quote?.user?.id) {
      targetUserId = session.quote.user.id;
      try {
        const memberInfo = await session.bot.getGuildMember(session.guildId, targetUserId);
        if (!memberInfo) {
          return "无法找到指定用户，请检查输入是否正确。";
        }
      } catch (error) {
        return "无法找到指定用户，请检查输入是否正确。";
      }
    }
    return targetUserId;
  }
  __name(validateTargetUser, "validateTargetUser");
  async function updateCCBRecord(session, groupId, targetUserId, duration, V, nickname, crit, pic) {
    const allData = await readData();
    const groupData = allData[groupId] || [];
    const recordIndex = groupData.findIndex((item) => item.id === targetUserId);
    if (recordIndex !== -1) {
      const item = groupData[recordIndex];
      const senderId = session.userId;
      item.num = (item.num || 0) + 1;
      item.vol = parseFloat((item.vol + V).toFixed(2));
      let ccb_by = item.ccb_by || {};
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
      item.ccb_by = ccb_by;
      let prev_max = item.max || 0;
      if (prev_max === 0) {
        const total_vol = item.vol || 0;
        const total_num = item.num || 0;
        if (total_num > 0) {
          prev_max = parseFloat((total_vol / total_num).toFixed(2));
        }
      }
      if (V > prev_max) {
        item.max = V;
        for (const k in ccb_by) {
          const current = ccb_by[k];
          ccb_by[k] = {
            count: current?.count || 0,
            first: current?.first || false,
            max: false
          };
        }
        const senderData = ccb_by[senderId];
        ccb_by[senderId] = {
          count: senderData?.count || 0,
          first: senderData?.first || false,
          max: true
        };
      } else {
        for (const k in ccb_by) {
          const current = ccb_by[k];
          if (!(current && "max" in current)) {
            ccb_by[k] = {
              count: current?.count || 0,
              first: current?.first || false,
              max: false
            };
          }
        }
      }
      item.ccb_by = ccb_by;
      let resultMessage = crit ? `你和${nickname}发生了${duration}min长的ccb行为，向ta注入了 💥 暴击！${V.toFixed(2)}ml的生命因子` : `你和${nickname}发生了${duration}min长的ccb行为，向ta注入了${V.toFixed(2)}ml的生命因子`;
      const message = [
        resultMessage,
        import_koishi.segment.image(pic),
        `这是ta的第${item.num}次。`
      ].join("\n");
      allData[groupId] = groupData;
      await writeData(allData);
      if (config.isLog) {
        try {
          await appendLog(groupId, session.userId, targetUserId, duration, V);
        } catch (e) {
          console.warn("记录日志失败:", e);
        }
      }
      return message;
    } else {
      return "对方拒绝了和你ccb";
    }
  }
  __name(updateCCBRecord, "updateCCBRecord");
  async function createNewCCBRecord(session, groupId, targetUserId, duration, V, nickname, pic) {
    const allData = await readData();
    const groupData = allData[groupId] || [];
    const newRecord = {
      id: targetUserId,
      num: 1,
      vol: V,
      ccb_by: { [session.userId]: { count: 1, first: true, max: true } },
      max: V
    };
    groupData.push(newRecord);
    allData[groupId] = groupData;
    await writeData(allData);
    const resultMessage = `你和${nickname}发生了${duration}min长的ccb行为，向ta注入了${V.toFixed(2)}ml的生命因子`;
    const message = [
      resultMessage,
      import_koishi.segment.image(pic),
      "这是ta的初体验。"
    ].join("\n");
    if (config.isLog) {
      try {
        await appendLog(groupId, session.userId, targetUserId, duration, V);
      } catch (e) {
        console.warn("记录日志失败:", e);
      }
    }
    return message;
  }
  __name(createNewCCBRecord, "createNewCCBRecord");
  ctx.command("ccb [target:user]", "和群友赛博sex的插件PLUS", { authority: 1 }).action(async ({ session }, target) => {
    const checkResult = checkGroupCommand(session);
    if (checkResult) {
      return checkResult;
    }
    const senderId = session.userId;
    const actorId = senderId;
    const now = Date.now() / 1e3;
    const banEnd = banList[actorId] || 0;
    if (now < banEnd) {
      const remain = Math.floor(banEnd - now);
      const m = Math.floor(remain / 60);
      const s = remain % 60;
      return `嘻嘻，你已经一滴不剩了，养胃还剩 ${m}分${s}秒`;
    }
    const times = actionTimes[actorId] = actionTimes[actorId] || [];
    const cutoff = now - config.ywWindow;
    while (times.length > 0 && times[0] < cutoff) {
      times.shift();
    }
    times.push(now);
    if (times.length > config.ywThreshold) {
      banList[actorId] = now + config.ywBanDuration;
      actionTimes[actorId] = [];
      return "冲得出来吗你就冲，再冲就给你折了";
    }
    let targetUserId = await validateTargetUser(session, target);
    if (targetUserId.startsWith("无法找到")) {
      return targetUserId;
    }
    if (config.whiteList.includes(targetUserId)) {
      const nickname = await getUserNickname(session, targetUserId) || targetUserId;
      return `${nickname} 的后门被后户之神霸占了，不能ccb（悲`;
    }
    if (targetUserId === actorId && !config.selfCcb) {
      return "兄啊金箔怎么还能捅到自己的啊（恼）";
    }
    const duration = parseFloat((Math.random() * 59 + 1).toFixed(2));
    let V = parseFloat((Math.random() * 99 + 1).toFixed(2));
    const prob = config.critProb;
    let crit = false;
    if (Math.random() < prob) {
      V = parseFloat((V * 2).toFixed(2));
      crit = true;
    }
    const pic = getAvatar(targetUserId);
    const allData = await readData();
    const groupData = allData[session.guildId] || [];
    const mode = makeit(groupData, targetUserId);
    let message;
    if (mode === 1) {
      try {
        const nickname = await getUserNickname(session, targetUserId);
        message = await updateCCBRecord(session, session.guildId, targetUserId, duration, V, nickname, crit, pic);
      } catch (e) {
        console.error(`报错: ${e}`);
        return "对方拒绝了和你ccb";
      }
    } else {
      try {
        const nickname = await getUserNickname(session, targetUserId);
        message = await createNewCCBRecord(session, session.guildId, targetUserId, duration, V, nickname, pic);
      } catch (e) {
        console.error(`报错: ${e}`);
        return "对方拒绝了和你ccb";
      }
    }
    if (Math.random() < config.ywProbability) {
      banList[actorId] = now + config.ywBanDuration;
      await session.send(message);
      return "💥你的牛牛炸膛了！满身疮痍，再起不能（悲）";
    }
    return message;
  });
  ctx.command("ccbtop", "按次数排行", { authority: 1 }).action(async ({ session }) => {
    const checkResult = checkGroupCommand(session);
    if (checkResult) {
      return checkResult;
    }
    const groupData = (await readData())[session.guildId] || [];
    if (!groupData.length) {
      return "当前群暂无ccb记录。";
    }
    const top5 = groupData.sort((a, b) => (b.num || 0) - (a.num || 0)).slice(0, 5);
    const nicknamePromises = top5.map((r) => getUserNickname(session, r.id));
    const nicknames = await Promise.all(nicknamePromises);
    let msg = "被ccb排行榜 TOP5：\n";
    for (let i = 0; i < top5.length; i++) {
      const r = top5[i];
      const nick = nicknames[i] || r.id;
      msg += `${i + 1}. ${nick} - 次数：${r.num}
`;
    }
    return msg.trim();
  });
  ctx.command("ccbvol", "按注入量排行", { authority: 1 }).action(async ({ session }) => {
    const checkResult = checkGroupCommand(session);
    if (checkResult) {
      return checkResult;
    }
    const groupData = (await readData())[session.guildId] || [];
    if (!groupData.length) {
      return "当前群暂无ccb记录。";
    }
    const top5 = groupData.sort((a, b) => (b.vol || 0) - (a.vol || 0)).slice(0, 5);
    const nicknamePromises = top5.map((r) => getUserNickname(session, r.id));
    const nicknames = await Promise.all(nicknamePromises);
    let msg = "被注入量排行榜 TOP5：\n";
    for (let i = 0; i < top5.length; i++) {
      const r = top5[i];
      const nick = nicknames[i] || r.id;
      msg += `${i + 1}. ${nick} - 累计注入：${r.vol.toFixed(2)}ml
`;
    }
    return msg.trim();
  });
  ctx.command("ccbmax", "按max值排行并输出产生者", { authority: 1 }).action(async ({ session }) => {
    const checkResult = checkGroupCommand(session);
    if (checkResult) {
      return checkResult;
    }
    const groupData = (await readData())[session.guildId] || [];
    if (!groupData.length) {
      return "当前群暂无ccb记录。";
    }
    const entries = [];
    for (const r of groupData) {
      let max_val = r.max || 0;
      try {
        if (r.max !== void 0 && r.max !== null) {
          max_val = parseFloat(r.max.toString());
        } else {
          const total_vol = r.vol || 0;
          const total_num = r.num || 0;
          if (total_num > 0) {
            max_val = parseFloat((total_vol / total_num).toFixed(2));
          }
        }
      } catch (error) {
        max_val = 0;
      }
      entries.push([r, max_val]);
    }
    entries.sort((a, b) => b[1] - a[1]);
    const top5 = entries.slice(0, 5);
    const userIds = [];
    const producerIds = [];
    for (let i = 0; i < top5.length; i++) {
      const [r] = top5[i];
      const uid = r.id;
      userIds.push(uid);
      let producer_id = null;
      const ccb_by = r.ccb_by || {};
      for (const actor_id in ccb_by) {
        if (ccb_by[actor_id].max) {
          producer_id = actor_id;
          break;
        }
      }
      if (!producer_id && Object.keys(ccb_by).length > 0) {
        try {
          const entries2 = Object.entries(ccb_by);
          const maxEntry = entries2.reduce(
            ([maxId, maxInfo], [currentId, currentInfo]) => (maxInfo?.count || 0) > (currentInfo?.count || 0) ? [maxId, maxInfo] : [currentId, currentInfo]
          );
          producer_id = maxEntry[0];
        } catch (error) {
          producer_id = null;
        }
      }
      producerIds.push(producer_id);
      if (producer_id) {
        userIds.push(producer_id);
      }
    }
    const allNicknames = /* @__PURE__ */ new Map();
    const uniqueUserIds = [...new Set(userIds)];
    const nicknamePromises = uniqueUserIds.map((uid) => getUserNickname(session, uid));
    const nicknameResults = await Promise.all(nicknamePromises);
    for (let i = 0; i < uniqueUserIds.length; i++) {
      allNicknames.set(uniqueUserIds[i], nicknameResults[i] || uniqueUserIds[i]);
    }
    let msg = "单次最大注入排行榜 TOP5：\n";
    for (let i = 0; i < top5.length; i++) {
      const [r, max_val] = top5[i];
      const uid = r.id;
      const nick = allNicknames.get(uid) || uid;
      const producer_nick = producerIds[i] ? allNicknames.get(producerIds[i]) || "未知" : "未知";
      msg += `${i + 1}. ${nick} - 单次最大：${max_val.toFixed(2)}ml（${producer_nick}）
`;
    }
    return msg.trim();
  });
  ctx.command("ccbinfo [target:user]", "查询某人ccb信息：第一次对他ccb的人，被ccb的总次数，注入总量", { authority: 1 }).action(async ({ session }, target) => {
    const checkResult = checkGroupCommand(session);
    if (checkResult) {
      return checkResult;
    }
    let targetUserId = session.userId;
    if (target) {
      const match = target.match(/^[^:]+:(.+)$/);
      if (match) {
        targetUserId = match[1];
        try {
          const memberInfo = await session.bot.getGuildMember(session.guildId, targetUserId);
          if (!memberInfo) {
            return "无法找到指定用户，请检查输入是否正确。";
          }
        } catch (error) {
          return "无法找到指定用户，请检查输入是否正确。";
        }
      }
    }
    const allData = await readData();
    const groupData = allData[session.guildId] || [];
    const record = groupData.find((r) => r.id === targetUserId);
    if (!record) {
      return "该用户暂无ccb记录。";
    }
    const total_num = record.num || 0;
    const total_vol = record.vol || 0;
    let max_val = 0;
    try {
      if (record.max !== void 0 && record.max !== null) {
        max_val = parseFloat(record.max.toString());
      } else {
        if (total_num > 0) {
          max_val = parseFloat((total_vol / total_num).toFixed(2));
        }
      }
    } catch (error) {
      max_val = 0;
    }
    let cb_total = 0;
    try {
      for (const rec of groupData) {
        const by = rec.ccb_by || {};
        const info = by[targetUserId];
        if (info) {
          cb_total += info.count || 0;
        }
      }
    } catch (error) {
      cb_total = 0;
    }
    const userIds = [targetUserId];
    let first_actor = null;
    const ccb_by = record.ccb_by || {};
    for (const actor_id in ccb_by) {
      if (ccb_by[actor_id].first) {
        first_actor = actor_id;
        userIds.push(first_actor);
        break;
      }
    }
    if (!first_actor && Object.keys(ccb_by).length > 0) {
      const entries = Object.entries(ccb_by);
      const maxEntry = entries.reduce(
        ([maxId, maxInfo], [currentId, currentInfo]) => (maxInfo?.count || 0) > (currentInfo?.count || 0) ? [maxId, maxInfo] : [currentId, currentInfo]
      );
      first_actor = maxEntry[0];
      userIds.push(first_actor);
    }
    const allNicknames = /* @__PURE__ */ new Map();
    const uniqueUserIds = [...new Set(userIds)];
    const nicknamePromises = uniqueUserIds.map((uid) => getUserNickname(session, uid));
    const nicknameResults = await Promise.all(nicknamePromises);
    for (let i = 0; i < uniqueUserIds.length; i++) {
      allNicknames.set(uniqueUserIds[i], nicknameResults[i] || uniqueUserIds[i]);
    }
    const first_nick = first_actor ? allNicknames.get(first_actor) || "未知" : "未知";
    const target_nick = allNicknames.get(targetUserId) || targetUserId;
    const msg = [
      `【${target_nick} 】`,
      `• 破壁人：${first_nick || "未知"}`,
      `• 北朝：${total_num}`,
      `• 朝壁：${cb_total}`,
      `• 诗经：${total_vol.toFixed(2)}ml`,
      `• 马克思：${max_val.toFixed(2)}ml`
    ].join("\n");
    return msg;
  });
  ctx.command("xnn", "XNN榜 - 计算群中最xnn特质的群友", { authority: 1 }).action(async ({ session }) => {
    const checkResult = checkGroupCommand(session);
    if (checkResult) {
      return checkResult;
    }
    const w_num = 1;
    const w_vol = 0.1;
    const w_action = 0.5;
    const allData = await readData();
    const groupData = allData[session.guildId] || [];
    if (!groupData.length) {
      return "当前群暂无ccb记录。";
    }
    const actorActions = {};
    for (const record of groupData) {
      const ccb_by = record.ccb_by || {};
      for (const actor_id in ccb_by) {
        actorActions[actor_id] = (actorActions[actor_id] || 0) + (ccb_by[actor_id].count || 0);
      }
    }
    const ranking = [];
    for (const record of groupData) {
      const uid = record.id;
      const num = record.num || 0;
      const vol = record.vol || 0;
      const actions = actorActions[uid] || 0;
      const xnn_value = num * w_num + vol * w_vol - actions * w_action;
      ranking.push([uid, xnn_value]);
    }
    ranking.sort((a, b) => b[1] - a[1]);
    const top5 = ranking.slice(0, 5);
    const userIds = top5.map((item) => item[0]);
    const nicknamePromises = userIds.map((uid) => getUserNickname(session, uid));
    const nicknames = await Promise.all(nicknamePromises);
    let msg = "💎 小南梁 TOP5 💎\n";
    for (let i = 0; i < top5.length; i++) {
      const [uid, xnn_val] = top5[i];
      const nick = nicknames[i] || uid;
      msg += `${i + 1}. ${nick} - XNN值：${xnn_val.toFixed(2)}
`;
    }
    return msg.trim();
  });
}
__name(apply, "apply");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Config,
  apply,
  name
});
