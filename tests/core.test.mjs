// A dal-adatok és a DOM-mentes mag tesztjei.
// Futtatás: node --test tests/
// Az index.html "songs" és "core" <script> blokkját futtatja (DOM nélkül).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const scriptById = (id) => {
  const m = new RegExp(`<script id="${id}">([\\s\\S]*?)</script>`).exec(html);
  if (!m) throw new Error(`Hiányzó <script id="${id}">`);
  return m[1];
};
// A saját realmban fut, hogy a deepStrictEqual prototípus-összevetése működjön.
const { SONGS, PianoCore: core } = vm.runInThisContext(
  `(() => {${scriptById("songs")}\n${scriptById("core")}\nreturn { SONGS, PianoCore: globalThis.PianoCore };})()`
);
const song = (id) => SONGS.find((s) => s.id === id);
const mainSongs = SONGS.filter((s) => !s.kids);
const kidSongs = SONGS.filter((s) => s.kids);
const names = (step) => step.notes.map((n) => n.name);
const pressAll = (session, tl, opts) => {
  const step = tl.steps[session.stepIndex];
  let effects = [];
  for (const midi of core.requiredMidis(step)) {
    const r = core.sessionReduce(session, { type: "key", midi }, tl, opts);
    session = r.session;
    effects = effects.concat(r.effects);
  }
  return { session, effects };
};

test("hangok értelmezése és magyar nevek", () => {
  assert.equal(core.parsePitch("C4").midi, 60);
  assert.equal(core.parsePitch("F#4").midi, 66);
  assert.equal(core.parsePitch("Bb3").midi, 58);
  assert.equal(core.parsePitch("B3").name, "H");
  assert.equal(core.parsePitch("Bb4").name, "B");
  assert.equal(core.parsePitch("F#3").name, "Fisz");
  assert.equal(core.parsePitch("C#5").name, "Cisz");
  assert.equal(core.parsePitch("G#4").name, "Gisz");
  assert.equal(core.parsePitch("Eb4").name, "Esz");
  assert.throws(() => core.parsePitch("H4"));
  assert.equal(core.keyName(61), "Cisz");
  assert.equal(core.keyName(63), "Disz");
  assert.equal(core.keyName(70), "B");
  assert.equal(core.keyName(71), "H");
  assert.equal(core.isBlack(66), true);
  assert.equal(core.isBlack(65), false);
});

test("hosszjelölések és hangjelek", () => {
  assert.equal(core.parseDuration(undefined), 1);
  assert.equal(core.parseDuration("q."), 1.5);
  assert.equal(core.parseDuration("8"), 0.5);
  assert.equal(core.parseDuration("w"), 4);
  assert.throws(() => core.parseDuration("x"));
  const t = core.parseToken("G3:h@1");
  assert.equal(t.pitch.midi, 55);
  assert.equal(t.dur, 2);
  assert.equal(t.finger, 1);
  assert.throws(() => core.parseToken("G3:h@7"));
});

test("minden dal adatai érvényesek (ütemhosszak, akkordok)", () => {
  assert.equal(mainSongs.length, 3);
  assert.equal(kidSongs.length, 4);
  for (const s of SONGS) assert.deepEqual(core.validateSong(s), [], s.title);
});

test("hibás ütemhossz kiderül", () => {
  const broken = {
    id: "x", title: "Hibás", meter: [4, 4],
    modes: { melody: { right: ["C4 D4 E4"] } },
  };
  const errors = core.validateSong(broken);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /1\. ütem 3 negyed hosszú, 4 kellene/);
});

test("Örömóda: jobb kéz dallam és ujjszámok", () => {
  const tl = core.buildTimeline(song("orom"), { mode: "melody", hands: "right" });
  assert.equal(tl.barCount, 16);
  assert.equal(tl.bpb, 4);
  const first = tl.steps.slice(0, 4);
  assert.deepEqual(first.map((s) => s.notes[0].name), ["E", "E", "F", "G"]);
  assert.deepEqual(first.map((s) => s.notes[0].finger), [3, 3, 4, 5]);
  // 4. ütem: E. D(8) D(fél)
  const bar4 = tl.bars[3].steps.map((i) => tl.steps[i].notes[0]);
  assert.deepEqual(bar4.map((n) => [n.name, n.dur]), [["E", 1.5], ["D", 0.5], ["D", 2]]);
  // 12. ütem vége: középső C alatti G, félkotta, hüvelykujj
  const g = tl.steps[tl.bars[11].steps.at(-1)].notes[0];
  assert.deepEqual([g.pitch.spelling, g.dur, g.finger], ["G3", 2, 1]);
});

