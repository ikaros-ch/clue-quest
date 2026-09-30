const T = document.documentElement.lang === "el"
  ? { done: "✔ Έγινε! (πάτα για αναίρεση)", copy: "Αντιγραφή", copied: "Αντιγράφηκε!", lv: "Επ " }
  : { done: "✔ Done! (click to undo)", copy: "Copy", copied: "Copied!", lv: "Lv " };
const KEY = "clueQuestDone";
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
const save = d => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch {} };
const btns = [...document.querySelectorAll(".done-btn")];
const total = btns.reduce((s, b) => s + +b.dataset.xp, 0);

function render() {
  const done = load();
  let xp = 0;
  btns.forEach(b => {
    const on = done.includes(b.dataset.id);
    b.closest("section").classList.toggle("done", on);
    if (!b.dataset.label) b.dataset.label = b.textContent;
    b.textContent = on ? T.done : b.dataset.label;
    if (on) xp += +b.dataset.xp;
  });
  document.getElementById("xpText").textContent = xp + " XP";
  document.getElementById("xpFill").style.width = (xp / total * 100) + "%";
  document.getElementById("lvl").textContent = T.lv + (1 + Math.floor(done.length / 2));
  document.getElementById("trophy").hidden = done.length !== btns.length;
}

function burst(x, y) {
  for (let i = 0; i < 14; i++) {
    const s = document.createElement("span");
    s.className = "pop";
    s.textContent = ["⭐", "🎉", "✨", "💜", "⚡"][i % 5];
    s.style.left = x + "px"; s.style.top = y + "px";
    s.style.setProperty("--dx", (Math.random() * 240 - 120) + "px");
    s.style.setProperty("--dy", (Math.random() * -220 - 40) + "px");
    s.style.setProperty("--r", (Math.random() * 720 - 360) + "deg");
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 1000);
  }
}

btns.forEach(b => b.addEventListener("click", e => {
  let done = load();
  const id = b.dataset.id;
  if (done.includes(id)) done = done.filter(d => d !== id);
  else { done.push(id); burst(e.clientX, e.clientY); }
  save(done); render();
  if (done.length === btns.length) document.getElementById("trophy").scrollIntoView();
}));
document.getElementById("reset").addEventListener("click", () => { save([]); render(); });

// copy buttons on code blocks
document.querySelectorAll("pre").forEach(pre => {
  const wrap = document.createElement("div");
  wrap.className = "codewrap";
  pre.replaceWith(wrap); wrap.appendChild(pre);
  const c = document.createElement("button");
  c.className = "copy"; c.textContent = T.copy;
  c.onclick = () => navigator.clipboard.writeText(pre.innerText).then(() => {
    c.textContent = T.copied; setTimeout(() => c.textContent = T.copy, 1200);
  });
  wrap.appendChild(c);
});

render();
