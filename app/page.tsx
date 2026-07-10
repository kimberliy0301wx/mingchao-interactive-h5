"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import QRCode from "qrcode";

type Stage = "intro" | "story" | "symbols" | "social" | "remix" | "kick" | "result";
type SensorPayload = { type?: string; side?: "left" | "right"; active?: boolean };

const STAGES: Array<{ key: Stage; label: string; icon: string }> = [
  { key: "intro", label: "入场", icon: "/assets/button-icons-v2/intro.png" },
  { key: "story", label: "情感火种", icon: "/assets/button-icons-v2/fire.png" },
  { key: "symbols", label: "城市徽记", icon: "/assets/button-icons-v2/flag.png" },
  { key: "social", label: "同伴回声", icon: "/assets/button-icons-v2/echo.png" },
  { key: "remix", label: "梗火花", icon: "/assets/button-icons-v2/spark.png" },
  { key: "kick", label: "一脚破圈", icon: "/assets/button-icons-v2/kick.png" },
];

const MEMORY_FRAGMENTS = ["海风吹回的旧皮球", "第一次穿上的家乡球衣", "看台上传来的熟悉方言"];
const MEMORY_ICONS: Record<string, string> = {
  "海风吹回的旧皮球": "/assets/button-icons-v2/memory-ball.png",
  "第一次穿上的家乡球衣": "/assets/button-icons-v2/memory-jersey.png",
  "看台上传来的熟悉方言": "/assets/button-icons-v2/memory-stands.png",
};
const SYMBOLS = [
  { id: "wave", icon: "/assets/button-icons-v2/wave.png", label: "海风纹样" },
  { id: "tower", icon: "/assets/button-icons-v2/tower.png", label: "地标剪影" },
  { id: "ball", icon: "/assets/button-icons-v2/ball.png", label: "足球符号" },
  { id: "cheer", icon: "/assets/button-icons-v2/cheer.png", label: "助威短句" },
  { id: "bridge", icon: "/assets/button-icons-v2/bridge.png", label: "山海连线" },
];
const PHRASES = ["海风起势，这脚向前！", "厝边，一起看闽超！", "这球有福气！", "家乡队，继续燃！"];
const TONES = ["热血切帧", "可爱弹跳", "反差停格"];
const STICKERS = [
  { id: "ball", icon: "/assets/button-icons-v2/ball.png", label: "足球" },
  { id: "spark", icon: "/assets/button-icons-v2/spark.png", label: "火花" },
  { id: "wave", icon: "/assets/button-icons-v2/wave.png", label: "海风" },
  { id: "flag", icon: "/assets/button-icons-v2/sticker-flag.png", label: "旗帜" },
];
const RITUAL_ICONS = [
  { id: "fire", icon: "/assets/button-icons-v2/fire.png", label: "情感火种" },
  { id: "flag", icon: "/assets/button-icons-v2/flag.png", label: "城市徽记" },
  { id: "echo", icon: "/assets/button-icons-v2/echo.png", label: "同伴回声" },
  { id: "spark", icon: "/assets/button-icons-v2/spark.png", label: "梗火花" },
];

