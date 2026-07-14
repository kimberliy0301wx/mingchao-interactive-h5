"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import QRCode from "qrcode";

type Stage = "intro" | "story" | "symbols" | "social" | "remix" | "kick" | "result";
type SensorPayload = { type?: string; side?: "left" | "right"; active?: boolean };
type DeviceMotionEventWithPermission = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};
type FeedbackDialog = {
  kicker: string;
  title: string;
  copy: string;
  icon: string;
  actionLabel?: string;
  kind?: "dismiss" | "kick-retry";
};

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

function PixelButton({ children, onClick, icon, disabled = false, blocked = false, autoFocus = false, tone = "primary", testId, className = "" }: { children: React.ReactNode; onClick: () => void; icon: string; disabled?: boolean; blocked?: boolean; autoFocus?: boolean; tone?: "primary" | "secondary" | "ghost"; testId?: string; className?: string }) {
  return (
    <button className={`pixel-button ${tone} ${blocked ? "is-blocked" : ""} ${className}`.trim()} onClick={onClick} disabled={disabled} data-blocked={blocked || undefined} data-testid={testId} autoFocus={autoFocus}>
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
  const [clapPulse, setClapPulse] = useState(0);
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
  const [kickHint, setKickHint] = useState("看准指针进入金色区域，点击足球即可射门");
  const [kicking, setKicking] = useState(false);
  const [kickOutcome, setKickOutcome] = useState<"idle" | "goal" | "miss">("idle");
  const [kickDirection, setKickDirection] = useState<"left" | "right">("right");
  const [feedbackDialog, setFeedbackDialog] = useState<FeedbackDialog | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [sensorPanel, setSensorPanel] = useState(false);
  const [sensorStatus, setSensorStatus] = useState("手机感应待开启");
  const [shareCardUrl, setShareCardUrl] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [shareStatus, setShareStatus] = useState("把这份声浪交给下一位球迷");
  const [stageScale, setStageScale] = useState(1);

  const holdTimer = useRef<number | null>(null);
  const heartHoldStartedAt = useRef(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStream = useRef<MediaStream | null>(null);
  const audioStream = useRef<MediaStream | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const audioFrame = useRef<number | null>(null);
  const motionHandler = useRef<((event: DeviceMotionEvent) => void) | null>(null);
  const lastMotionAt = useRef(0);
  const kickTimer = useRef<number | null>(null);
  const kickingRef = useRef(false);
  const kickSweetSpotRef = useRef<HTMLSpanElement>(null);
  const kickPointerRef = useRef<HTMLElement>(null);
  const bgmRef = useRef<HTMLAudioElement>(null);
  const buttonSfxRef = useRef<HTMLAudioElement>(null);
  const cityCorrectSfxRef = useRef<HTMLAudioElement>(null);
  const cheerSfxRef = useRef<HTMLAudioElement>(null);
  const shutterSfxRef = useRef<HTMLAudioElement>(null);
  const kickSfxRef = useRef<HTMLAudioElement>(null);
  const soundEnabledRef = useRef(true);
  const stageRef = useRef<Stage>("intro");
  const stageViewportRef = useRef<HTMLDivElement>(null);
  const stageContentRef = useRef<HTMLDivElement>(null);

  const currentIndex = stage === "result" ? STAGES.length : STAGES.findIndex((item) => item.key === stage);
  const symbolState = selectedSymbols.length < 2 ? "too-light" : selectedSymbols.length > 3 ? "too-crowded" : "just-right";
  const symbolMessage = symbolState === "too-light" ? "还看不出你从哪来，选一个最想被记住的符号。" : symbolState === "too-crowded" ? "符号都在抢话，删掉一个，让主角先说。" : "刚刚好，一眼认出，一眼记住。";

  const playClip = useCallback((audio: HTMLAudioElement | null, volume: number) => {
    if (!audio || !soundEnabledRef.current) return;
    audio.volume = volume;
    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
  }, []);

  const toggleSound = () => {
    const next = !soundEnabledRef.current;
    soundEnabledRef.current = next;
    setSoundEnabled(next);
    const effects = [buttonSfxRef.current, cityCorrectSfxRef.current, cheerSfxRef.current, shutterSfxRef.current, kickSfxRef.current];
    if (!next) {
      bgmRef.current?.pause();
      effects.forEach((audio) => {
        audio?.pause();
        if (audio) audio.currentTime = 0;
      });
      return;
    }
    const bgm = bgmRef.current;
    if (bgm) {
      bgm.volume = 0.24;
      void bgm.play().catch(() => undefined);
    }
  };

  const showFeedback = useCallback((dialog: FeedbackDialog) => {
    setFeedbackDialog({ kind: "dismiss", actionLabel: "知道了，继续", ...dialog });
  }, []);

  const triggerGoal = useCallback(() => {
    if (kickingRef.current) return;
    const pointer = kickPointerRef.current?.getBoundingClientRect();
    const sweetSpot = kickSweetSpotRef.current?.getBoundingClientRect();
    if (!pointer || !sweetSpot) {
      setKickHint("指针还没准备好，请再试一次");
      return;
    }

    const pointerCenter = pointer.left + pointer.width / 2;
    const sweetCenter = sweetSpot.left + sweetSpot.width / 2;
    const scored = pointerCenter >= sweetSpot.left && pointerCenter <= sweetSpot.right;
    const direction = pointerCenter < sweetCenter ? "left" : "right";

    playClip(kickSfxRef.current, 0.82);
    setFeedbackDialog(null);
    kickingRef.current = true;
    setKicking(true);
    setKickOutcome(scored ? "goal" : "miss");
    setKickDirection(direction);
    setKickHint(scored ? "时机正好！足球正飞进声浪出口" : "时机偏了，足球飞向门框外！");
    if (kickTimer.current) window.clearTimeout(kickTimer.current);
    kickTimer.current = window.setTimeout(() => {
      kickingRef.current = false;
      setKicking(false);
      if (scored) {
        setKickOutcome("idle");
        setStage("result");
      } else {
        setKickHint("偏出！等指针进入金色区域，再踢一遍");
        showFeedback({
          kicker: "MISS · 时机偏了",
          title: "这脚偏出啦",
          copy: "指针没有停在金色区域，球还没进。等指针进入“最佳时机”，再踢一次。",
          icon: "/assets/button-icons-v2/swipe-kick.png",
          actionLabel: "回到球前 · 再踢一遍",
          kind: "kick-retry",
        });
      }
      kickTimer.current = null;
    }, 980);
  }, [playClip, showFeedback]);

  const dismissFeedback = () => {
    if (feedbackDialog?.kind === "kick-retry") {
      setKickOutcome("idle");
      setKickHint("再看一次指针，进入金色区域时点击足球");
    }
    setFeedbackDialog(null);
  };

  useEffect(() => {
    stageRef.current = stage;
    if (stage !== "social" && stage !== "kick") setSensorPanel(false);
  }, [stage]);

  useEffect(() => {
    if (!feedbackDialog) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismissFeedback();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [feedbackDialog]);

  useEffect(() => {
    const startBgm = () => {
      const bgm = bgmRef.current;
      if (bgm && bgm.paused && soundEnabledRef.current) {
        bgm.volume = 0.24;
        void bgm.play().catch(() => undefined);
      }
      window.removeEventListener("pointerdown", startBgm);
      window.removeEventListener("keydown", startBgm);
    };
    window.addEventListener("pointerdown", startBgm, { once: true });
    window.addEventListener("keydown", startBgm, { once: true });
    return () => {
      window.removeEventListener("pointerdown", startBgm);
      window.removeEventListener("keydown", startBgm);
    };
  }, []);

  useEffect(() => {
    const handleButtonSound = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const control = event.target.closest("button, a.pixel-button");
      if (!control || control.hasAttribute("disabled")) return;
      if (control.classList.contains("kick-ball") || control.classList.contains("kick-trigger") || control.closest(".symbol-palette")) return;
      playClip(buttonSfxRef.current, 0.52);
    };
    document.addEventListener("click", handleButtonSound);
    return () => document.removeEventListener("click", handleButtonSound);
  }, [playClip]);

  const registerClap = useCallback(() => {
    if (!leftPad || !rightPad || chantComplete) return;
    playClip(cheerSfxRef.current, 0.68);
    setClapPulse((value) => value + 1);
    setChantHits((value) => {
      if (value >= 3) return value;
      const next = value + 1;
      if (next >= 3) {
        setChantComplete(true);
        setMicStatus("声浪已经连成一片");
      } else {
        setMicStatus("再把回声交给同伴");
      }
      return next;
    });
  }, [chantComplete, leftPad, playClip, rightPad]);

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
    if (motionHandler.current) window.removeEventListener("devicemotion", motionHandler.current);
    if (holdTimer.current) window.clearTimeout(holdTimer.current);
    if (kickTimer.current) window.clearTimeout(kickTimer.current);
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
        registerClap();
      }
      if (detail.type === "goal" && stage === "kick") triggerGoal();
    };
    window.addEventListener("mingchao:sensor", handleSensor);
    return () => window.removeEventListener("mingchao:sensor", handleSensor);
  }, [registerClap, stage, triggerGoal]);

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
    if (memories.length !== MEMORY_FRAGMENTS.length) {
      showFeedback({
        kicker: "WAIT · 记忆未齐",
        title: "记忆还没找齐",
        copy: `先点亮三段记忆。现在已经找回 ${memories.length} / ${MEMORY_FRAGMENTS.length} 段。`,
        icon: "/assets/button-icons-v2/memory-on.png",
      });
      return;
    }
    if (heartReady) return;
    heartHoldStartedAt.current = Date.now();
    setHeartHolding(true);
    holdTimer.current = window.setTimeout(() => {
      heartHoldStartedAt.current = 0;
      setHeartReady(true);
      setHeartHolding(false);
    }, 1200);
  };

  const cancelHeartHold = (showReleaseHint = false) => {
    const releasedEarly = heartHoldStartedAt.current > 0;
    if (holdTimer.current) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
    heartHoldStartedAt.current = 0;
    if (!heartReady) setHeartHolding(false);
    if (showReleaseHint && releasedEarly && !heartReady) {
      showFeedback({
        kicker: "HOLD · 松手太早",
        title: "这里需要长按",
        copy: "按住心跳按钮不要松手，持续约 1.2 秒，等情感火种完全点亮。",
        icon: "/assets/button-icons-v2/heart-memory.png",
        actionLabel: "明白了，再长按一次",
      });
    }
  };

  const toggleMemory = (fragment: string) => {
    if (memories.includes(fragment)) {
      showFeedback({
        kicker: "FOUND · 已经收好",
        title: "这段记忆亮过了",
        copy: "它已经放进故事里。继续点亮还没有发光的记忆碎片。",
        icon: "/assets/button-icons-v2/memory-on.png",
      });
      return;
    }
    setMemories((current) => [...current, fragment]);
  };

  const chooseInfoStory = () => {
    setStoryMode("info");
    showFeedback({
      kicker: "TRY AGAIN · 还差情感",
      title: "赛况不是这次的答案",
      copy: "它能告诉大家发生了什么，却还不能让人记住为什么重要。试试右边的人物故事。",
      icon: "/assets/button-icons-v2/info-card.png",
      actionLabel: "回去选择人物故事",
    });
  };

  const continueFromStory = () => {
    if (heartReady) {
      setFeedbackDialog(null);
      setStage("symbols");
      return;
    }
    if (storyMode !== "emotion") {
      showFeedback({
        kicker: "WAIT · 故事未选择",
        title: "先找到值得记住的故事",
        copy: "选择“旧球鞋里的海风”，再把其中三段记忆找回来。",
        icon: "/assets/button-icons-v2/story-boot.png",
      });
      return;
    }
    if (memories.length !== MEMORY_FRAGMENTS.length) {
      showFeedback({
        kicker: "WAIT · 记忆未齐",
        title: "故事还没有拼完整",
        copy: `还差 ${MEMORY_FRAGMENTS.length - memories.length} 段记忆。把三张记忆卡全部点亮后再继续。`,
        icon: "/assets/button-icons-v2/memory-on.png",
      });
      return;
    }
    showFeedback({
      kicker: "HOLD · 火种未亮",
      title: "还要守住这段记忆",
      copy: "按住心跳按钮约 1.2 秒，等情感火种真正点亮后再继续。",
      icon: "/assets/button-icons-v2/heart-memory.png",
    });
  };

  const toggleSymbol = (id: string) => {
    const next = selectedSymbols.includes(id) ? selectedSymbols.filter((item) => item !== id) : [...selectedSymbols, id];
    const wasCorrect = selectedSymbols.length >= 2 && selectedSymbols.length <= 3;
    const isCorrect = next.length >= 2 && next.length <= 3;
    setSelectedSymbols(next);
    playClip(isCorrect && !wasCorrect ? cityCorrectSfxRef.current : buttonSfxRef.current, isCorrect && !wasCorrect ? 0.76 : 0.52);
    if (next.length > 3) {
      showFeedback({
        kicker: "TOO MUCH · 素材太挤",
        title: "旗帜快装不下了",
        copy: "城市符号最多保留三个。再点一次不那么重要的素材，把主角让出来。",
        icon: "/assets/button-icons-v2/flag.png",
        actionLabel: "回去删掉一个素材",
      });
    }
  };

  const continueFromSymbols = () => {
    if (symbolState === "just-right") {
      setFeedbackDialog(null);
      setStage("social");
      return;
    }
    showFeedback(symbolState === "too-light" ? {
      kicker: "TOO LIGHT · 还认不出",
      title: "城市味还不够",
      copy: "至少选择两个城市符号，再举起这面旗帜。",
      icon: "/assets/button-icons-v2/flag.png",
      actionLabel: "继续选择素材",
    } : {
      kicker: "TOO MUCH · 素材太挤",
      title: "先给旗帜留口气",
      copy: "最多保留三个城市符号。删掉一个素材，让画面重新清楚起来。",
      icon: "/assets/button-icons-v2/flag.png",
      actionLabel: "回去删掉一个素材",
    });
  };

  const activatePad = (side: "left" | "right") => {
    const active = side === "left" ? leftPad : rightPad;
    if (active) {
      showFeedback({
        kicker: "READY · 已经就位",
        title: "这一边已经亮了",
        copy: side === "left" ? "发起人已经站好。现在去邀请右侧同伴一起就位。" : "同伴已经站好。两边都亮起后就可以开始助威。",
        icon: side === "left" ? "/assets/button-icons-v2/cheer.png" : "/assets/button-icons-v2/echo.png",
      });
      return;
    }
    if (side === "left") setLeftPad(true);
    else setRightPad(true);
  };

  const tapCheer = () => {
    if (chantComplete) return;
    if (!leftPad || !rightPad) {
      showFeedback({
        kicker: "WAIT · 站位未齐",
        title: "先让两边都站好",
        copy: "点亮“我的站位”和“同伴站位”，两个人准备好后再拍手助威。",
        icon: "/assets/button-icons-v2/clap.png",
      });
      return;
    }
    registerClap();
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
      showFeedback({
        kicker: "MIC · 没有听见",
        title: "麦克风没有开启",
        copy: "可以允许麦克风后再试，也可以直接使用“拍手助威”完成这一幕。",
        icon: "/assets/button-icons-v2/microphone.png",
        actionLabel: "改用拍手助威",
      });
    }
  };

  const startMicrophoneWithGuard = () => {
    if (!leftPad || !rightPad) {
      showFeedback({
        kicker: "WAIT · 站位未齐",
        title: "现在还不能开麦",
        copy: "先点亮“我的站位”和“同伴站位”，再让两边一起把声音接起来。",
        icon: "/assets/button-icons-v2/microphone.png",
      });
      return;
    }
    void startMicrophone();
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
      showFeedback({
        kicker: "CAMERA · 镜头未开",
        title: "没有取得镜头画面",
        copy: "可以重新允许镜头，也可以选择“不用镜头，使用像素合影”。",
        icon: "/assets/button-icons-v2/camera.png",
        actionLabel: "改用像素合影",
      });
    }
  };

  const capturePhoto = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      showFeedback({
        kicker: "WAIT · 画面未就绪",
        title: "镜头还在准备",
        copy: "等画面出现后再定格这一刻，或者返回使用像素合影。",
        icon: "/assets/button-icons-v2/capture.png",
      });
      return;
    }
    playClip(shutterSfxRef.current, 0.78);
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
    playClip(shutterSfxRef.current, 0.78);
    setCapturedPhoto("/assets/cheer-squad.png");
    setPhotoStatus("已使用像素拉拉队合影，不会保存真人画面");
  };

  const continueFromSocial = () => {
    if (capturedPhoto) {
      stopCamera();
      setFeedbackDialog(null);
      setStage("remix");
      return;
    }
    if (!chantComplete) {
      showFeedback(!leftPad || !rightPad ? {
        kicker: "WAIT · 站位未齐",
        title: "同伴回声还没接上",
        copy: "先点亮左右两处站位，再使用麦克风或拍手完成助威。",
        icon: "/assets/button-icons-v2/echo.png",
      } : {
        kicker: "WAIT · 声浪未满",
        title: "再把回声喊响一点",
        copy: "继续拍手，或打开麦克风助威。声浪达到三格后才会进入合影。",
        icon: "/assets/button-icons-v2/clap.png",
      });
      return;
    }
    showFeedback({
      kicker: "WAIT · 合影未完成",
      title: "还少一张同伴合影",
      copy: "打开镜头定格这一刻，或直接使用像素合影，再带着回声去二创。",
      icon: "/assets/button-icons-v2/avatar-group.png",
      actionLabel: "回去完成合影",
    });
  };

  const makeRemix = () => {
    setRemixing(true);
    setRemixReady(false);
    window.setTimeout(() => {
      setRemixing(false);
      setRemixReady(true);
    }, 900);
  };

  const continueFromRemix = () => {
    if (remixReady) {
      setFeedbackDialog(null);
      setStage("kick");
      return;
    }
    showFeedback({
      kicker: "WAIT · 二创未生成",
      title: "梗火花还没点亮",
      copy: "先选择短句、节奏和贴纸，再点击“重新开球 · 完成再编码”。",
      icon: "/assets/button-icons-v2/remix.png",
      actionLabel: "回去完成二创",
    });
  };

  const enablePhoneSensor = async () => {
    if (typeof DeviceMotionEvent === "undefined") {
      setSensorStatus("当前浏览器不支持手机动作感应，可继续点按模拟");
      showFeedback({
        kicker: "SENSOR · 当前不可用",
        title: "这台设备没有动作感应",
        copy: "不用连接实体装置，直接使用控制台里的模拟按钮也能继续体验。",
        icon: "/assets/button-icons-v2/sensor.png",
        actionLabel: "使用点按模拟",
      });
      return;
    }
    try {
      const motionApi = DeviceMotionEvent as DeviceMotionEventWithPermission;
      if (motionApi.requestPermission) {
        const permission = await motionApi.requestPermission();
        if (permission !== "granted") {
          setSensorStatus("手机感应未授权，可继续点按模拟");
          showFeedback({
            kicker: "SENSOR · 未获授权",
            title: "手机感应没有开启",
            copy: "可以重新授权，也可以直接使用控制台里的模拟按钮继续体验。",
            icon: "/assets/button-icons-v2/sensor.png",
            actionLabel: "使用点按模拟",
          });
          return;
        }
      }
      if (motionHandler.current) window.removeEventListener("devicemotion", motionHandler.current);
      motionHandler.current = (event: DeviceMotionEvent) => {
        const now = Date.now();
        if (now - lastMotionAt.current < 900) return;
        const motion = event.accelerationIncludingGravity;
        const strength = Math.abs(motion?.x ?? 0) + Math.abs(motion?.y ?? 0) + Math.abs(motion?.z ?? 0);
        if (strength < 24) return;
        lastMotionAt.current = now;
        if (stageRef.current === "social") {
          window.dispatchEvent(new CustomEvent("mingchao:sensor", { detail: { type: "clap" } }));
        }
        if (stageRef.current === "kick" && strength > 32) {
          window.dispatchEvent(new CustomEvent("mingchao:sensor", { detail: { type: "goal" } }));
        }
      };
      window.addEventListener("devicemotion", motionHandler.current);
      setSensorStatus("手机感应已开启：晃动可助威，射门页可触发进球");
    } catch {
      setSensorStatus("手机感应开启失败，可继续点按模拟");
      showFeedback({
        kicker: "SENSOR · 开启失败",
        title: "暂时读不到手机动作",
        copy: "不用外接设备，直接使用控制台里的模拟按钮即可继续。",
        icon: "/assets/button-icons-v2/sensor.png",
        actionLabel: "使用点按模拟",
      });
    }
  };

  const simulatePad = (side: "left" | "right") => {
    if (stageRef.current !== "social" || chantComplete) {
      showFeedback({
        kicker: "NOT YET · 当前幕不可用",
        title: "现在还用不上站位",
        copy: "走到“一个人知道，不如一起喊”这一幕，再用手机感应点亮两处站位。",
        icon: "/assets/button-icons-v2/sensor.png",
      });
      return;
    }
    if ((side === "left" && leftPad) || (side === "right" && rightPad)) {
      activatePad(side);
      return;
    }
    window.dispatchEvent(new CustomEvent("mingchao:sensor", { detail: { type: side === "left" ? "mat-left" : "mat-right", active: true } }));
  };

  const simulateMotion = () => {
    if (stageRef.current !== "social" && stageRef.current !== "kick") {
      showFeedback({
        kicker: "NOT YET · 当前幕不可用",
        title: "现在晃动还不会生效",
        copy: "在同伴助威幕晃动可模拟拍手，在射门幕晃动可触发踢球。",
        icon: "/assets/button-icons-v2/goal-sensor.png",
      });
      return;
    }
    if (stageRef.current === "social" && (!leftPad || !rightPad)) {
      showFeedback({
        kicker: "WAIT · 站位未齐",
        title: "先让两边都站好",
        copy: "点亮两处站位后，再晃动手机完成拍手助威。",
        icon: "/assets/button-icons-v2/clap.png",
      });
      return;
    }
    window.dispatchEvent(new CustomEvent("mingchao:sensor", { detail: { type: stageRef.current === "social" ? "clap" : "goal" } }));
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
      playClip(cheerSfxRef.current, 0.78);
      void createShareCard();
      void QRCode.toDataURL(window.location.href, { width: 240, margin: 1, color: { dark: "#102d31", light: "#fff8df" } }).then(setQrDataUrl);
    }
  }, [createShareCard, playClip, stage]);

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

  const attemptShare = () => {
    if (!shareCardUrl) {
      showFeedback({
        kicker: "WAIT · 像素卡显影中",
        title: "分享卡还没准备好",
        copy: "再等一小会儿，像素卡和二维码完成显影后就可以发布。",
        icon: "/assets/button-icons-v2/share.png",
      });
      return;
    }
    void shareWork();
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
    setKicking(false);
    setKickOutcome("idle");
    setKickDirection("right");
    setFeedbackDialog(null);
    kickingRef.current = false;
    if (kickTimer.current) window.clearTimeout(kickTimer.current);
    kickTimer.current = null;
    setKickHint("看准指针进入金色区域，点击足球即可射门");
    setSensorStatus("手机感应待开启");
    setShareStatus("把这份声浪交给下一位球迷");
  };

  return (
    <main className={`game-shell stage-${stage}`}>
      <audio ref={bgmRef} src="/assets/audio/bgm-0714.mp3" preload="auto" loop aria-hidden="true" />
      <audio ref={buttonSfxRef} src="/assets/audio/sfx-button.mp3" preload="auto" aria-hidden="true" />
      <audio ref={cityCorrectSfxRef} src="/assets/audio/sfx-city-correct.mp3" preload="auto" aria-hidden="true" />
      <audio ref={cheerSfxRef} src="/assets/audio/sfx-cheer.mp3" preload="auto" aria-hidden="true" />
      <audio ref={shutterSfxRef} src="/assets/audio/sfx-shutter.mp3" preload="auto" aria-hidden="true" />
      <audio ref={kickSfxRef} src="/assets/audio/sfx-kick.mp3" preload="auto" aria-hidden="true" />
      <div className="stadium-backdrop" aria-hidden="true" />
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-chip">PIXEL RITUAL · 互动仪式链</span>
          <strong>闽超声浪接力</strong>
        </div>
        <button className={`sound-toggle ${soundEnabled ? "" : "muted"}`.trim()} onClick={toggleSound} aria-pressed={soundEnabled} aria-label={soundEnabled ? "关闭声音" : "开启声音"}><PixelIcon src="/assets/button-icons-v2/echo.png" alt="" className="button-icon" /><span>{soundEnabled ? "声音开" : "声音关"}</span></button>
      </header>

      <nav className="ritual-track" aria-label="互动剧情进度">
        {STAGES.map((item, index) => (
          <div className={`track-step ${index < currentIndex ? "done" : ""} ${item.key === stage ? "active" : ""}`} key={item.key}>
            <span><PixelIcon src={item.icon} alt={item.label} /></span><small>{item.label}</small>
          </div>
        ))}
      </nav>

      {sensorPanel && (
        <aside className="sensor-panel" aria-label="手机感应控制台">
          <div><strong>手机感应</strong><small>{sensorStatus}</small></div>
          <PixelButton onClick={() => void enablePhoneSensor()} icon="/assets/button-icons-v2/sensor.png" tone="secondary">开启手机感应</PixelButton>
          <div className="sensor-sim-row">
            <button onClick={() => simulatePad("left")}><PixelIcon src="/assets/button-icons-v2/cheer.png" alt="" className="button-icon" />点亮我的站位</button>
            <button onClick={() => simulatePad("right")}><PixelIcon src="/assets/button-icons-v2/echo.png" alt="" className="button-icon" />点亮同伴站位</button>
            <button onClick={simulateMotion}><PixelIcon src="/assets/button-icons-v2/goal-sensor.png" alt="" className="button-icon" />晃动手机</button>
          </div>
          <p>这里的传感器指手机自带动作感应：倾斜点亮站位，晃动完成拍手助威，射门页晃动可判定进球。不需要外接设备。</p>
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
              <button className={`story-door info ${storyMode === "info" ? "selected" : ""}`} onClick={chooseInfoStory}><PixelIcon src="/assets/button-icons-v2/info-card.png" alt="" className="choice-icon" /><small>赛事资讯</small><strong>今晚有比赛</strong><span>知道发生了什么</span></button>
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
                  onClick={() => { if (memories.length !== MEMORY_FRAGMENTS.length) startHeartHold(); }}
                  onPointerUp={() => cancelHeartHold(true)}
                  onPointerLeave={() => cancelHeartHold(false)}
                  disabled={heartReady}
                  data-blocked={memories.length !== MEMORY_FRAGMENTS.length || undefined}
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
            <div className="act-actions"><PixelButton onClick={continueFromStory} icon="/assets/button-icons-v2/fire-next.png" blocked={!heartReady}>带着情感火种继续</PixelButton></div>
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
                  <strong>闽超 · 声浪接力</strong>
                </div>
                <div className="flag-materials" aria-label="已选城市素材">
                  {selectedSymbols.length === 0 ? <em>素材会放在旗帜下方</em> : selectedSymbols.map((id) => {
                    const item = SYMBOLS.find((symbol) => symbol.id === id);
                    return item ? <span key={id}><PixelIcon src={item.icon} alt={item.label} /></span> : null;
                  })}
                </div>
                <div className="density-state">{symbolState === "too-light" ? "太淡" : symbolState === "too-crowded" ? "太挤" : "刚刚好"}</div>
              </div>
            </div>
            <div className={`symbol-message ${symbolState}`}>{symbolMessage}</div>
            <div className="act-actions"><PixelButton onClick={continueFromSymbols} icon="/assets/button-icons-v2/flag-raise.png" blocked={symbolState !== "just-right"}>举起城市徽记</PixelButton></div>
          </div>
        )}

        {stage === "social" && (
          <div className="act-layout social-act">
            <div className="act-heading"><span>ACT 3 · H3</span><h2>一个人知道，不如一起喊</h2><p>共同站位、轮流回应，再和拉拉队完成一张真正能带走的合影。</p></div>
            <button className="inline-sensor-toggle" onClick={() => setSensorPanel((value) => !value)} aria-expanded={sensorPanel}><PixelIcon src="/assets/button-icons-v2/sensor.png" alt="" className="button-icon" />手机感应</button>
            {!chantComplete ? (
              <>
                <div className="footpads">
                  <button className={leftPad ? "active" : ""} onClick={() => activatePad("left")}>
                    <PixelIcon src="/assets/button-icons-v2/cheer.png" alt="" className="foot-icon" />
                    <b>我的站位</b>
                    <span>{leftPad ? "发起人已就位" : "点亮站位"}</span>
                  </button>
                  <div className={`pass-line ${leftPad && rightPad ? "linked" : ""}`}>
                    <PixelIcon src="/assets/button-icons-v2/ball.png" alt="足球" />
                  </div>
                  <button className={rightPad ? "active" : ""} onClick={() => activatePad("right")}>
                    <PixelIcon src="/assets/button-icons-v2/echo.png" alt="" className="foot-icon" />
                    <b>同伴站位</b>
                    <span>{rightPad ? "应援同伴已就位" : "邀请同伴"}</span>
                  </button>
                </div>
                <div className="chant-console">
                  <div className={`sound-ripples hits-${Math.min(chantHits, 3)}`}><i /><i /><i /></div>
                  {clapPulse > 0 && (
                    <div className="clap-burst" key={`clap-burst-${clapPulse}`} aria-hidden="true">
                      <PixelIcon src="/assets/button-icons-v2/clap.png" alt="" />
                      <PixelIcon src="/assets/button-icons-v2/clap.png" alt="" />
                    </div>
                  )}
                  <strong>{leftPad && rightPad ? micStatus : "先让两处站位都亮起来"}</strong>
                  <div className="chant-buttons">
                    <PixelButton onClick={startMicrophoneWithGuard} icon="/assets/button-icons-v2/microphone.png" blocked={!leftPad || !rightPad} tone="secondary">打开麦克风助威</PixelButton>
                    <PixelButton key={`clap-button-${clapPulse}`} onClick={tapCheer} icon="/assets/button-icons-v2/clap.png" blocked={!leftPad || !rightPad} tone="ghost" className={clapPulse > 0 ? "clap-button clapping" : "clap-button"}>拍手助威</PixelButton>
                  </div>
                </div>
              </>
            ) : (
              <div className="photo-studio">
                <div className="camera-frame">{cameraOn ? <video ref={videoRef} playsInline muted /> : capturedPhoto ? <img src={capturedPhoto} alt="用户选择的像素拉拉队合影" /> : <div className="avatar-stage"><img src="/assets/cheer-squad.png" alt="原创像素拉拉队做出挥旗、举手和比心动作" /></div>}<div className="camera-overlay"><span>准备——一起把海风喊起来！</span></div></div>
                <div className="photo-controls"><p>{photoStatus}</p>{cameraOn ? <PixelButton onClick={() => void capturePhoto()} icon="/assets/button-icons-v2/capture.png">定格这一刻</PixelButton> : <><PixelButton onClick={() => void openCamera()} icon="/assets/button-icons-v2/camera.png" tone="secondary">同意并打开镜头</PixelButton><PixelButton onClick={useAvatarPhoto} icon="/assets/button-icons-v2/avatar-group.png" tone="ghost">不用镜头，使用像素合影</PixelButton></>}</div>
              </div>
            )}
            <div className="act-actions"><PixelButton onClick={continueFromSocial} icon="/assets/button-icons-v2/echo-next.png" blocked={!capturedPhoto}>带着同伴回声去二创</PixelButton></div>
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
            <div className="act-actions"><PixelButton onClick={continueFromRemix} icon="/assets/button-icons-v2/ritual-ball.png" blocked={!remixReady}>把四件仪式物注入足球</PixelButton></div>
          </div>
        )}

        {stage === "kick" && (
          <div className="act-layout kick-act">
            <div className="act-heading"><span>FINAL · 闭环</span><h2>一脚破圈</h2><p>故事、符号、同伴与新梗已经就位。现在，把热爱踢出屏幕。</p></div>
            <button className="inline-sensor-toggle" onClick={() => setSensorPanel((value) => !value)} aria-expanded={sensorPanel}><PixelIcon src="/assets/button-icons-v2/sensor.png" alt="" className="button-icon" />手机感应</button>
            <div className={`goal-stage ${kicking ? `kicking ${kickOutcome}${kickOutcome === "miss" ? ` miss-${kickDirection}` : ""}` : kickOutcome === "miss" ? "missed" : ""}`}>
              <div className="goal-net"><span>声浪出口</span></div>
              <div className="ritual-orbit">
                {RITUAL_ICONS.map((item) => (
                  <i key={item.id}><PixelIcon src={item.icon} alt={item.label} /></i>
                ))}
              </div>
              <div className="kick-timing" aria-label="射门时机指针">
                <span className="kick-sweet-spot" ref={kickSweetSpotRef}>最佳时机</span>
                <i aria-hidden="true" ref={kickPointerRef} />
              </div>
              <button
                className="kick-ball"
                aria-label="点击足球完成射门"
                onClick={triggerGoal}
                disabled={kicking}
              >
                <PixelIcon src="/assets/button-icons-v2/swipe-kick.png" alt="足球" className="kick-ball-icon" />
              </button>
              <div className="kick-trail" />
            </div>
            <div className="kick-instruction">{kickHint}</div>
            <div className="kick-actions"><PixelButton onClick={triggerGoal} icon="/assets/button-icons-v2/goal-sensor.png" tone="secondary" disabled={kicking} className="kick-trigger">{kicking ? "足球飞行中…" : kickOutcome === "miss" ? "再踢一遍" : "现在踢球"}</PixelButton><PixelButton onClick={() => setStage("result")} icon="/assets/button-icons-v2/assist.png" tone="ghost">无障碍助攻键</PixelButton></div>
          </div>
        )}

        {stage === "result" && (
          <div className="result-layout">
            <div className="pixel-burst" aria-hidden="true"><i /><i /><i /><i /><i /></div>
            <span className="eyebrow">GOAL · 球进了</span>
            <h2>闽超破圈，<br /><em>被你继续讲了一次。</em></h2>
            <p>{shareStatus}</p>
            <div className="result-card">{shareCardUrl ? <img src={shareCardUrl} alt="自动生成的闽超像素分享卡" /> : <div className="card-loading">像素卡正在显影…</div>}{qrDataUrl && <div className="share-qr"><img src={qrDataUrl} alt="在手机上继续体验的二维码" /><span>扫码带走声浪</span></div>}</div>
            <div className="result-actions"><PixelButton onClick={attemptShare} icon="/assets/button-icons-v2/share.png" blocked={!shareCardUrl}><span className="share-button-copy">发布<br />分享给朋友</span></PixelButton>{shareCardUrl && <a className="pixel-button secondary" href={shareCardUrl} download="闽超声浪接力.png"><PixelIcon src="/assets/button-icons-v2/save.png" alt="" className="button-icon" />保存像素卡</a>}<PixelButton onClick={resetGame} icon="/assets/button-icons-v2/pass-next.png" tone="ghost">把球交给下一位</PixelButton></div>
          </div>
        )}
          </div>
        </div>
      </section>

      {feedbackDialog && (
        <div className="pixel-dialog-backdrop" role="presentation">
          <div
            className="pixel-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-dialog-title"
            aria-describedby="feedback-dialog-copy"
          >
            <span className="pixel-dialog-kicker">{feedbackDialog.kicker}</span>
            <PixelIcon src={feedbackDialog.icon} alt="" className="pixel-dialog-icon" />
            <h2 id="feedback-dialog-title">{feedbackDialog.title}</h2>
            <p id="feedback-dialog-copy">{feedbackDialog.copy}</p>
            <PixelButton
              onClick={dismissFeedback}
              icon="/assets/button-icons-v2/pass-next.png"
              testId="feedback-dialog-action"
              autoFocus
            >
              {feedbackDialog.actionLabel}
            </PixelButton>
          </div>
        </div>
      )}

      <footer><span>原创互动原型 · 不使用真实赛事数据</span><span>镜头与麦克风仅在你主动开启时使用</span></footer>
    </main>
  );
}
