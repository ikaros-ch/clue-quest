// CLUE Quest Picture Maker: photo / GIF -> CircuitPython code for the CLUE's 240x240 screen.
// Limits measured on a real CLUE (CircuitPython 10.3.1): code.py over ~45 KB of picture data
// runs out of memory, and the screen redraws fully about 3 times per second.
const EL = document.documentElement.lang === "el";
const T = EL ? {
  pick: "Διάλεξε μια φωτογραφία ή ένα GIF για να ξεκινήσεις.", loading: "Φόρτωση…", frames: n => `${n} καρέ`,
  ok: "Χωράει στο CLUE! 🎉", tooBig: "Πολύ μεγάλο για το CLUE. Δοκίμασε λιγότερα χρώματα, μικρότερο μέγεθος, λιγότερα καρέ ή κλείσε το dithering (ή πάτα «Αυτόματο ταίριασμα»).",
  tight: "Χωράει οριακά. Αν πάρεις MemoryError, μίκρυνέ το λίγο.",
  fileOk: "Η καλύτερη ποιότητα! Πάτα «Αποθήκευση στο CLUE» (ή κατέβασε το .zip και αντέγραψε τα αρχεία στο CIRCUITPY).",
  fileAnim: fps => `Η καλύτερη ποιότητα, αλλά κάθε καρέ διαβάζεται από τον δίσκο, οπότε παίζει σαν slideshow (περίπου ${String(fps).replace(".", ",")} καρέ το δευτερόλεπτο).`,
  flashFull: "Πάρα πολλά αρχεία για τον δίσκο του CLUE (έχει περίπου 1,9 MB ελεύθερα). Διάλεξε λιγότερα καρέ ή μικρότερο μέγεθος.",
  saved: n => `Αποθηκεύτηκαν ${n} αρχεία στο CLUE! Κάνει επανεκκίνηση μόνο του. 🎉`,
  notClue: "Αυτός ο φάκελος δεν είναι ο δίσκος CIRCUITPY (δεν έχει boot_out.txt). Δεν αποθηκεύτηκε τίποτα.",
  noSave: "Ο browser σου δεν μπορεί να αποθηκεύσει κατευθείαν σε δίσκο. Χρησιμοποίησε το «Κατέβασμα .zip».",
  lblCode: "Μέγεθος code.py", lblDrive: "Αρχεία στον δίσκο", lblRam: "Μνήμη CLUE",
  c_frames: "κάθε αρχείο .bmp στον φάκελο /frames είναι ένα καρέ",
  c_lazy: "ανοίγουμε ένα καρέ τη φορά, για να μη γεμίσει η μνήμη",
  copied: "Αντιγράφηκε!", autoFail: "Δεν βρέθηκε ρύθμιση που να χωράει. Δοκίμασε λιγότερα καρέ.",
  noCam: "Δεν βρέθηκε κάμερα ή δεν δόθηκε άδεια.",
  c_head: "Φτιαγμένο με το CLUE Quest Picture Maker", c_pal: "τα χρώματα της εικόνας (0xRRGGBB)",
  c_data: "τα pixel, συμπιεσμένα σε λωρίδες των", c_rows: "γραμμών",
  c_build: "ξεπακετάρουμε κάθε λωρίδα μέσα σε ένα Bitmap", c_show: "δείξε την εικόνα, μεγεθυμένη SCALE φορές",
  c_anim: "άλλαξε καρέ για πάντα", c_still: "κράτα την εικόνα στην οθόνη", c_delay: "δευτερόλεπτα ανά καρέ",
  c_file: "διαβάζει την εικόνα από το αρχείο /picture.bmp στο CLUE",
} : {
  pick: "Choose a photo or a GIF to start.", loading: "Loading…", frames: n => `${n} frames`,
  ok: "Fits on the CLUE! 🎉", tooBig: "Too big for the CLUE. Try fewer colors, a smaller size, fewer frames or turn off dithering (or press “Auto-fit”).",
  tight: "Just fits. If you get a MemoryError, shrink it a little.",
  fileOk: "Best quality! Press “Save to CLUE” (or download the .zip and copy the files onto CIRCUITPY).",
  fileAnim: fps => `Best quality, but every frame is read from the drive, so it plays like a slideshow (about ${fps} ${fps === 1 ? "frame" : "frames"} per second).`,
  flashFull: "Too many files for the CLUE's drive (it has about 1.9 MB free). Use fewer frames or a smaller size.",
  saved: n => `Saved ${n} files to the CLUE! It restarts by itself. 🎉`,
  notClue: "That folder isn't the CIRCUITPY drive (there's no boot_out.txt). Nothing was saved.",
  noSave: "Your browser can't save straight to a drive. Use “Download .zip” instead.",
  lblCode: "code.py size", lblDrive: "Files on drive", lblRam: "CLUE memory",
  c_frames: "every .bmp file in the /frames folder is one frame",
  c_lazy: "open one frame at a time so memory never fills up",
  copied: "Copied!", autoFail: "Couldn't find a setting that fits. Try fewer frames.",
  noCam: "No camera found, or permission was denied.",
  c_head: "Made with the CLUE Quest Picture Maker", c_pal: "the picture's colors (0xRRGGBB)",
  c_data: "the pixels, squeezed in strips of", c_rows: "rows",
  c_build: "unpack every strip into a Bitmap", c_show: "show it, blown up SCALE times",
  c_anim: "flip through the frames forever", c_still: "keep the picture on screen", c_delay: "seconds per frame",
  c_file: "reads the picture from the file /picture.bmp on the CLUE",
};