function PixelIcon({ src, alt = "", className = "" }: { src: string; alt?: string; className?: string }) {
  return <img className={`pixel-icon ${className}`} src={src} alt={alt} draggable={false} />;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function drawCover(ctx: CanvasRenderingContext2D, image: CanvasImageSource, sourceWidth: number, sourceHeight: number, x: number, y: number, width: number, height: number) {
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const cropWidth = width / scale;
  const cropHeight = height / scale;
  const sourceX = (sourceWidth - cropWidth) / 2;
  const sourceY = (sourceHeight - cropHeight) / 2;
  ctx.drawImage(image, sourceX, sourceY, cropWidth, cropHeight, x, y, width, height);
}

function PixelButton({ children, onClick, icon, disabled = false, tone = "primary", testId }: { children: React.ReactNode; onClick: () => void; icon: string; disabled?: boolean; tone?: "primary" | "secondary" | "ghost"; testId?: string }) {
  return (
    <button className={`pixel-button ${tone}`} onClick={onClick} disabled={disabled} data-testid={testId}>
      <PixelIcon src={icon} alt="" className="button-icon" />
      {children}
    </button>
  );
}

export default function Home() {
  const [stage, setStage] = useState<Stage>("intro");
  const [storyMode, setStoryMode] = useState<"idle" | "info" | "emotion">("idle");
  const [memories, setMemories] = useState<string[]>([]);
  const [heartReady, setHeartReady] = useState(false);
  const [heartHolding, setHeartHolding] = useState(false);
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
  const [leftPad, setLeftPad] = useState(false);
  const [rightPad, setRightPad] = useState(false);
  const [chantHits, setChantHits] = useState(0);
  const [chantComplete, setChantComplete] = useState(false);
  const [micStatus, setMicStatus] = useState("等待助威");
  const [cameraOn, setCameraOn] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string>("");
  const [photoStatus, setPhotoStatus] = useState("合影只在你同意后开启");
  const [phrase, setPhrase] = useState(PHRASES[0]);
  const [tone, setTone] = useState(TONES[0]);
  const [sticker, setSticker] = useState(STICKERS[0].id);
  const [remixReady, setRemixReady] = useState(false);
  const [remixing, setRemixing] = useState(false);
  const [kickHint, setKickHint] = useState("把足球向球门方向快速上划，或等待实体传感器信号");
  const [sensorPanel, setSensorPanel] = useState(false);
  const [sensorStatus, setSensorStatus] = useState("模拟模式可用");
  const [shareCardUrl, setShareCardUrl] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [shareStatus, setShareStatus] = useState("把这份声浪交给下一位球迷");
  const [stageScale, setStageScale] = useState(1);

  const holdTimer = useRef<number | null>(null);
  const kickStart = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStream = useRef<MediaStream | null>(null);
  const audioStream = useRef<MediaStream | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const audioFrame = useRef<number | null>(null);
  const stageViewportRef = useRef<HTMLDivElement>(null);
  const stageContentRef = useRef<HTMLDivElement>(null);

  const currentIndex = stage === "result" ? STAGES.length : STAGES.findIndex((item) => item.key === stage);
  const symbolState = selectedSymbols.length < 2 ? "too-light" : selectedSymbols.length > 3 ? "too-crowded" : "just-right";
  const symbolMessage = symbolState === "too-light" ? "还看不出你从哪来，选一个最想被记住的符号。" : symbolState === "too-crowded" ? "符号都在抢话，删掉一个，让主角先说。" : "刚刚好，一眼认出，一眼记住。";

  const stopCamera = useCallback(() => {
    cameraStream.current?.getTracks().forEach((track) => track.stop());
    cameraStream.current = null;
    setCameraOn(false);
  }, []);

  const stopMic = useCallback(() => {
    if (audioFrame.current) cancelAnimationFrame(audioFrame.current);
    audioFrame.current = null;
    audioStream.current?.getTracks().forEach((track) => track.stop());
    audioStream.current = null;
    void audioContext.current?.close();
    audioContext.current = null;
  }, []);

  useEffect(() => () => {
    stopCamera();
    stopMic();
    if (holdTimer.current) window.clearTimeout(holdTimer.current);
  }, [stopCamera, stopMic]);

  useEffect(() => {
    if (cameraOn && videoRef.current && cameraStream.current) {
      videoRef.current.srcObject = cameraStream.current;
      void videoRef.current.play();
    }
  }, [cameraOn]);

  useEffect(() => {
    const handleSensor = (event: Event) => {
      const detail = (event as CustomEvent<SensorPayload>).detail;
      if (detail.type === "mat-left") setLeftPad(detail.active !== false);
      if (detail.type === "mat-right") setRightPad(detail.active !== false);
      if (detail.type === "clap") {
        setChantHits((value) => {
          const next = value + 1;
          if (next >= 3) setChantComplete(true);
          return next;
        });
      }
      if (detail.type === "goal" && stage === "kick") setStage("result");
    };
    window.addEventListener("mingchao:sensor", handleSensor);
    return () => window.removeEventListener("mingchao:sensor", handleSensor);
  }, [stage]);

  useEffect(() => {
    const viewport = stageViewportRef.current;
    const content = stageContentRef.current;
    if (!viewport || !content) return;
    let frame = 0;
    const fitStage = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const availableWidth = Math.max(1, viewport.clientWidth - 2);
        const availableHeight = Math.max(1, viewport.clientHeight - 2);
        const naturalWidth = Math.max(1, content.scrollWidth);
        const naturalHeight = Math.max(1, content.scrollHeight);
        const nextScale = Math.min(1, availableWidth / naturalWidth, availableHeight / naturalHeight);
        setStageScale((current) => Math.abs(current - nextScale) > 0.005 ? nextScale : current);
      });
    };
    const observer = new ResizeObserver(fitStage);
    observer.observe(viewport);
    observer.observe(content);
    fitStage();
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [stage, storyMode, chantComplete, cameraOn, capturedPhoto, remixReady, shareCardUrl, sensorPanel]);

  const startHeartHold = () => {
    if (memories.length !== MEMORY_FRAGMENTS.length) return;
    setHeartHolding(true);
    holdTimer.current = window.setTimeout(() => {
      setHeartReady(true);
      setHeartHolding(false);
    }, 1200);
  };

  const cancelHeartHold = () => {
    if (holdTimer.current) window.clearTimeout(holdTimer.current);
    if (!heartReady) setHeartHolding(false);
  };

  const toggleMemory = (fragment: string) => setMemories((current) => current.includes(fragment) ? current : [...current, fragment]);
  const toggleSymbol = (id: string) => setSelectedSymbols((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  const tapCheer = () => {
    if (chantComplete) return;
    setChantHits((value) => {
      const next = value + 1;
      if (next >= 3) {
        setChantComplete(true);
        setMicStatus("声浪已经连成一片");
      } else {
        setMicStatus("再把回声交给同伴");
      }
      return next;
    });
  };

  const startMicrophone = async () => {
    try {
      stopMic();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      context.createMediaStreamSource(stream).connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      let energeticFrames = 0;
      audioStream.current = stream;
      audioContext.current = context;
      setMicStatus("正在听你的助威——喊出来！");
      const monitor = () => {
        analyser.getByteTimeDomainData(samples);
        const peak = samples.reduce((max, value) => Math.max(max, Math.abs(value - 128)), 0);
        energeticFrames = peak > 24 ? energeticFrames + 1 : Math.max(0, energeticFrames - 1);
        if (energeticFrames > 16) {
          setChantHits(3);
          setChantComplete(true);
          setMicStatus("声浪已经连成一片");
          stopMic();
          return;
        }
        audioFrame.current = requestAnimationFrame(monitor);
      };
      monitor();
    } catch {
      setMicStatus("麦克风没有开启，可以改用下方助威键");
    }
  };

  const openCamera = async () => {
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      cameraStream.current = stream;
      setCameraOn(true);
      setPhotoStatus("跟着拉拉队做动作，然后定格");
    } catch {
      setPhotoStatus("镜头没有开启，可直接使用像素头像完成合影");
    }
  };

  const capturePhoto = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 1120;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    drawCover(ctx, video, video.videoWidth, video.videoHeight, 0, 0, canvas.width, canvas.height);
    ctx.restore();
    ctx.fillStyle = "rgba(7, 34, 34, .22)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const squad = await loadImage("/assets/cheer-squad.png");
    ctx.drawImage(squad, 55, 465, 790, 525);
    ctx.strokeStyle = "#f6c94c";
    ctx.lineWidth = 18;
    ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);
    setCapturedPhoto(canvas.toDataURL("image/png"));
    setPhotoStatus("合影完成，你仍可重拍");
    stopCamera();
  };

  const useAvatarPhoto = () => {
    stopCamera();
    setCapturedPhoto("/assets/cheer-squad.png");
    setPhotoStatus("已使用像素拉拉队合影，不会保存真人画面");
  };

  const makeRemix = () => {
    setRemixing(true);
    setRemixReady(false);
    window.setTimeout(() => {
      setRemixing(false);
      setRemixReady(true);
    }, 900);
  };

  const triggerGoal = () => {
    setKickHint("进球确认——声浪正在穿过八闽！");
    window.setTimeout(() => setStage("result"), 520);
  };

  const connectSerialSensor = async () => {
    type SerialPortLike = { open(options: { baudRate: number }): Promise<void>; readable?: ReadableStream<Uint8Array> };
    type SerialApi = { requestPort(): Promise<SerialPortLike> };
    const serial = (navigator as Navigator & { serial?: SerialApi }).serial;
    if (!serial) {
      setSensorStatus("当前浏览器不支持串口，继续使用模拟模式");
      return;
    }
    try {
      const port = await serial.requestPort();
      await port.open({ baudRate: 9600 });
      setSensorStatus("实体传感器已连接");
      if (!port.readable) return;
      const reader = port.readable.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          try {
            const payload = JSON.parse(line.trim()) as SensorPayload;
            window.dispatchEvent(new CustomEvent("mingchao:sensor", { detail: payload }));
          } catch {
            if (line.trim() === "GOAL") window.dispatchEvent(new CustomEvent("mingchao:sensor", { detail: { type: "goal" } }));
          }
        }
      }
    } catch {
      setSensorStatus("连接已取消，模拟模式仍可使用");
    }
  };

  const createShareCard = useCallback(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 1500;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const background = await loadImage("/assets/stadium-bg.png");
    drawCover(ctx, background, background.width, background.height, 0, 0, canvas.width, canvas.height);
    const shade = ctx.createLinearGradient(0, 0, 0, canvas.height);
    shade.addColorStop(0, "rgba(4,24,37,.12)");
    shade.addColorStop(.55, "rgba(4,24,37,.42)");
    shade.addColorStop(1, "rgba(4,24,37,.96)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f6c94c";
    ctx.fillRect(68, 70, 220, 18);
    ctx.fillStyle = "#fff7d8";
    ctx.font = '900 88px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText("我把闽超", 68, 205);
    ctx.fillText("踢出圈了！", 68, 315);
    const visual = await loadImage(capturedPhoto || "/assets/cheer-squad.png");
    const vw = visual.width;
    const vh = visual.height;
    drawCover(ctx, visual, vw, vh, 80, 430, 1040, 650);
    ctx.strokeStyle = "#f6c94c";
    ctx.lineWidth = 18;
    ctx.strokeRect(80, 430, 1040, 650);
    ctx.fillStyle = "#f7f1dc";
    ctx.font = '800 48px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText(phrase, 92, 1180);
    ctx.fillStyle = "#8bd0ca";
    ctx.font = '700 34px "PingFang SC", "Microsoft YaHei", sans-serif';
    const stickerLabel = STICKERS.find((item) => item.id === sticker)?.label ?? sticker;
    ctx.fillText(`${stickerLabel}  ${tone}  ·  闽超声浪接力`, 92, 1250);
    ctx.fillStyle = "#fff7d8";
    ctx.font = '700 30px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText("故事 · 城市 · 同伴 · 新梗 · 一脚传出去", 92, 1360);
    canvas.toBlob((blob) => {
      if (!blob) return;
      setShareCardUrl((current) => {
        if (current.startsWith("blob:")) URL.revokeObjectURL(current);
        return URL.createObjectURL(blob);
      });
    }, "image/png");
  }, [capturedPhoto, phrase, sticker, tone]);

  useEffect(() => {
    if (stage === "result") {
      void createShareCard();
      void QRCode.toDataURL(window.location.href, { width: 240, margin: 1, color: { dark: "#102d31", light: "#fff8df" } }).then(setQrDataUrl);
    }
  }, [createShareCard, stage]);

  const shareWork = async () => {
    try {
      if (!shareCardUrl) return;
      const blob = await fetch(shareCardUrl).then((response) => response.blob());
      const file = new File([blob], "闽超声浪接力.png", { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: "我把闽超踢出圈了", text: phrase, files: [file] });
        setShareStatus("声浪已交给下一位球迷");
      } else {
        await navigator.clipboard.writeText(`我把闽超踢出圈了！${phrase}`);
        setShareStatus("分享文案已复制；像素卡可直接保存");
      }
    } catch {
      setShareStatus("分享已取消，作品仍保留在当前页面");
    }
  };

  const resetGame = () => {
    stopCamera();
    stopMic();
    setStage("intro");
    setStoryMode("idle");
    setMemories([]);
    setHeartReady(false);
    setSelectedSymbols([]);
    setLeftPad(false);
    setRightPad(false);
    setChantHits(0);
    setChantComplete(false);
    setCapturedPhoto("");
    setRemixReady(false);
    setRemixing(false);
    setKickHint("把足球向球门方向快速上划，或等待实体传感器信号");
    setShareStatus("把这份声浪交给下一位球迷");
  };

  return (
    <main className={`game-shell stage-${stage}`}>
      <div className="stadium-backdrop" aria-hidden="true" />
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-chip">PIXEL RITUAL · 互动仪式链</span>
          <strong>闽超声浪接力</strong>
        </div>
        <button className="sensor-toggle" onClick={() => setSensorPanel((value) => !value)} aria-expanded={sensorPanel}><PixelIcon src="/assets/button-icons-v2/sensor.png" alt="" className="button-icon" />传感器</button>
      </header>

      <nav className="ritual-track" aria-label="互动剧情进度">
        {STAGES.map((item, index) => (
          <div className={`track-step ${index < currentIndex ? "done" : ""} ${item.key === stage ? "active" : ""}`} key={item.key}>
            <span><PixelIcon src={item.icon} alt={item.label} /></span><small>{item.label}</small>
          </div>
        ))}
      </nav>

      {sensorPanel && (
        <aside className="sensor-panel" aria-label="传感器控制台">
          <div><strong>实体装置接口</strong><small>{sensorStatus}</small></div>
          <PixelButton onClick={() => void connectSerialSensor()} icon="/assets/button-icons-v2/serial.png" tone="secondary">连接串口传感器</PixelButton>
          <div className="sensor-sim-row">
            <button onClick={() => window.dispatchEvent(new CustomEvent("mingchao:sensor", { detail: { type: "mat-left", active: true } }))}><PixelIcon src="/assets/button-icons-v2/mat-left.png" alt="" className="button-icon" />模拟左脚垫</button>
            <button onClick={() => window.dispatchEvent(new CustomEvent("mingchao:sensor", { detail: { type: "mat-right", active: true } }))}><PixelIcon src="/assets/button-icons-v2/mat-right.png" alt="" className="button-icon" />模拟右脚垫</button>
            <button onClick={() => window.dispatchEvent(new CustomEvent("mingchao:sensor", { detail: { type: "goal" } }))}><PixelIcon src="/assets/button-icons-v2/goal-sensor.png" alt="" className="button-icon" />模拟进球</button>
          </div>
          <p>串口每行可发送 JSON：goal、mat-left、mat-right、clap。没有硬件时不影响完整体验。</p>
        </aside>
      )}

      <section className="game-stage" aria-live="polite">
        <div className="stage-corners" aria-hidden="true"><i /><i /><i /><i /></div>
        <div className="stage-viewport" ref={stageViewportRef}>
          <div className="stage-fit" ref={stageContentRef} style={{ "--stage-scale": stageScale } as CSSProperties}>
        {stage === "intro" && (
          <div className="intro-layout">
            <div className="hero-copy">
              <span className="eyebrow">STAGE 0 · 序幕</span>
              <h1>闽超声浪接力<br /><em>一脚踢出屏幕</em></h1>
              <p>球场里已经沸腾，屏幕外却还罩着“温差雾”。找回四件仪式物，把现场声浪交给下一个人。</p>
              <PixelButton onClick={() => setStage("story")} icon="/assets/button-icons-v2/start-pass.png" testId="start-game">接球，开始破圈</PixelButton>
              <div className="no-data-note">NO RANK · NO CHART · 只有真实互动</div>
            </div>
            <div className="guide-scene">
              {RITUAL_ICONS.map((item) => (
                <div className={`orbit-token ${item.id}`} key={item.id}>
                  <PixelIcon src={item.icon} alt={item.label} />
                </div>
              ))}
              <img src="/assets/guide.png" alt="原创像素引导员小闽火，手托发光足球" />
              <div className="speech-bubble">“闽超缺的不是观众，<br />是把热爱传给下一位的那一脚。”</div>
            </div>
          </div>
        )}

        {stage === "story" && (
          <div className="act-layout">
            <div className="act-heading"><span>ACT 1 · H1</span><h2>把比分变成家乡故事</h2><p>纯资讯让人知道，情感叙事让人愿意继续讲。</p></div>
            <div className="story-doors">
              <button className={`story-door info ${storyMode === "info" ? "selected" : ""}`} onClick={() => setStoryMode("info")}><PixelIcon src="/assets/button-icons-v2/info-card.png" alt="" className="choice-icon" /><small>赛事资讯</small><strong>今晚有比赛</strong><span>知道发生了什么</span></button>
              <button className={`story-door emotion ${storyMode === "emotion" ? "selected" : ""}`} onClick={() => setStoryMode("emotion")}><PixelIcon src="/assets/button-icons-v2/story-boot.png" alt="" className="choice-icon" /><small>人物叙事</small><strong>旧球鞋里的海风</strong><span>知道为什么值得记住</span></button>
            </div>
            {storyMode === "info" && <div className="soft-message">赛况卡亮了一下，又安静了。小闽火：“信息已经看见了，再听一句他的心里话。”</div>}
            {storyMode === "emotion" && (
              <div className="memory-board">
                <div className="fragment-row">
                  {MEMORY_FRAGMENTS.map((fragment) => (
                    <button className={memories.includes(fragment) ? "restored" : ""} key={fragment} onClick={() => toggleMemory(fragment)}>
                      <PixelIcon src={memories.includes(fragment) ? "/assets/button-icons-v2/memory-on.png" : MEMORY_ICONS[fragment]} alt="" />
                      <span>{fragment}</span>
                    </button>
                  ))}
                </div>
                <blockquote>“小时候，海风总把球吹回脚边。今天我想把这座城的名字，踢到更远的地方。”</blockquote>
                <button
                  className={`heart-hold ${heartHolding ? "holding" : ""} ${heartReady ? "ready" : ""}`}
                  onPointerDown={startHeartHold}
                  onPointerUp={cancelHeartHold}
                  onPointerLeave={cancelHeartHold}
                  disabled={memories.length !== MEMORY_FRAGMENTS.length || heartReady}
                >
                  <span className="heart-visual" aria-hidden="true">
                    <PixelIcon src="/assets/button-icons-v2/heart-memory.png" alt="" className="heart-icon" />
                    <i className="heart-pulse" />
                    <i className="heart-pulse delay" />
                  </span>
                  <span className="heart-copy">{heartReady ? "情感火种已点亮" : "按住心跳，守住这段记忆"}</span>
                </button>
              </div>
            )}
            <div className="act-actions"><PixelButton onClick={() => setStage("symbols")} icon="/assets/button-icons-v2/fire-next.png" disabled={!heartReady}>带着情感火种继续</PixelButton></div>
          </div>
        )}

        {stage === "symbols" && (
          <div className="act-layout symbol-act">
            <div className="act-heading"><span>ACT 2 · H2</span><h2>给福建味留一口气</h2><p>选择最重要的城市符号，让人一眼认出，也让画面有呼吸。</p></div>
            <div className="symbol-workshop">
              <div className="symbol-palette">
                <h3>点选素材，再点一次撤回</h3>
                {SYMBOLS.map((item) => (
                  <button key={item.id} className={selectedSymbols.includes(item.id) ? "picked" : ""} onClick={() => toggleSymbol(item.id)}>
                    <b><PixelIcon src={item.icon} alt={item.label} /></b>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
              <div className={`pixel-flag ${symbolState}`}>
                <div className="flag-pole" />
                <div className="flag-cloth">
                  {selectedSymbols.map((id) => {
                    const item = SYMBOLS.find((symbol) => symbol.id === id);
                    return item ? <span key={id}><PixelIcon src={item.icon} alt={item.label} /></span> : null;
                  })}
                  <strong>闽超 · 声浪接力</strong>
                </div>
                <div className="density-state">{symbolState === "too-light" ? "太淡" : symbolState === "too-crowded" ? "太挤" : "刚刚好"}</div>
              </div>
            </div>
            <div className={`symbol-message ${symbolState}`}>{symbolMessage}</div>
            <div className="act-actions"><PixelButton onClick={() => setStage("social")} icon="/assets/button-icons-v2/flag-raise.png" disabled={symbolState !== "just-right"}>举起城市徽记</PixelButton></div>
          </div>
        )}

        {stage === "social" && (
          <div className="act-layout social-act">
            <div className="act-heading"><span>ACT 3 · H3</span><h2>一个人知道，不如一起喊</h2><p>共同站位、轮流回应，再和拉拉队完成一张真正能带走的合影。</p></div>
            {!chantComplete ? (
              <>
                <div className="footpads">
                  <button className={leftPad ? "active" : ""} onClick={() => setLeftPad(true)}>
                    <PixelIcon src="/assets/button-icons-v2/mat-left.png" alt="" className="foot-icon" />
                    <b>左脚印</b>
                    <span>{leftPad ? "传球手已就位" : "我站上去"}</span>
                  </button>
                  <div className={`pass-line ${leftPad && rightPad ? "linked" : ""}`}>
                    <PixelIcon src="/assets/button-icons-v2/ball.png" alt="足球" />
                  </div>
                  <button className={rightPad ? "active" : ""} onClick={() => setRightPad(true)}>
                    <PixelIcon src="/assets/button-icons-v2/mat-right.png" alt="" className="foot-icon" />
                    <b>右脚印</b>
                    <span>{rightPad ? "同伴已就位" : "邀请同伴"}</span>
                  </button>
                </div>
                <div className="chant-console"><div className={`sound-ripples hits-${Math.min(chantHits, 3)}`}><i /><i /><i /></div><strong>{leftPad && rightPad ? micStatus : "先让两枚脚印都亮起来"}</strong><div className="chant-buttons"><PixelButton onClick={() => void startMicrophone()} icon="/assets/button-icons-v2/microphone.png" disabled={!leftPad || !rightPad} tone="secondary">打开麦克风助威</PixelButton><PixelButton onClick={tapCheer} icon="/assets/button-icons-v2/clap.png" disabled={!leftPad || !rightPad} tone="ghost">拍手 / 点按助威</PixelButton></div></div>
              </>
            ) : (
              <div className="photo-studio">
                <div className="camera-frame">{cameraOn ? <video ref={videoRef} playsInline muted /> : capturedPhoto ? <img src={capturedPhoto} alt="用户选择的像素拉拉队合影" /> : <div className="avatar-stage"><img src="/assets/cheer-squad.png" alt="原创像素拉拉队做出挥旗、举手和比心动作" /></div>}<div className="camera-overlay"><span>准备——一起把海风喊起来！</span></div></div>
                <div className="photo-controls"><p>{photoStatus}</p>{cameraOn ? <PixelButton onClick={() => void capturePhoto()} icon="/assets/button-icons-v2/capture.png">定格这一刻</PixelButton> : <><PixelButton onClick={() => void openCamera()} icon="/assets/button-icons-v2/camera.png" tone="secondary">同意并打开镜头</PixelButton><PixelButton onClick={useAvatarPhoto} icon="/assets/button-icons-v2/avatar-group.png" tone="ghost">不用镜头，使用像素合影</PixelButton></>}</div>
              </div>
            )}
            <div className="act-actions"><PixelButton onClick={() => { stopCamera(); setStage("remix"); }} icon="/assets/button-icons-v2/echo-next.png" disabled={!capturedPhoto}>带着同伴回声去二创</PixelButton></div>
          </div>
        )}

        {stage === "remix" && (
          <div className="act-layout remix-act">
            <div className="act-heading"><span>ACT 4 · H4</span><h2>把名场面变成“我们的梗”</h2><p>原片只是材料，你的方言、动作和贴纸让它长出第二次生命。</p></div>
            <div className="remix-workshop">
              <div className="remix-controls">
                <label>方言 / 助威短句
                  <select value={phrase} onChange={(event) => { setPhrase(event.target.value); setRemixReady(false); }}>
                    {PHRASES.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
                <label>像素节奏
                  <select value={tone} onChange={(event) => { setTone(event.target.value); setRemixReady(false); }}>
                    {TONES.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
                <fieldset>
                  <legend>动作贴纸</legend>
                  {STICKERS.map((item) => (
                    <button className={sticker === item.id ? "selected" : ""} key={item.id} onClick={() => { setSticker(item.id); setRemixReady(false); }} title={item.label}>
                      <PixelIcon src={item.icon} alt={item.label} />
                    </button>
                  ))}
                </fieldset>
                <PixelButton onClick={makeRemix} icon="/assets/button-icons-v2/remix.png" disabled={remixing}>{remixing ? "素材正在重新排布…" : "重新开球 · 完成再编码"}</PixelButton>
              </div>
              <div className={`remix-preview ${remixing ? "remixing" : ""} ${remixReady ? "ready" : ""}`}>
                <img src={capturedPhoto || "/assets/cheer-squad.png"} alt="闽超像素二创预览" />
                <div className="meme-caption">{phrase}</div>
                <div className="meme-sticker">
                  <PixelIcon src={STICKERS.find((item) => item.id === sticker)?.icon ?? STICKERS[0].icon} alt="" />
                </div>
                <small>{tone}</small>
              </div>
            </div>
            {remixReady && <div className="soft-message success">梗火花已点亮：这已经不是原素材，而是你的闽超表达。</div>}
            <div className="act-actions"><PixelButton onClick={() => setStage("kick")} icon="/assets/button-icons-v2/ritual-ball.png" disabled={!remixReady}>把四件仪式物注入足球</PixelButton></div>
          </div>
        )}

        {stage === "kick" && (
          <div className="act-layout kick-act">
            <div className="act-heading"><span>FINAL · 闭环</span><h2>一脚破圈</h2><p>故事、符号、同伴与新梗已经就位。现在，把热爱踢出屏幕。</p></div>
            <div className="goal-stage">
              <div className="goal-net"><span>声浪出口</span></div>
              <div className="ritual-orbit">
                {RITUAL_ICONS.map((item) => (
                  <i key={item.id}><PixelIcon src={item.icon} alt={item.label} /></i>
                ))}
              </div>
              <button
                className="kick-ball"
                aria-label="向上划动足球完成射门"
                onPointerDown={(event) => { kickStart.current = event.clientY; event.currentTarget.setPointerCapture(event.pointerId); }}
                onPointerUp={(event) => {
                  if (kickStart.current !== null && kickStart.current - event.clientY > 45) triggerGoal();
                  else setKickHint("海风把球送回来了，再果断地向上划一次");
                  kickStart.current = null;
                }}
              >
                <PixelIcon src="/assets/button-icons-v2/swipe-kick.png" alt="足球" className="kick-ball-icon" />
              </button>
              <div className="kick-trail" />
            </div>
            <div className="kick-instruction">{kickHint}</div>
            <div className="kick-actions"><PixelButton onClick={triggerGoal} icon="/assets/button-icons-v2/goal-sensor.png" tone="secondary">模拟球门传感器进球</PixelButton><PixelButton onClick={() => setStage("result")} icon="/assets/button-icons-v2/assist.png" tone="ghost">无障碍助攻键</PixelButton></div>
          </div>
        )}

        {stage === "result" && (
          <div className="result-layout">
            <div className="pixel-burst" aria-hidden="true"><i /><i /><i /><i /><i /></div>
            <span className="eyebrow">GOAL · 球进了</span>
            <h2>闽超破圈，<br /><em>被你继续讲了一次。</em></h2>
            <p>{shareStatus}</p>
            <div className="result-card">{shareCardUrl ? <img src={shareCardUrl} alt="自动生成的闽超像素分享卡" /> : <div className="card-loading">像素卡正在显影…</div>}{qrDataUrl && <div className="share-qr"><img src={qrDataUrl} alt="在手机上继续体验的二维码" /><span>扫码带走声浪</span></div>}</div>
            <div className="result-actions"><PixelButton onClick={() => void shareWork()} icon="/assets/button-icons-v2/share.png" disabled={!shareCardUrl}>发布 / 分享给朋友</PixelButton>{shareCardUrl && <a className="pixel-button secondary" href={shareCardUrl} download="闽超声浪接力.png"><PixelIcon src="/assets/button-icons-v2/save.png" alt="" className="button-icon" />保存像素卡</a>}<PixelButton onClick={resetGame} icon="/assets/button-icons-v2/pass-next.png" tone="ghost">把球交给下一位</PixelButton></div>
          </div>
        )}
          </div>
        </div>
      </section>

      <footer><span>原创互动原型 · 不使用真实赛事数据</span><span>镜头与麦克风仅在你主动开启时使用</span></footer>
    </main>
  );
}
