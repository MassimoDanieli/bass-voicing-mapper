import { useEffect, useMemo, useRef, useState } from "react";
import { analyzeAudioBuffer, mergeChordSegments, segmentsToProgression, type ChordSegment } from "./audioAnalysis";

import {
  OPEN_PITCH_CLASSES as OPEN,
  STRING_NAMES as STRINGS,
  noteName,
  optimize,
  parseChord,
  type Chord,
  type DegreeRole,
} from "./music";

function colorForRole(role: DegreeRole) {
  if (role === "bass") return "root";
  return role === "sixth" || role === "suspension" ? "extension" : role;
}

type PracticeMode = "chords" | "arpeggio" | "walking";
type Preset = { title:string; artist:string; style:string; progression:string; bpm:number };
type Lang = "en" | "it";
type SyncSource = "none" | "audio" | "youtube";
type SongStep = { chord:Chord; beats:number };
type SavedSong = { id:string; title:string; progression:string; bpm:number; segments?:ChordSegment[] };

const PRESETS: Preset[] = [
  { title:"Stand by Me", artist:"Ben E. King", style:"Pop / soul", progression:"C Am F G", bpm:118 },
  { title:"Let It Be", artist:"The Beatles", style:"Pop", progression:"C G Am F", bpm:72 },
  { title:"Three Little Birds", artist:"Bob Marley", style:"Reggae", progression:"A D A E", bpm:76 },
  { title:"So What", artist:"Miles Davis", style:"Modal jazz", progression:"Dm7 Dm7 Ebm7 Dm7", bpm:136 },
  { title:"Blue Bossa", artist:"Kenny Dorham", style:"Bossa jazz", progression:"Cm7 Fm7 Dm7b5 G7 Cm7", bpm:116 },
  { title:"Autumn Leaves", artist:"Standard jazz", style:"II–V–I", progression:"Cm7 F7 Bbmaj7 Ebmaj7 Am7b5 D7 Gm", bpm:120 },
  { title:"Song for My Father", artist:"Horace Silver", style:"Hard bop", progression:"Fm7 Eb7 Db7 C7", bpm:126 },
  { title:"12-bar Blues", artist:"Traditional form", style:"Blues", progression:"E7 E7 E7 E7 A7 A7 E7 E7 B7 A7 E7 B7", bpm:100 },
  { title:"Rhythm Changes", artist:"Jazz form", style:"Turnaround", progression:"Bb Gm7 Cm7 F7 Bb Gm7 Cm7 F7", bpm:160 },
  { title:"Circle of Fifths", artist:"Practice pattern", style:"Technique", progression:"C7 F7 Bb7 Eb7 Ab7 Db7 Gb7 B7 E7 A7 D7 G7", bpm:90 },
  { title:"Fly Me to the Moon", artist:"Bart Howard", style:"Jazz standard", progression:"Am7 Dm7 G7 Cmaj7 Fmaj7 Bm7b5 E7 Am7", bpm:120 },
  { title:"Hit the Road Jack", artist:"Ray Charles", style:"Soul", progression:"Am G F E", bpm:86 },
  { title:"Knockin’ on Heaven’s Door", artist:"Bob Dylan", style:"Folk rock", progression:"G D Am G D C", bpm:70 },
  { title:"With or Without You", artist:"U2", style:"Rock", progression:"D A Bm G", bpm:110 },
  { title:"All Along the Watchtower", artist:"Bob Dylan / Hendrix", style:"Rock", progression:"Am G F G", bpm:116 },
  { title:"Get Lucky", artist:"Daft Punk", style:"Funk / pop", progression:"Bm7 D F#m7 E", bpm:116 },
  { title:"Isn’t She Lovely", artist:"Stevie Wonder", style:"Soul / pop", progression:"Emaj7 C#m7 F#m7 B7", bpm:118 },
  { title:"Sunny", artist:"Bobby Hebb", style:"Soul jazz", progression:"Am7 Gm7 C7 Fmaj7 Bm7b5 E7 Am7", bpm:124 },
  { title:"Hotel California", artist:"Eagles", style:"Rock", progression:"Bm F# A E G D Em F#", bpm:74 },
  { title:"Minor II–V–I", artist:"Practice pattern", style:"Jazz exercise", progression:"Dm7b5 G7 Cm", bpm:96 },
];