test("Örömóda: két kézzel a bal kéz az ütemek elején csatlakozik", () => {
  const tl = core.buildTimeline(song("orom"), { mode: "melody", hands: "both" });
  const s0 = tl.steps[0];
  assert.deepEqual(s0.notes.map((n) => [n.hand, n.pitch.spelling]), [["right", "E4"], ["left", "C3"]]);
  assert.equal(tl.steps[1].notes.length, 1);
  // 8. ütem: G(fél) C(fél) a bal kézben
  const bar8Left = tl.events.filter((e) => e.bar === 7 && e.hand === "left");
  assert.deepEqual(bar8Left.map((e) => [e.pitch.spelling, e.dur]), [["G3", 2], ["C3", 2]]);
  assert.deepEqual(bar8Left.map((e) => e.finger), [1, 5]);
});

test("River Flows in You: akkordkör, alaphang a bal kézben, ismétlés", () => {
  const tl = core.buildTimeline(song("river"), { mode: "chords", hands: "both" });
  assert.equal(tl.barCount, 4);
  assert.equal(tl.loop, true);
  assert.deepEqual(tl.chordSlots.map((c) => c.name), ["Fisz-moll", "D-dúr", "A-dúr", "E-dúr"]);
  assert.deepEqual(tl.steps.map((s) => s.notes.length), [4, 4, 4, 4]);
  const bass = tl.events.filter((e) => e.hand === "left").map((e) => e.name);
  assert.deepEqual(bass, ["Fisz", "D", "A", "E"]);
  assert.deepEqual(tl.chordSlots[0].notes.slice().sort(), ["A", "Cisz", "Fisz"]);
});

test("River Flows in You: felbontva 1–3–5–3 nyolcadokban", () => {
  const tl = core.buildTimeline(song("river"), { mode: "chords", hands: "right", arpeggio: true });
  assert.equal(tl.arpeggio, true);
  const bar1 = tl.bars[0].steps.map((i) => tl.steps[i].notes[0]);
  assert.equal(bar1.length, 8);
  assert.ok(bar1.every((n) => n.dur === 0.5));
  assert.deepEqual(bar1.map((n) => n.name), ["Cisz", "Fisz", "A", "Fisz", "Cisz", "Fisz", "A", "Fisz"]);
  assert.deepEqual(bar1.slice(0, 4).map((n) => n.finger), [1, 3, 5, 3]);
});

test("Kalózok: 15 ütem 3/4-ben, ütemenként 3 akkord, hangsúly az elsőn", () => {
  const tl = core.buildTimeline(song("pirates"), { mode: "chords", hands: "right" });
  assert.equal(tl.barCount, 15);
  assert.equal(tl.bpb, 3);
  assert.equal(tl.totalBeats, 45);
  for (const bar of tl.bars) {
    assert.equal(bar.steps.length, 3);
    assert.deepEqual(bar.steps.map((i) => tl.steps[i].accent), [true, false, false]);
  }
  assert.deepEqual(tl.chordSlots.map((c) => c.id).join(" "), "Dm Bb Am Dm Bb F C Dm Dm Gm Bb Dm Bb Dm A");
  const bb = tl.chordSlots.find((c) => c.id === "Bb");
  assert.deepEqual(bb.notes.slice().sort(), ["B", "D", "F"]);
  const a = tl.chordSlots.find((c) => c.id === "A");
  assert.deepEqual(a.notes.slice().sort(), ["A", "Cisz", "E"]);
});

test("szerzői jogvédett dalokhoz nincs dallam, csak megjegyzés", () => {
  for (const id of ["river", "pirates"]) {
    assert.deepEqual(core.availableModes(song(id)), ["chords"]);
    assert.match(song(id).copyrightNote, /easy piano kottából/);
  }
});

test("billentyűzet: minden dal elfér 2 oktávon (C3–H4)", () => {
  for (const s of mainSongs) assert.deepEqual(core.keyboardRange(s), { low: 48, high: 71 }, s.title);
});

