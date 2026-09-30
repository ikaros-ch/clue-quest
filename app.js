const T = document.documentElement.lang === "el"
  ? { done: "✔ Έγινε! (πάτα για αναίρεση)", copy: "Αντιγραφή", copied: "Αντιγράφηκε!", lv: "Επ ", next: "Επόμενο ▶" }
  : { done: "✔ Done! (click to undo)", copy: "Copy", copied: "Copied!", lv: "Lv ", next: "Next ▶" };
const KEY = "clueQuestDone", TAB_KEY = "clueQuestTab";
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
const save = d => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch {} };
const btns = [...document.querySelectorAll(".done-btn")];
const total = btns.reduce((s, b) => s + +b.dataset.xp, 0);

// ---------- tabs: one level per tab (only on pages with a #tabs bar) ----------
const tabBar = document.getElementById("tabs");
const panels = tabBar ? [...document.querySelectorAll("main > section.card")] : [];
const trophy = document.getElementById("trophy");
const tabFor = {};
panels.forEach(p => {
  const b = document.createElement("button");
  b.type = "button"; b.className = "tab"; b.setAttribute("role", "tab"); b.setAttribute("aria-controls", p.id);
  const tag = p.querySelector(".tag").textContent;
  const emoji = p.querySelector("h2 .emoji")?.textContent || tag.match(/^[^\p{L}\p{N}\s]+/u)?.[0] || "⭐";
  b.innerHTML = `<span class="tab-emoji">${emoji}</span><span class="tab-name"></span>`;
  b.querySelector(".tab-name").textContent = tag.replace(/^[^\p{L}\p{N}]+/u, "");
  b.addEventListener("click", () => show(p.id, true));
  tabBar.appendChild(b);
  tabFor[p.id] = b;
  p.setAttribute("role", "tabpanel");
  const done = p.querySelector(".done-btn");
  if (done) {   // a Next button that appears once the level is complete
    const nx = document.createElement("button");
    nx.type = "button"; nx.className = "btn next-btn"; nx.textContent = T.next; nx.hidden = true;
    nx.addEventListener("click", () => show(nextOf(p.id), true));
    done.after(nx);
  }
});
const unlocked = () => btns.length > 0 && load().length === btns.length;
const available = () => panels.filter(p => p !== trophy || unlocked());
const nextOf = id => { const a = available(), i = a.findIndex(p => p.id === id); return a[Math.min(i + 1, a.length - 1)].id; };

function show(id, scroll) {
  if (!tabBar) return;
  if (!available().some(p => p.id === id)) id = panels[0].id;
  panels.forEach(p => { p.hidden = p.id !== id; tabFor[p.id].setAttribute("aria-selected", p.id === id); });
  tabBar.scrollTo({ left: tabFor[id].offsetLeft - tabBar.clientWidth / 2 + tabFor[id].offsetWidth / 2 });
  try { localStorage.setItem(TAB_KEY, id); } catch {}
  history.replaceState(null, "", "#" + id);
  if (scroll) toTabs();
}
// scroll so the tab bar sits right under the header and the level starts below it
const toTabs = () => scrollTo({ top: document.querySelector(".hero").getBoundingClientRect().bottom + parseFloat(getComputedStyle(tabBar).marginTop) + scrollY - document.querySelector(".topbar").offsetHeight });

// a #link opens the tab that holds it (from the menu, other pages or links inside the text)
function openHash() {
  const target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
  const panel = target && target.closest("main > section.card");
  if (!panel) return false;
  show(panel.id);
  if (target === panel) toTabs(); else target.scrollIntoView({ block: "start" });
  return true;
}
if (tabBar) {
  addEventListener("hashchange", openHash);
  if (!openHash()) { let saved = null; try { saved = localStorage.getItem(TAB_KEY); } catch {} show(saved || panels[0].id); }
  const bar = document.querySelector(".topbar");
  const setTop = () => { const r = document.documentElement.style; r.setProperty("--tb", bar.offsetHeight + "px"); r.setProperty("--tabsh", tabBar.offsetHeight + "px"); };
  setTop(); addEventListener("resize", setTop);
}

// ---------- XP ----------
function render() {
  if (!document.getElementById("xpText")) return;   // pages without the XP bar (Screen Lab)
  const done = load();
  let xp = 0;
  btns.forEach(b => {
    const on = done.includes(b.dataset.id);
    const sec = b.closest("section");
    sec.classList.toggle("done", on);
    if (!b.dataset.label) b.dataset.label = b.textContent;
    b.textContent = on ? T.done : b.dataset.label;
    if (on) xp += +b.dataset.xp;
    const nx = sec.querySelector(".next-btn");
    if (nx) nx.hidden = !on;
    if (tabFor[sec.id]) tabFor[sec.id].classList.toggle("tab-done", on);
  });
  document.getElementById("xpText").textContent = xp + " XP";
  document.getElementById("xpFill").style.width = (xp / total * 100) + "%";
  document.getElementById("lvl").textContent = T.lv + (1 + Math.floor(done.length / 2));
  if (tabBar) {
    tabFor.trophy.hidden = !unlocked();
    if (!unlocked() && !trophy.hidden) show("cheat");
  } else if (trophy) trophy.hidden = !unlocked();
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
  if (done.length === btns.length) tabBar ? show("trophy", true) : trophy?.scrollIntoView();
}));
document.getElementById("reset")?.addEventListener("click", () => { save([]); render(); });

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

// language switch keeps you on the tab/section you're reading
document.querySelector(".lang").addEventListener("click", e => {
  const here = tabBar ? panels.find(p => !p.hidden)
    : [...document.querySelectorAll("section[id]")].filter(s => !s.hidden && s.getBoundingClientRect().top < innerHeight / 3).pop();
  if (here) e.currentTarget.href = e.currentTarget.getAttribute("href") + "#" + here.id;
});
