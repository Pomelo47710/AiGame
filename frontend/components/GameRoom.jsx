"use client";

import { useEffect, useMemo, useRef, useState } from "react";

function getPhaseLabel(room) {
  switch (room.phase) {
    case "lobby":
      return "等待開局";
    case "speaking":
      return "輪流發言";
    case "tie_break_speaking":
      return "平票加時發言";
    case "voting":
      return room.voteMode === "tie_break" ? "加時投票" : "盲投階段";
    case "ended":
      return "對局結束";
    default:
      return "同步中";
  }
}

function getSystemMessageStyle(variant) {
  switch (variant) {
    case "danger":
      return "border-rose-200/25 bg-rose-200/10 text-rose-50";
    case "success":
      return "border-emerald-200/25 bg-emerald-200/10 text-emerald-50";
    case "warning":
      return "border-amber-200/25 bg-amber-200/10 text-amber-50";
    case "spotlight":
      return "border-orange-200/25 bg-orange-200/10 text-orange-50";
    default:
      return "border-stone-200/15 bg-[#fff7ed]/[0.06] text-stone-100";
  }
}

function messageBubbleStyle(item, isSelf) {
  if (item.type === "system") {
    return getSystemMessageStyle(item.variant);
  }

  if (isSelf) {
    return "border-amber-200/25 bg-amber-200/10 text-amber-50";
  }

  return "border-amber-100/10 bg-[#fff7ed]/[0.05] text-stone-100";
}

function profileSummary(profile) {
  if (!profile) {
    return "遊戲開始後，這裡會顯示你的虛擬個人簡介。";
  }

  if (typeof profile === "string") {
    return profile;
  }

  return `${profile.interest}。${profile.personality}`;
}

