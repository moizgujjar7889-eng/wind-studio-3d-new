import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronUp, Hand, RotateCcw, Wind, MicOff } from 'lucide-react';
import type { CharacterPreset, LocationPreset } from './lib/types';
import { LOCATIONS } from './lib/locations';
import { CHARACTERS } from './lib/characters';
import { WindEngine, DemoWind } from './lib/windEngine';
import { WindScene } from './three/windScene';
import WindMeter from './components/WindMeter';
import StylePanel from './components/StylePanel';

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<WindScene | null>(null);
  const engineRef = useRef<WindEngine | null>(null);
  const demoRef = useRef<DemoWind | null>(null);
  const dragRef = useRef<{ x: number; active: boolean }>({ x: 0, active: false });

  const [location, setLocation] = useState<LocationPreset>(LOCATIONS.garden);
  const [character, setCharacter] = useState<CharacterPreset>(CHARACTERS[0]);
  const [listening, setListening] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [wind, setWind] = useState(0);
  const [peak, setPeak] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<'closed' | 'style'>('closed');
  const [fps, setFps] = useState(60);
  const [manualWind, setManualWind] = useState(0);
  const [useManual, setUseManual] = useState(false);

  // ---- scene boot ----
  useEffect(() => {
    if (!mountRef.current) return;
    const scene = new WindScene(mountRef.current, LOCATIONS.garden, CHARACTERS[0], {
      onFps: setFps,
    });
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setLocation(location);
  }, [location]);

  useEffect(() => {
    sceneRef.current?.setCharacter(character);
  }, [character]);

  // ---- wind wiring ----
  const applyWind = useCallback((w: number) => {
    setWind(w);
    sceneRef.current?.setWind(w);
  }, []);

  useEffect(() => {
    if (listening || demoMode || useManual) return;
    applyWind(0);
  }, [listening, demoMode, useManual, applyWind]);

  useEffect(() => {
    if (!useManual) return;
    applyWind(manualWind);
  }, [manualWind, useManual, applyWind]);

  const startMic = useCallback(async () => {
    setError(null);
    demoRef.current?.stop();
    setDemoMode(false);
    const engine = engineRef.current ?? new WindEngine();
    engineRef.current = engine;
    engine.onWind((level, status) => {
      setWind(level);
      setPeak(status.peak);
      sceneRef.current?.setWind(level);
      if (status.message) setError(status.message);
    });
    await engine.start();
    if (engine.status.phase === 'listening') {
      setListening(true);
    } else if (engine.status.phase === 'error') {
      setError(engine.status.message ?? 'Microphone unavailable.');
    }
  }, []);

  const stopMic = useCallback(() => {
    engineRef.current?.stop();
    setListening(false);
    applyWind(0);
  }, [applyWind]);

  const startDemo = useCallback(() => {
    engineRef.current?.stop();
    setListening(false);
    setError(null);
    const demo = demoRef.current ?? new DemoWind();
    demoRef.current = demo;
    demo.onWind((level) => {
      setWind(level);
      setPeak(level);
      sceneRef.current?.setWind(level);
    });
    demo.start();
    setDemoMode(true);
  }, []);

  const stopDemo = useCallback(() => {
    demoRef.current?.stop();
    setDemoMode(false);
    applyWind(0);
  }, [applyWind]);

  useEffect(() => {
    return () => {
      engineRef.current?.dispose();
      demoRef.current?.stop();
    };
  }, []);

  // ---- orbit drag ----
  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { x: e.clientX, active: true };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.active || !sceneRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    dragRef.current.x = e.clientX;
    sceneRef.current.addYaw(dx * 0.006);
  };
  const onPointerUp = () => {
    dragRef.current.active = false;
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    sceneRef.current?.addZoom(e.deltaY * 0.002);
  };

  const active = listening || demoMode || useManual;

  return (
    <div className="fixed inset-0 bg-[#0a0e14] overflow-hidden font-sans">
      {/* 3D canvas */}
      <div
        ref={mountRef}
        className="absolute inset-0 touch-none cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onWheel={onWheel}
      />

      {/* top bar */}
      <header className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-4 pt-4 pointer-events-none">
        <div className="pointer-events-auto">
          <h1 className="text-lg font-extrabold tracking-[0.22em] text-white drop-shadow-lg">
            WIND STUDIO
            <span className="ml-1.5 text-sky-300">3D</span>
          </h1>
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/50 mt-0.5">
            {location.name} · {character.name}
          </p>
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <span className="rounded-full bg-black/40 backdrop-blur px-3 py-1.5 text-[10px] font-semibold tracking-wider text-white/60 border border-white/10">
            {fps} FPS
          </span>
        </div>
      </header>

      {/* wind indicator (top-right under fps) */}
      <div className="absolute top-16 right-4 z-20 pointer-events-none">
        {active && (
          <span className="flex items-center gap-1.5 rounded-full bg-sky-500/20 border border-sky-400/40 px-3 py-1 text-[10px] font-bold tracking-[0.18em] text-sky-200 backdrop-blur">
            <Wind className="w-3 h-3 animate-pulse" />
            {demoMode ? 'DEMO GUSTS' : 'LISTENING'}
          </span>
        )}
      </div>

      {/* bottom sheet */}
      <div className="absolute inset-x-0 bottom-0 z-30 pointer-events-none">
        <div className="pointer-events-auto mx-auto w-full max-w-md px-4 pb-4">
          <div className="rounded-3xl bg-black/55 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/60 overflow-hidden">
            <div className="px-5 pt-4 pb-3 flex items-center justify-between">
              <WindMeter level={wind} active={active} />
              <div className="flex flex-col items-end gap-1 text-right">
                <span className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-semibold">
                  Peak gust
                </span>
                <span className="text-xl font-bold text-white/90 tabular-nums">
                  {Math.round(peak * 100)}%
                </span>
                <button
                  onClick={() => {
                    if (demoMode) stopDemo();
                    else if (!listening) startDemo();
                  }}
                  className="mt-1 text-[10px] uppercase tracking-[0.14em] font-bold text-sky-300/80 hover:text-sky-200 underline underline-offset-4 decoration-sky-400/40"
                >
                  {demoMode ? 'Stop demo' : 'Demo gusts'}
                </button>
              </div>
            </div>

            <div className="px-5 pb-5 flex flex-col gap-3">
              {error && (
                <div className="flex items-start gap-3 rounded-xl bg-rose-950/60 border border-rose-500/30 p-3.5 text-rose-100 text-sm leading-relaxed">
                  <MicOff className="w-5 h-5 shrink-0 mt-0.5 text-rose-300" />
                  <div className="flex flex-col gap-2">
                    <span>{error}</span>
                    <button
                      onClick={startMic}
                      className="self-start text-xs font-semibold tracking-wide uppercase text-rose-300 hover:text-rose-200 underline underline-offset-4"
                    >
                      Try again
                    </button>
                  </div>
                </div>
              )}
              {!listening && !demoMode && (
                <button
                  onClick={startMic}
                  className="flex items-center justify-center gap-2.5 w-full rounded-2xl bg-gradient-to-br from-sky-400 to-sky-600 hover:from-sky-300 hover:to-sky-500 active:scale-[0.98] transition-all text-white font-semibold py-4 shadow-lg shadow-sky-950/40"
                >
                  <Wind className="w-5 h-5" />
                  Start Wind — Blow Into the Mic
                </button>
              )}
              {listening && (
                <button
                  onClick={stopMic}
                  className="w-full rounded-2xl bg-rose-500/90 hover:bg-rose-500 active:scale-[0.98] transition-all text-white font-semibold py-4 shadow-lg shadow-rose-950/40"
                >
                  Stop Microphone
                </button>
              )}
              {demoMode && (
                <button
                  onClick={stopDemo}
                  className="w-full rounded-2xl bg-amber-500/90 hover:bg-amber-500 active:scale-[0.98] transition-all text-white font-semibold py-4 shadow-lg shadow-amber-950/40"
                >
                  Stop Demo Gusts
                </button>
              )}

              {/* Manual wind slider */}
              <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] uppercase tracking-[0.18em] text-white/50 font-semibold">
                    Manual Wind
                  </label>
                  <span className="text-sm font-bold text-sky-300 tabular-nums">
                    {Math.round(manualWind * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={manualWind}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setManualWind(v);
                    setUseManual(true);
                    if (listening) stopMic();
                    if (demoMode) stopDemo();
                    applyWind(v);
                  }}
                  className="w-full h-2 rounded-full appearance-none bg-white/15 accent-sky-400 cursor-pointer"
                />
                <div className="flex justify-between mt-1.5 text-[9px] text-white/30 uppercase tracking-wider">
                  <span>Calm</span>
                  <span>Gale</span>
                </div>
              </div>

              <div className="flex gap-2.5">
                <button
                  onClick={() => setPanel(panel === 'style' ? 'closed' : 'style')}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 active:scale-[0.98] transition-all text-white/85 text-sm font-medium py-3 border border-white/10"
                >
                  <Hand className="w-4 h-4" />
                  Style &amp; Location
                  <ChevronUp
                    className={`w-4 h-4 transition-transform ${panel === 'style' ? '' : 'rotate-180'}`}
                  />
                </button>
                <button
                  onClick={() => {
                    sceneRef.current?.resetYaw();
                    setManualWind(0);
                    setUseManual(false);
                    applyWind(0);
                  }}
                  title="Reset simulation & view"
                  className="flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/15 active:scale-[0.98] transition-all text-white/85 py-3 px-4 border border-white/10"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {panel === 'style' && (
              <div className="px-5 pb-6 pt-1 border-t border-white/10 bg-black/30">
                <StylePanel
                  character={character}
                  location={location}
                  onCharacter={setCharacter}
                  onLocation={setLocation}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
