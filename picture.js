// CLUE Quest Picture Maker: photo / GIF -> CircuitPython code for the CLUE's 240x240 screen.
// Limits measured on a real CLUE (CircuitPython 10.3.1): code.py over ~45 KB of picture data
// runs out of memory, and the screen redraws fully about 3 times per second.
const EL = document.documentElement.lang === "el";
const T = EL ? {
  pick: "Διάλεξε μια φωτογραφία ή ένα GIF για να ξεκινήσεις.", loading: "Φόρτωση…", frames: n => `${n} καρέ`,
  ok: "Χωράει στο CLUE! 🎉", tooBig: "Πολύ μεγάλο για το CLUE. Δοκίμασε λιγότερα χρώματα, μικρότερο μέγεθος, λιγότερα καρέ ή κλείσε το dithering (ή πάτα «Αυτόματο ταίριασμα»).",
  tight: "Χωράει οριακά. Αν πάρεις MemoryError, μίκρυνέ το λίγο.",
  fileOk: "Η καλύτερη ποιότητα! Ανέβασε το picture.bmp στο CLUE και μετά βάλε τον κώδικα στο code.py.",
  fileGif: "Η λειτουργία αρχείου δείχνει μόνο το πρώτο καρέ. Για κίνηση, διάλεξε «Μόνο κώδικας».",
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
  fileOk: "Best quality! Upload picture.bmp to the CLUE, then put the code in code.py.",
  fileGif: "Picture-file mode shows only the first frame. For animation choose “Code only”.",
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
const BAND = 16;            // rows per compressed strip, keeps unpacking memory small
const $ = s => document.querySelector(s);

let source = [];            // [{img: ImageBitmap, delay: seconds}]
let out = null;             // last result {code, bmp, ...}
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

function makeFileCode(W) {
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
  const n = s.mode === "file" ? 1 : Math.min(s.frames, source.length);
  const picks = Array.from({ length: n }, (_, i) => source[Math.floor(i * source.length / n)]);
  const rgba = picks.map(p => fitFrame(p.img, s.W, s.fit, s.bg));
  const pal = buildPalette(rgba, s.mode === "file" ? Math.min(s.colors, 256) : s.colors);
  const idx = rgba.map(d => toIndices(d, s.W, pal, s.dither));
  const totalDur = source.reduce((t, f) => t + f.delay, 0);
  const delay = n > 1 ? Math.max(0.05, totalDur / n) : 0.1;
  if (s.mode === "file") {
    const code = makeFileCode(s.W);
    return { s, pal, idx, delay, code, bmp: makeBmp(s.W, pal, idx[0]), size: code.length, ram: 0 };
  }
  const code = await makeCode(s.W, pal, idx, delay);
  return { s, pal, idx, delay, code, size: new Blob([code]).size, ram: ramFor(s.W, pal.length, n) };
}

const fits = o => o.s.mode === "file" || (o.size <= CODE_LIMIT && o.ram <= RAM_LIMIT);

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
  $("#bmpBtn").hidden = !o.bmp;
  const pct = (v, lim) => Math.min(100, Math.round(v / lim * 100));
  $("#sizeBar").style.width = o.s.mode === "file" ? "5%" : pct(o.size, CODE_LIMIT) + "%";
  $("#ramBar").style.width = o.s.mode === "file" ? "5%" : pct(o.ram, RAM_LIMIT) + "%";
  $("#sizeTxt").textContent = `${(o.size / 1024).toFixed(1)} KB / ${CODE_LIMIT / 1000} KB`;
  $("#ramTxt").textContent = o.s.mode === "file" ? "–" : `${(o.ram / 1024).toFixed(1)} KB / ${RAM_LIMIT / 1000} KB`;
  $("#palInfo").textContent = `${o.pal.length}`;
  if (o.s.mode === "file") setStatus(source.length > 1 ? T.fileGif : T.fileOk, "ok");
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
    if (o.idx.length > 1) timer = setTimeout(tick, Math.max(o.delay, 1 / 3) * 1000);  // the CLUE manages ~3 full redraws/s
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
$("#bmpBtn").addEventListener("click", () => out && out.bmp && download(out.bmp, "picture.bmp"));
syncLabels();
setStatus(T.pick, "");
