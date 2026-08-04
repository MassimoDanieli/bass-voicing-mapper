import type { Copy, Preset } from "../content";

export default function Repertoire({
  presets, copy, onLoad,
}: { presets: Preset[]; copy: Copy; onLoad: (preset: Preset) => void }) {
  return (
    <section className="library-section">
      <div className="library-title">
        <div>
          <p className="eyebrow">{copy.repertoire}</p>
          <h2>{copy.libraryTitle}</h2>
          <p>{copy.libraryText}</p>
        </div>
        <span>{presets.length} {copy.exercises}</span>
      </div>
      <div className="preset-grid">
        {presets.map((preset) => (
          <button key={preset.title} onClick={() => onLoad(preset)}>
            <span className="preset-style">{preset.style}</span>
            <b>{preset.title}</b>
            <span>{preset.artist}</span>
            <code>{preset.progression}</code>
            <small>{preset.bpm} BPM <i>{copy.load}</i></small>
          </button>
        ))}
      </div>
    </section>
  );
}