const CODE_LIMIT = 38000;   // bytes of code.py (tested: ~45 KB worked, ~60 KB crashed)
const RAM_LIMIT = 60000;    // bytes of bitmaps kept in memory, see screen.html#memory
const FLASH_LIMIT = 1800000; // bytes of files on CIRCUITPY (a fresh CLUE has ~1.9 MB free)
const FILE_FPS = { 240: 0.9, 120: 0.9, 80: 0.9, 60: 0.9 };  // frames/s reading each frame from the drive (measured on a CLUE)
const BAND = 16;            // rows per compressed strip, keeps unpacking memory small
const $ = s => document.querySelector(s);

let source = [];            // [{img: ImageBitmap, delay: seconds}]
let out = null;             // last result {code, files, ...}
let busy = 0;

// ---------- loading ----------
async function loadFile(file) {
  if (!file) return;
  setStatus(T.loading, "");
  source = [];
  if (file.type === "image/gif" && "ImageDecoder" in window) {
    const dec = new ImageDecoder({ data: await file.arrayBuffer(), type: "image/gif" });
    await dec.tracks.ready;
    const n = Math.min(dec.tracks.selectedTrack.frameCount, 120);
    for (let i = 0; i < n; i++) {
      const { image } = await dec.decode({ frameIndex: i });
      source.push({ img: await createImageBitmap(image), delay: (image.duration || 1e5) / 1e6 });
      image.close();
    }
  } else {
    source.push({ img: await createImageBitmap(file), delay: 0.1 });
  }
  const max = Math.min(source.length, 30);
  $("#frames").max = max;
  $("#frames").value = Math.min(+$("#frames").value || 8, max);
  $("#frameRow").hidden = source.length < 2;
  $("#srcInfo").textContent = `${source[0].img.width} × ${source[0].img.height}` + (source.length > 1 ? ` · ${T.frames(source.length)}` : "");
  await update();
  if (out && !fits(out)) autoFit();   // a fresh picture that's too big: fix it straight away
}

// ---------- image processing ----------
function fitFrame(img, W, fit, bg) {
  const c = new OffscreenCanvas(W, W), g = c.getContext("2d");
  g.imageSmoothingQuality = "high";
  g.fillStyle = bg; g.fillRect(0, 0, W, W);
  const iw = img.width, ih = img.height;
  if (fit === "stretch") g.drawImage(img, 0, 0, W, W);
  else {
    const s = fit === "fill" ? Math.max(W / iw, W / ih) : Math.min(W / iw, W / ih);
    g.drawImage(img, (W - iw * s) / 2, (W - ih * s) / 2, iw * s, ih * s);
  }
  return g.getImageData(0, 0, W, W).data;
}

