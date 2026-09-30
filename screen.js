// Screen Lab widgets: coordinate explorer and RGB -> RGB565 color mixer.
const $ = s => document.querySelector(s);

// coordinate explorer: a 240x240 canvas, one canvas pixel = one CLUE pixel
const cc = $("#coordCanvas"), g = cc.getContext("2d");
function drawGrid(px, py) {
  g.fillStyle = "#1b1340"; g.fillRect(0, 0, 240, 240);
  g.fillStyle = "#ff4d4d88";
  for (let i = 0; i <= 240; i += 40) { g.fillRect(i, 0, 1, 240); g.fillRect(0, i, 240, 1); }
  g.fillStyle = "#ffd23f"; g.font = "bold 11px Nunito, sans-serif";
  g.fillText("(0, 0)", 3, 12); g.fillText("(239, 239)", 178, 235);
  if (px === undefined) return;
  g.fillStyle = "#22d3ee"; g.fillRect(px, 0, 1, 240); g.fillRect(0, py, 240, 1);
  g.fillStyle = "#ff4fa3"; g.fillRect(px - 2, py - 2, 5, 5);
}
function onMove(e) {
  const r = cc.getBoundingClientRect(), p = e.touches ? e.touches[0] : e;
  const x = Math.max(0, Math.min(239, Math.floor((p.clientX - r.left) / r.width * 240)));
  const y = Math.max(0, Math.min(239, Math.floor((p.clientY - r.top) / r.height * 240)));
  drawGrid(x, y);
  $("#cx").textContent = `x = ${x}, y = ${y}`;
  $("#sx").textContent = `x = ${x - 120}, y = ${120 - y}`;
  if (e.touches) e.preventDefault();
}
cc.addEventListener("mousemove", onMove);
cc.addEventListener("touchmove", onMove, { passive: false });
drawGrid();

// color mixer: shows the 24-bit color you ask for and the RGB565 color the screen really stores
function mix() {
  const r = +$("#mr").value, gr = +$("#mg").value, b = +$("#mb").value;
  const h = n => n.toString(16).padStart(2, "0").toUpperCase();
  $("#mTuple").textContent = `(${r}, ${gr}, ${b})`;
  $("#mHex").textContent = `0x${h(r)}${h(gr)}${h(b)}`;
  const r5 = r >> 3, g6 = gr >> 2, b5 = b >> 3;
  $("#m565").innerHTML = `<span style="color:#e11d48">${r5.toString(2).padStart(5, "0")}</span>` +
    `<span style="color:#16a34a">${g6.toString(2).padStart(6, "0")}</span>` +
    `<span style="color:#2563eb">${b5.toString(2).padStart(5, "0")}</span>`;
  $("#sw24").style.background = `rgb(${r},${gr},${b})`;
  // expand the 565 value back to 8 bits per channel, the way the screen displays it
  $("#sw16").style.background = `rgb(${(r5 << 3) | (r5 >> 2)},${(g6 << 2) | (g6 >> 4)},${(b5 << 3) | (b5 >> 2)})`;
}
["#mr", "#mg", "#mb"].forEach(id => $(id).addEventListener("input", mix));
mix();
