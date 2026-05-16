import http from "http";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { nanoid } from "nanoid";
import { Server } from "socket.io";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const PORT = Number(process.env.PORT || 3001);
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "*";
const MAX_MESSAGE_LENGTH = 300;
const ROOM_CODE_LENGTH = 6;
const RESPONSE_TIMEOUT_MS = 7 * 60 * 1000;
const AI_THINKING_MIN_MS = 2800;
const AI_THINKING_MAX_MS = 6200;
const AI_TYPING_BASE_MS = 2200;
const AI_TYPING_PER_CHAR_MS = 75;
const AI_TYPING_MAX_MS = 16000;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGIN === "*" ? true : CLIENT_ORIGIN.split(",").map((item) => item.trim()),
    methods: ["GET", "POST"]
  }
});

app.use(
  cors({
    origin: CLIENT_ORIGIN === "*" ? true : CLIENT_ORIGIN.split(",").map((item) => item.trim())
  })
);
app.use(express.json());

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

const rooms = new Map();
const socketToPlayer = new Map();

const ROUND_DEFINITIONS = [
  {
    id: "round_1",
    title: "第一輪：自我介紹",
    prompt: "請用虛擬身份做自然的自我介紹，內容必須緊扣個人簡介。"
  },
  {
    id: "round_2",
    title: "第二輪：深度破冰",
    prompt: "延伸第一輪，補充你的經歷、習慣或價值觀，依然只能根據簡介發揮。"
  },
  {
    id: "round_3",
    title: "第三輪：人類和AI的本質區別",
    prompt: "圍繞人類與 AI 的本質差異發言，兼顧自證與觀察，不可暴露真實身份。"
  },
  {
    id: "round_4",
    title: "第四輪：最終拉票",
    prompt: "最後一次替自己辯護，嘗試說服大家不要把票投給你。"
  }
];

const NAME_POOL = [
  "蘋果",
  "香蕉",
  "海鹽",
  "月桃",
  "松露",
  "星砂",
  "青梅",
  "奶蓋",
  "烏龍",
  "小夜",
  "初雪",
  "黑糖",
  "流螢",
  "山嵐",
  "紙鳶",
  "琥珀",
  "霧森",
  "豆花",
  "南風",
  "薄荷"
];

const INTEREST_POOL = [
  "週末喜歡跑咖、記錄咖啡風味",
  "熱衷戶外露營和山線小旅行",
  "常逛展覽，也會順手拍街頭人物",
  "很愛桌遊，尤其喜歡推理和陣營類",
  "平常會追球賽，也喜歡跟朋友聊戰術",
  "喜歡甜點烘焙，常研究口感和香氣層次",
  "是重度音樂愛好者，歌單會跟情緒一起變",
  "會在城市裡散步，邊觀察人邊想故事",
  "喜歡整理帳目、寫規劃表，對數字很有感",
  "熱愛看社會議題文章，會一直追後續討論"
];

const JOB_POOL = [
  "目前在品牌行銷團隊負責活動企劃，常要整理資訊、抓節奏和對外溝通。",
  "現在做產品設計相關工作，平常會訪談使用者、拆問題、調整細節。",
  "在餐飲營運端工作，習慣觀察現場節奏，也很重視情緒跟服務感受。",
  "平常在內容編輯領域上班，工作內容是整理資料、寫稿、調整敘事順序。",
  "目前做專案管理，習慣把混亂局面拆成幾個可處理的小步驟。",
  "在教育訓練相關工作，常常需要聽人說話、抓重點，再換個方式表達。",
  "做影像與社群內容企劃，平時很依賴觀察力和現場感。",
  "目前在零售通路工作，對人的反應、語氣和購買猶豫會特別敏感。",
  "在活動執行端工作，常要同時顧流程、顧氣氛，也得臨場應變。",
  "做研究助理性質的工作，平常習慣比對資訊、找前後是否一致。"
];

const PERSONALITY_POOL = [
  "個性偏慢熱，但一熟起來其實很會接話。",
  "平常看起來冷靜，其實心裡想很多。",
  "自認直覺不差，但不喜歡太快把話說死。",
  "講話算直接，不過會顧一下場面不要太僵。",
  "對細節很敏感，尤其在意前後說法有沒有對上。",
  "偏理性，習慣先整理脈絡再表態。",
  "緊張時會故意講輕鬆一點，不想讓氣氛太硬。",
  "很重視誠意，遇到太完美或太制式的說法反而會起疑。"
];

const SOCIAL_POOL = [
  "跟不熟的人相處時，通常會先聽大家講，再慢慢補自己的看法。",
  "如果現場氣氛怪怪的，我會先觀察誰在帶節奏。",
  "我不太愛搶話，但會記住每個人前面講過什麼。",
  "遇到壓力時會表面裝沒事，實際上腦袋轉得很快。",
  "比起聽漂亮結論，我更常看一個人的語氣是不是自然。",
  "我很吃現場感，誰太像準備好的稿子，我會忍不住留意。"
];

const VIOLATION_PATTERNS = [
  /我是(ai|AI|人工智慧|機器人|模型|Gemini|GPT|ChatGPT)/i,
  /身分證|手機|電話|line|ig|instagram|facebook|住在|公司|學校/i,
  /https?:\/\//i,
  /\d{8,}/
];

