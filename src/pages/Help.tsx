import type { Lang } from "../content";

type Section = { title: string; body: string[]; rows?: [string, string][] };

const HELP: Record<Lang, { eyebrow: string; title: string; intro: string; sections: Section[] }> = {
  en: {
    eyebrow: "HELP",
    title: "How to use it",
    intro: "Everything runs in your browser. Nothing you type or load is uploaded.",
    sections: [
      {
        title: "Writing a progression",
        body: [
          "Type chord symbols separated by spaces. Bar lines, commas and repeat marks are ignored, so you can paste a chart as it is written.",
          "Add a duration with a colon: Am7:4 means four beats. Without one, the chord lasts the default duration you set under Tempo.",
          "Anything not recognized is listed under the box instead of being guessed at.",
        ],
        rows: [
          ["Roots", "C, C#, Db — sharps and flats both work"],
          ["Triads", "C, Cm, Cdim, Caug, Csus2, Csus4, C5"],
          ["Sixths", "C6, Cm6, C6/9"],
          ["Sevenths", "C7, Cmaj7, Cm7, Cm7b5, Cdim7, CmMaj7"],
          ["Altered", "C7b5, C7#5, C7b9, C7#9, C7alt"],
          ["Extended", "C9, Cm9, Cmaj9, C13, Cm11, C7sus4, C9sus4"],
          ["Jazz shorthand", "C-7, C^7, Ch7, C°7, Cø7 all work"],
          ["Slash chords", "C/E puts E at the bottom, even if it is not a chord tone"],
        ],
      },
      {
        title: "Fret zone",
        body: [
          "Voicings are searched only inside the fret range you choose, so you can practise without leaving position.",
          "If a chord has no playable voicing in that range, it is marked instead of silently disappearing — widen the range or move it.",
        ],
      },
      {
        title: "Why a note is missing",
        body: [
          "Four strings cannot hold five notes. When a chord has more tones than strings, the least characteristic ones are dropped first.",
          "The fifth goes first: it carries almost no harmonic information. The third and the seventh are kept, because they are what makes a chord major, minor or dominant. On diminished and half-diminished chords the flat fifth is characteristic, so it is protected too.",
        ],
      },
      {
        title: "Note names",
        body: [
          "Notes are spelled from their degree, not from a fixed sharp or flat table. F7 shows E♭ because the seventh of F is a kind of E — writing D♯ there would be the same pitch and the wrong note.",
          "Double accidentals are shown as their plain equivalent: B♭dim7 ends on G rather than A♭♭, which is correct on paper and useless on a fretboard.",
        ],
      },
      {
        title: "Practice modes",
        body: [
          "Chords holds the whole voicing for the length of the chord.",
          "Arpeggio walks through the voicing one note per beat, from the root upward.",
          "Walking outlines root, third, fifth, third — the skeleton of a walking line.",
        ],
      },
      {
        title: "Backing track",
        body: [
          "Load an audio file from the Backing track panel. It stays on your machine.",
          "Set First downbeat so the grid lines up: start the track, then press Set here exactly on beat one. Almost no recording starts its form at 0:00, so without this the chords will be offset for the whole song.",
          "The fretboard follows the audio position rather than a separate clock, so changing the speed does not pull them apart.",
        ],
      },
      {
        title: "A–B loop",
        body: [
          "Pick a first and last chord, tick the loop, and that section repeats. With a backing track loaded the audio seeks back too, so you can drill four bars against the real recording.",
        ],
      },
    ],
  },
  it: {
    eyebrow: "GUIDA",
    title: "Come si usa",
    intro: "Tutto gira nel tuo browser. Niente di quello che scrivi o carichi viene mandato online.",
    sections: [
      {
        title: "Scrivere una progressione",
        body: [
          "Scrivi gli accordi separati da spazi. Barre, virgole e segni di ritornello vengono ignorati, quindi puoi incollare una griglia così com'è scritta.",
          "Aggiungi la durata con i due punti: Am7:4 vuol dire quattro battiti. Senza, l'accordo dura la durata predefinita impostata sotto Tempo.",
          "Quello che non viene riconosciuto è elencato sotto la casella, invece di essere indovinato.",
        ],
        rows: [
          ["Fondamentali", "C, C#, Db — diesis e bemolle funzionano entrambi"],
          ["Triadi", "C, Cm, Cdim, Caug, Csus2, Csus4, C5"],
          ["Seste", "C6, Cm6, C6/9"],
          ["Settime", "C7, Cmaj7, Cm7, Cm7b5, Cdim7, CmMaj7"],
          ["Alterati", "C7b5, C7#5, C7b9, C7#9, C7alt"],
          ["Estesi", "C9, Cm9, Cmaj9, C13, Cm11, C7sus4, C9sus4"],
          ["Sigle jazz", "C-7, C^7, Ch7, C°7, Cø7 funzionano tutte"],
          ["Rivolti", "C/E mette il MI al basso, anche se non appartiene all'accordo"],
        ],
      },
      {
        title: "Zona della tastiera",
        body: [
          "I voicing vengono cercati solo dentro la zona di tasti che scegli, così studi senza cambiare posizione.",
          "Se un accordo non è suonabile in quella zona viene segnalato, invece di sparire in silenzio: allarga la zona o spostala.",
        ],
      },
      {
        title: "Perché manca una nota",
        body: [
          "Quattro corde non tengono cinque note. Quando un accordo ha più note che corde, si tolgono per prime quelle meno caratteristiche.",
          "La quinta va via per prima: non porta quasi nessuna informazione armonica. Terza e settima restano, perché sono quelle che rendono un accordo maggiore, minore o di dominante. Sui semidiminuiti e diminuiti anche la quinta bemolle è caratteristica, quindi è protetta.",
        ],
      },
      {
        title: "Nomi delle note",
        body: [
          "Le note prendono il nome dal loro grado, non da una tabella fissa di diesis o bemolle. F7 mostra E♭ perché la settima di FA è una specie di MI: scrivere D♯ darebbe la stessa altezza e la nota sbagliata.",
          "Le doppie alterazioni sono mostrate con l'equivalente semplice: B♭dim7 finisce su G invece che su A♭♭, che è corretto sulla carta e inutile su una tastiera.",
        ],
      },
      {
        title: "Modalità di studio",
        body: [
          "Accordi tiene tutto il voicing per la durata dell'accordo.",
          "Arpeggio percorre il voicing una nota per battito, dalla fondamentale in su.",
          "Walking disegna fondamentale, terza, quinta, terza — lo scheletro di una linea di walking.",
        ],
      },
      {
        title: "Base di accompagnamento",
        body: [
          "Carica un file audio dal pannello Base. Resta sul tuo computer.",
          "Imposta il Primo battere per agganciare la griglia: fai partire il brano e premi Segna qui esattamente sul primo battere. Quasi nessuna registrazione attacca la forma a 0:00, quindi senza questo gli accordi restano sfasati per tutto il pezzo.",
          "La tastiera segue la posizione dell'audio e non un orologio separato, quindi cambiare velocità non li disallinea.",
        ],
      },
      {
        title: "Loop A–B",
        body: [
          "Scegli primo e ultimo accordo, spunta il loop, e quella sezione si ripete. Con una base caricata anche l'audio torna indietro, così puoi macinare quattro battute sulla registrazione vera.",
        ],
      },
    ],
  },
};

export default function Help({ lang }: { lang: Lang }) {
  const help = HELP[lang];

  return (
    <section className="help-section">
      <div className="library-title">
        <div>
          <p className="eyebrow">{help.eyebrow}</p>
          <h2>{help.title}</h2>
          <p>{help.intro}</p>
        </div>
      </div>
      <div className="help-grid">
        {help.sections.map((section) => (
          <article className="help-card" key={section.title}>
            <h3>{section.title}</h3>
            {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            {section.rows && (
              <dl>
                {section.rows.map(([term, description]) => (
                  <div key={term}>
                    <dt>{term}</dt>
                    <dd><code>{description}</code></dd>
                  </div>
                ))}
              </dl>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
