import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import {
  OPEN_PITCH_CLASSES as OPEN,
  STRING_NAMES as STRINGS,
  optimizePath,
  parseSong,
  spellTone,
  type Chord,
  type DegreeRole,
} from "./music";

import {
  beatAtTime,
  beatGrid,
  locate,
  stepEndBeat,
  stepStartBeat,
  stepStartTime,
  timeOfBeat,
} from "./transport";

import { COPY, PRESETS, songNameFromFile, type Lang, type Preset } from "./content";
import { BACKING_STYLES, backingEvents, type BackingStyle } from "./backing";
import { BackingPlayer } from "./backingPlayer";
import { Link, navigate, useRoute } from "./router";
import Help from "./pages/Help";
import Repertoire from "./pages/Repertoire";
import SavedSongs, { type SavedSong } from "./pages/SavedSongs";

function colorForRole(role: DegreeRole) {
  if (role === "bass") return "root";
  return role === "sixth" || role === "suspension" ? "extension" : role;
}

type PracticeMode = "chords" | "arpeggio" | "walking";

const STORAGE_KEY = "bvm:songs";

const clampFret = (value:number) => Number.isFinite(value) ? Math.max(0,Math.min(24,Math.round(value))) : 0;

function readSavedSongs():SavedSong[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(raw) ? raw as SavedSong[] : [];
  } catch { return []; }
}