const dist = (p, r, g, b) => { const dr = (p >> 16) - r, dg = ((p >> 8) & 255) - g, db = (p & 255) - b; return 2 * dr * dr + 4 * dg * dg + 3 * db * db; };
function nearest(pal, r, g, b) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < pal.length; i++) { const d = dist(pal[i], r, g, b); if (d < bd) { bd = d; best = i; } }
  return best;
}

// median cut on a sample of pixels, then a few k-means rounds to polish
function buildPalette(frames, k) {
  const sample = [];
  const total = frames.length * frames[0].length / 4, step = Math.max(1, Math.floor(total / 30000));
  let n = 0;
  for (const d of frames) for (let i = 0; i < d.length; i += 4, n++) if (n % step === 0) sample.push((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
  const uniq = [...new Set(sample)];
  if (uniq.length <= k) return uniq;
  const ch = (c, s) => (c >> s) & 255;
  let boxes = [sample];
  while (boxes.length < k) {
    let bi = -1, bs = 0, bshift = 0;
    boxes.forEach((b, i) => {
      if (b.length < 2) return;
      for (const s of [16, 8, 0]) {
        let lo = 255, hi = 0;
        for (const c of b) { const v = ch(c, s); if (v < lo) lo = v; if (v > hi) hi = v; }
        const score = (hi - lo) * Math.sqrt(b.length);
        if (score > bs) { bs = score; bi = i; bshift = s; }
      }
    });
    if (bi < 0) break;
    const b = boxes[bi].sort((x, y) => ch(x, bshift) - ch(y, bshift)), m = b.length >> 1;
    boxes.splice(bi, 1, b.slice(0, m), b.slice(m));
  }
  let pal = boxes.map(avg);
  for (let round = 0; round < 3; round++) {
    const acc = pal.map(() => [0, 0, 0, 0]);
    for (const c of sample) { const a = acc[nearest(pal, c >> 16, (c >> 8) & 255, c & 255)]; a[0] += c >> 16; a[1] += (c >> 8) & 255; a[2] += c & 255; a[3]++; }
    pal = pal.map((p, i) => acc[i][3] ? (Math.round(acc[i][0] / acc[i][3]) << 16) | (Math.round(acc[i][1] / acc[i][3]) << 8) | Math.round(acc[i][2] / acc[i][3]) : p);
  }
  return [...new Set(pal)];
  function avg(b) { let r = 0, g = 0, bl = 0; for (const c of b) { r += c >> 16; g += (c >> 8) & 255; bl += c & 255; } const l = b.length; return (Math.round(r / l) << 16) | (Math.round(g / l) << 8) | Math.round(bl / l); }
}

// map RGBA pixels to palette indices, optional Floyd-Steinberg dithering
function toIndices(d, W, pal, dither) {
  const out = new Uint8Array(W * W), cache = new Map();
  const err = dither ? new Float32Array(W * W * 3) : null;
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const p = y * W + x;
    let r = d[p * 4], g = d[p * 4 + 1], b = d[p * 4 + 2];
    if (dither) { r = clamp(r + err[p * 3]); g = clamp(g + err[p * 3 + 1]); b = clamp(b + err[p * 3 + 2]); }
    const key = (r << 16) | (g << 8) | b;
    let i = cache.get(key);
    if (i === undefined) { i = nearest(pal, r, g, b); cache.set(key, i); }
    out[p] = i;
    if (dither) {
      const c = pal[i], er = r - (c >> 16), eg = g - ((c >> 8) & 255), eb = b - (c & 255);
      spread(x + 1, y, 7 / 16); spread(x - 1, y + 1, 3 / 16); spread(x, y + 1, 5 / 16); spread(x + 1, y + 1, 1 / 16);
      function spread(xx, yy, f) { if (xx < 0 || xx >= W || yy >= W) return; const q = (yy * W + xx) * 3; err[q] += er * f; err[q + 1] += eg * f; err[q + 2] += eb * f; }
    }
  }
  return out;
}
const clamp = v => v < 0 ? 0 : v > 255 ? 255 : Math.round(v);

// ---------- packing ----------
async function deflateB64(u8) {
  const buf = await new Response(new Blob([u8]).stream().pipeThrough(new CompressionStream("deflate"))).arrayBuffer();
  const b = new Uint8Array(buf); let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}
const hex = c => "0x" + c.toString(16).padStart(6, "0").toUpperCase();
const bitsFor = n => n <= 2 ? 1 : n <= 4 ? 2 : n <= 16 ? 4 : 8;
const ramFor = (W, n, frames) => frames * W * Math.ceil(W * bitsFor(n) / 32) * 4;

async function makeCode(W, pal, idxFrames, delay) {
  const scale = 240 / W, anim = idxFrames.length > 1;
  const frames = [];
  for (const f of idxFrames) {
    const bands = [];
    for (let y = 0; y < W; y += BAND) {
      const s = await deflateB64(f.subarray(y * W, Math.min(y + BAND, W) * W));
      const lines = s.match(/.{1,76}/g).map(l => `        "${l}"`);
      bands.push(lines.join("\n") + ",");
    }
    frames.push(`    (\n${bands.join("\n")}\n    ),`);
  }
  const palLines = [];
  for (let i = 0; i < pal.length; i += 8) palLines.push("    " + pal.slice(i, i + 8).map(hex).join(", ") + ",");
  return `# ${T.c_head}
import time
import board
import displayio
import bitmaptools
import zlib
import binascii

W = H = ${W}
SCALE = ${scale}
BAND = ${BAND}
DELAY = ${delay.toFixed(2)}  # ${T.c_delay}

# ${T.c_pal}
PALETTE = [
${palLines.join("\n")}
]

# ${T.c_data} ${BAND} ${T.c_rows}
FRAMES = (
${frames.join("\n")}
)

palette = displayio.Palette(len(PALETTE))
for i, color in enumerate(PALETTE):
    palette[i] = color

# ${T.c_build}
bitmaps = []
for frame in FRAMES:
    bitmap = displayio.Bitmap(W, H, len(PALETTE))
    for i, strip in enumerate(frame):
        y = i * BAND
        pixels = zlib.decompress(binascii.a2b_base64(strip))
        bitmaptools.arrayblit(bitmap, pixels, 0, y, W, min(y + BAND, H))
    bitmaps.append(bitmap)
del FRAMES

# ${T.c_show}
tile = displayio.TileGrid(bitmaps[0], pixel_shader=palette)
group = displayio.Group(scale=SCALE)
group.append(tile)
board.DISPLAY.root_group = group

` + (anim ? `while True:  # ${T.c_anim}
    for bitmap in bitmaps:
        tile.bitmap = bitmap
        time.sleep(DELAY)
` : `while True:  # ${T.c_still}
    time.sleep(1)
`);
}

function makeFileCode(W, anim, delay) {
  if (anim) return makeFramesCode(W, delay);
  return `# ${T.c_head}
import time
import board
import displayio

# ${T.c_file}
picture = displayio.OnDiskBitmap("/picture.bmp")
tile = displayio.TileGrid(picture, pixel_shader=picture.pixel_shader)
group = displayio.Group(scale=${240 / W})
group.append(tile)
board.DISPLAY.root_group = group

while True:
    time.sleep(1)
`;
}

function makeFramesCode(W, delay) {
  return `# ${T.c_head}
import os
import time
import board
import displayio

DELAY = ${delay.toFixed(2)}  # ${T.c_delay}

# ${T.c_frames}
names = sorted(n for n in os.listdir("/frames") if n.endswith(".bmp"))
first = displayio.OnDiskBitmap("/frames/" + names[0])

tile = displayio.TileGrid(first, pixel_shader=first.pixel_shader)
group = displayio.Group(scale=${240 / W})
group.append(tile)
board.DISPLAY.root_group = group

while True:  # ${T.c_anim}
    for name in names:
        frame = displayio.OnDiskBitmap("/frames/" + name)  # ${T.c_lazy}
        tile.bitmap = frame
        tile.pixel_shader = frame.pixel_shader
        time.sleep(DELAY)
`;
}

// 8-bit indexed BMP, rows bottom-up and padded to 4 bytes (what OnDiskBitmap reads)
function makeBmp(W, pal, idx) {
  const row = (W + 3) & ~3, img = row * W, off = 14 + 40 + 1024;
  const buf = new ArrayBuffer(off + img), v = new DataView(buf), u = new Uint8Array(buf);
  u[0] = 66; u[1] = 77; v.setUint32(2, off + img, true); v.setUint32(10, off, true);
  v.setUint32(14, 40, true); v.setInt32(18, W, true); v.setInt32(22, W, true); v.setUint16(26, 1, true); v.setUint16(28, 8, true);
  v.setUint32(34, img, true); v.setInt32(38, 2835, true); v.setInt32(42, 2835, true); v.setUint32(46, 256, true);
  pal.forEach((c, i) => { u[54 + i * 4] = c & 255; u[55 + i * 4] = (c >> 8) & 255; u[56 + i * 4] = c >> 16; });
  for (let y = 0; y < W; y++) u.set(idx.subarray(y * W, y * W + W), off + (W - 1 - y) * row);
  return new Blob([buf], { type: "image/bmp" });
}

// ---------- main ----------
function settings() {
  return { W: +$("#size").value, colors: +$("#colors").value, fit: $("#fit").value, bg: $("#bg").value,
    dither: $("#dither").checked, frames: source.length > 1 ? +$("#frames").value : 1, mode: $("input[name=mode]:checked").value };
}

async function build(s) {
  const n = Math.min(s.frames, source.length);
  const picks = Array.from({ length: n }, (_, i) => source[Math.floor(i * source.length / n)]);
  const rgba = picks.map(p => fitFrame(p.img, s.W, s.fit, s.bg));
  const pal = buildPalette(rgba, s.mode === "file" ? Math.min(s.colors, 256) : s.colors);
  const idx = rgba.map(d => toIndices(d, s.W, pal, s.dither));
  const totalDur = source.reduce((t, f) => t + f.delay, 0);
  const delay = n > 1 ? Math.max(0.05, totalDur / n) : 0.1;
  if (s.mode === "file") {
    const code = makeFileCode(s.W, n > 1, delay);
    const files = idx.map((f, i) => ({ path: n > 1 ? `frames/frame${String(i).padStart(2, "0")}.bmp` : "picture.bmp", blob: makeBmp(s.W, pal, f) }));
    return { s, pal, idx, delay, code, files, size: files.reduce((t, f) => t + f.blob.size, 0) + code.length, ram: 0 };
  }
  const code = await makeCode(s.W, pal, idx, delay);
  return { s, pal, idx, delay, code, size: new Blob([code]).size, ram: ramFor(s.W, pal.length, n) };
}

const fits = o => o.s.mode === "file" ? o.size <= FLASH_LIMIT : o.size <= CODE_LIMIT && o.ram <= RAM_LIMIT;

async function update() {
  if (!source.length) return;
  const my = ++busy;
  const o = await build(settings());
  if (my !== busy) return;   // a newer update started meanwhile
  out = o;
  show(o);
}

function show(o) {
  $("#code").value = o.code;
  const file = o.s.mode === "file";
  $("#zipBtn").hidden = !file;
  const pct = (v, lim) => Math.min(100, Math.round(v / lim * 100));
  const lim = file ? FLASH_LIMIT : CODE_LIMIT;
  $("#sizeLbl").textContent = file ? T.lblDrive : T.lblCode;
  $("#ramLbl").textContent = T.lblRam;
  $("#sizeBar").style.width = pct(o.size, lim) + "%";
  $("#ramBar").style.width = file ? "5%" : pct(o.ram, RAM_LIMIT) + "%";
  $("#sizeTxt").textContent = `${(o.size / 1024).toFixed(1)} KB / ${lim / 1000} KB`;
  $("#ramTxt").textContent = file ? "–" : `${(o.ram / 1024).toFixed(1)} KB / ${RAM_LIMIT / 1000} KB`;
  $("#palInfo").textContent = `${o.pal.length}`;
  if (file) setStatus(!fits(o) ? T.flashFull : o.idx.length > 1 ? T.fileAnim(FILE_FPS[o.s.W]) : T.fileOk, fits(o) ? "ok" : "bad");
  else if (!fits(o)) setStatus(T.tooBig, "bad");
  else if (o.size > CODE_LIMIT * 0.85 || o.ram > RAM_LIMIT * 0.85) setStatus(T.tight, "warn");
  else setStatus(T.ok, "ok");
  animate(o);
}

let timer = 0;
function animate(o) {
  clearTimeout(timer);
  const cv = $("#preview"), g = cv.getContext("2d"), W = o.s.W;
  const small = new OffscreenCanvas(W, W), sg = small.getContext("2d"), im = sg.createImageData(W, W);
  // show colors the way the screen really shows them: RGB565 (5 bits red, 6 green, 5 blue)
  const p565 = o.pal.map(c => [(c >> 16) & 0xF8, (c >> 8) & 0xFC, c & 0xF8]);
  let f = 0;
  (function tick() {
    const idx = o.idx[f % o.idx.length];
    for (let i = 0; i < idx.length; i++) { const c = p565[idx[i]]; im.data[i * 4] = c[0]; im.data[i * 4 + 1] = c[1]; im.data[i * 4 + 2] = c[2]; im.data[i * 4 + 3] = 255; }
    sg.putImageData(im, 0, 0);
    g.imageSmoothingEnabled = false;
    g.drawImage(small, 0, 0, cv.width, cv.height);
    f++;
    const fastest = o.s.mode === "file" ? 1 / FILE_FPS[W] : 1 / 3;  // ~3 full redraws/s from memory, slower from the drive
    if (o.idx.length > 1) timer = setTimeout(tick, Math.max(o.delay, fastest) * 1000);
  })();
}

function setStatus(msg, cls) { const el = $("#status"); el.textContent = msg; el.className = "status " + cls; }

async function autoFit() {
  if (!source.length) return;
  const s = settings();
  if (s.mode === "file") return;
  const btn = $("#autoBtn"); btn.disabled = true; setStatus(T.loading, "");
  try { await tryAll(s); } finally { btn.disabled = false; }
}

async function tryAll(s) {
  const sizes = [240, 120, 80, 60].filter(w => w <= s.W), colorSteps = [256, 128, 64, 32, 16, 8, 4, 2].filter(c => c <= s.colors);
  // first try to keep 16+ colors at any size, only then drop below 16
  const tries = [];
  for (const few of [false, true]) for (const W of sizes) for (const colors of colorSteps.filter(c => few ? c < 16 : c >= 16)) tries.push([W, colors]);
  for (const [W, colors] of tries) for (const dither of s.dither ? [true, false] : [false]) {
    const o = await build({ ...s, W, colors, dither });
    if (fits(o) && o.size <= CODE_LIMIT * 0.9) {
      $("#size").value = W; $("#colors").value = colors; $("#dither").checked = dither; syncLabels();
      out = o; show(o); return;
    }
  }
  setStatus(T.autoFail, "bad");
}

function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function syncLabels() { $("#colorsVal").textContent = $("#colors").value; $("#framesVal").textContent = $("#frames").value; }

// ---------- saving ----------
// Writes straight onto the CIRCUITPY drive (Chrome/Edge). code.py goes last so the CLUE restarts with everything in place.
async function saveToClue() {
  if (!out) return;
  if (!window.showDirectoryPicker) return setStatus(T.noSave, "bad");
  let dir;
  try { dir = await showDirectoryPicker({ id: "circuitpy", mode: "readwrite" }); } catch { return; }  // cancelled
  try { await dir.getFileHandle("boot_out.txt"); } catch { return setStatus(T.notClue, "bad"); }
  const files = out.files || [];
  if (files.some(f => f.path.startsWith("frames/"))) {
    const fd = await dir.getDirectoryHandle("frames", { create: true });
    const old = [];
    for await (const name of fd.keys()) if (name.endsWith(".bmp")) old.push(name);
    for (const name of old) await fd.removeEntry(name);   // no leftover frames from a longer GIF
  }
  for (const f of [...files, { path: "code.py", blob: new Blob([out.code]) }]) {
    let d = dir;
    const parts = f.path.split("/");
    for (const part of parts.slice(0, -1)) d = await d.getDirectoryHandle(part, { create: true });
    const w = await (await d.getFileHandle(parts.at(-1), { create: true })).createWritable();
    await w.write(f.blob);
    await w.close();
  }
  setStatus(T.saved(files.length + 1), "ok");
}

// Minimal .zip: files are stored, not compressed (the CLUE needs plain BMPs anyway)
const CRC = Array.from({ length: 256 }, (_, n) => { for (let k = 0; k < 8; k++) n = n & 1 ? 0xEDB88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
function crc32(u) { let c = ~0; for (const b of u) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return ~c >>> 0; }
async function makeZip(files) {
  const parts = [], central = [];
  let offset = 0;
  for (const f of files) {
    const data = new Uint8Array(await f.blob.arrayBuffer()), name = new TextEncoder().encode(f.path), crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint32(14, crc, true);
    h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint32(16, crc, true);
    c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
    parts.push(h, name, data);
    central.push(c, name);
    offset += 30 + name.length + data.length;
  }
  const size = central.reduce((t, p) => t + p.byteLength, 0), end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, size, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end], { type: "application/zip" });
}

// ---------- camera ----------
let stream = null;
async function camera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
    $("#video").srcObject = stream; $("#camBox").hidden = false;
  } catch { setStatus(T.noCam, "bad"); }
}
async function snap() {
  const v = $("#video"), c = new OffscreenCanvas(v.videoWidth, v.videoHeight);
  c.getContext("2d").drawImage(v, 0, 0);
  stream.getTracks().forEach(t => t.stop()); $("#camBox").hidden = true;
  source = [{ img: await createImageBitmap(c), delay: 0.1 }];
  $("#frameRow").hidden = true; $("#srcInfo").textContent = `${c.width} × ${c.height}`;
  update();
}