test("billentyűzet: a tartomány bővül, ha a dal kilóg", () => {
  const wide = { id: "w", title: "Széles", meter: [4, 4], modes: { melody: { right: ["C5:w"], left: ["A2:w"] } } };
  assert.deepEqual(core.keyboardRange(wide), { low: 36, high: 83 });
});

test("gyakorlás: helyes billentyűre továbblép, hibásra jelez, de nem lép vissza", () => {
  const tl = core.buildTimeline(song("orom"), { mode: "melody", hands: "right" });
  let s = core.sessionInit(0);
  let r = core.sessionReduce(s, { type: "key", midi: 62 }, tl, { autoAdvance: true });
  assert.deepEqual(r.effects.map((e) => e.type), ["wrong"]);
  assert.equal(r.session.stepIndex, 0);
  assert.equal(r.session.barErrors, 1);
  r = core.sessionReduce(r.session, { type: "key", midi: 64 }, tl, { autoAdvance: true });
  assert.deepEqual(r.effects.map((e) => e.type), ["ok", "stepDone"]);
  assert.equal(r.session.stepIndex, 1);
});

test("gyakorlás: lépésenként módban csak a Következő gomb léptet", () => {
  const tl = core.buildTimeline(song("orom"), { mode: "melody", hands: "right" });
  let r = core.sessionReduce(core.sessionInit(0), { type: "key", midi: 64 }, tl, { autoAdvance: false });
  assert.equal(r.session.stepIndex, 0);
  assert.equal(r.session.stepDone, true);
  // befejezett lépés után a mellényomás nem számít hibának
  r = core.sessionReduce(r.session, { type: "key", midi: 50 }, tl, { autoAdvance: false });
  assert.equal(r.session.barErrors, 0);
  r = core.sessionReduce(r.session, { type: "next" }, tl, { autoAdvance: false });
  assert.equal(r.session.stepIndex, 1);
});

test("gyakorlás: akkordnál minden hangot le kell ütni (bármilyen sorrendben)", () => {
  const tl = core.buildTimeline(song("river"), { mode: "chords", hands: "both" });
  const opts = { autoAdvance: true };
  let r = core.sessionReduce(core.sessionInit(0), { type: "key", midi: 69 }, tl, opts);
  r = core.sessionReduce(r.session, { type: "key", midi: 69 }, tl, opts); // ismételt: nincs hatás
  assert.deepEqual(r.effects, []);
  r = core.sessionReduce(r.session, { type: "key", midi: 54 }, tl, opts);
  r = core.sessionReduce(r.session, { type: "key", midi: 61 }, tl, opts);
  assert.equal(r.session.stepIndex, 0);
  r = core.sessionReduce(r.session, { type: "key", midi: 66 }, tl, opts);
  assert.equal(r.session.stepIndex, 1);
  assert.deepEqual(r.effects.map((e) => e.type), ["ok", "stepDone", "barClean"]);
});

test("gyakorlás: hibátlan ütem és a dal vége", () => {
  const tl = core.buildTimeline(song("orom"), { mode: "melody", hands: "right" });
  const opts = { autoAdvance: true };
  let s = core.sessionInit(0);
  const all = [];
  while (!s.finished) {
    const r = pressAll(s, tl, opts);
    s = r.session;
    all.push(...r.effects);
  }
  assert.deepEqual(s.cleanBars, Array.from({ length: 16 }, (_, i) => i));
  assert.equal(all.filter((e) => e.type === "barClean").length, 16);
  assert.equal(all.at(-1).type, "finished");
  // a befejezett állapot nem változik tovább
  assert.equal(core.sessionReduce(s, { type: "next" }, tl, opts).session, s);
});

test("gyakorlás: kihagyott vagy hibás ütem nem számít hibátlannak", () => {
  const tl = core.buildTimeline(song("orom"), { mode: "melody", hands: "right" });
  const opts = { autoAdvance: false };
  let s = core.sessionInit(0);
  for (let i = 0; i < 4; i++) s = core.sessionReduce(s, { type: "next" }, tl, opts).session; // 1. ütem kihagyva
  assert.equal(s.stepIndex, 4);
  assert.deepEqual(s.cleanBars, []);
  s = core.sessionReduce(s, { type: "key", midi: 60 }, tl, opts).session; // hiba a 2. ütemben
  for (let i = 0; i < 4; i++) {
    s = pressAll(s, tl, opts).session;
    s = core.sessionReduce(s, { type: "next" }, tl, opts).session;
  }
  assert.deepEqual(s.cleanBars, []);
  // ütem közepéről indulva sem hibátlan
  let mid = core.sessionInit(1);
  for (let i = 0; i < 3; i++) mid = core.sessionReduce(pressAll(mid, tl, opts).session, { type: "next" }, tl, opts).session;
  assert.deepEqual(mid.cleanBars, []);
});

