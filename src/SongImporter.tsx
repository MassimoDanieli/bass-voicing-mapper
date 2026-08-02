import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { analyzeAudioFile } from "./audioAnalysis";
import { readAudioMetadata } from "./audioMetadata";
import { parseIRealInput } from "./iRealImport";
import "./SongImporter.css";

type SongSource = "audio" | "youtube" | "ireal";
type Song = {
  id: string;
  source: SongSource;
  title: string;
  artist: string;
  progression: string;
  bpm: number;
  key?: string;
  style?: string;
  album?: string;
  confidence?: number;
  youtubeId?: string;
  fileName?: string;
  duration?: number;
};

type RuntimeAudio = Record<string, string>;
type RuntimeFiles = Record<string, File>;
type AnalysisState = Record<string, "idle" | "working" | "done" | "error">;

const STORAGE_KEY = "bass-voicing-mapper:songs:v3";

function readSongs(): Song[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem("bass-voicing-mapper:songs:v2") ?? localStorage.getItem("bass-voicing-mapper:songs:v1");
    return raw ? (JSON.parse(raw) as Song[]) : [];
  } catch {
    return [];
  }
}

function youtubeIdFrom(value: string) {
  try {
    const url = new URL(value.trim());
    if (url.hostname === "youtu.be") return url.pathname.slice(1).split("/")[0];
    if (url.hostname.includes("youtube.com")) {
      if (url.pathname.startsWith("/shorts/")) return url.pathname.split("/")[2];
      if (url.pathname.startsWith("/embed/")) return url.pathname.split("/")[2];
      return url.searchParams.get("v") ?? "";
    }
  } catch {
    return "";
  }
  return "";
}

