# Zongoratanuló

Egyfájlos (`index.html`), külső függőség nélküli, mobilra optimalizált zongoratanuló webalkalmazás teljesen kezdőknek. Magyar felület és hangnevek (C, D, E, F, G, A, H; Cisz, Disz, Fisz, Gisz, B).

## Használat

1. Nyisd meg az `index.html`-t a telefon böngészőjében, majd **Megosztás → Hozzáadás a kezdőképernyőhöz**.
2. Kezdd az **Örömódával**, jobb kézzel, a **Következő** gombbal lépve.
3. Ha megy, kapcsold be a **Gyakorlást** (a dal megvárja a helyes billentyűt) és a metronómot 60-as tempón.
4. Utána bal kéz külön, majd mindkettő.
5. A River Flows in You és a Kalózok akkordmódjában az akkordváltásokat gyakorold; a dallamot easy piano kottából (pl. Musicnotes, Sheet Music Direct) tedd rá.

### Gyerekdalok (4 éves kortól)

A kezdőlap alján külön szekció: kotta és betűk nélkül is követhető, csak jobb kéz, egy oktáv (C4–C5).

- Minden hangnak saját színe van (C piros, D narancs, E sárga, F zöld, G türkiz, A lila, H rózsaszín), a billentyűkön is.
- Felül színes buborékok mutatják a következő hangokat (és ha van, a szótagot); a soron következő billentyű csillaggal világít.
- Jó billentyűre csillag repül és jön a következő hang; rossz billentyűre semmi piros, csak a helyes billentyű megmozdul.
- **Hallgasd meg** = a dal lejátszása, **Újra** = elölről; a végén „Ügyes vagy!” és csillag a dal kártyáján.

Dalok: Hot Cross Buns (3 hang), Boci, boci tarka, Mary Had a Little Lamb, Twinkle, Twinkle, Little Star. Új gyerekdal: `kids: true`, `picture`, és opcionálisan `lyrics` (lásd lent).

Vezérlés: **Lejátszás** = bemutató a tempón (1 ütem visszaszámlálással), **Következő** = egy lépés előre, **Újra** = elölről. A haladás (hibátlan ütemek) és a beállítások `localStorage`-ban maradnak meg.

iPhone-on a néma kapcsoló elnémíthatja a Web Audio hangot.

## Új dal felvétele

A dalok az `index.html` elején, a `<script id="songs">` blokk `SONGS` tömbjében vannak.

- Hang: `HANG[:HOSSZ][@UJJ]`, pl. `"E4"`, `"D4:8"`, `"G3:h@1"` (C4 = középső C, `#` = kereszt, `b` = bé; `B3` a felületen H).
- Hossz: `w` egész, `h.` pontozott fél, `h` fél, `q.` pontozott negyed, `q` negyed (alapértelmezés), `8` nyolcad.
- Dallammód: `modes.melody.right` / `left` ütemenként egy szöveg. Ujjszám a hangnál vagy a dal `fingers` táblájában.
- Gyerekdal: `kids: true`, `picture` (kártyakép), `modes.melody.right`, opcionálisan `lyrics` ütemenként szótagokkal (`"Bo- ci bo- ci"`); a szótagszám ütemenként egyezik a hangok számával, ezt a validáció ellenőrzi.
- Akkordmód: `modes.chords.harmony` (akkordok: jobb kéz hangjai alulról felfelé, ujjak, basszus) + `bars` (`"Fism"` vagy `"G:h C:h"`); `rhythm: "q"` negyedenként ismétel, `accentFirst` hangsúlyoz, `arpeggio` felbontást enged, `loop` ismétli a kört.

Az ütemhosszakat induláskor ellenőrzi a `validateSong`; hibás dal a konzolon jelez és kimarad. A billentyűzet tartománya automatikusan bővül, ha egy dal kilóg a C3–H4 tartományból.

## Felépítés

| Blokk | Tartalom |
| --- | --- |
| `<script id="songs">` | Dal-adatok |
| `<script id="core">` | Tiszta, DOM-mentes logika: hangértelmezés, idővonal (`buildTimeline`), gyakorló állapotgép (`sessionReduce`), javaslatok |
| `<script id="app-script">` | Felület: SVG kotta, billentyűzet, Web Audio hang, metronóm/bemutató ütemező, lapok, tárolás |

## Tesztek

```sh
node --test tests/*.test.mjs
```

A tesztek (Node 18+, függőség nélkül) az `index.html` `songs` és `core` blokkját futtatják: dal-adatok érvényessége, idővonal, gyakorló állapotgép, javaslatlogika.