function shuffle(array) {
  const copy = [...array];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function generateRoomCode() {
  let code = "";
  do {
    code = Math.random().toString(36).slice(2, 8).toUpperCase();
  } while (rooms.has(code) || code.length !== ROOM_CODE_LENGTH);
  return code;
}

function nowIso() {
  return new Date().toISOString();
}

function createSystemMessage(content, options = {}) {
  return {
    id: nanoid(),
    type: "system",
    title: options.title || "系統通知",
    variant: options.variant || "info",
    content,
    createdAt: nowIso()
  };
}

function getDisplayName(player) {
  if (player.virtualNumber && player.virtualName) {
    return `${player.virtualNumber}號${player.virtualName}`;
  }

  return player.realName;
}

function getHumanPlayers(room) {
  return room.players.filter((player) => !player.isAI);
}

function getAlivePlayers(room) {
  return room.players.filter((player) => player.isAlive);
}

function getAliveHumans(room) {
  return room.players.filter((player) => player.isAlive && !player.isAI);
}

function getAliveAis(room) {
  return room.players.filter((player) => player.isAlive && player.isAI);
}

function formatProfile(profile, mode = "full") {
  if (!profile) {
    return "";
  }

  if (typeof profile === "string") {
    return profile;
  }

  const summary = `興趣是${profile.interest}。${profile.work} ${profile.personality}`;
  if (mode === "summary") {
    return summary;
  }

  return [
    `興趣：${profile.interest}`,
    `工作內容：${profile.work}`,
    `個性：${profile.personality}`,
    `互動風格：${profile.socialStyle}`
  ].join("\n");
}

function buildProfiles(playerCount) {
  const interests = shuffle(INTEREST_POOL);
  const jobs = shuffle(JOB_POOL);
  const personalities = shuffle(PERSONALITY_POOL);
  const socials = shuffle(SOCIAL_POOL);

  return Array.from({ length: playerCount }, (_, index) => ({
    interest: interests[index % interests.length],
    work: jobs[index % jobs.length],
    personality: personalities[index % personalities.length],
    socialStyle: socials[index % socials.length]
  }));
}

function assignVirtualIdentities(room) {
  const shuffledNames = shuffle(NAME_POOL);
  const builtProfiles = buildProfiles(room.players.length);
  const orderedPlayers = shuffle(room.players);

  orderedPlayers.forEach((player, index) => {
    player.virtualNumber = index + 1;
    player.virtualName = shuffledNames[index % shuffledNames.length];
    player.profile = builtProfiles[index % builtProfiles.length];
  });

  room.players.sort((a, b) => a.virtualNumber - b.virtualNumber);
}

function buildActiveRounds(room) {
  const totalPlayers = room.players.length;
  if (totalPlayers < 5) {
    return ROUND_DEFINITIONS.filter((round) => round.id !== "round_2");
  }

  return ROUND_DEFINITIONS;
}

function createRoom({ hostName, password, aiCount, socketId }) {
  const hostId = nanoid();
  const code = generateRoomCode();

  return {
    code,
    password,
    status: "lobby",
    phase: "lobby",
    hostId,
    settings: {
      aiCount
    },
    players: [
      {
        id: hostId,
        socketId,
        realName: hostName,
        isAI: false,
        isAlive: true,
        isConnected: true,
        eliminatedReason: null,
        virtualNumber: null,
        virtualName: null,
        profile: null
      }
    ],
    activeRounds: [],
    currentRoundIndex: -1,
    currentSpeakerId: null,
    speakingQueue: [],
    messages: [],
    votes: {},
    voteMode: "normal",
    votingTargets: [],
    tieBreakerIds: [],
    timers: new Set(),
    responseTimers: new Map(),
    createdAt: nowIso(),
    winner: null
  };
}

function addMessage(room, message) {
  room.messages.push({
    id: nanoid(),
    createdAt: nowIso(),
    ...message
  });
}

function clearRoomTimers(room) {
  room.timers.forEach((timer) => clearTimeout(timer));
  room.timers.clear();
}

function clearResponseTimer(room, playerId) {
  const timer = room.responseTimers.get(playerId);
  if (!timer) {
    return;
  }

  clearTimeout(timer);
  room.responseTimers.delete(playerId);
}

function clearResponseTimers(room) {
  room.responseTimers.forEach((timer) => clearTimeout(timer));
  room.responseTimers.clear();
}

function scheduleRoomTask(room, callback, delay = 1200) {
  const timer = setTimeout(async () => {
    room.timers.delete(timer);
    try {
      await callback();
    } catch (error) {
      console.error("Scheduled room task failed:", error);
      pushSystemMessage(room, "系統處理 AI 行動時發生問題，已改用安全備援流程。", {
        title: "系統修正",
        variant: "warning"
      });
      emitRoomState(room);
    }
  }, delay);

  room.timers.add(timer);
  return timer;
}

function pushSystemMessage(room, content, options = {}) {
  addMessage(room, createSystemMessage(content, options));
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function calculateAiTypingDelay(text) {
  const delay = AI_TYPING_BASE_MS + String(text || "").length * AI_TYPING_PER_CHAR_MS;
  return Math.min(delay, AI_TYPING_MAX_MS);
}

function sanitizePlayerForViewer(room, player, viewerId) {
  const started = room.status !== "lobby";
  const isViewer = player.id === viewerId;
  const viewer = room.players.find((item) => item.id === viewerId);

  return {
    id: player.id,
    displayName: started ? getDisplayName(player) : player.realName,
    isAlive: player.isAlive,
    isHost: player.id === room.hostId,
    isConnected: player.isConnected,
    isCurrentSpeaker: player.id === room.currentSpeakerId,
    isAISeat: started ? null : player.isAI,
    isKickableByViewer: Boolean(
      viewer?.id === room.hostId && room.status !== "ended" && !player.isAI && player.id !== viewerId
    ),
    profile: isViewer ? player.profile : null,
    role: isViewer ? (player.isAI ? "ai" : "human") : null
  };
}

function serializeRoom(room, viewerId) {
  const viewer = room.players.find((player) => player.id === viewerId);
  const alivePlayers = getAlivePlayers(room);
  const hasViewerVoted = Boolean(room.votes[viewerId]);

  return {
    code: room.code,
    status: room.status,
    phase: room.phase,
    hostId: room.hostId,
    settings: room.settings,
    winner: room.winner,
    currentRound: room.activeRounds[room.currentRoundIndex] || null,
    roundIndex: room.currentRoundIndex,
    rounds: room.activeRounds,
    currentSpeakerId: room.currentSpeakerId,
    voteMode: room.voteMode,
    votingTargets: room.votingTargets,
    aliveCount: alivePlayers.length,
    players: room.players.map((player) => sanitizePlayerForViewer(room, player, viewerId)),
    messages: room.messages.slice(-80),
    self: viewer
      ? {
          id: viewer.id,
          displayName: room.status === "lobby" ? viewer.realName : getDisplayName(viewer),
          isAlive: viewer.isAlive,
          isHost: viewer.id === room.hostId,
          role: viewer.isAI ? "ai" : "human",
          profile: viewer.profile
        }
      : null,
    hasViewerVoted
  };
}

function emitRoomState(room) {
  getHumanPlayers(room).forEach((player) => {
    if (!player.socketId) {
      return;
    }

    io.to(player.socketId).emit("room_state", serializeRoom(room, player.id));
  });
}

function emitError(socket, message) {
  socket.emit("game_error", { message });
}

function getRoundAnnouncement(room) {
  const round = room.activeRounds[room.currentRoundIndex];
  if (!round) {
    return "本局結束。";
  }

  return `${round.title}開始，請依序發言。每人最多 ${MAX_MESSAGE_LENGTH} 字。`;
}

function getAliveSpeakingQueue(room, candidateIds = null) {
  const candidates = candidateIds
    ? room.players.filter((player) => candidateIds.includes(player.id))
    : room.players;

  return candidates
    .filter((player) => player.isAlive)
    .sort((a, b) => a.virtualNumber - b.virtualNumber)
    .map((player) => player.id);
}

function getCurrentRound(room) {
  return room.activeRounds[room.currentRoundIndex] || null;
}

function trimHistoryForAi(room) {
  return room.messages
    .filter((message) => message.type === "speech")
    .slice(-10)
    .map((message) => `${message.speakerName}：${message.content}`)
    .join("\n");
}

function buildGeminiSystemPrompt(player, room, round) {
  return `
你正在參加一個中文網頁多人遊戲《誰是臥底？》，你必須扮演一名真實參賽者，絕對不能露出 AI 痕跡。

固定身份設定：
- 你的公開名稱：${getDisplayName(player)}
- 你的個人簡介：
${formatProfile(player.profile)}
- 本輪主題：${round.title}
- 本輪說明：${round.prompt}

硬性規則：
1. 你只能根據自己的虛擬名稱與個人簡介延伸，不可虛構太明顯的現實身分細節。
2. 不可承認自己是 AI、模型、機器人、程式，不能提到提示詞、系統、規則、演算法、資料庫。
3. 使用自然的繁體中文台灣口語，不要書面腔，不要客服口吻，不要過度客套。
4. 不要用條列、不要用引號、不要用 markdown、不要加表情符號。
5. 字數控制在 20 到 30 字，最多不得超過 40 字。
6. 語氣像真人聊天，允許稍微保留、猶豫、觀察他人，但不能故意做出明顯錯字或怪異標點來假裝人類。
7. 你不知道其他 AI 是誰，所以不能替任何人保證身分。
8. 若你要懷疑別人，只能輕微帶過，不能像法官宣判。
9. 不要輸入重複的發言

輸出要求：
- 只輸出最終發言內容本身，不要任何前言、說明或括號。
`.trim();
}

function fallbackAiSpeech(player, round) {
  const base = [
    `我是${getDisplayName(player)}，${formatProfile(player.profile, "summary")}`,
    "我比較習慣先觀察大家講話的細節，再慢慢判斷誰哪裡怪。",
    "這輪如果要我說重點，我會更在意一個人前後說法有沒有連起來。"
  ];

  if (round.id === "round_3") {
    return `如果要談人類跟 AI 的差別，我會覺得人講話通常會帶著當下情緒跟猶豫，不會每句都那麼工整。像我自己就比較吃語氣跟現場感，誰太像準備好的稿，我反而會起疑。`;
  }

  if (round.id === "round_4") {
    return `到這輪我還是維持原本的節奏，因為硬演反而更怪。${formatProfile(player.profile, "summary")}這點其實跟我剛剛幾輪的說法都有接上，我比較希望大家看一個人前後是不是自然，不是只看誰講得漂亮。`;
  }

  return base.join("");
}

async function generateAiSpeech(room, player) {
  const round = getCurrentRound(room);
  const history = trimHistoryForAi(room);

  if (!genAI) {
    return fallbackAiSpeech(player, round);
  }

  try {
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    const prompt = `
最近對話紀錄：
${history || "目前你是前段發言者，還沒有其他參考內容。"}

請現在直接說出你的本輪發言。
`.trim();

    const result = await model.generateContent([
      {
        text: buildGeminiSystemPrompt(player, room, round)
      },
      {
        text: prompt
      }
    ]);

    const text = result.response.text().replace(/\s+/g, " ").trim();
    return text.slice(0, 220) || fallbackAiSpeech(player, round);
  } catch (error) {
    console.error("Gemini speech failed:", error);
    return fallbackAiSpeech(player, round);
  }
}

function chooseAiVoteTarget(room, aiPlayer) {
  const candidates = getAlivePlayers(room).filter((player) => player.id !== aiPlayer.id);
  const allowedTargets = room.votingTargets.length
    ? candidates.filter((player) => room.votingTargets.includes(player.id))
    : candidates;

  if (!allowedTargets.length) {
    return null;
  }

  const recentSpeeches = room.messages.filter((message) => message.type === "speech");
  const scores = new Map();

  allowedTargets.forEach((player) => {
    scores.set(player.id, Math.random() * 2 + (player.isAI ? 0.2 : 1));
  });

  recentSpeeches.slice(-8).forEach((message) => {
    const score = scores.get(message.speakerId);
    if (score == null) {
      return;
    }

    if (/ai|機器|太像稿|太工整|不自然/i.test(message.content)) {
      scores.set(message.speakerId, score + 1.4);
      return;
    }

    if (message.content.length < 40) {
      scores.set(message.speakerId, score + 0.5);
    }
  });

  return [...scores.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || allowedTargets[0].id;
}

function validateSpeech(content) {
  const text = String(content || "").trim();

  if (!text) {
    return "發言不可為空。";
  }

  if (text.length > MAX_MESSAGE_LENGTH) {
    return `發言不可超過 ${MAX_MESSAGE_LENGTH} 字。`;
  }

  if (VIOLATION_PATTERNS.some((pattern) => pattern.test(text))) {
    return "偵測到可能暴露真實身分、聯絡資訊或 AI 身分的內容。";
  }

  return null;
}

function scheduleResponseDeadline(room, playerId, context) {
  clearResponseTimer(room, playerId);

  const timer = setTimeout(() => {
    room.responseTimers.delete(playerId);

    if (room.status !== "in_game") {
      return;
    }

    const player = room.players.find((item) => item.id === playerId);
    if (!player || !player.isAlive || player.isAI) {
      return;
    }

    if (context === "speaking" && room.currentSpeakerId !== playerId) {
      return;
    }

    if (context === "voting" && room.phase !== "voting") {
      return;
    }

    if (context === "voting" && room.votes[playerId]) {
      return;
    }

    markEliminated(room, playerId, "超過 7 分鐘未回應，系統視同斷線");
    emitRoomState(room);

    const winner = determineWinner(room);
    if (winner) {
      finalizeGame(room, winner);
      emitRoomState(room);
      return;
    }

    if (context === "speaking") {
      advanceSpeaker(room);
      return;
    }

    if (context === "voting" && allAlivePlayersVoted(room)) {
      resolveVoting(room);
      return;
    }

    emitRoomState(room);
  }, RESPONSE_TIMEOUT_MS);

  room.responseTimers.set(playerId, timer);
}

function getPlayerOrThrow(room, playerId) {
  const player = room.players.find((item) => item.id === playerId);
  if (!player) {
    throw new Error("找不到玩家資料。");
  }

  return player;
}

function markEliminated(room, playerId, reason) {
  const player = room.players.find((item) => item.id === playerId);
  if (!player || !player.isAlive) {
    return;
  }

  player.isAlive = false;
  player.eliminatedReason = reason;
  clearResponseTimer(room, playerId);

  pushSystemMessage(room, `${getDisplayName(player)} 已遭淘汰。原因：${reason}`, {
    title: "淘汰公告",
    variant: "danger"
  });
}

function determineWinner(room) {
  const aliveHumans = getAliveHumans(room);
  const aliveAis = getAliveAis(room);

  if (aliveAis.length === 0) {
    return {
      team: "human",
      title: "人類陣營獲勝",
      detail: "所有 AI 玩家都已遭到淘汰。"
    };
  }

  if (aliveHumans.length === 0) {
    return {
      team: "ai",
      title: "AI 陣營獲勝",
      detail: "所有人類玩家都已遭到淘汰。"
    };
  }

  if (room.currentRoundIndex >= room.activeRounds.length) {
    if (aliveAis.length > aliveHumans.length) {
      return {
        team: "ai",
        title: "AI 陣營獲勝",
        detail: "四輪結束後，存活 AI 數量大於存活人類數量。"
      };
    }

    return {
      team: "human",
      title: "人類陣營獲勝",
      detail: "四輪結束後，AI 未能取得人數優勢。"
    };
  }

  return null;
}

function finalizeGame(room, winner) {
  room.status = "ended";
  room.phase = "ended";
  room.currentSpeakerId = null;
  room.votes = {};
  room.votingTargets = [];
  room.voteMode = "normal";
  room.winner = winner;
  clearRoomTimers(room);
  clearResponseTimers(room);

  const revealText = room.players
    .map((player) => `${getDisplayName(player)}：${player.isAI ? "AI" : "人類"}`)
    .join("、");

  pushSystemMessage(room, `${winner.title}。${winner.detail}`, {
    title: "勝負揭曉",
    variant: winner.team === "human" ? "success" : "danger"
  });
  pushSystemMessage(room, `最終身分公開：${revealText}`, {
    title: "身份公開",
    variant: "spotlight"
  });
}

async function maybeRunAiTurn(room) {
  if (room.status !== "in_game") {
    return;
  }

  const currentSpeaker = room.players.find((player) => player.id === room.currentSpeakerId);
  if (!currentSpeaker || !currentSpeaker.isAlive || !currentSpeaker.isAI) {
    return;
  }

  clearRoomTimers(room);
  scheduleRoomTask(room, async () => {
    const speech = await generateAiSpeech(room, currentSpeaker);
    scheduleRoomTask(room, async () => {
      if (room.currentSpeakerId !== currentSpeaker.id || !currentSpeaker.isAlive) {
        return;
      }

      addMessage(room, {
        type: "speech",
        roundId: getCurrentRound(room)?.id || null,
        speakerId: currentSpeaker.id,
        speakerName: getDisplayName(currentSpeaker),
        content: speech
      });
      emitRoomState(room);
      advanceSpeaker(room);
    }, calculateAiTypingDelay(speech));
  }, randomInt(AI_THINKING_MIN_MS, AI_THINKING_MAX_MS));
}

function allAlivePlayersVoted(room) {
  return getAlivePlayers(room).every((player) => room.votes[player.id]);
}

function startVoting(room, mode = "normal", targets = []) {
  clearRoomTimers(room);
  clearResponseTimers(room);
  room.phase = "voting";
  room.currentSpeakerId = null;
  room.votes = {};
  room.voteMode = mode;
  room.votingTargets = targets;

  const targetText = targets.length
    ? `本次加時投票僅能投給：${targets
        .map((id) => getDisplayName(room.players.find((player) => player.id === id)))
        .join("、")}`
    : "所有存活玩家請盲投一位你最懷疑的對象。";

  pushSystemMessage(room, `進入投票階段。${targetText}`, {
    title: room.voteMode === "tie_break" ? "加時投票" : "開始投票",
    variant: "warning"
  });
  emitRoomState(room);

  getAliveHumans(room).forEach((player) => {
    scheduleResponseDeadline(room, player.id, "voting");
  });

  const aliveAis = getAliveAis(room);
  aliveAis.forEach((aiPlayer, index) => {
    scheduleRoomTask(
      room,
      async () => {
        if (room.phase !== "voting" || room.votes[aiPlayer.id]) {
          return;
        }

        const targetId = chooseAiVoteTarget(room, aiPlayer);
        if (!targetId) {
          return;
        }

        room.votes[aiPlayer.id] = targetId;
        emitRoomState(room);

        if (allAlivePlayersVoted(room)) {
          resolveVoting(room);
        }
      },
      2600 + index * 1500
    );
  });
}

function beginRound(room) {
  clearRoomTimers(room);
  clearResponseTimers(room);
  room.phase = "speaking";
  room.votes = {};
  room.voteMode = "normal";
  room.votingTargets = [];
  room.tieBreakerIds = [];
  room.speakingQueue = getAliveSpeakingQueue(room);
  room.currentSpeakerId = room.speakingQueue[0] || null;

  pushSystemMessage(room, getRoundAnnouncement(room), {
    title: "新回合開始",
    variant: "spotlight"
  });

  emitRoomState(room);
  if (room.currentSpeakerId) {
    const currentPlayer = room.players.find((player) => player.id === room.currentSpeakerId);
    if (currentPlayer?.isAI) {
      maybeRunAiTurn(room);
    } else if (currentPlayer) {
      scheduleResponseDeadline(room, currentPlayer.id, "speaking");
    }
  }
}

function advanceRound(room) {
  room.currentRoundIndex += 1;
  const winner = determineWinner(room);

  if (winner) {
    finalizeGame(room, winner);
    emitRoomState(room);
    return;
  }

  if (room.currentRoundIndex >= room.activeRounds.length) {
    const finalWinner = determineWinner(room);
    finalizeGame(room, finalWinner);
    emitRoomState(room);
    return;
  }

  beginRound(room);
}

function advanceSpeaker(room) {
  clearRoomTimers(room);
  clearResponseTimers(room);

  if (room.phase !== "speaking" && room.phase !== "tie_break_speaking") {
    return;
  }

  const currentIndex = room.speakingQueue.findIndex((playerId) => playerId === room.currentSpeakerId);
  const nextId = room.speakingQueue[currentIndex + 1] || null;
  room.currentSpeakerId = nextId;

  if (!nextId) {
    if (room.phase === "tie_break_speaking") {
      startVoting(room, "tie_break", room.tieBreakerIds);
      return;
    }

    startVoting(room, "normal", []);
    return;
  }

  emitRoomState(room);
  const nextPlayer = room.players.find((player) => player.id === nextId);
  if (nextPlayer?.isAI) {
    maybeRunAiTurn(room);
    return;
  }

  if (nextPlayer) {
    scheduleResponseDeadline(room, nextPlayer.id, "speaking");
  }
}

function resolveVoting(room) {
  if (room.phase !== "voting") {
    return;
  }

  clearRoomTimers(room);
  clearResponseTimers(room);

  const tally = {};
  Object.values(room.votes).forEach((targetId) => {
    tally[targetId] = (tally[targetId] || 0) + 1;
  });

  const ranked = Object.entries(tally).sort((left, right) => right[1] - left[1]);
  if (!ranked.length) {
    pushSystemMessage(room, "本輪沒有有效票，系統自動進入下一輪。", {
      title: "投票結算",
      variant: "warning"
    });
    advanceRound(room);
    return;
  }

  const highest = ranked[0][1];
  const topIds = ranked.filter((entry) => entry[1] === highest).map((entry) => entry[0]);

  if (topIds.length > 1) {
    room.phase = "tie_break_speaking";
    room.tieBreakerIds = topIds;
    room.speakingQueue = getAliveSpeakingQueue(room, topIds);
    room.currentSpeakerId = room.speakingQueue[0] || null;

    pushSystemMessage(
      room,
      `出現平票，${topIds
        .map((id) => getDisplayName(room.players.find((player) => player.id === id)))
        .join("、")} 需要重新發言，之後立刻進行加時投票。`,
      {
        title: "平票重開",
        variant: "warning"
      }
    );

    emitRoomState(room);
    const nextPlayer = room.players.find((player) => player.id === room.currentSpeakerId);
    if (nextPlayer?.isAI) {
      maybeRunAiTurn(room);
    } else if (nextPlayer) {
      scheduleResponseDeadline(room, nextPlayer.id, "speaking");
    }
    return;
  }

  const eliminatedId = topIds[0];
  markEliminated(room, eliminatedId, "得票最高");

  const winner = determineWinner(room);
  if (winner) {
    finalizeGame(room, winner);
    emitRoomState(room);
    return;
  }

  if (room.voteMode === "tie_break") {
    pushSystemMessage(room, "加時投票結束，回到主流程。", {
      title: "加時結束",
      variant: "info"
    });
  }

  emitRoomState(room);
  advanceRound(room);
}

function startGame(room) {
  if (room.status !== "lobby") {
    throw new Error("遊戲已經開始。");
  }

  const humanCount = getHumanPlayers(room).length;
  if (humanCount < 3 || humanCount > 7) {
    throw new Error("人類玩家必須介於 3 到 7 人。");
  }

  if (room.settings.aiCount < 1 || room.settings.aiCount > 3) {
    throw new Error("AI 玩家數必須介於 1 到 3 人。");
  }

  for (let index = 0; index < room.settings.aiCount; index += 1) {
    room.players.push({
      id: nanoid(),
      socketId: null,
      realName: `AI-${index + 1}`,
      isAI: true,
      isAlive: true,
      isConnected: true,
      eliminatedReason: null,
      virtualNumber: null,
      virtualName: null,
      profile: null
    });
  }

  room.status = "in_game";
  room.activeRounds = buildActiveRounds(room);
  room.currentRoundIndex = -1;
  assignVirtualIdentities(room);
  room.messages = [
    createSystemMessage("遊戲開始，所有人已獲得虛擬名稱與個人簡介。請依據身份設定發言，違規將直接淘汰。", {
      title: "開局通知",
      variant: "spotlight"
    })
  ];

  if (room.activeRounds.length < ROUND_DEFINITIONS.length) {
    room.messages.push(
      createSystemMessage("由於總玩家數不足 5 人，系統已自動跳過第二輪「深度破冰」。", {
        title: "流程調整",
        variant: "warning"
      })
    );
  }

  advanceRound(room);
}

function pruneRoomIfEmpty(room) {
  const activeHumans = room.players.filter((player) => !player.isAI && player.isConnected);
  if (!activeHumans.length) {
    clearRoomTimers(room);
    clearResponseTimers(room);
    rooms.delete(room.code);
  }
}

function removePlayerFromRoom(room, playerId) {
  const player = room.players.find((item) => item.id === playerId);
  if (!player) {
    return null;
  }

  clearResponseTimer(room, playerId);
  room.players = room.players.filter((item) => item.id !== playerId);

  if (room.hostId === playerId && room.players.length) {
    const nextHost = room.players.find((item) => !item.isAI) || room.players[0];
    room.hostId = nextHost.id;
  }

  if (room.currentSpeakerId === playerId) {
    room.speakingQueue = room.speakingQueue.filter((id) => id !== playerId);
    room.currentSpeakerId = null;
  } else {
    room.speakingQueue = room.speakingQueue.filter((id) => id !== playerId);
  }

  if (room.tieBreakerIds?.length) {
    room.tieBreakerIds = room.tieBreakerIds.filter((id) => id !== playerId);
  }

  if (room.votingTargets?.length) {
    room.votingTargets = room.votingTargets.filter((id) => id !== playerId);
  }

  delete room.votes[playerId];
  Object.keys(room.votes).forEach((voterId) => {
    if (room.votes[voterId] === playerId) {
      delete room.votes[voterId];
    }
  });

  return player;
}

function kickPlayerFromRoom(room, targetPlayer) {
  const removedCurrentSpeaker = room.currentSpeakerId === targetPlayer.id;
  const targetSocket = targetPlayer.socketId ? io.sockets.sockets.get(targetPlayer.socketId) : null;
  const removedPlayer = removePlayerFromRoom(room, targetPlayer.id);
  if (!removedPlayer) {
    return;
  }

  if (removedPlayer.socketId) {
    socketToPlayer.delete(removedPlayer.socketId);
  }

  if (targetSocket) {
    targetSocket.leave(room.code);
    targetSocket.emit("kicked_from_room", {
      message: "你已被房主移出房間。"
    });
  }

  pushSystemMessage(room, `${getDisplayName(removedPlayer)} 已被房主移出房間。`, {
    title: "房間管理",
    variant: "warning"
  });

  if (room.status === "in_game") {
    const winner = determineWinner(room);
    if (winner) {
      finalizeGame(room, winner);
      emitRoomState(room);
      return;
    }

    if ((room.phase === "speaking" || room.phase === "tie_break_speaking") && removedCurrentSpeaker) {
      advanceSpeaker(room);
      return;
    }

    if (room.phase === "voting" && allAlivePlayersVoted(room)) {
      resolveVoting(room);
      return;
    }
  }

  emitRoomState(room);
}

app.get("/", (_request, response) => {
  response.json({
    name: "Undercover AI Backend",
    status: "ok",
    rooms: rooms.size
  });
});

app.get("/health", (_request, response) => {
  response.json({ ok: true, timestamp: nowIso() });
});

io.on("connection", (socket) => {
  socket.on("create_room", (payload) => {
    try {
      const hostName = String(payload?.playerName || "").trim();
      const password = String(payload?.password || "").trim();
      const aiCount = Number(payload?.aiCount || 1);

      if (!hostName) {
        throw new Error("請先輸入你的玩家名稱。");
      }

      if (!password) {
        throw new Error("請輸入房間密碼。");
      }

      if (aiCount < 1 || aiCount > 3) {
        throw new Error("AI 數量必須介於 1 到 3 人。");
      }

      const room = createRoom({ hostName, password, aiCount, socketId: socket.id });
      rooms.set(room.code, room);
      socket.join(room.code);
      socketToPlayer.set(socket.id, { roomCode: room.code, playerId: room.hostId });

      socket.emit("room_created", {
        roomCode: room.code,
        playerId: room.hostId
      });
      emitRoomState(room);
    } catch (error) {
      emitError(socket, error.message);
    }
  });

  socket.on("join_room", (payload) => {
    try {
      const roomCode = String(payload?.roomCode || "").trim().toUpperCase();
      const password = String(payload?.password || "").trim();
      const playerName = String(payload?.playerName || "").trim();
      const room = rooms.get(roomCode);

      if (!room) {
        throw new Error("找不到這個房間。");
      }

      if (room.password !== password) {
        throw new Error("房間密碼錯誤。");
      }

      if (room.status !== "lobby") {
        throw new Error("這個房間已經開始遊戲。");
      }

      if (!playerName) {
        throw new Error("請輸入你的玩家名稱。");
      }

      const humanCount = getHumanPlayers(room).length;
      if (humanCount >= 7) {
        throw new Error("此房間的人類玩家已滿。");
      }

      const playerId = nanoid();
      room.players.push({
        id: playerId,
        socketId: socket.id,
        realName: playerName,
        isAI: false,
        isAlive: true,
        isConnected: true,
        eliminatedReason: null,
        virtualNumber: null,
        virtualName: null,
        profile: null
      });

      socket.join(room.code);
      socketToPlayer.set(socket.id, { roomCode: room.code, playerId });
      socket.emit("room_joined", {
        roomCode: room.code,
        playerId
      });
      pushSystemMessage(room, `${playerName} 已加入房間。`, {
        title: "玩家加入",
        variant: "info"
      });
      emitRoomState(room);
    } catch (error) {
      emitError(socket, error.message);
    }
  });

  socket.on("start_game", (payload) => {
    try {
      const roomCode = String(payload?.roomCode || "").trim().toUpperCase();
      const playerId = String(payload?.playerId || "");
      const room = rooms.get(roomCode);

      if (!room) {
        throw new Error("找不到房間。");
      }

      if (room.hostId !== playerId) {
        throw new Error("只有房主可以開始遊戲。");
      }

      startGame(room);
    } catch (error) {
      emitError(socket, error.message);
    }
  });

  socket.on("send_message", (payload) => {
    try {
      const roomCode = String(payload?.roomCode || "").trim().toUpperCase();
      const playerId = String(payload?.playerId || "");
      const content = String(payload?.content || "");
      const room = rooms.get(roomCode);

      if (!room) {
        throw new Error("找不到房間。");
      }

      if (room.phase !== "speaking" && room.phase !== "tie_break_speaking") {
        throw new Error("現在不是發言階段。");
      }

      if (room.currentSpeakerId !== playerId) {
        throw new Error("現在還沒輪到你發言。");
      }

      const player = getPlayerOrThrow(room, playerId);
      if (!player.isAlive) {
        throw new Error("你已經遭到淘汰。");
      }

      if (player.isAI) {
        throw new Error("AI 玩家由系統控制。");
      }

      const violation = validateSpeech(content);
      if (violation) {
        markEliminated(room, playerId, `違規發言：${violation}`);
        emitRoomState(room);

        const winner = determineWinner(room);
        if (winner) {
          finalizeGame(room, winner);
          emitRoomState(room);
          return;
        }

        advanceSpeaker(room);
        return;
      }

      clearResponseTimer(room, playerId);
      addMessage(room, {
        type: "speech",
        roundId: getCurrentRound(room)?.id || null,
        speakerId: player.id,
        speakerName: getDisplayName(player),
        content: content.trim()
      });
      emitRoomState(room);
      advanceSpeaker(room);
    } catch (error) {
      emitError(socket, error.message);
    }
  });

  socket.on("cast_vote", (payload) => {
    try {
      const roomCode = String(payload?.roomCode || "").trim().toUpperCase();
      const playerId = String(payload?.playerId || "");
      const targetId = String(payload?.targetId || "");
      const room = rooms.get(roomCode);

      if (!room) {
        throw new Error("找不到房間。");
      }

      if (room.phase !== "voting") {
        throw new Error("現在不是投票階段。");
      }

      const player = getPlayerOrThrow(room, playerId);
      const target = getPlayerOrThrow(room, targetId);

      if (!player.isAlive) {
        throw new Error("淘汰玩家不能投票。");
      }

      if (player.isAI) {
        throw new Error("AI 玩家由系統自動投票。");
      }

      if (!target.isAlive) {
        throw new Error("只能投給仍存活的玩家。");
      }

      if (player.id === target.id) {
        throw new Error("不能投給自己。");
      }

      if (room.votingTargets.length && !room.votingTargets.includes(target.id)) {
        throw new Error("這輪加時投票只能投給平票玩家。");
      }

      clearResponseTimer(room, player.id);
      room.votes[player.id] = target.id;
      emitRoomState(room);

      if (allAlivePlayersVoted(room)) {
        resolveVoting(room);
      }
    } catch (error) {
      emitError(socket, error.message);
    }
  });

  socket.on("kick_player", (payload) => {
    try {
      const roomCode = String(payload?.roomCode || "").trim().toUpperCase();
      const playerId = String(payload?.playerId || "");
      const targetId = String(payload?.targetId || "");
      const room = rooms.get(roomCode);

      if (!room) {
        throw new Error("找不到房間。");
      }

      if (room.hostId !== playerId) {
        throw new Error("只有房主可以移出玩家。");
      }

      if (room.status === "ended") {
        throw new Error("對局已結束，不能再移出玩家。");
      }

      if (playerId === targetId) {
        throw new Error("房主不能移除自己。");
      }

      const targetPlayer = getPlayerOrThrow(room, targetId);

      if (targetPlayer.isAI) {
        throw new Error("AI 座位不提供房主管理移除。");
      }

      kickPlayerFromRoom(room, targetPlayer);
      pruneRoomIfEmpty(room);
    } catch (error) {
      emitError(socket, error.message);
    }
  });

  socket.on("disconnect", () => {
    const mapping = socketToPlayer.get(socket.id);
    socketToPlayer.delete(socket.id);

    if (!mapping) {
      return;
    }

    const room = rooms.get(mapping.roomCode);
    if (!room) {
      return;
    }

    const player = room.players.find((item) => item.id === mapping.playerId);
    if (!player) {
      return;
    }

    player.isConnected = false;
    player.socketId = null;

    if (room.status === "lobby") {
      removePlayerFromRoom(room, player.id);
      emitRoomState(room);
      pruneRoomIfEmpty(room);
      return;
    }

    if (player.isAlive && !player.isAI) {
      markEliminated(room, player.id, "連線中斷");
      const winner = determineWinner(room);
      if (winner) {
        finalizeGame(room, winner);
      } else if (room.currentSpeakerId === player.id) {
        advanceSpeaker(room);
      } else if (room.phase === "voting") {
        if (allAlivePlayersVoted(room)) {
          resolveVoting(room);
        }
      }
      emitRoomState(room);
    }

    pruneRoomIfEmpty(room);
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