test("magyar számrag", () => {
  const cases = { 40: "40-es", 50: "50-es", 60: "60-as", 65: "65-ös", 66: "66-os", 70: "70-es", 80: "80-as", 90: "90-es", 100: "100-as", 110: "110-es", 120: "120-as", 73: "73-as" };
  for (const [n, want] of Object.entries(cases)) assert.equal(core.numberAdjective(Number(n)), want);
});

test("javaslat: fokozatos haladás", () => {
  const base = { cleanBars: 16, totalBars: 16, hands: "right", practice: false, tempo: 60, songIndex: 0, songCount: 3 };
  assert.equal(core.suggestNext(base).action.kind, "practice");
  assert.deepEqual(core.suggestNext({ ...base, practice: true }).action, { kind: "hands", value: "left" });
  assert.deepEqual(core.suggestNext({ ...base, practice: true, hands: "left" }).action, { kind: "hands", value: "both" });
  const t = core.suggestNext({ ...base, practice: true, hands: "both" });
  assert.deepEqual(t.action, { kind: "tempo", value: 70 });
  assert.equal(t.text, "Próbáld 70-es tempón.");
  assert.deepEqual(core.suggestNext({ ...base, practice: true, hands: "both", tempo: 120 }).action, { kind: "song", index: 1 });
  assert.equal(core.suggestNext({ ...base, practice: true, hands: "both", tempo: 120, songIndex: 2 }).action, null);
  assert.deepEqual(core.suggestNext({ ...base, cleanBars: 10 }).action, { kind: "tempo", value: 50 });
  assert.equal(core.suggestNext({ ...base, cleanBars: 10, tempo: 50 }).action.kind, "retry");
});

test("gyerekdalok: egy oktávon (C4–C5) elférnek, csak jobb kéz", () => {
  for (const s of kidSongs) {
    assert.deepEqual(core.kidsRange(s), { low: 60, high: 72 }, s.title);
    assert.deepEqual(core.availableModes(s), ["melody"], s.title);
    assert.equal(s.modes.melody.left, undefined, s.title);
    assert.ok(s.picture, s.title);
  }
});

test("gyerekdalok: a Hot Cross Buns csak 3 hangot használ", () => {
  const tl = core.buildTimeline(song("buns"), { mode: "melody", hands: "right" });
  assert.deepEqual([...new Set(tl.events.map((e) => e.name))].sort(), ["C", "D", "E"]);
});

test("Boci, boci tarka: dallam és szótagok párban", () => {
  const tl = core.buildTimeline(song("boci"), { mode: "melody", hands: "right" });
  assert.equal(tl.barCount, 8);
  assert.equal(tl.bpb, 2);
  const line = (from, to) => tl.steps.filter((s) => s.bar >= from && s.bar <= to).map((s) => s.notes[0]);
  assert.deepEqual(line(0, 1).map((n) => n.name).join(" "), "C E C E G G");
  assert.deepEqual(line(4, 5).map((n) => n.name).join(" "), "C H A G F A");
  assert.deepEqual(line(6, 7).map((n) => n.name).join(" "), "G F E D C C");
  assert.deepEqual(line(0, 1).map((n) => n.lyric), ["Bo-", "ci", "bo-", "ci", "tar-", "ka,"]);
  assert.equal(line(7, 7).at(-1).lyric, "ni.");
});

test("Twinkle: 12 ütem, a vége C", () => {
  const tl = core.buildTimeline(song("star"), { mode: "melody", hands: "right" });
  assert.equal(tl.barCount, 12);
  assert.equal(tl.steps.at(-1).notes[0].pitch.spelling, "C4");
});

test("hibás szótagszám kiderül", () => {
  const broken = {
    id: "y", title: "Rossz szöveg", kids: true, meter: [2, 4],
    modes: { melody: { right: ["C4 D4"], lyrics: ["egy"] } },
  };
  const errors = core.validateSong(broken);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /1\. ütem 1 szótag, de 2 hang/);
});
