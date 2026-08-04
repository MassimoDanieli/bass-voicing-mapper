/**
 * These are not unit tests. They mount the real app and check that each route
 * renders and that the controls that must always be reachable, are.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "./App";

beforeEach(() => {
  window.scrollTo = () => undefined; // jsdom does not implement it and logs on every call
  window.history.pushState(null, "", "/");
  // Node 22+ defines a disabled localStorage global that shadows the jsdom one,
  // so reach it through window rather than as a bare identifier.
  window.localStorage.clear();
});
afterEach(cleanup);

const nav = () => within(screen.getByRole("navigation"));

describe("routes", () => {
  it("opens on the instrument", () => {
    render(<App />);
    expect(screen.getByLabelText("Progression")).toBeDefined();
    expect(screen.getByRole("button", { name: "Play" })).toBeDefined();
  });

  it("walks to every page and back, and updates the URL", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(nav().getByText("Repertoire"));
    expect(window.location.pathname).toBe("/repertoire");
    expect(screen.getByText("Blue Bossa")).toBeDefined();

    await user.click(nav().getByText("Help"));
    expect(window.location.pathname).toBe("/help");
    expect(screen.getByText("Writing a progression")).toBeDefined();

    await user.click(nav().getByText("My songs"));
    expect(window.location.pathname).toBe("/songs");
    expect(screen.getByText("No saved songs yet")).toBeDefined();

    await user.click(nav().getByText("Studio"));
    expect(window.location.pathname).toBe("/");
    expect(screen.getByLabelText("Progression")).toBeDefined();
  });

  it("renders the instrument for an unknown path", () => {
    window.history.pushState(null, "", "/repertorio");
    render(<App />);
    expect(screen.getByLabelText("Progression")).toBeDefined();
  });

  it("loading a preset returns to the instrument with the progression applied", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(nav().getByText("Repertoire"));
    await user.click(screen.getByText("Blue Bossa"));

    expect(window.location.pathname).toBe("/");
    expect(screen.getByLabelText<HTMLTextAreaElement>("Progression").value)
      .toBe("Cm7 Fm7 Dm7b5 G7 Cm7");
  });
});

describe("control panel", () => {
  it("swaps content between the two tabs", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByLabelText("Progression")).toBeDefined();
    await user.click(screen.getByRole("tab", { name: "Backing track" }));

    expect(screen.queryByLabelText("Progression")).toBeNull();
    expect(screen.getByText("Choose an audio file")).toBeDefined();
  });

  it("puts the transport above the progression, not below the fold", () => {
    render(<App />);
    const play = screen.getByRole("button", { name: "Play" });
    const progression = screen.getByLabelText("Progression");

    // DOCUMENT_POSITION_FOLLOWING: play comes first in the panel.
    expect(play.compareDocumentPosition(progression) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps the transport reachable from both tabs", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole("button", { name: "Play" })).toBeDefined();
    await user.click(screen.getByRole("tab", { name: "Backing track" }));
    expect(screen.getByRole("button", { name: "Play" })).toBeDefined();
  });
});

describe("saved songs", () => {
  it("saves from the backing panel and lists it on its own page", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("tab", { name: "Backing track" }));
    await user.type(screen.getByLabelText("Song name"), "Blue Bossa study");
    await user.click(screen.getByRole("button", { name: "Save" }));

    // Proves storage is actually reachable under test, not silently swallowed
    // by the try/catch around it.
    expect(window.localStorage.getItem("bvm:songs")).toContain("Blue Bossa study");

    await user.click(nav().getByText("My songs"));
    expect(screen.getByText("Blue Bossa study")).toBeDefined();
  });
});

describe("backing source", () => {
  it("starts on the metronome and offers the audio file only once one is loaded", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("tab", { name: "Backing track" }));
    expect(screen.getByRole("button", { name: "Metronome" }).className).toContain("chosen");
    expect(screen.getByRole("button", { name: "Audio file" })).toHaveProperty("disabled", true);
  });

  it("reveals the feel and levels when the generated backing is chosen", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("tab", { name: "Backing track" }));
    expect(screen.queryByLabelText("Feel")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Generated" }));
    expect(screen.getByLabelText("Feel")).toBeDefined();
    expect(screen.getByLabelText("Drums")).toBeDefined();
    expect(screen.getByLabelText("Piano")).toBeDefined();
    expect(screen.getByLabelText("One bar count-in")).toBeDefined();
  });

  it("loading a preset selects the feel that suits it", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(nav().getByText("Repertoire"));
    await user.click(screen.getByText("Blue Bossa"));
    await user.click(screen.getByRole("tab", { name: "Backing track" }));
    await user.click(screen.getByRole("button", { name: "Generated" }));

    expect(screen.getByLabelText<HTMLSelectElement>("Feel").value).toBe("bossa");
  });
});

describe("the chord engine reaches the screen", () => {
  it("spells the seventh of F7 as E flat", async () => {
    const user = userEvent.setup();
    render(<App />);

    const progression = screen.getByLabelText("Progression");
    await user.clear(progression);
    await user.type(progression, "F7");

    // Degree-aware spelling: D sharp is the same pitch and the wrong note.
    expect(await screen.findAllByTitle(/^E♭, degree b7$/)).not.toHaveLength(0);
  });

  it("reports unrecognized chords instead of guessing", async () => {
    const user = userEvent.setup();
    render(<App />);

    const progression = screen.getByLabelText("Progression");
    await user.clear(progression);
    await user.type(progression, "Cm7 Cfoo");

    expect(await screen.findByText(/Not recognized: Cfoo/)).toBeDefined();
  });
});