export default function App() {
  const [lang,setLang] = useState<Lang>("en");
  const [panel,setPanel] = useState<"chords"|"backing">("chords");
  const route = useRoute();
  const t = COPY[lang];
  const [input,setInput] = useState("C-7:4 F7:4 Bbdim7:2 Ebdim7:6");
  const [from,setFrom] = useState(0); const [to,setTo] = useState(5);
  const [active,setActive] = useState(0); const [optimized,setOptimized] = useState(true);
  const [bpm,setBpm] = useState(100); const [beats,setBeats] = useState(4);
  const [mode,setMode] = useState<PracticeMode>("chords"); const [playing,setPlaying] = useState(false);
  const [beat,setBeat] = useState(0); const [noteStep,setNoteStep] = useState(0); const [metro,setMetro] = useState(true);
  const [audioUrl,setAudioUrl] = useState(""); const [audioName,setAudioName] = useState("");
  const [source,setSource] = useState<"metronome"|"generated"|"file">("metronome");
  const [style,setStyle] = useState<BackingStyle>("swing");
  const [drumLevel,setDrumLevel] = useState(0.9); const [compLevel,setCompLevel] = useState(0.55); const [countIn,setCountIn] = useState(true);
  const [speed,setSpeed] = useState(1); const [offset,setOffset] = useState(0); const [loop,setLoop] = useState(false);
  const [loopStart,setLoopStart] = useState(0); const [loopEnd,setLoopEnd] = useState(Number.MAX_SAFE_INTEGER);
  const [songTitle,setSongTitle] = useState(""); const [songSubtitle,setSongSubtitle] = useState(""); const [savedSongs,setSavedSongs] = useState<SavedSong[]>([]);
  const [warning,setWarning] = useState("");
  const audioRef = useRef<AudioContext | null>(null);
  const mediaRef = useRef<HTMLAudioElement | null>(null);
  const playerRef = useRef<BackingPlayer | null>(null);

  // Voicing search costs 100ms+ on long progressions; keep it off the keystroke path.
  const deferredInput = useDeferredValue(input);
  const song = useMemo(() => parseSong(deferredInput,beats),[deferredInput,beats]);
  const steps = song.steps;
  const parsed = useMemo(() => steps.map(step=>step.chord),[steps]);
  const grid = useMemo(() => beatGrid(steps),[steps]);
  const { path, unreachable } = useMemo(() => optimizePath(parsed,from,to),[parsed,from,to]);
  const chord:Chord | undefined = parsed[Math.min(active, Math.max(0,parsed.length-1))];
  const fullSelected = useMemo(() => optimized ? path[Math.min(active,Math.max(0,path.length-1))] ?? [] : [],[optimized,path,active]);
  const orderedSelected = useMemo(() => [...fullSelected].sort((a,b)=>a.toneIndex-b.toneIndex || b.string-a.string),[fullSelected]);
  const walkingOrder = useMemo(() => {
    if (!orderedSelected.length) return [];
    const root=orderedSelected.find(p=>p.role==="root")??orderedSelected[0];
    const fifth=orderedSelected.find(p=>p.role==="fifth")??orderedSelected.at(-1)!;
    const third=orderedSelected.find(p=>p.role==="third")??root;
    return [root,third,fifth,third];
  },[orderedSelected]);
  const playedPositions = mode==="walking" ? walkingOrder : orderedSelected;
  const currentPlayed = mode==="chords" ? null : playedPositions[noteStep % Math.max(1,playedPositions.length)];
  const selected = mode!=="chords" && playing && currentPlayed ? [currentPlayed] : fullSelected;
  const frets = Array.from({length:to-from+1},(_,i)=>from+i);
  const stepBeats = steps[Math.min(active,Math.max(0,steps.length-1))]?.beats ?? beats;
  const safeLoopStart = Math.min(loopStart,Math.max(0,steps.length-1));
  const safeLoopEnd = Math.max(safeLoopStart,Math.min(loopEnd,Math.max(0,steps.length-1)));
  const region = useMemo(()=>{
    const first = loop ? safeLoopStart : 0;
    const last = loop ? safeLoopEnd : steps.length-1;
    const slice = steps.slice(first,last+1);
    return { slice, offset: stepStartBeat(grid,first), beats: beatGrid(slice).total, events: backingEvents(slice,style) };
  },[steps,grid,loop,safeLoopStart,safeLoopEnd,style]);

  // The interval callback must not read state through a stale closure, and must not
  // run side effects inside a setState updater: refs carry the live transport position.
  const cursor = useRef({beat:0,active:0});
  useEffect(()=>{ cursor.current={beat,active}; },[beat,active]);

  const seekStep = (index:number) => {
    const next=Math.max(0,Math.min(index,Math.max(0,steps.length-1)));
    cursor.current={beat:0,active:next};
    setActive(next); setBeat(0); setNoteStep(0);
    if (mediaRef.current) mediaRef.current.currentTime=stepStartTime(grid,next,bpm,offset);
  };
  const markDownbeat = () => { if (mediaRef.current) setOffset(Math.max(0,Number(mediaRef.current.currentTime.toFixed(2)))); };

  const audioContext = () => {
    const Ctx = window.AudioContext || (window as typeof window & {webkitAudioContext:typeof AudioContext}).webkitAudioContext;
    audioRef.current ??= new Ctx();
    return audioRef.current;
  };
  const click = (accent=false) => {
    if (!metro || source==="generated") return;
    const ctx=audioContext(), osc=ctx.createOscillator(), gain=ctx.createGain();
    osc.frequency.value=accent?1000:720; gain.gain.setValueAtTime(.055,ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.055);
    osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime+.06);
  };
  const togglePlay = () => {
    if (!parsed.length) return;
    // Autoplay policy: the context must be resumed from inside the gesture.
    void audioContext().resume().catch(()=>undefined);
    setPlaying(v=>!v);
  };
  const resetPractice = () => { setPlaying(false); seekStep(loop?safeLoopStart:0); };

  useEffect(()=>{
    // Browser storage is only available after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSavedSongs(readSavedSongs());
  },[]);
  useEffect(()=>{
    if (!mediaRef.current) return;
    mediaRef.current.playbackRate=speed;
    if (playing) void mediaRef.current.play().catch(()=>setPlaying(false)); else mediaRef.current.pause();
  },[playing,speed,audioUrl]);
  useEffect(()=>{
    // Metronome only: the interval is the clock.
    if (!playing || !steps.length || source!=="metronome") return;
    click(true);
    const id=window.setInterval(()=>{
      const current=cursor.current;
      const currentBeats=steps[Math.min(current.active,steps.length-1)]?.beats ?? beats;
      const nextBeat=current.beat+1;
      const chordDone=nextBeat>=currentBeats;
      click(chordDone);
      if (mode!=="chords") setNoteStep(n=>n+1);
      if (!chordDone) { cursor.current={...current,beat:nextBeat}; setBeat(nextBeat); return; }

      let following=current.active+1;
      if (loop && following>safeLoopEnd) following=safeLoopStart;
      if (following>=steps.length) { setPlaying(false); return; }
      cursor.current={beat:0,active:following};
      setBeat(0); setActive(following);
    },60000/bpm);
    return ()=>window.clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[playing,bpm,mode,steps,beats,metro,loop,safeLoopStart,safeLoopEnd,source]);
  useEffect(()=>{
    // Backing track: the audio element is the clock, so playback rate and buffering
    // cannot pull the fretboard out of sync with what you are hearing.
    if (!playing || source!=="file" || !steps.length) return;
    let frame=0;
    const follow=()=>{
      frame=window.requestAnimationFrame(follow);
      const media=mediaRef.current;
      if (!media) return;
      const position=beatAtTime(media.currentTime,bpm,offset);
      if (loop) {
        const openBeat=stepStartBeat(grid,safeLoopStart);
        const closeBeat=stepEndBeat(grid,steps,safeLoopEnd);
        if (position>=closeBeat || position<openBeat-0.25) { media.currentTime=timeOfBeat(openBeat,bpm,offset); return; }
      }
      const at=locate(grid,position);
      if (!at) return;
      const current=cursor.current;
      if (at.index===current.active && at.beatInStep===current.beat) return;
      click(at.beatInStep===0);
      if (mode!=="chords") setNoteStep(n=>at.index===current.active?n+1:0);
      cursor.current={beat:at.beatInStep,active:at.index};
      setBeat(at.beatInStep); setActive(at.index);
    };
    frame=window.requestAnimationFrame(follow);
    return ()=>window.cancelAnimationFrame(frame);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[playing,source,audioUrl,steps,grid,bpm,offset,mode,metro,loop,safeLoopStart,safeLoopEnd]);
  useEffect(()=>{
    // Generated backing: the AudioContext clock drives both the sound and the fretboard.
    if (!playing || source!=="generated" || !region.events.length) return;
    const player = playerRef.current ??= new BackingPlayer(audioContext());
    player.setLevels(drumLevel,compLevel);
    player.start(region.events,bpm,region.beats,Math.max(0,stepStartBeat(grid,cursor.current.active)-region.offset),countIn?4:0);
    let frame=0;
    const follow=()=>{
      frame=window.requestAnimationFrame(follow);
      const within=player.position();
      if (within<0) return;
      const at=locate(grid,region.offset+within);
      if (!at) return;
      const current=cursor.current;
      if (at.index===current.active && at.beatInStep===current.beat) return;
      if (mode!=="chords") setNoteStep(n=>at.index===current.active?n+1:0);
      cursor.current={beat:at.beatInStep,active:at.index};
      setBeat(at.beatInStep); setActive(at.index);
    };
    frame=window.requestAnimationFrame(follow);
    return ()=>{ window.cancelAnimationFrame(frame); player.stop(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[playing,source,region,bpm,grid,mode,countIn]);
  useEffect(()=>{ playerRef.current?.setLevels(drumLevel,compLevel); },[drumLevel,compLevel]);
  useEffect(()=>()=>{ playerRef.current?.dispose(); },[]);
  useEffect(()=>()=>{ if(audioUrl) URL.revokeObjectURL(audioUrl); },[audioUrl]);

  const persist = (next:SavedSong[]) => {
    setSavedSongs(next);
    try { window.localStorage.setItem(STORAGE_KEY,JSON.stringify(next)); setWarning(""); }
    catch { setWarning(t.storageFull); }
  };
  const loadPreset = (preset:Preset) => { setInput(preset.progression); setBpm(preset.bpm); setStyle(preset.feel); setSongTitle(preset.title); setSongSubtitle(`${preset.artist} · ${preset.style} · ${preset.bpm} BPM`); setPlaying(false); seekStep(0); navigate("/"); };
  const loadAudio = (file?:File) => {
    if (!file) return;
    mediaRef.current?.pause();
    setAudioUrl(current=>{ if(current) URL.revokeObjectURL(current); return URL.createObjectURL(file); });
    setAudioName(file.name); setSource("file"); setSongTitle(songNameFromFile(file.name)); setSongSubtitle(""); setPlaying(false);
  };
  const chooseSource = (next:"metronome"|"generated"|"file") => {
    setPlaying(false);
    if (next!=="file") mediaRef.current?.pause();
    setSource(next);
  };
  const clearAudio = () => { mediaRef.current?.pause(); setPlaying(false); setSource("metronome"); setAudioUrl(current=>{ if(current) URL.revokeObjectURL(current); return ""; }); setAudioName(""); };
  const saveSong = () => {
    const title=songTitle.trim()||`Song ${savedSongs.length+1}`;
    persist([{id:`${Date.now()}-${Math.random().toString(36).slice(2)}`,title,progression:input,bpm},...savedSongs].slice(0,20));
    setSongTitle(title);
  };
  const loadSaved = (saved:SavedSong) => { setSongTitle(saved.title); setSongSubtitle(`${saved.bpm} BPM`);setInput(saved.progression);setBpm(saved.bpm);setPlaying(false);seekStep(0); navigate("/"); };
  const deleteSaved = (id:string) => persist(savedSongs.filter(saved=>saved.id!==id));

  return <main lang={lang}>
    <header className="topbar"><div className="brand"><span className="clef">𝄢</span><span>Bass Voicing Mapper</span></div><nav className="nav" aria-label={t.navStudio}>{([["/",t.navStudio],["/repertoire",t.navRepertoire],["/songs",t.navSongs],["/help",t.navHelp]] as ["/"|"/repertoire"|"/songs"|"/help",string][]).map(([to,label])=><Link key={to} to={to} className={route===to?"current":""}>{label}</Link>)}</nav><div className="header-actions"><span className="header-note">{t.header}</span><div className="lang-switch" aria-label="Language"><button className={lang==='en'?'active':''} onClick={()=>setLang('en')}>EN</button><button className={lang==='it'?'active':''} onClick={()=>setLang('it')}>IT</button></div></div></header>
    {route==="/" && <>
    <section className={"intro"+(songTitle?" loaded":"")}>{songTitle ? <><h1>{songTitle}</h1><span>{songSubtitle}</span></> : <><h1>{t.hero1} {t.hero2}</h1><span>{t.intro}</span></>}</section>
    <section className="workspace">
      <aside className="controls card">
        <div className="panel-tabs" role="tablist">{([["chords",t.panelChords],["backing",t.panelBacking]] as ["chords"|"backing",string][]).map(([value,label])=><button key={value} role="tab" aria-selected={panel===value} className={panel===value?"chosen":""} onClick={()=>setPanel(value)}>{label}</button>)}</div>
        <div className="transport-bar">
        <div className="practice-heading"><label>{t.practice}</label><span className={playing?'live':''}>{playing?t.running:t.ready}</span></div>
        <div className="transport"><button className="play" aria-label={playing?t.pause:t.play} onClick={togglePlay}>{playing?'Ⅱ':'▶'}</button><button aria-label={t.restart} onClick={resetPractice}>↺</button><button className={metro?'metro-on':''} aria-label={t.metro} onClick={()=>setMetro(v=>!v)}>♩</button><div className="beat-dots" aria-label={`${t.beat} ${beat+1} / ${stepBeats}`}>{Array.from({length:Math.min(16,stepBeats)},(_,i)=><i className={i===beat&&playing?'now':''} key={i}/>)}</div></div>
        </div>
        {panel==="chords" ? <>
        <label htmlFor="progression">{t.progression}</label>
        <textarea id="progression" value={input} onChange={e=>{setInput(e.target.value);setSongSubtitle("");setActive(0);setBeat(0);setPlaying(false)}} rows={3}/>
        {song.invalid.length>0 ? <small className="parse-error">{t.invalid}: {song.invalid.join(' ')}</small> : <small>{t.hint}</small>}
        <hr/>
        <label>{t.zone}</label>
        <div className="range"><input aria-label="First fret" type="number" min="0" max="24" value={from} onChange={e=>setFrom(Math.min(clampFret(+e.target.value),to))}/><span>—</span><input aria-label="Last fret" type="number" min="0" max="24" value={to} onChange={e=>setTo(Math.max(clampFret(+e.target.value),from))}/><span>{t.frets}</span></div>
        <button className="primary" onClick={()=>setActive(0)}>{t.show} <span>→</span></button>
        <button className={'secondary '+(optimized?'on':'')} onClick={()=>setOptimized(v=>!v)}>✦ {optimized?t.optimized:t.all}</button>
        <div className="mode-switch" aria-label="Practice mode">{([['chords',t.chords],['arpeggio',t.arpeggio],['walking',t.walking]] as [PracticeMode,string][]).map(([value,label])=><button key={value} className={mode===value?'chosen':''} onClick={()=>{setMode(value);setNoteStep(0)}}>{label}</button>)}</div>
        <div className="tempo-grid"><label><span>{t.tempo}</span><input aria-label="BPM" type="number" min="40" max="240" value={bpm} onChange={e=>setBpm(Math.max(40,Math.min(240,+e.target.value||40)))}/><small>BPM</small></label><label><span>{t.duration}</span><select aria-label="Beats per chord" value={beats} onChange={e=>setBeats(+e.target.value)}><option value="1">1 {t.beat}</option><option value="2">2 {t.beats}</option><option value="4">4 {t.beats}</option><option value="8">8 {t.beats}</option></select></label></div>
        </> : <>
        <div className="sync-panel">
          <p>{t.player}</p>
          <label className={'source-choice '+(audioUrl?'selected':'')}><span>{audioName||t.chooseAudio}</span><input type="file" accept="audio/*" onChange={e=>loadAudio(e.target.files?.[0])}/></label>
          {audioUrl&&<audio ref={mediaRef} src={audioUrl} onEnded={()=>setPlaying(false)} preload="metadata" controls/>}
          {audioUrl&&<div className="offset-row"><label>{t.offset}<input type="number" min="0" step="0.05" value={offset} onChange={e=>setOffset(Math.max(0,+e.target.value||0))}/></label><button onClick={markDownbeat}>{t.markDownbeat}</button></div>}
          <div className="mode-switch source-switch">{([["metronome",t.srcMetro],["generated",t.srcGenerated],["file",t.srcFile]] as ["metronome"|"generated"|"file",string][]).map(([value,label])=><button key={value} className={source===value?"chosen":""} disabled={value==="file"&&!audioUrl} onClick={()=>chooseSource(value)}>{label}</button>)}</div>
          {source==="generated"&&<div className="backing-controls"><small>{t.generatedHint}</small><label>{t.styleLabel}<select value={style} onChange={e=>setStyle(e.target.value as BackingStyle)}>{BACKING_STYLES.map(value=><option key={value} value={value}>{value==="straight"?t.styleStraight:value==="swing"?t.styleSwing:t.styleBossa}</option>)}</select></label><label>{t.drumsLevel}<input type="range" min="0" max="1.4" step="0.05" value={drumLevel} onChange={e=>setDrumLevel(+e.target.value)}/></label><label>{t.pianoLevel}<input type="range" min="0" max="1.4" step="0.05" value={compLevel} onChange={e=>setCompLevel(+e.target.value)}/></label><label className="count-in"><input type="checkbox" checked={countIn} onChange={e=>setCountIn(e.target.checked)}/> {t.countIn}</label></div>}
          {source==="file"&&<div className="source-status"><label>{t.speed}<select value={speed} onChange={e=>setSpeed(+e.target.value)}><option value="0.5">0.5×</option><option value="0.75">0.75×</option><option value="1">1×</option><option value="1.25">1.25×</option></select></label><button onClick={clearAudio}>{t.removeAudio}</button></div>}
        </div>
        <div className="loop-panel"><label><input type="checkbox" checked={loop} onChange={e=>setLoop(e.target.checked)}/> {t.loop}</label><select aria-label={t.loopFrom} value={safeLoopStart} onChange={e=>{const value=+e.target.value;setLoopStart(value);if(value>safeLoopEnd)setLoopEnd(value)}}>{steps.map((step,i)=><option value={i} key={i}>{t.loopFrom} {i+1}: {step.chord.raw}</option>)}</select><select aria-label={t.loopTo} value={safeLoopEnd} onChange={e=>{const value=+e.target.value;setLoopEnd(value);if(value<safeLoopStart)setLoopStart(value)}}>{steps.map((step,i)=><option value={i} key={i}>{t.loopTo} {i+1}: {step.chord.raw}</option>)}</select></div>
        <div className="save-panel"><p>{t.saveSong}</p><div><input aria-label={t.songName} placeholder={t.songName} value={songTitle} onChange={e=>setSongTitle(e.target.value)}/><button onClick={saveSong}>{t.save}</button></div>{warning&&<small className="parse-error" role="alert">{warning}</small>}{savedSongs.length>0&&<Link className="panel-link" to="/songs">{savedSongs.length} {t.saved} · {t.viewSaved}</Link>}</div>
        </>}
        <div className="tip"><b>{t.how}</b><span>{t.howText}</span></div>
      </aside>
      <div className="viewer card">
        <div className="viewer-title"><div><h2>{t.recommended}</h2><span className="pill">{t.frets} {from}–{to}</span></div><div className="legend"><span className="root">● {t.root}</span><span className="third">● {t.third}</span><span className="fifth">● {t.fifth}</span><span className="seventh">● {t.seventh}</span></div></div>
        {parsed.length ? <>
          <div className="tabs" role="tablist">{steps.map((step,i)=><button role="tab" aria-selected={i===active} className={i===active?'active':''} onClick={()=>seekStep(i)} key={i}>{step.chord.raw}<small>{step.beats}</small></button>)}</div>
          <div className="fret-scroll"><div className="fretboard" style={{'--cols':frets.length} as React.CSSProperties}>
            <div className="fret-numbers"><span></span>{frets.map(f=><span key={f}>{f}</span>)}</div>
            {STRINGS.map((s,si)=><div className="string-row" key={s}><b>{s}</b>{frets.map(f=>{const pitchClass=(OPEN[si]+f)%12; const toneIndex=chord?.tones.findIndex(tone=>tone.pitchClass===pitchClass)??-1; const chordTone=toneIndex>=0?chord?.tones[toneIndex]:undefined; const pos=selected.find(p=>p.string===si&&p.fret===f); const visible=!!chord&&!!chordTone&&(!optimized || !!pos); const sounding=!!currentPlayed&&currentPlayed.string===si&&currentPlayed.fret===f&&playing; return <div className="fret" key={f}><span className="string"/><span className="wire"/>{visible&&<span className={'note '+colorForRole(chordTone!.role)+(sounding?' sounding':'')} title={spellTone(chord!,chordTone!)+", "+(lang==='it'?'grado':'degree')+" "+chordTone!.degree}>{spellTone(chord!,chordTone!)}</span>}</div>})}</div>)}
          </div></div>
          <div className="path"><div className="path-copy"><b>{t.smooth}</b><span>{t.smoothText}</span></div><div className="path-cards">{parsed.map((c,i)=><button onClick={()=>seekStep(i)} className={i===active?'current':''} key={i}><b>{c.raw}</b><span>{[...(path[i]??[])].sort((a,b)=>b.string-a.string).map(p=>spellTone(c,c.tones[p.toneIndex])).join(' · ')||'—'}</span><small className={unreachable.includes(i)?'omitted':''}>{unreachable.includes(i)?t.outOfRange:(path[i]??[]).map(p=>`${STRINGS[p.string]}${p.fret}`).join('  ')}</small></button>)}</div></div>
        </>:<div className="empty"><b>{t.none}</b><span>{t.try}</span></div>}
      </div>
    </section>
    </>}
    {route==="/repertoire" && <Repertoire presets={PRESETS} copy={t} onLoad={loadPreset}/>}
    {route==="/songs" && <SavedSongs songs={savedSongs} copy={t} onLoad={loadSaved} onDelete={deleteSaved}/>}
    {route==="/help" && <Help lang={lang}/>}
    <footer>{t.footer}</footer>
  </main>;
}
