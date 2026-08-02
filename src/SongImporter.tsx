import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import "./SongImporter.css";

type SongSource = "audio" | "youtube";
type Song = {
  id: string;
  source: SongSource;
  title: string;
  artist: string;
  progression: string;
  bpm: number;
  youtubeId?: string;
  fileName?: string;
  duration?: number;
};

type RuntimeAudio = Record<string, string>;

const STORAGE_KEY = "bass-voicing-mapper:songs:v1";

function readSongs(): Song[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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

export default function SongImporter() {
  const [songs, setSongs] = useState<Song[]>(readSongs);
  const [runtimeAudio, setRuntimeAudio] = useState<RuntimeAudio>({});
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [message, setMessage] = useState("");
  const fileInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
  }, [songs]);

  useEffect(() => () => {
    Object.values(runtimeAudio).forEach(url => URL.revokeObjectURL(url));
  }, [runtimeAudio]);

  const audioCount = useMemo(() => songs.filter(song => song.source === "audio").length, [songs]);
  const youtubeCount = songs.length - audioCount;

  const importAudio = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;

    const additions: Song[] = [];
    const urls: RuntimeAudio = {};

    for (const file of files) {
      const id = crypto.randomUUID();
      additions.push({
        id,
        source: "audio",
        title: file.name.replace(/\.[^.]+$/, ""),
        artist: "",
        progression: "",
        bpm: 100,
        fileName: file.name,
      });
      urls[id] = URL.createObjectURL(file);
    }

    setSongs(current => [...additions, ...current]);
    setRuntimeAudio(current => ({ ...current, ...urls }));
    setMessage(`${files.length} file audio importati. I file restano solo in questo dispositivo.`);
    event.target.value = "";
  };

  const addYoutube = () => {
    const youtubeId = youtubeIdFrom(youtubeUrl);
    if (!youtubeId) {
      setMessage("Link YouTube non riconosciuto.");
      return;
    }

    setSongs(current => [{
      id: crypto.randomUUID(),
      source: "youtube",
      title: "Video YouTube",
      artist: "",
      progression: "",
      bpm: 100,
      youtubeId,
    }, ...current]);
    setYoutubeUrl("");
    setMessage("Video YouTube aggiunto tramite player ufficiale.");
  };

  const patchSong = (id: string, patch: Partial<Song>) => {
    setSongs(current => current.map(song => song.id === id ? { ...song, ...patch } : song));
  };

  const removeSong = (song: Song) => {
    const url = runtimeAudio[song.id];
    if (url) URL.revokeObjectURL(url);
    setRuntimeAudio(current => {
      const next = { ...current };
      delete next[song.id];
      return next;
    });
    setSongs(current => current.filter(item => item.id !== song.id));
  };

  const loadSong = (song: Song) => {
    if (!song.progression.trim()) {
      setMessage("Inserisci prima gli accordi della canzone.");
      return;
    }
    if (applyProgressionToMapper(song.progression)) {
      setMessage(`Progressione di “${song.title}” caricata nella mappa.`);
    }
  };

  return <section className="song-importer" aria-labelledby="song-importer-title">
    <div className="song-importer__head">
      <div>
        <p className="song-importer__eyebrow">LE MIE CANZONI</p>
        <h2 id="song-importer-title">Importa audio o apri YouTube</h2>
        <p>Riproduci i brani, annota gli accordi e caricali direttamente nella mappa del basso.</p>
      </div>
      <span>{audioCount} audio · {youtubeCount} YouTube</span>
    </div>

    <div className="song-importer__actions">
      <div className="song-importer__action-card">
        <b>File audio</b>
        <p>MP3, WAV, M4A e OGG. Puoi selezionare più file insieme.</p>
        <input ref={fileInput} hidden type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg" multiple onChange={importAudio}/>
        <button type="button" onClick={() => fileInput.current?.click()}>Importa audio</button>
      </div>

      <div className="song-importer__action-card">
        <b>YouTube</b>
        <p>Il video viene aperto con il player ufficiale, senza scaricare l’audio.</p>
        <div className="song-importer__youtube-input">
          <input value={youtubeUrl} onChange={event => setYoutubeUrl(event.target.value)} placeholder="Incolla un link YouTube"/>
          <button type="button" onClick={addYoutube}>Aggiungi</button>
        </div>
      </div>
    </div>

    {message && <div className="song-importer__message" role="status">{message}</div>}

    <div className="song-importer__grid">
      {songs.map(song => <article className="song-card" key={song.id}>
        <div className="song-card__topline">
          <span>{song.source === "audio" ? "AUDIO LOCALE" : "YOUTUBE"}</span>
          <button type="button" className="song-card__remove" onClick={() => removeSong(song)} aria-label={`Elimina ${song.title}`}>×</button>
        </div>

        <label>
          <span>Titolo</span>
          <input value={song.title} onChange={event => patchSong(song.id, { title: event.target.value })}/>
        </label>
        <label>
          <span>Artista</span>
          <input value={song.artist} onChange={event => patchSong(song.id, { artist: event.target.value })} placeholder="Artista"/>
        </label>

        {song.source === "audio" ? <>
          {runtimeAudio[song.id] ? <audio controls preload="metadata" src={runtimeAudio[song.id]} onLoadedMetadata={event => patchSong(song.id, { duration: event.currentTarget.duration })}/> : <div className="song-card__missing">Ricarica il file audio per riprodurlo in questa sessione.</div>}
          <small>{song.fileName} · {formatDuration(song.duration)}</small>
        </> : <div className="song-card__video">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${song.youtubeId}`}
            title={song.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>}

        <div className="song-card__meta">
          <label>
            <span>BPM</span>
            <input type="number" min="40" max="240" value={song.bpm} onChange={event => patchSong(song.id, { bpm: Number(event.target.value) || 100 })}/>
          </label>
        </div>

        <label>
          <span>Accordi</span>
          <textarea rows={3} value={song.progression} onChange={event => patchSong(song.id, { progression: event.target.value })} placeholder="Esempio: C Am F G"/>
        </label>
        <button type="button" className="song-card__load" onClick={() => loadSong(song)}>Usa nella mappa →</button>
      </article>)}

      {!songs.length && <div className="song-importer__empty">Non hai ancora importato canzoni.</div>}
    </div>

    <p className="song-importer__privacy">Le schede e gli accordi vengono salvati nel browser. I file audio non vengono caricati su server e vanno riselezionati dopo aver chiuso la pagina.</p>
  </section>;
}