const COPY = {
  en:{header:"4-string bass · E–A–D–G",eyebrow:"CHORD MAP",hero1:"Find the right voicing,",hero2:"without leaving your zone.",intro:"See every chord tone and find the smoothest path across the fretboard.",sketch1:"voicing",sketch2:"minimum movement",sketch3:"full sound",progression:"Progression",hint:"Add beats with :number. Example: Am7:4 D7:4 Gmaj7:8",zone:"Fretboard zone",frets:"frets",show:"Show positions",optimized:"Optimized voicings",all:"Show all notes",practice:"Song practice",running:"● PLAYING",ready:"READY",chords:"Chords",arpeggio:"Arpeggio",walking:"Walking",tempo:"Tempo",duration:"Default duration",beat:"beat",beats:"beats",pause:"Pause",play:"Play",restart:"Back to start",metro:"Toggle metronome",how:"How does it work?",howText:"Chord durations, player and fretboard share the same transport.",recommended:"Recommended voicing",root:"Root",third:"Third",fifth:"Fifth",seventh:"Seventh",smooth:"Smooth path",smoothText:"Voicings chosen for minimum movement.",none:"No chord recognized",try:"Try: G:4 A:4 D:8 or C-7 F7 Bbdim7 Ebdim7",repertoire:"REPERTOIRE",libraryTitle:"Progressions ready to play",libraryText:"Essential harmonic forms and simplified song progressions for bass practice.",exercises:"exercises",load:"Load →",footer:"Supports international notation with sharps and flats · Optimized for 4-string bass",player:"PLAYER & SYNC",localAudio:"Local audio",chooseAudio:"Choose an audio file",youtube:"YouTube URL",connect:"Connect",noSource:"Metronome only",speed:"Speed",loop:"A–B loop",loopFrom:"From",loopTo:"To",saveSong:"Save song",songName:"Song name",save:"Save",saved:"Saved songs",delete:"Delete",analysis:"AUDIO TRANSCRIPTION",analysisTitle:"Detect chords on the timeline",analysisText:"The analysis runs locally in your browser. Review uncertain segments, then send the timeline to practice mode.",analyze:"Analyze audio",analyzing:"Analyzing",applyTimeline:"Use in practice mode",start:"Start",end:"End",confidence:"Confidence",source:"Source",automatic:"Automatic",edited:"Edited",split:"Split",merge:"Merge next",preview:"Play segment",noAudio:"Choose a local audio file to start.",analysisError:"The audio could not be analyzed. Try another MP3, WAV or M4A file.",noChord:"No chord",detectedSegments:"detected segments"},
  it:{header:"Basso 4 corde · E–A–D–G",eyebrow:"MAPPA DEGLI ACCORDI",hero1:"Trova la voce giusta,",hero2:"senza cambiare zona.",intro:"Visualizza le note degli accordi e trova il percorso più fluido sulla tastiera.",sketch1:"voicing",sketch2:"movimento minimo",sketch3:"suono pieno",progression:"Progressione",hint:"Aggiungi i battiti con :numero. Esempio: Am7:4 D7:4 Gmaj7:8",zone:"Zona della tastiera",frets:"tasti",show:"Mostra le posizioni",optimized:"Rivolti ottimizzati",all:"Mostra tutte le note",practice:"Studio del brano",running:"● IN CORSO",ready:"PRONTO",chords:"Accordi",arpeggio:"Arpeggio",walking:"Walking",tempo:"Tempo",duration:"Durata predefinita",beat:"battito",beats:"battiti",pause:"Pausa",play:"Avvia",restart:"Torna all’inizio",metro:"Attiva o disattiva metronomo",how:"Come funziona?",howText:"Durate, player e tastiera condividono gli stessi comandi.",recommended:"Voicing consigliato",root:"Fondamentale",third:"Terza",fifth:"Quinta",seventh:"Settima",smooth:"Percorso fluido",smoothText:"Voicing scelti per spostamenti minimi.",none:"Nessun accordo riconosciuto",try:"Prova: G:4 A:4 D:8 oppure C-7 F7 Bbdim7 Ebdim7",repertoire:"REPERTORIO",libraryTitle:"Progressioni da suonare subito",libraryText:"Forme armoniche essenziali e versioni semplificate per lo studio del basso.",exercises:"esercizi",load:"Carica →",footer:"Supporta notazione internazionale con diesis e bemolle · Ottimizzato per basso a 4 corde",player:"PLAYER E SINCRONIA",localAudio:"Audio locale",chooseAudio:"Scegli un file audio",youtube:"URL YouTube",connect:"Collega",noSource:"Solo metronomo",speed:"Velocità",loop:"Loop A–B",loopFrom:"Da",loopTo:"A",saveSong:"Salva brano",songName:"Nome del brano",save:"Salva",saved:"Brani salvati",delete:"Elimina",analysis:"TRASCRIZIONE AUDIO",analysisTitle:"Rileva gli accordi sulla timeline",analysisText:"L’analisi avviene localmente nel browser. Controlla i segmenti incerti, poi invia la timeline alla modalità studio.",analyze:"Analizza audio",analyzing:"Analisi in corso",applyTimeline:"Usa nella modalità studio",start:"Inizio",end:"Fine",confidence:"Affidabilità",source:"Origine",automatic:"Automatica",edited:"Modificata",split:"Dividi",merge:"Unisci al successivo",preview:"Ascolta segmento",noAudio:"Scegli un file audio locale per iniziare.",analysisError:"Impossibile analizzare l’audio. Prova un altro file MP3, WAV o M4A.",noChord:"Nessun accordo",detectedSegments:"segmenti rilevati"}
};

