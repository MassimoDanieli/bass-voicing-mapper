import { useEffect, useMemo, useRef, useState } from "react";
import {
  OPEN_PITCH_CLASSES,
  STRING_NAMES,
  noteName,
  omittedTones,
  optimize,
  parseProgression,
  type DegreeRole,
} from "./music";
type PracticeMode = "chords" | "arpeggio" | "walking";
type Preset = { title:string; artist:string; style:string; progression:string; bpm:number };
type Lang = "en" | "it";

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
  en:{header:"4-string bass · E–A–D–G",eyebrow:"CHORD MAP",hero1:"Find the right voicing,",hero2:"without leaving your zone.",intro:"See every chord tone and find the smoothest path across the fretboard.",sketch1:"voicing",sketch2:"minimum movement",sketch3:"full sound",progression:"Progression",hint:"Separate chords with spaces. Example: G A D",invalid:"Not recognized",omitted:"omits",zone:"Fretboard zone",frets:"frets",show:"Show positions",optimized:"Optimized voicings",all:"Show all notes",practice:"Timed practice",running:"● PLAYING",ready:"READY",chords:"Chords",arpeggio:"Arpeggio",walking:"Walking",tempo:"Tempo",duration:"Duration",beat:"beat",beats:"beats",pause:"Pause",play:"Play",restart:"Back to start",metro:"Toggle metronome",how:"How does it work?",howText:"The suggested path protects characteristic chord tones, then reduces hand and voice movement.",recommended:"Recommended voicing",root:"Root",third:"Third",fifth:"Fifth",seventh:"Seventh",extension:"Extension",smooth:"Smooth path",smoothText:"Harmonic priorities first, movement second.",none:"No chord recognized",try:"Try: G A D or C-7 F7 Bbdim7 Ebdim7",repertoire:"REPERTOIRE",libraryTitle:"Progressions ready to play",libraryText:"Essential harmonic forms and simplified song progressions for bass practice.",exercises:"exercises",load:"Load →",footer:"Supports international notation with sharps and flats · Optimized for 4-string bass"},
  it:{header:"Basso 4 corde · E–A–D–G",eyebrow:"MAPPA DEGLI ACCORDI",hero1:"Trova la voce giusta,",hero2:"senza cambiare zona.",intro:"Visualizza le note degli accordi e trova il percorso più fluido sulla tastiera.",sketch1:"voicing",sketch2:"movimento minimo",sketch3:"suono pieno",progression:"Progressione",hint:"Separa gli accordi con uno spazio. Esempio: G A D",invalid:"Non riconosciuti",omitted:"omette",zone:"Zona della tastiera",frets:"tasti",show:"Mostra le posizioni",optimized:"Rivolti ottimizzati",all:"Mostra tutte le note",practice:"Pratica a tempo",running:"● IN CORSO",ready:"PRONTO",chords:"Accordi",arpeggio:"Arpeggio",walking:"Walking",tempo:"Tempo",duration:"Durata",beat:"battito",beats:"battiti",pause:"Pausa",play:"Avvia",restart:"Torna all’inizio",metro:"Attiva o disattiva metronomo",how:"Come funziona?",howText:"Il percorso protegge le note caratteristiche, poi riduce il movimento delle voci e della mano.",recommended:"Voicing consigliato",root:"Fondamentale",third:"Terza",fifth:"Quinta",seventh:"Settima",extension:"Estensione",smooth:"Percorso fluido",smoothText:"Prima le priorità armoniche, poi il movimento.",none:"Nessun accordo riconosciuto",try:"Prova: G A D oppure C-7 F7 Bbdim7 Ebdim7",repertoire:"REPERTORIO",libraryTitle:"Progressioni da suonare subito",libraryText:"Forme armoniche essenziali e versioni semplificate per lo studio del basso.",exercises:"esercizi",load:"Carica →",footer:"Supporta notazione internazionale con diesis e bemolle · Ottimizzato per basso a 4 corde"}
};

function colorForRole(role: DegreeRole) {
  if (role === "bass") return "root";
  return role === "sixth" || role === "suspension" ? "extension" : role;
}

