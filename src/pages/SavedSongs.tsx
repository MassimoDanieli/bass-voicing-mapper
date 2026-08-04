import type { Copy } from "../content";
import { Link } from "../router";

export type SavedSong = { id: string; title: string; progression: string; bpm: number };

export default function SavedSongs({
  songs, copy, onLoad, onDelete,
}: {
  songs: SavedSong[];
  copy: Copy;
  onLoad: (song: SavedSong) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <section className="library-section">
      <div className="library-title">
        <div>
          <p className="eyebrow">{copy.saved}</p>
          <h2>{copy.savedTitle}</h2>
          <p>{copy.savedText}</p>
        </div>
        <span>{songs.length}</span>
      </div>
      {songs.length ? (
        <div className="preset-grid">
          {songs.map((song) => (
            <div className="saved-card" key={song.id}>
              <button onClick={() => onLoad(song)}>
                <b>{song.title}</b>
                <code>{song.progression}</code>
                <small>{song.bpm} BPM <i>{copy.load}</i></small>
              </button>
              <button
                className="saved-delete"
                aria-label={`${copy.delete} ${song.title}`}
                onClick={() => onDelete(song.id)}
              >×</button>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty">
          <b>{copy.savedEmpty}</b>
          <span>{copy.savedEmptyHint}</span>
          <Link className="empty-link" to="/">{copy.savedEmptyAction}</Link>
        </div>
      )}
    </section>
  );
}