export default function GameRoom({
  room,
  error,
  isConnected,
  onStartGame,
  onSendMessage,
  onCastVote,
  onKickPlayer
}) {
  const [drafts, setDrafts] = useState({});
  const bottomRef = useRef(null);

  const self = room?.self;
  const canDraft =
    room?.status === "in_game" &&
    (room?.phase === "speaking" || room?.phase === "tie_break_speaking") &&
    self?.isAlive &&
    self?.role === "human";
  const canSpeak =
    canDraft && room?.currentSpeakerId === self?.id;

  const canVote =
    room?.status === "in_game" &&
    room?.phase === "voting" &&
    self?.isAlive &&
    !room?.hasViewerVoted;

  const draftKey = useMemo(() => {
    if (!self?.id || room?.status !== "in_game") {
      return "inactive";
    }

    return `${self.id}:${room.phase}:${room.currentRound?.id || "no_round"}`;
  }, [room?.currentRound?.id, room?.phase, room?.status, self?.id]);

  const message = drafts[draftKey] || "";

  const setMessage = (value) => {
    setDrafts((current) => ({
      ...current,
      [draftKey]: value
    }));
  };

  const voteTargets = useMemo(() => {
    if (!room?.players) {
      return [];
    }

    return room.players.filter((player) => {
      if (!player.isAlive || player.id === self?.id) {
        return false;
      }

      if (room.votingTargets?.length) {
        return room.votingTargets.includes(player.id);
      }

      return true;
    });
  }, [room, self?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [room?.messages]);

  const speakingHint = canSpeak
    ? "輪到你發言了，確認內容後就能送出。"
    : canDraft
      ? "你可以先把本輪內容打好，等輪到你時再送出。"
      : self?.isAlive
        ? "目前不是發言階段，暫時無法編輯發言。"
      : "你已遭淘汰，目前為觀戰狀態。";

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-4 px-3 py-4 sm:gap-6 sm:px-4 sm:py-6 lg:px-6">
      <div className="rounded-3xl border border-amber-100/10 bg-[#2d1d19]/85 p-4 shadow-[0_28px_90px_rgba(15,8,7,0.35)] backdrop-blur sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-amber-200/75 sm:text-sm">
              Cozy Game Room
            </p>
            <h1 className="mt-2 text-2xl font-bold text-amber-50 sm:text-3xl">誰是臥底？今晚這局很有戲</h1>
            <p className="mt-2 text-sm leading-7 text-stone-200/90">
              房號 <span className="font-semibold text-amber-200">{room.code}</span>
              <span className="hidden sm:inline"> ・ </span>
              <span className="block sm:inline">
                狀態 <span className="font-semibold text-amber-50">{getPhaseLabel(room)}</span>
              </span>
              <span className="hidden sm:inline"> ・ </span>
              <span className="block sm:inline">
                連線{" "}
                <span className={isConnected ? "text-emerald-200" : "text-rose-200"}>
                  {isConnected ? "已連線" : "已中斷"}
                </span>
              </span>
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-amber-100/10 bg-[#fff7ed]/[0.05] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-amber-200/70">當前輪次</p>
              <p className="mt-2 text-base font-semibold text-amber-50 sm:text-lg">
                {room.currentRound?.title || "Lobby"}
              </p>
              <p className="mt-2 text-sm leading-7 text-stone-200/90">
                {room.currentRound?.prompt || "等待房主開始遊戲"}
              </p>
            </div>

            <div className="rounded-2xl border border-rose-200/15 bg-rose-200/10 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-rose-100/80">你的身份卡</p>
              <p className="mt-2 text-base font-semibold text-amber-50 sm:text-lg">
                {self?.displayName || "尚未同步"}
              </p>
              <p className="mt-2 text-sm leading-7 text-stone-100/90">{profileSummary(self?.profile)}</p>

              {self?.profile && typeof self.profile === "object" ? (
                <details className="mt-3 rounded-2xl border border-amber-100/10 bg-[#2a1a17]/55 p-3">
                  <summary className="cursor-pointer text-sm font-medium text-amber-100">
                    展開完整身份設定
                  </summary>
                  <div className="mt-3 grid gap-2 text-sm leading-7 text-stone-100/90">
                    <p>
                      <span className="font-semibold text-amber-50">興趣：</span>
                      {self.profile.interest}
                    </p>
                    <p>
                      <span className="font-semibold text-amber-50">工作內容：</span>
                      {self.profile.work}
                    </p>
                    <p>
                      <span className="font-semibold text-amber-50">個性：</span>
                      {self.profile.personality}
                    </p>
                    <p>
                      <span className="font-semibold text-amber-50">互動風格：</span>
                      {self.profile.socialStyle}
                    </p>
                  </div>
                </details>
              ) : null}
            </div>
          </div>
        </div>

        {room.status === "lobby" ? (
          <div className="mt-5 rounded-2xl border border-amber-200/20 bg-amber-200/10 p-4 text-sm leading-7 text-amber-50">
            <p>房主可在玩家到齊後開始遊戲。規則上需要 3 到 7 位人類玩家，並搭配 1 到 3 位 AI。</p>
            <p className="mt-2">若總玩家數不足 5 人，系統會自動跳過第二輪。</p>
          </div>
        ) : null}

        {room.winner ? (
          <div className="mt-5 rounded-2xl border border-emerald-200/20 bg-emerald-200/10 p-4 text-sm text-emerald-50">
            <p className="text-lg font-semibold">{room.winner.title}</p>
            <p className="mt-2 leading-7">{room.winner.detail}</p>
          </div>
        ) : null}

        {error ? (
          <div className="mt-5 rounded-2xl border border-rose-200/20 bg-rose-200/10 p-4 text-sm text-rose-50">
            {error}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.45fr_0.95fr] lg:gap-6">
        <section className="flex min-h-[420px] flex-col rounded-3xl border border-amber-100/10 bg-[#2d1d19]/80 p-4 backdrop-blur sm:min-h-[560px]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-100/10 pb-3">
            <div>
              <h2 className="text-lg font-semibold text-amber-50 sm:text-xl">對話紀錄</h2>
              <p className="mt-1 text-sm text-stone-300/80">看語氣、看節奏，也看誰越講越心虛。</p>
            </div>
            <div className="rounded-full border border-amber-100/10 bg-[#fff7ed]/[0.05] px-3 py-1 text-xs text-stone-200/85">
              {room.messages?.length || 0} 則訊息
            </div>
          </div>

          <div className="mt-4 flex max-h-[48vh] flex-1 space-y-3 overflow-y-auto pr-1 sm:max-h-none">
            <div className="w-full space-y-3">
              {(room.messages || []).map((item) => {
                const isSelf = item.speakerId && item.speakerId === self?.id;
                return (
                  <article
                    key={item.id}
                    className={`rounded-2xl border p-3 sm:p-4 ${messageBubbleStyle(item, isSelf)}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-amber-50">
                        {item.type === "system" ? item.title || "系統" : item.speakerName}
                      </p>
                      <p className="shrink-0 text-xs text-stone-300/85">
                        {new Date(item.createdAt).toLocaleTimeString("zh-TW", {
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </p>
                    </div>
                    {item.type === "system" ? (
                      <p className="mt-2 inline-flex rounded-full border border-amber-100/10 px-2 py-1 text-[11px] tracking-wide text-amber-50/80">
                        {item.variant === "danger"
                          ? "高優先"
                          : item.variant === "success"
                            ? "結果"
                            : item.variant === "warning"
                              ? "提醒"
                              : item.variant === "spotlight"
                                ? "重點"
                                : "通知"}
                      </p>
                    ) : null}
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-7">{item.content}</p>
                  </article>
                );
              })}
              <div ref={bottomRef} />
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-amber-100/10 bg-[#fff7ed]/[0.05] p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-7 text-stone-200/90">{speakingHint}</p>
              <p className="text-xs text-stone-300/75">{message.length}/300</p>
            </div>

            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value.slice(0, 300))}
              disabled={!canDraft}
              rows={4}
              placeholder={
                canDraft
                  ? canSpeak
                    ? "確認本輪內容後送出"
                    : "先打好這輪內容，輪到你時再送出"
                  : "等待下一輪發言階段"
              }
              className="mt-3 w-full rounded-2xl border border-amber-100/10 bg-[#2a1a17]/85 px-4 py-3 text-sm leading-7 text-amber-50 outline-none transition placeholder:text-stone-500 focus:border-amber-200/60 disabled:bg-[#1f1412] disabled:text-stone-500"
            />

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                disabled={!canSpeak || !message.trim()}
                onClick={() => {
                  onSendMessage(message.trim());
                  setDrafts((current) => ({
                    ...current,
                    [draftKey]: ""
                  }));
                }}
                className="min-h-12 w-full rounded-2xl bg-rose-300 px-5 py-3 text-sm font-semibold text-[#2a1a17] transition hover:bg-rose-200 disabled:bg-stone-700 disabled:text-stone-400 sm:w-auto"
              >
                {canSpeak ? "送出發言" : "等待輪到你"}
              </button>
            </div>
          </div>
        </section>

        <section className="space-y-4 sm:space-y-6">
          <div className="rounded-3xl border border-amber-100/10 bg-[#2d1d19]/80 p-4 backdrop-blur">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-amber-50 sm:text-xl">玩家列表</h2>
                <p className="mt-1 text-sm text-stone-300/80">看看誰還穩得住，誰已經露餡。</p>
              </div>
              {room.status === "lobby" && self?.isHost ? (
                <button
                  type="button"
                  onClick={onStartGame}
                  className="min-h-11 rounded-2xl bg-amber-200 px-4 py-2 text-sm font-semibold text-[#2a1a17] transition hover:bg-amber-100"
                >
                  開始遊戲
                </button>
              ) : null}
            </div>

            <div className="mt-4 space-y-3">
              {(room.players || []).map((player) => (
                <div
                  key={player.id}
                  className={`rounded-2xl border px-4 py-3 ${
                    player.isCurrentSpeaker
                      ? "border-amber-200/25 bg-amber-200/10"
                      : "border-amber-100/10 bg-[#fff7ed]/[0.05]"
                  }`}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <div>
                      <p className="font-semibold text-amber-50">{player.displayName}</p>
                      <p className="mt-1 text-xs leading-6 text-stone-300/80">
                        {player.isHost ? "房主" : "玩家"} ・{" "}
                        {player.isAlive ? "存活" : "已淘汰"} ・{" "}
                        {player.isCurrentSpeaker ? "正在發言" : "等待中"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {player.isKickableByViewer ? (
                        <button
                          type="button"
                          onClick={() => onKickPlayer(player.id)}
                          className="min-h-10 rounded-xl border border-rose-200/20 bg-rose-200/10 px-3 py-2 text-xs font-semibold text-rose-50 transition hover:bg-rose-200/20"
                        >
                          踢出
                        </button>
                      ) : null}
                      <div
                        className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                          player.isAlive
                            ? "bg-emerald-200/15 text-emerald-100"
                            : "bg-rose-200/15 text-rose-100"
                        }`}
                      >
                        {player.isAlive ? "Alive" : "Out"}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-amber-100/10 bg-[#2d1d19]/80 p-4 backdrop-blur">
            <h2 className="text-lg font-semibold text-amber-50 sm:text-xl">投票區</h2>
            <p className="mt-1 text-sm leading-7 text-stone-300/80">
              只有投票階段且你仍存活時才可操作，其他時間按鈕保持反灰。
            </p>

            <div className="mt-4 space-y-3">
              {voteTargets.map((player) => (
                <button
                  key={player.id}
                  type="button"
                  disabled={!canVote}
                  onClick={() => onCastVote(player.id)}
                  className="flex min-h-12 w-full flex-col items-start justify-between gap-2 rounded-2xl border border-amber-100/10 bg-[#fff7ed]/[0.05] px-4 py-3 text-left transition hover:border-rose-200/30 hover:bg-rose-200/10 disabled:border-amber-100/10 disabled:bg-[#1f1412] disabled:text-stone-500 sm:flex-row sm:items-center"
                >
                  <span className="font-medium text-amber-50">{player.displayName}</span>
                  <span className="text-xs text-stone-300/80">
                    {room.hasViewerVoted ? "已投票" : canVote ? "投出質疑票" : "尚未開放"}
                  </span>
                </button>
              ))}
            </div>

            {!voteTargets.length ? (
              <p className="mt-4 rounded-2xl border border-amber-100/10 bg-[#fff7ed]/[0.05] px-4 py-3 text-sm text-stone-300/80">
                目前沒有可投票的對象。
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