// ---------- wiring ----------
$("#file").addEventListener("change", e => loadFile(e.target.files[0]));
const drop = $("#drop");
drop.addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("over"); });
drop.addEventListener("dragleave", () => drop.classList.remove("over"));
drop.addEventListener("drop", e => { e.preventDefault(); drop.classList.remove("over"); loadFile(e.dataTransfer.files[0]); });
document.querySelectorAll("#controls select, #controls input").forEach(el => el.addEventListener("input", () => { syncLabels(); update(); }));
$("#camBtn").addEventListener("click", camera);
$("#snapBtn").addEventListener("click", snap);
$("#autoBtn").addEventListener("click", autoFit);
$("#copyBtn").addEventListener("click", () => navigator.clipboard.writeText($("#code").value).then(() => {
  const b = $("#copyBtn"), t = b.textContent; b.textContent = T.copied; setTimeout(() => b.textContent = t, 1200);
}));
$("#dlBtn").addEventListener("click", () => out && download(new Blob([out.code], { type: "text/x-python" }), "code.py"));
$("#zipBtn").addEventListener("click", async () => out && out.files && download(await makeZip([...out.files, { path: "code.py", blob: new Blob([out.code]) }]), "clue-picture.zip"));
$("#saveBtn").addEventListener("click", saveToClue);
syncLabels();
setStatus(T.pick, "");