export default function App() {
  const [lang,setLang] = useState<Lang>("en");
  const t = COPY[lang];
  const [input,setInput] = useState("C-7 F7 Bbdim7 Ebdim7");
  const [from,setFrom] = useState(0); const [to,setTo] = useState(5);
  const [active,setActive] = useState(0); const [optimized,setOptimized] = useState(true);
  const [bpm,setBpm] = useState(100); const [beats,setBeats] = useState(4);
  const [mode,setMode] = useState<PracticeMode>("chords"); const [playing,setPlaying] = useState(false);
  const [beat,setBeat] = useState(0); const [noteStep,setNoteStep] = useState(0); const [metro,setMetro] = useState(true);
  const audioRef = useRef<AudioContext | null>(null);
  const progression = useMemo(() => parseProgression(input), [input]);
  const parsed = progression.chords;
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

  const click = (accent=false) => {
    if (!metro) return;
    const Ctx = window.AudioContext || (window as typeof window & {webkitAudioContext:typeof AudioContext}).webkitAudioContext;
    audioRef.current ??= new Ctx();
    const ctx=audioRef.current, osc=ctx.createOscillator(), gain=ctx.createGain();
    osc.frequency.value=accent?1000:720; gain.gain.setValueAtTime(.055,ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.055);
    osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime+.06);
  };
  const togglePlay = async () => {
    if (!parsed.length) return;
    if (!playing && metro) {
      const Ctx = window.AudioContext || (window as typeof window & {webkitAudioContext:typeof AudioContext}).webkitAudioContext;
      audioRef.current ??= new Ctx();
      await audioRef.current.resume();
    }
    setPlaying(v=>!v);
  };
  const resetPractice = () => { setPlaying(false); setActive(0); setBeat(0); setNoteStep(0); };
  useEffect(()=>{
    if (!playing || !parsed.length) return;
    const id=window.setInterval(()=>{
      setBeat(prev=>{
        const next=(prev+1)%beats;
        click(next===0);
        if (mode!=="chords") setNoteStep(n=>n+1);
        if (next===0) setActive(a=>(a+1)%parsed.length);
        return next;
      });
    },60000/bpm);
    click(true);
    return ()=>window.clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[playing,bpm,beats,mode,parsed.length,metro]);
  const loadPreset = (preset:Preset) => { setInput(preset.progression); setBpm(preset.bpm); setActive(0); setBeat(0); setNoteStep(0); setPlaying(false); window.scrollTo({top:0,behavior:"smooth"}); };

  return <main lang={lang}>
    <header className="topbar"><div className="brand"><span className="clef">𝄢</span><span>Bass Voicing Mapper</span></div><div className="header-actions"><span className="header-note">{t.header}</span><div className="lang-switch" aria-label="Language"><button className={lang==='en'?'active':''} onClick={()=>setLang('en')}>EN</button><button className={lang==='it'?'active':''} onClick={()=>setLang('it')}>IT</button></div></div></header>
    <section className="hero"><div><p className="eyebrow">{t.eyebrow}</p><h1>{t.hero1}<br/>{t.hero2}</h1><p>{t.intro}</p></div><div className="sketch" aria-hidden="true"><span>{t.sketch1}</span><i>{t.sketch2}</i><b>{t.sketch3}</b></div></section>
    <section className="workspace">
      <aside className="controls card">
        <label htmlFor="progression">{t.progression}</label>
        <textarea id="progression" value={input} onChange={e=>{setInput(e.target.value);setActive(0)}} rows={3}/>
        <small>{t.hint}</small>
        {progression.invalid.length > 0 && <small className="parse-error" role="alert">{t.invalid}: {progression.invalid.join(", ")}</small>}
        <hr/>
        <label>{t.zone}</label>
        <div className="range"><input aria-label="First fret" type="number" min="0" max="20" value={from} onChange={e=>setFrom(Math.min(+e.target.value,to))}/><span>—</span><input aria-label="Last fret" type="number" min="0" max="24" value={to} onChange={e=>setTo(Math.max(+e.target.value,from))}/><span>{t.frets}</span></div>
        <button className="primary" onClick={()=>setActive(0)}>{t.show} <span>→</span></button>
        <button className={'secondary '+(optimized?'on':'')} onClick={()=>setOptimized(v=>!v)}>✦ {optimized?t.optimized:t.all}</button>
        <hr/>
        <div className="practice-heading"><label>{t.practice}</label><span className={playing?'live':''}>{playing?t.running:t.ready}</span></div>
        <div className="mode-switch" aria-label="Practice mode">{([['chords',t.chords],['arpeggio',t.arpeggio],['walking',t.walking]] as [PracticeMode,string][]).map(([value,label])=><button key={value} className={mode===value?'chosen':''} onClick={()=>{setMode(value);setNoteStep(0)}}>{label}</button>)}</div>
        <div className="tempo-grid"><label><span>{t.tempo}</span><input aria-label="BPM" type="number" min="40" max="240" value={bpm} onChange={e=>setBpm(Math.max(40,Math.min(240,+e.target.value)))}/><small>BPM</small></label><label><span>{t.duration}</span><select aria-label="Beats per chord" value={beats} onChange={e=>setBeats(+e.target.value)}><option value="1">1 {t.beat}</option><option value="2">2 {t.beats}</option><option value="4">4 {t.beats}</option><option value="8">8 {t.beats}</option></select></label></div>
        <div className="transport"><button className="play" aria-label={playing?t.pause:t.play} onClick={togglePlay}>{playing?'Ⅱ':'▶'}</button><button aria-label={t.restart} onClick={resetPractice}>↺</button><button className={metro?'metro-on':''} aria-label={t.metro} onClick={()=>setMetro(v=>!v)}>♩</button><div className="beat-dots" aria-label={`${t.beat} ${beat+1} / ${beats}`}>{Array.from({length:beats},(_,i)=><i className={i===beat&&playing?'now':''} key={i}/>)}</div></div>
        <div className="tip"><b>{t.how}</b><span>{t.howText}</span></div>
      </aside>
      <div className="viewer card">
        <div className="viewer-title"><div><h2>{t.recommended}</h2><span className="pill">{t.frets} {from}–{to}</span></div><div className="legend"><span className="root">● {t.root}</span><span className="third">● {t.third}</span><span className="fifth">● {t.fifth}</span><span className="seventh">● {t.seventh}</span><span className="extension">● {t.extension}</span></div></div>
        {parsed.length ? <>
          <div className="tabs" role="tablist">{parsed.map((c,i)=><button role="tab" aria-selected={i===active} className={i===active?'active':''} onClick={()=>setActive(i)} key={i}>{c.raw}</button>)}</div>
          <div className="fret-scroll"><div className="fretboard" style={{'--cols':frets.length} as React.CSSProperties}>
            <div className="fret-numbers"><span></span>{frets.map(f=><span key={f}>{f}</span>)}</div>
            {STRING_NAMES.map((s,si)=><div className="string-row" key={s}><b>{s}</b>{frets.map(f=>{const pitchClass=(OPEN_PITCH_CLASSES[si]+f)%12; const toneIndex=chord?.tones.findIndex(tone=>tone.pitchClass===pitchClass)??-1; const chordTone=toneIndex>=0?chord?.tones[toneIndex]:undefined; const pos=selected.find(p=>p.string===si&&p.fret===f); const visible=!!chordTone && (!optimized || !!pos); const sounding=!!currentPlayed&&currentPlayed.string===si&&currentPlayed.fret===f&&playing; return <div className="fret" key={f}><span className="string"/><span className="wire"/>{visible&&<span className={'note '+colorForRole(chordTone.role)+(sounding?' sounding':'')} title={`${noteName(pitchClass,chord)}, ${lang==='it'?'grado':'degree'} ${chordTone.degree}`}>{noteName(pitchClass,chord)}</span>}</div>})}</div>)}
          </div></div>
          <div className="path"><div className="path-copy"><b>{t.smooth}</b><span>{t.smoothText}</span></div><div className="path-cards">{parsed.map((c,i)=>{const voicing=path[i]??[];const omitted=omittedTones(c,voicing);return <button onClick={()=>setActive(i)} className={i===active?'current':''} key={i}><b>{c.raw}</b><span>{[...voicing].sort((a,b)=>b.string-a.string).map(p=>noteName(p.pitchClass,c)).join(' · ')||'—'}</span><small>{voicing.map(p=>`${STRING_NAMES[p.string]}${p.fret}`).join('  ')}</small>{omitted.length>0&&<small className="omitted">{t.omitted}: {omitted.map(tone=>tone.degree).join(', ')}</small>}</button>})}</div></div>
        </>:<div className="empty"><b>{t.none}</b><span>{t.try}</span></div>}
      </div>
    </section>
    <section className="library-section"><div className="library-title"><div><p className="eyebrow">{t.repertoire}</p><h2>{t.libraryTitle}</h2><p>{t.libraryText}</p></div><span>{PRESETS.length} {t.exercises}</span></div><div className="preset-grid">{PRESETS.map(p=><button key={p.title} onClick={()=>loadPreset(p)}><span className="preset-style">{p.style}</span><b>{p.title}</b><span>{p.artist}</span><code>{p.progression}</code><small>{p.bpm} BPM <i>{t.load}</i></small></button>)}</div></section>
    <footer>{t.footer}</footer>
  </main>;
}