function formatDuration(seconds?: number) {
  if (!seconds || !Number.isFinite(seconds)) return "—";
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function applyProgressionToMapper(progression: string) {
  const textarea = document.querySelector<HTMLTextAreaElement>("#progression");
  if (!textarea) return false;
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  setter?.call(textarea, progression);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.dispatchEvent(new Event("change", { bubbles: true }));
  textarea.focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
  return true;
}

function sourceLabel(source: SongSource) {
  if (source === "audio") return "AUDIO LOCALE";
  if (source === "youtube") return "YOUTUBE";
  return "IREAL PRO";
}

export default function SongImporter() {
  const [songs, setSongs] = useState<Song[]>(readSongs);
  const [runtimeAudio, setRuntimeAudio] = useState<RuntimeAudio>({});
  const [runtimeFiles, setRuntimeFiles] = useState<RuntimeFiles>({});
  const [analysis, setAnalysis] = useState<AnalysisState>({});
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [iRealInput, setIRealInput] = useState("");
  const [message, setMessage] = useState("");
  const fileInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
  }, [songs]);

  useEffect(() => () => {
    Object.values(runtimeAudio).forEach(url => URL.revokeObjectURL(url));
  }, [runtimeAudio]);

  const audioCount = useMemo(() => songs.filter(song => song.source === "audio").length, [songs]);
  const youtubeCount = useMemo(() => songs.filter(song => song.source === "youtube").length, [songs]);
  const iRealCount = songs.length - audioCount - youtubeCount;

  const importAudio = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    const additions: Song[] = [];
    const urls: RuntimeAudio = {};
    const nextFiles: RuntimeFiles = {};
    for (const file of files) {
      const id = crypto.randomUUID();
      const metadata = await readAudioMetadata(file);
      additions.push({
        id,
        source: "audio",
        title: metadata.title || file.name.replace(/\.[^.]+$/, ""),
        artist: metadata.artist || "",
        album: metadata.album,
        progression: "",
        bpm: 100,
        fileName: file.name,
      });
      urls[id] = URL.createObjectURL(file);
      nextFiles[id] = file;
    }
    setSongs(current => [...additions, ...current]);
    setRuntimeAudio(current => ({ ...current, ...urls }));
    setRuntimeFiles(current => ({ ...current, ...nextFiles }));
    setMessage(`${files.length} file audio importati. Titolo e artista letti dai tag quando disponibili.`);
    event.target.value = "";
  };

  const addYoutube = () => {
    const youtubeId = youtubeIdFrom(youtubeUrl);
    if (!youtubeId) return setMessage("Link YouTube non riconosciuto.");
    setSongs(current => [{ id: crypto.randomUUID(), source: "youtube", title: "Video YouTube", artist: "", progression: "", bpm: 100, youtubeId }, ...current]);
    setYoutubeUrl("");
    setMessage("Video YouTube aggiunto tramite player ufficiale.");
  };

  const addIReal = () => {
    const imported = parseIRealInput(iRealInput);
    if (!imported.length) return setMessage("Formato iReal non riconosciuto. Incolla un link iReal Pro completo o il testo esportato.");
    const additions: Song[] = imported.map(song => ({
      id: crypto.randomUUID(),
      source: "ireal",
      title: song.title,
      artist: song.artist,
      style: song.style,
      key: song.key,
      progression: song.progression,
      bpm: 100,
    }));
    setSongs(current => [...additions, ...current]);
    setIRealInput("");
    setMessage(`${additions.length} brani iReal importati con gli accordi già pronti.`);
  };

  const patchSong = (id: string, patch: Partial<Song>) => setSongs(current => current.map(song => song.id === id ? { ...song, ...patch } : song));

  const analyzeSong = async (song: Song) => {
    const file = runtimeFiles[song.id];
    if (!file) {
      setMessage("Riseleziona il file audio prima di avviare l’analisi.");
      return null;
    }
    setAnalysis(current => ({ ...current, [song.id]: "working" }));
    setMessage(`Analisi di “${song.title}” in corso nel browser…`);
    try {
      const result = await analyzeAudioFile(file);
      patchSong(song.id, { bpm: result.bpm, key: result.key, progression: result.progression, confidence: result.confidence });
      setAnalysis(current => ({ ...current, [song.id]: "done" }));
      setMessage(`Analisi completata: tonalità ${result.key}, circa ${result.bpm} BPM.`);
      return result;
    } catch (error) {
      console.error(error);
      setAnalysis(current => ({ ...current, [song.id]: "error" }));
      setMessage("Non è stato possibile analizzare questo file. Prova con WAV, MP3 o M4A non protetti.");
      return null;
    }
  };

  const removeSong = (song: Song) => {
    const url = runtimeAudio[song.id];
    if (url) URL.revokeObjectURL(url);
    setRuntimeAudio(current => { const next = { ...current }; delete next[song.id]; return next; });
    setRuntimeFiles(current => { const next = { ...current }; delete next[song.id]; return next; });
    setSongs(current => current.filter(item => item.id !== song.id));
  };

  const loadSong = async (song: Song) => {
    let progression = song.progression.trim();
    if (!progression && song.source === "audio") {
      const result = await analyzeSong(song);
      progression = result?.progression.trim() ?? "";
    }
    if (!progression) {
      setMessage(song.source === "youtube" ? "Per YouTube inserisci gli accordi manualmente." : "Non ci sono accordi utilizzabili per questo brano.");
      return;
    }
    if (applyProgressionToMapper(progression)) setMessage(`Progressione di “${song.title}” caricata nella mappa.`);
  };

  return <section className="song-importer" aria-labelledby="song-importer-title">
    <div className="song-importer__head"><div><p className="song-importer__eyebrow">LE MIE CANZONI</p><h2 id="song-importer-title">Importa audio, YouTube o iReal Pro</h2><p>Leggi i metadati, importa chart armonici e carica tutto nella mappa del basso.</p></div><span>{audioCount} audio · {youtubeCount} YouTube · {iRealCount} iReal</span></div>
    <div className="song-importer__actions song-importer__actions--three">
      <div className="song-importer__action-card"><b>File audio</b><p>MP3, WAV, M4A e OGG. Titolo e artista vengono letti automaticamente quando presenti.</p><input ref={fileInput} hidden type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg" multiple onChange={importAudio}/><button type="button" onClick={() => fileInput.current?.click()}>Importa audio</button></div>
      <div className="song-importer__action-card"><b>YouTube</b><p>Player ufficiale, senza scaricare o estrarre l’audio.</p><div className="song-importer__youtube-input"><input value={youtubeUrl} onChange={event => setYoutubeUrl(event.target.value)} placeholder="Incolla un link YouTube"/><button type="button" onClick={addYoutube}>Aggiungi</button></div></div>
      <div className="song-importer__action-card"><b>iReal Pro</b><p>Incolla un link iReal o il testo di una playlist esportata.</p><textarea rows={3} value={iRealInput} onChange={event => setIRealInput(event.target.value)} placeholder="irealbook://..."/><button type="button" onClick={addIReal}>Importa iReal</button></div>
    </div>
    {message && <div className="song-importer__message" role="status">{message}</div>}
    <div className="song-importer__grid">
      {songs.map(song => <article className="song-card" key={song.id}>
        <div className="song-card__topline"><span>{sourceLabel(song.source)}</span><button type="button" className="song-card__remove" onClick={() => removeSong(song)} aria-label={`Elimina ${song.title}`}>×</button></div>
        <label><span>Titolo</span><input value={song.title} onChange={event => patchSong(song.id, { title: event.target.value })}/></label>
        <label><span>Artista</span><input value={song.artist} onChange={event => patchSong(song.id, { artist: event.target.value })} placeholder="Artista"/></label>
        {song.album && <small>Album: {song.album}</small>}
        {song.style && <small>Stile iReal: {song.style}</small>}
        {song.source === "audio" && <>
          {runtimeAudio[song.id] ? <audio controls preload="metadata" src={runtimeAudio[song.id]} onLoadedMetadata={event => patchSong(song.id, { duration: event.currentTarget.duration })}/> : <div className="song-card__missing">Ricarica il file audio per riprodurlo e analizzarlo.</div>}
          <small>{song.fileName} · {formatDuration(song.duration)}</small>
          <button type="button" className="song-card__analyze" disabled={analysis[song.id] === "working" || !runtimeFiles[song.id]} onClick={() => analyzeSong(song)}>{analysis[song.id] === "working" ? "Analisi in corso…" : "Analizza BPM, tonalità e accordi"}</button>
        </>}
        {song.source === "youtube" && <div className="song-card__video"><iframe src={`https://www.youtube-nocookie.com/embed/${song.youtubeId}`} title={song.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen/></div>}
        <div className="song-card__meta"><label><span>BPM</span><input type="number" min="40" max="240" value={song.bpm} onChange={event => patchSong(song.id, { bpm: Number(event.target.value) || 100 })}/></label><label><span>Tonalità</span><input value={song.key ?? ""} onChange={event => patchSong(song.id, { key: event.target.value })} placeholder="Es. Am"/></label></div>
        {song.confidence !== undefined && <div className="song-card__confidence">Confidenza indicativa: {Math.round(song.confidence * 100)}%</div>}
        <label><span>Accordi stimati / importati</span><textarea rows={3} value={song.progression} onChange={event => patchSong(song.id, { progression: event.target.value })} placeholder="Esempio: C Am F G"/></label>
        <button type="button" className="song-card__load" disabled={analysis[song.id] === "working"} onClick={() => loadSong(song)}>{analysis[song.id] === "working" ? "Analisi in corso…" : "Usa nella mappa →"}</button>
      </article>)}
      {!songs.length && <div className="song-importer__empty">Non hai ancora importato canzoni.</div>}
    </div>
    <p className="song-importer__privacy">I file restano nel browser. I metadati dipendono dai tag presenti nell’MP3; l’analisi armonica resta una stima automatica modificabile.</p>
  </section>;
}