function parseProgression(value:string, defaultBeats:number):SongStep[] {
  return value.split(/[\s,;]+/).filter(Boolean).flatMap(token => {
    const duration = token.match(/:(\d+(?:\.\d+)?)$/);
    const raw = duration ? token.slice(0,-duration[0].length) : token;
    const chord = parseChord(raw);
    return chord ? [{ chord, beats:Math.max(1,duration ? Number(duration[1]) : defaultBeats) }] : [];
  });
}

function youtubeId(value:string) {
  const match = value.trim().match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  return match?.[1] ?? (/^[\w-]{11}$/.test(value.trim()) ? value.trim() : "");
}

export default function App() {
  const [lang,setLang] = useState<Lang>("en");
  const t = COPY[lang];
  const [input,setInput] = useState("C-7:4 F7:4 Bbdim7:2 Ebdim7:6");
  const [from,setFrom] = useState(0); const [to,setTo] = useState(5);
  const [active,setActive] = useState(0); const [optimized,setOptimized] = useState(true);
  const [bpm,setBpm] = useState(100); const [beats,setBeats] = useState(4);
  const [mode,setMode] = useState<PracticeMode>("chords"); const [playing,setPlaying] = useState(false);
  const [beat,setBeat] = useState(0); const [noteStep,setNoteStep] = useState(0); const [metro,setMetro] = useState(true);
  const [syncSource,setSyncSource] = useState<SyncSource>("none");
  const [audioUrl,setAudioUrl] = useState(""); const [audioName,setAudioName] = useState("");
  const [audioFile,setAudioFile] = useState<File | null>(null);
  const [youtubeUrl,setYoutubeUrl] = useState(""); const [youtubeVideo,setYoutubeVideo] = useState("");
  const [speed,setSpeed] = useState(1); const [loop,setLoop] = useState(false);
  const [loopStart,setLoopStart] = useState(0); const [loopEnd,setLoopEnd] = useState(Number.MAX_SAFE_INTEGER);
  const [songTitle,setSongTitle] = useState(""); const [savedSongs,setSavedSongs] = useState<SavedSong[]>([]);
  const [segments,setSegments] = useState<ChordSegment[]>([]);
  const [analysisState,setAnalysisState] = useState<"idle"|"decoding"|"analyzing"|"done"|"error">("idle");
  const [analysisProgress,setAnalysisProgress] = useState(0);
  const audioRef = useRef<AudioContext | null>(null);
  const mediaRef = useRef<HTMLAudioElement | null>(null);
  const youtubeRef = useRef<HTMLIFrameElement | null>(null);
  const previewEndRef = useRef<number | null>(null);
  const steps = useMemo(() => parseProgression(input,beats),[input,beats]);
  const parsed = useMemo(() => steps.map(step=>step.chord),[steps]);
  const path = useMemo(() => optimize(parsed,from,to),[parsed,from,to]);
  const chord = parsed[Math.min(active, Math.max(0,parsed.length-1))];
  const fullSelected = useMemo(() => optimized ? path[Math.min(active,path.length-1)] ?? [] : [],[optimized,path,active]);
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
  const effectiveSpeed = syncSource==="audio" ? speed : 1;
  const safeLoopStart = Math.min(loopStart,Math.max(0,steps.length-1));
  const safeLoopEnd = Math.max(safeLoopStart,Math.min(loopEnd,Math.max(0,steps.length-1)));

  const postYoutube = (func:string,args:(string|number|boolean)[]=[])=>(youtubeRef.current?.contentWindow?.postMessage(JSON.stringify({event:"command",func,args}),"*"));
  const stopAllMedia = () => { previewEndRef.current=null; mediaRef.current?.pause(); postYoutube("pauseVideo"); };
  const stepTime = (index:number) => steps.slice(0,index).reduce((sum,step)=>sum+step.beats,0)*60/bpm;
  const seekStep = (index:number) => {
    const next=Math.max(0,Math.min(index,Math.max(0,steps.length-1)));
    setActive(next); setBeat(0); setNoteStep(0);
    const seconds=stepTime(next);
    if (syncSource==="audio" && mediaRef.current) mediaRef.current.currentTime=seconds;
    if (syncSource==="youtube") postYoutube("seekTo",[seconds,true]);
  };

  const click = (accent=false) => {
    if (!metro) return;
    const Ctx = window.AudioContext || (window as typeof window & {webkitAudioContext:typeof AudioContext}).webkitAudioContext;
    audioRef.current ??= new Ctx();
    const ctx=audioRef.current, osc=ctx.createOscillator(), gain=ctx.createGain();
    osc.frequency.value=accent?1000:720; gain.gain.setValueAtTime(.055,ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.055);
    osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime+.06);
  };
  const togglePlay = () => { previewEndRef.current=null; if (parsed.length) setPlaying(v=>!v); };
  const resetPractice = () => { setPlaying(false); seekStep(loop?safeLoopStart:0); };
  useEffect(()=>{
    // Browser storage is only available after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { setSavedSongs(JSON.parse(localStorage.getItem("bvm:songs")??"[]")); } catch { setSavedSongs([]); }
  },[]);
  useEffect(()=>{
    if (syncSource==="audio" && mediaRef.current) {
      mediaRef.current.playbackRate=speed;
      if (playing) void mediaRef.current.play().catch(()=>setPlaying(false)); else mediaRef.current.pause();
    }
    if (syncSource==="youtube") postYoutube(playing?"playVideo":"pauseVideo");
  },[playing,syncSource,speed]);
  useEffect(()=>{
    if (!playing || !parsed.length) return;
    const id=window.setInterval(()=>{
      setBeat(prev=>{
        const next=prev+1;
        const chordDone=next>=stepBeats;
        click(chordDone);
        if (mode!=="chords") setNoteStep(n=>n+1);
        if (chordDone) setActive(current=>{
          let following=current+1;
          if (loop && following>safeLoopEnd) following=safeLoopStart;
          if (following>=parsed.length) { setPlaying(false); return current; }
          if (loop && following===safeLoopStart) {
            const seconds=stepTime(safeLoopStart);
            if (syncSource==="audio"&&mediaRef.current) mediaRef.current.currentTime=seconds;
            if (syncSource==="youtube") postYoutube("seekTo",[seconds,true]);
          }
          return following;
        });
        return chordDone?0:next;
      });
    },60000/bpm/effectiveSpeed);
    click(true);
    return ()=>window.clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[playing,bpm,mode,parsed.length,metro,stepBeats,effectiveSpeed,loop,safeLoopStart,safeLoopEnd]);
  useEffect(()=>()=>{ if(audioUrl) URL.revokeObjectURL(audioUrl); },[audioUrl]);

  const loadPreset = (preset:Preset) => { setInput(preset.progression); setBpm(preset.bpm); setSongTitle(preset.title); setPlaying(false); seekStep(0); window.scrollTo({top:0,behavior:"smooth"}); };
  const loadAudio = (file?:File) => {
    if (!file) return;
    stopAllMedia();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioFile(file);
    setAudioUrl(URL.createObjectURL(file)); setAudioName(file.name); setSyncSource("audio"); setPlaying(false);
    setSegments([]); setAnalysisState("idle"); setAnalysisProgress(0);
  };
  const connectYoutube = () => { const id=youtubeId(youtubeUrl); if(id){stopAllMedia();setYoutubeVideo(id);setSyncSource("youtube");setPlaying(false);} };
  const saveSong = () => {
    const title=songTitle.trim()||`Song ${savedSongs.length+1}`;
    const next=[{id:`${Date.now()}-${Math.random().toString(36).slice(2)}`,title,progression:input,bpm,segments},...savedSongs].slice(0,20);
    setSavedSongs(next); localStorage.setItem("bvm:songs",JSON.stringify(next)); setSongTitle(title);
  };
  const loadSaved = (song:SavedSong) => { setSongTitle(song.title);setInput(song.progression);setBpm(song.bpm);setSegments(song.segments??[]);setAnalysisState(song.segments?.length?"done":"idle");setPlaying(false);seekStep(0); };
  const deleteSaved = (id:string) => { const next=savedSongs.filter(song=>song.id!==id);setSavedSongs(next);localStorage.setItem("bvm:songs",JSON.stringify(next)); };

  const analyzeAudio = async () => {
    if (!audioFile || analysisState==="decoding" || analysisState==="analyzing") return;
    setPlaying(false); setAnalysisState("decoding"); setAnalysisProgress(0); setSegments([]);
    try {
      const Ctx = window.AudioContext || (window as typeof window & {webkitAudioContext:typeof AudioContext}).webkitAudioContext;
      const context = audioRef.current ?? new Ctx();
      audioRef.current=context;
      const decoded=await context.decodeAudioData(await audioFile.arrayBuffer());
      setAnalysisState("analyzing");
      const found=await analyzeAudioBuffer(decoded,{onProgress:setAnalysisProgress});
      setSegments(found); setAnalysisState("done");
    } catch {
      setAnalysisState("error");
    }
  };
  const updateSegment = (id:string,patch:Partial<ChordSegment>) => setSegments(current=>current.map(segment=>segment.id===id?{...segment,...patch,source:"edited"}:segment));
  const splitSegment = (index:number) => setSegments(current=>{
    const segment=current[index]; if(!segment || segment.end-segment.start<0.4) return current;
    const middle=(segment.start+segment.end)/2;
    const left={...segment,end:middle,source:"edited" as const};
    const right={...segment,id:`seg-${Date.now()}-${index}`,start:middle,source:"edited" as const};
    return [...current.slice(0,index),left,right,...current.slice(index+1)];
  });
  const mergeSegment = (index:number) => setSegments(current=>mergeChordSegments(current,index));
  const previewSegment = async (segment:ChordSegment) => {
    if (!mediaRef.current) return;
    setPlaying(false); previewEndRef.current=segment.end; mediaRef.current.currentTime=segment.start;
    try { await mediaRef.current.play(); } catch { previewEndRef.current=null; }
  };
  const applyTimeline = () => {
    const usable=segments.filter(segment=>segment.chord!=="N.C.");
    const progression=segmentsToProgression(segments,bpm);
    if(progression){setInput(progression);setPlaying(false);setActive(0);setBeat(0);setLoopStart(0);setLoopEnd(Math.max(0,usable.length-1));}
  };
  const onAudioTime = () => {
    if(mediaRef.current && previewEndRef.current!==null && mediaRef.current.currentTime>=previewEndRef.current){mediaRef.current.pause();previewEndRef.current=null;}
  };

  return <main lang={lang}>
    <header className="topbar"><div className="brand"><span className="clef">𝄢</span><span>Bass Voicing Mapper</span></div><div className="header-actions"><span className="header-note">{t.header}</span><div className="lang-switch" aria-label="Language"><button className={lang==='en'?'active':''} onClick={()=>setLang('en')}>EN</button><button className={lang==='it'?'active':''} onClick={()=>setLang('it')}>IT</button></div></div></header>
    <section className="hero"><div><p className="eyebrow">{t.eyebrow}</p><h1>{t.hero1}<br/>{t.hero2}</h1><p>{t.intro}</p></div><div className="sketch" aria-hidden="true"><span>{t.sketch1}</span><i>{t.sketch2}</i><b>{t.sketch3}</b></div></section>
    <section className="workspace">
      <aside className="controls card">
        <label htmlFor="progression">{t.progression}</label>
        <textarea id="progression" value={input} onChange={e=>{setInput(e.target.value);setActive(0);setBeat(0);setPlaying(false)}} rows={3}/>
        <small>{t.hint}</small>
        <hr/>
        <label>{t.zone}</label>
        <div className="range"><input aria-label="First fret" type="number" min="0" max="20" value={from} onChange={e=>setFrom(Math.min(+e.target.value,to))}/><span>—</span><input aria-label="Last fret" type="number" min="0" max="24" value={to} onChange={e=>setTo(Math.max(+e.target.value,from))}/><span>{t.frets}</span></div>
        <button className="primary" onClick={()=>setActive(0)}>{t.show} <span>→</span></button>
        <button className={'secondary '+(optimized?'on':'')} onClick={()=>setOptimized(v=>!v)}>✦ {optimized?t.optimized:t.all}</button>
        <hr/>
        <div className="practice-heading"><label>{t.practice}</label><span className={playing?'live':''}>{playing?t.running:t.ready}</span></div>
        <div className="mode-switch" aria-label="Practice mode">{([['chords',t.chords],['arpeggio',t.arpeggio],['walking',t.walking]] as [PracticeMode,string][]).map(([value,label])=><button key={value} className={mode===value?'chosen':''} onClick={()=>{setMode(value);setNoteStep(0)}}>{label}</button>)}</div>
        <div className="tempo-grid"><label><span>{t.tempo}</span><input aria-label="BPM" type="number" min="40" max="240" value={bpm} onChange={e=>setBpm(Math.max(40,Math.min(240,+e.target.value)))}/><small>BPM</small></label><label><span>{t.duration}</span><select aria-label="Beats per chord" value={beats} onChange={e=>setBeats(+e.target.value)}><option value="1">1 {t.beat}</option><option value="2">2 {t.beats}</option><option value="4">4 {t.beats}</option><option value="8">8 {t.beats}</option></select></label></div>
        <div className="transport"><button className="play" aria-label={playing?t.pause:t.play} onClick={togglePlay}>{playing?'Ⅱ':'▶'}</button><button aria-label={t.restart} onClick={resetPractice}>↺</button><button className={metro?'metro-on':''} aria-label={t.metro} onClick={()=>setMetro(v=>!v)}>♩</button><div className="beat-dots" aria-label={`${t.beat} ${beat+1} / ${stepBeats}`}>{Array.from({length:Math.min(16,stepBeats)},(_,i)=><i className={i===beat&&playing?'now':''} key={i}/>)}</div></div>
        <div className="sync-panel">
          <p>{t.player}</p>
          <label className={'source-choice '+(syncSource==='audio'?'selected':'')}><span>{audioName||t.chooseAudio}</span><input type="file" accept="audio/*" onChange={e=>loadAudio(e.target.files?.[0])}/></label>
          {audioUrl&&<audio ref={mediaRef} src={audioUrl} onTimeUpdate={onAudioTime} onEnded={()=>setPlaying(false)} preload="metadata"/>}
          <div className="youtube-row"><input aria-label={t.youtube} placeholder={t.youtube} value={youtubeUrl} onChange={e=>setYoutubeUrl(e.target.value)}/><button onClick={connectYoutube}>{t.connect}</button></div>
          {youtubeVideo&&syncSource==='youtube'&&<div className="video-frame"><iframe ref={youtubeRef} title="YouTube player" src={`https://www.youtube.com/embed/${youtubeVideo}?enablejsapi=1&playsinline=1`} allow="autoplay; encrypted-media; picture-in-picture"/></div>}
          <div className="source-status"><button className={syncSource==='none'?'active':''} onClick={()=>{stopAllMedia();setSyncSource('none');setPlaying(false)}}>{t.noSource}</button>{syncSource==='audio'&&<label>{t.speed}<select value={speed} onChange={e=>setSpeed(+e.target.value)}><option value="0.5">0.5×</option><option value="0.75">0.75×</option><option value="1">1×</option><option value="1.25">1.25×</option></select></label>}</div>
        </div>
        <div className="loop-panel"><label><input type="checkbox" checked={loop} onChange={e=>setLoop(e.target.checked)}/> {t.loop}</label><select aria-label={t.loopFrom} value={safeLoopStart} onChange={e=>{const value=+e.target.value;setLoopStart(value);if(value>safeLoopEnd)setLoopEnd(value)}}>{steps.map((step,i)=><option value={i} key={i}>{t.loopFrom} {i+1}: {step.chord.raw}</option>)}</select><select aria-label={t.loopTo} value={safeLoopEnd} onChange={e=>{const value=+e.target.value;setLoopEnd(value);if(value<safeLoopStart)setLoopStart(value)}}>{steps.map((step,i)=><option value={i} key={i}>{t.loopTo} {i+1}: {step.chord.raw}</option>)}</select></div>
        <div className="save-panel"><p>{t.saveSong}</p><div><input aria-label={t.songName} placeholder={t.songName} value={songTitle} onChange={e=>setSongTitle(e.target.value)}/><button onClick={saveSong}>{t.save}</button></div>{savedSongs.length>0&&<ul aria-label={t.saved}>{savedSongs.map(song=><li key={song.id}><button onClick={()=>loadSaved(song)}><b>{song.title}</b><span>{song.bpm} BPM</span></button><button aria-label={`${t.delete} ${song.title}`} onClick={()=>deleteSaved(song.id)}>×</button></li>)}</ul>}</div>
        <div className="tip"><b>{t.how}</b><span>{t.howText}</span></div>
      </aside>
      <div className="viewer card">
        <div className="viewer-title"><div><h2>{t.recommended}</h2><span className="pill">{t.frets} {from}–{to}</span></div><div className="legend"><span className="root">● {t.root}</span><span className="third">● {t.third}</span><span className="fifth">● {t.fifth}</span><span className="seventh">● {t.seventh}</span></div></div>
        {parsed.length ? <>
          <div className="tabs" role="tablist">{steps.map((step,i)=><button role="tab" aria-selected={i===active} className={i===active?'active':''} onClick={()=>seekStep(i)} key={i}>{step.chord.raw}<small>{step.beats}</small></button>)}</div>
          <div className="fret-scroll"><div className="fretboard" style={{'--cols':frets.length} as React.CSSProperties}>
            <div className="fret-numbers"><span></span>{frets.map(f=><span key={f}>{f}</span>)}</div>
            {STRINGS.map((s,si)=><div className="string-row" key={s}><b>{s}</b>{frets.map(f=>{const pitchClass=(OPEN[si]+f)%12; const toneIndex=chord?.tones.findIndex(tone=>tone.pitchClass===pitchClass)??-1; const chordTone=toneIndex>=0?chord?.tones[toneIndex]:undefined; const pos=selected.find(p=>p.string===si&&p.fret===f); const visible=!!chordTone && (!optimized || !!pos); const sounding=!!currentPlayed&&currentPlayed.string===si&&currentPlayed.fret===f&&playing; return <div className="fret" key={f}><span className="string"/><span className="wire"/>{visible&&<span className={'note '+colorForRole(chordTone.role)+(sounding?' sounding':'')} title={noteName(pitchClass,chord)+", "+(lang==='it'?'grado':'degree')+" "+chordTone.degree}>{noteName(pitchClass,chord)}</span>}</div>})}</div>)}
          </div></div>
          <div className="path"><div className="path-copy"><b>{t.smooth}</b><span>{t.smoothText}</span></div><div className="path-cards">{parsed.map((c,i)=><button onClick={()=>seekStep(i)} className={i===active?'current':''} key={i}><b>{c.raw}</b><span>{[...(path[i]??[])].sort((a,b)=>b.string-a.string).map(p=>noteName(p.pitchClass,c)).join(' · ')||'—'}</span><small>{(path[i]??[]).map(p=>`${STRINGS[p.string]}${p.fret}`).join('  ')}</small></button>)}</div></div>
        </>:<div className="empty"><b>{t.none}</b><span>{t.try}</span></div>}
      </div>
    </section>
    <section className="analysis-section card">
      <div className="analysis-header">
        <div><p className="eyebrow">{t.analysis}</p><h2>{t.analysisTitle}</h2><p>{t.analysisText}</p></div>
        <div className="analysis-action">
          <button className="primary" disabled={!audioFile||analysisState==="decoding"||analysisState==="analyzing"} onClick={analyzeAudio}>{analysisState==="decoding"||analysisState==="analyzing"?`${t.analyzing}… ${Math.round(analysisProgress*100)}%`:t.analyze}</button>
          {(analysisState==="decoding"||analysisState==="analyzing")&&<progress aria-label={t.analyzing} max="1" value={analysisProgress}/>} 
          {segments.length>0&&<small>{segments.length} {t.detectedSegments}</small>}
        </div>
      </div>
      {!audioFile&&<div className="analysis-empty">♫ <span>{t.noAudio}</span></div>}
      {analysisState==="error"&&<div className="analysis-error" role="alert">{t.analysisError}</div>}
      {segments.length>0&&<>
        <div className="timeline-strip" aria-label={t.analysisTitle}>{segments.map(segment=><button key={segment.id} style={{flexGrow:Math.max(.2,segment.end-segment.start)}} className={(segment.confidence<.55?'uncertain ':'')+(segment.source==='edited'?'edited':'')} onClick={()=>previewSegment(segment)} title={`${segment.chord} · ${segment.start.toFixed(1)}–${segment.end.toFixed(1)}s`}><b>{segment.chord}</b><span>{Math.round(segment.confidence*100)}%</span></button>)}</div>
        <div className="segment-table">
          <div className="segment-head"><span></span><span>{t.start}</span><span>{t.end}</span><span>{t.chords}</span><span>{t.confidence}</span><span>{t.source}</span><span></span></div>
          {segments.map((segment,index)=><div className={'segment-row '+(segment.confidence<.55?'uncertain':'')} key={segment.id}>
            <button className="preview-segment" aria-label={`${t.preview} ${segment.chord}`} onClick={()=>previewSegment(segment)}>▶</button>
            <label><span>{t.start}</span><input type="number" min="0" step="0.1" value={Number(segment.start.toFixed(2))} onChange={e=>updateSegment(segment.id,{start:Math.max(0,Math.min(+e.target.value,segment.end-.1))})}/></label>
            <label><span>{t.end}</span><input type="number" min={segment.start+.1} step="0.1" value={Number(segment.end.toFixed(2))} onChange={e=>updateSegment(segment.id,{end:Math.max(segment.start+.1,+e.target.value)})}/></label>
            <label><span>{t.chords}</span><input className="chord-field" value={segment.chord==='N.C.'?'':segment.chord} placeholder={t.noChord} onChange={e=>updateSegment(segment.id,{chord:e.target.value.trim()||'N.C.'})}/></label>
            <div className="confidence"><span style={{width:`${Math.round(segment.confidence*100)}%`}}/><b>{Math.round(segment.confidence*100)}%</b></div>
            <span className={'source-badge '+segment.source}>{segment.source==='edited'?t.edited:t.automatic}</span>
            <div className="segment-tools"><button onClick={()=>splitSegment(index)}>{t.split}</button><button disabled={index===segments.length-1} onClick={()=>mergeSegment(index)}>{t.merge}</button></div>
          </div>)}
        </div>
        <div className="analysis-footer"><p>{lang==='it'?'I segmenti sotto il 55% richiedono una verifica. Le tue correzioni vengono salvate insieme al brano.':'Segments below 55% need review. Your corrections are saved with the song.'}</p><button className="primary" onClick={applyTimeline}>{t.applyTimeline} <span>→</span></button></div>
      </>}
    </section>
    <section className="library-section"><div className="library-title"><div><p className="eyebrow">{t.repertoire}</p><h2>{t.libraryTitle}</h2><p>{t.libraryText}</p></div><span>{PRESETS.length} {t.exercises}</span></div><div className="preset-grid">{PRESETS.map(p=><button key={p.title} onClick={()=>loadPreset(p)}><span className="preset-style">{p.style}</span><b>{p.title}</b><span>{p.artist}</span><code>{p.progression}</code><small>{p.bpm} BPM <i>{t.load}</i></small></button>)}</div></section>
    <footer>{t.footer}</footer>
  </main>;
}

