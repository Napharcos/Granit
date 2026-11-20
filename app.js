"use strict";

/* =====================================================================
 *  Granit – tiszta JS port (a korábbi Kotlin Compose HTML alkalmazásból)
 * ===================================================================== */

// ------------------------------------------------------------ konstansok
const INVITE_CODES = ["DGCOT", "KCP1J", "FMUZV", "NTAVO", "1ZHRL", "8GQMA"];

const COLORS = {
  ARROW: "#FF0000",
  ARROW_GLOW: "#FF66A1",
  BUBBLE_LINE: "#CCCCCCB2",
  CODE_BUBBLES: ["#ccffff", "#ccffcc", "#ccffff", "#ccffcc", "#ccffff", "#ccffcc"],
};

const LINK_COLOR = "rgb(103, 80, 164)";
const SCREENS = { MAIN: "MAIN", HOW: "HOW", REQUIREMENTS: "REQUIREMENTS", LICENSE: "LICENSE", LIBRARIES: "LIBRARIES" };

const COPY_SVG = '<svg class="cell-copy" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M9 18q-.825 0-1.412-.587T7 16V4q0-.825.588-1.412T9 2h9q.825 0 1.413.588T20 4v12q0 .825-.587 1.413T18 18zm0-2h9V4H9zm-4 6q-.825 0-1.412-.587T3 20V6h2v14h11v2zm4-6V4z"/></svg>';
const PERSON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#FF7034" d="M12 13c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zM12 14c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';
const CHECK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#4CAF50" stroke="gray" stroke-width="0.5"/><path fill="#fff" d="M10.6 16.6l7.05-7.05-1.4-1.4-5.65 5.65-2.85-2.85-1.4 1.4z"/></svg>';

// ------------------------------------------------------------ segédek
const texts = {};
const t = (key) => texts[key] ?? key;
const randomCode = () => INVITE_CODES[Math.floor(Math.random() * INVITE_CODES.length)];
const openUrl = (url) => window.open(url, "_blank");

/** Mini DOM-építő: h("div", {class, style, onclick}, ...gyerekek) */
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") el.className = v;
      else if (k === "style") el.style.cssText = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v);
    }
  }
  for (const c of kids.flat()) if (c != null) el.append(c);
  return el;
}

/** Megbízható, beégetett SVG-k beszúrása */
function svg(html) {
  const tpl = document.createElement("template");
  tpl.innerHTML = html.trim();
  return tpl.content.firstElementChild;
}

function observeSize(el, cb) {
  const o = new ResizeObserver(() => cb());
  o.observe(el);
  return o;
}

// ------------------------------------------------------------ állapot / toast
let toastEl, toastTimer = 0;

function copyToClipboard(text) {
  const done = () => showCopied();
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done, () => { fallbackCopy(text); done(); });
  } else {
    fallbackCopy(text);
    done();
  }
}

function fallbackCopy(text) {
  const ta = h("textarea", { style: "position:fixed;opacity:0;top:0;left:0" });
  ta.value = text;
  document.body.append(ta);
  ta.select();
  try { document.execCommand("copy"); } catch (_) { /* nincs mit tenni */ }
  ta.remove();
}

function showCopied() {
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 3000);
}

// ------------------------------------------------------------ RichText
/** A sablonban lévő helyőrzőket linkekre / véletlen kódra cseréli. */
function getWithUrlOrCode(template, replace, replaceUrl = false) {
  const out = [];
  let cur = 0;
  for (const [placeholder, value] of Object.entries(replace)) {
    const index = template.indexOf(placeholder, cur);
    if (index === -1) continue;
    out.push({ plain: template.substring(cur, index) });
    if (placeholder !== "[code]") {
      out.push({ text: replaceUrl ? value : placeholder, onClick: () => openUrl(value), color: LINK_COLOR });
    } else {
      const code = randomCode();
      out.push({ text: code, onClick: () => copyToClipboard(code), bold: true, size: 16, color: LINK_COLOR });
    }
    cur = index + placeholder.length;
  }
  out.push({ plain: template.substring(cur) });
  return out;
}

function richNodes(parts) {
  return parts.map((p) => {
    if (p.plain !== undefined) return document.createTextNode(p.plain);
    let style = "";
    if (p.bold) style += "font-weight:bold;";
    if (p.size) style += `font-size:${p.size}px;`;
    if (p.color) style += `color:${p.color};`;
    return h("span", { class: "rlink", style, onclick: p.onClick }, p.text);
  });
}

// ------------------------------------------------------------ canvas segéd
/** A szülőjét kitöltő canvas; méretváltozáskor újrarajzol (DPR-skálázással). */
function canvasLayer(draw) {
  const c = h("canvas", { class: "cv" });
  const redraw = () => {
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth, hh = c.clientHeight;
    if (w <= 0 || hh <= 0) return;
    c.width = (w * dpr) | 0;
    c.height = (hh * dpr) | 0;
    const ctx = c.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(ctx, w, hh);
  };
  observeSize(c, redraw);
  return c;
}

// ------------------------------------------------------------ felhő geometria
function cloudGeometry(r, w, h, withTail = false) {
  const pitch = r * 1.5;
  const cr = pitch * 2;
  const tailExtra = withTail ? r * 1.6 : 0;
  const bodyBottom = h - tailExtra;
  const left = r, top = r;
  const right = Math.max(w - r, left + 1);
  const bottom = Math.max(bodyBottom - r, top + 1);
  const nx = Math.max(2, Math.round((right - left - 2 * cr) / pitch));
  const ny = Math.max(3, Math.round((bottom - top - 2 * cr) / pitch));
  const px = Math.max(right - left - 2 * cr, 2 * pitch) / nx;
  const py = Math.max(bottom - top - 2 * cr, 3 * pitch) / ny;

  function bumps(cornerScale) {
    const list = [];
    for (let i = 0; i < nx; i++) {
      const x = left + cr + (i + 0.5) * px;
      list.push([x, top, 1], [x, bottom, 1]);
    }
    for (let i = 0; i < ny; i++) {
      const y = top + cr + (i + 0.5) * py;
      list.push([left, y, 1], [right, y, 1]);
    }
    const arc = (cx, cy, startDeg) => {
      for (let i = 0; i < 3; i++) {
        const a = ((startDeg + (90 * (i + 0.5)) / 3) * Math.PI) / 180;
        list.push([cx + cr * Math.cos(a), cy + cr * Math.sin(a), i === 1 ? cornerScale : 1]);
      }
    };
    arc(right - cr, top + cr, -90);
    arc(right - cr, bottom - cr, 0);
    arc(left + cr, bottom - cr, 90);
    arc(left + cr, top + cr, 180);
    return list;
  }
  return { left, top, right, bottom, cr, bumps };
}

/** Lekerekített téglalap + körök; azonos körüljárás -> a nonzero fill/clip az uniót adja. */
function cloudPath(ctx, g, r, cornerScale) {
  const PI = Math.PI;
  ctx.beginPath();
  ctx.moveTo(g.left + g.cr, g.top);
  ctx.lineTo(g.right - g.cr, g.top);
  ctx.arc(g.right - g.cr, g.top + g.cr, g.cr, -PI / 2, 0, false);
  ctx.lineTo(g.right, g.bottom - g.cr);
  ctx.arc(g.right - g.cr, g.bottom - g.cr, g.cr, 0, PI / 2, false);
  ctx.lineTo(g.left + g.cr, g.bottom);
  ctx.arc(g.left + g.cr, g.bottom - g.cr, g.cr, PI / 2, PI, false);
  ctx.lineTo(g.left, g.top + g.cr);
  ctx.arc(g.left + g.cr, g.top + g.cr, g.cr, PI, PI * 1.5, false);
  ctx.closePath();
  for (const [x, y, s] of g.bumps(cornerScale)) {
    const rr = r * s;
    ctx.moveTo(x + rr, y);
    ctx.arc(x, y, rr, 0, 2 * PI, false);
  }
}

/** Ellipszis + egyenletes ívhossz-osztású bodrok */
function ovalCloudPath(ctx, w, h, bumpPx) {
  const PI = Math.PI;
  const r = Math.max(Math.min(bumpPx, Math.min(w, h) * 0.28), 1);
  const cx = w / 2, cy = h / 2;
  const a = Math.max(w / 2 - r, 1);
  const b = Math.max(h / 2 - r, 1);

  const steps = 720;
  const cum = new Float64Array(steps + 1);
  let px = a, py = 0;
  for (let i = 1; i <= steps; i++) {
    const tt = (2 * PI * i) / steps;
    const x = a * Math.cos(tt), y = b * Math.sin(tt);
    cum[i] = cum[i - 1] + Math.sqrt((x - px) * (x - px) + (y - py) * (y - py));
    px = x; py = y;
  }
  const total = cum[steps];
  const count = Math.max(6, Math.round(total / (r * 1.5)));

  ctx.beginPath();
  ctx.moveTo(cx + a, cy);
  ctx.ellipse(cx, cy, a, b, 0, 0, 2 * PI, false);

  let idx = 0;
  for (let k = 0; k < count; k++) {
    const target = (total * k) / count;
    while (idx < steps - 1 && cum[idx + 1] < target) idx++;
    const seg = cum[idx + 1] - cum[idx];
    const frac = seg > 0 ? (target - cum[idx]) / seg : 0;
    const tt = (2 * PI * (idx + frac)) / steps;
    const x = cx + a * Math.cos(tt), y = cy + b * Math.sin(tt);
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, 2 * PI, false);
  }
}

function strokeThenFill(ctx, fill, line, bw) {
  ctx.lineJoin = "round";
  ctx.lineWidth = bw * 2;
  ctx.strokeStyle = line;
  ctx.stroke();
  ctx.fillStyle = fill;
  ctx.fill();
}

// ------------------------------------------------------------ rács-felhő rajzolás
function drawGrid(ctx, canvasW, canvasH, rows, r, bw, tail, lineColor, cellColors) {
  const PI = Math.PI;
  const W = canvasW - 2 * bw;
  const H = canvasH - 2 * bw;
  ctx.save();
  ctx.translate(bw, bw);

  const g = cloudGeometry(r, W, H);
  cloudPath(ctx, g, r, 1.3);
  strokeThenFill(ctx, "#3300FFFF", lineColor, bw);

  const bodyH = H - tail;
  const rowH = bodyH / rows;
  const cx = W / 2;
  const amp = r * 0.35;
  const halfWave = r * 1.5;
  const big = r * 4;

  const sampleY = (f) => { const l = []; for (let y = -big; y <= H + big; y += 2) l.push([f(y), y]); return l; };
  const sampleX = (f) => { const l = []; for (let x = -big; x <= W + big; x += 2) l.push([x, f(x)]); return l; };

  let m;
  if (rows === 3) {
    const n = Math.max(Math.round((bodyH / halfWave / 3 - 1) / 2), 0);
    m = 3 * (2 * n + 1);
  } else {
    m = 2 * Math.max(Math.round(bodyH / halfWave / 2), 1);
  }
  const vertical = sampleY((y) => cx + amp * Math.sin((PI * m * y) / bodyH));

  const lines = [];
  for (let i = 0; i < rows - 1; i++) {
    const y0 = rowH * (i + 1);
    const dir = i % 2 === 0 ? 1 : -1;
    lines.push(sampleX((x) => y0 + dir * amp * Math.sin((PI * (x - cx)) / halfWave)));
  }

  const leftCorners = [[-big, H + big], [-big, -big]];
  const rightCorners = [[W + big, H + big], [W + big, -big]];

  const band = (i) => {
    const upper = i === 0 ? [[-big, -big], [W + big, -big]] : lines[i - 1];
    const lower = i === rows - 1 ? [[W + big, H + big], [-big, H + big]] : lines[i].slice().reverse();
    return upper.concat(lower);
  };
  const poly = (...parts) => {
    ctx.beginPath();
    let first = true;
    for (const p of parts) for (const [x, y] of p) {
      if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
    }
    ctx.closePath();
  };
  const line = (pts) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  };

  // cellák: bal oszlop fentről le, majd a jobb
  let idx = 0;
  for (const side of [leftCorners, rightCorners]) {
    for (let b = 0; b < rows; b++) {
      ctx.save();
      cloudPath(ctx, g, r, 1.3); ctx.clip();
      poly(vertical, side); ctx.clip();
      poly(band(b)); ctx.clip();
      ctx.fillStyle = cellColors[idx] ?? "#3300FFFF";
      ctx.fillRect(-big, -big, W + 2 * big, H + 2 * big);
      ctx.restore();
      idx++;
    }
  }

  // vonalak a felhőn belül
  ctx.save();
  cloudPath(ctx, g, r, 1.3); ctx.clip();
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = bw;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  line(vertical); ctx.stroke();
  for (const l of lines) { line(l); ctx.stroke(); }
  ctx.restore();

  ctx.restore();
}

// ------------------------------------------------------------ nyíl
let arrowCounter = 0;

function animatedArrow(up, widthPx, heightPx, baseColor = COLORS.ARROW, glowColor = COLORS.ARROW_GLOW) {
  const id = "arrowGlow" + arrowCounter++;
  const y = (v) => (up ? v : 24 - v);
  const d = `M8 ${y(21)} L8 ${y(15)} L3 ${y(15)} L12 ${y(4)} L21 ${y(15)} L16 ${y(15)} L16 ${y(21)} Z`;
  const [y1, y2] = up ? ["31.68;8.16", "15.84;-7.68"] : ["8.16;31.68", "-7.68;15.84"];

  const el = svg(`
    <svg class="arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" preserveAspectRatio="none">
      <defs>
        <linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="${y1.split(";")[0]}" y2="${y2.split(";")[0]}">
          <stop offset="0" stop-color="${glowColor}" stop-opacity="0"/>
          <stop offset="0.25" stop-color="${glowColor}" stop-opacity="0.15"/>
          <stop offset="0.5" stop-color="${glowColor}" stop-opacity="1"/>
          <stop offset="0.75" stop-color="${glowColor}" stop-opacity="0.15"/>
          <stop offset="1" stop-color="${glowColor}" stop-opacity="0"/>
          <animate attributeName="y1" values="${y1}" dur="1.6s" repeatCount="indefinite"/>
          <animate attributeName="y2" values="${y2}" dur="1.6s" repeatCount="indefinite"/>
        </linearGradient>
      </defs>
      <path d="${d}" fill="${baseColor}"/>
      <path d="${d}" fill="url(#${id})"/>
    </svg>`);
  el.style.width = widthPx + "px";
  el.style.height = heightPx + "px";
  return el;
}

// ------------------------------------------------------------ hóesés
function newFlake(startAnywhere) {
  const depth = Math.random();
  return {
    x: Math.random(),
    y: startAnywhere ? Math.random() : -0.05,
    size: 3 + depth * 7,
    speed: 0.06 + depth * 0.10,
    sway: 8 + Math.random() * 16,
    swayFreq: 0.5 + Math.random(),
    phase: Math.random() * 6.28,
    rot: Math.random() * 360,
    rotSpeed: (Math.random() - 0.5) * 60,
    alpha: 0.55 + depth * 0.45,
    type: Math.floor(Math.random() * 3),
  };
}

function drawSnowflake(ctx, cx, cy, radius, rotDeg, type, color, stroke) {
  const PI = Math.PI;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = stroke;
  ctx.lineCap = "round";
  const seg = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };

  for (let i = 0; i < 6; i++) {
    const armAngle = ((rotDeg + i * 60 - 90) * PI) / 180;
    const dx = Math.cos(armAngle), dy = Math.sin(armAngle);
    ctx.lineWidth = stroke;
    seg(cx, cy, cx + dx * radius, cy + dy * radius);

    const branch = (at, len, spread = 40) => {
      const bx = cx + dx * radius * at, by = cy + dy * radius * at;
      ctx.lineWidth = stroke * 0.85;
      for (const s of [-1, 1]) {
        const a = armAngle + (spread * s * PI) / 180;
        seg(bx, by, bx + Math.cos(a) * radius * len, by + Math.sin(a) * radius * len);
      }
    };
    if (type === 0) branch(0.55, 0.35);
    else if (type === 1) { branch(0.4, 0.28); branch(0.7, 0.22); }
    else { branch(0.35, 0.3, 55); branch(0.65, 0.3, 35); }
  }
  ctx.beginPath();
  ctx.arc(cx, cy, stroke * 1.1, 0, 2 * PI, false);
  ctx.fill();
}

function createSnow() {
  const canvas = h("canvas", { class: "snow" });
  let flakes = [];
  let last = 0;

  function frame(now) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, hh = canvas.clientHeight;
    const pw = (w * dpr) | 0, ph = (hh * dpr) | 0;
    if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, hh);

    const dt = last === 0 ? 0 : (now - last) / 1000;
    last = now;
    const tt = now / 1000;

    for (const f of flakes) {
      f.y += f.speed * dt;
      f.rot += f.rotSpeed * dt;
      if (f.y > 1.05) { const n = newFlake(false); f.x = n.x; f.y = n.y; }
      const cx = f.x * w + Math.sin(tt * f.swayFreq + f.phase) * f.sway;
      const cy = f.y * hh;
      drawSnowflake(ctx, cx, cy, f.size, f.rot, f.type, `rgba(255,255,255,${f.alpha})`, Math.max(f.size * 0.14, 1));
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    canvas,
    setCount(n) {
      if (n === flakes.length) return;
      flakes = Array.from({ length: n }, () => newFlake(true));
    },
  };
}

// ------------------------------------------------------------ cím
function titleBar(text) {
  return h("div", { class: "title" },
    h("div", { class: "title-in" },
      h("div", { class: "title-l" }, animatedArrow(false, 40, 70)),
      h("div", { class: "title-text" }, text),
      h("div", { class: "title-r" }, animatedArrow(false, 40, 70))));
}

// ------------------------------------------------------------ buborékok
function gridBubble(leftItems, rightItems, rows, bumpRadius = 16, lineColor = COLORS.BUBBLE_LINE, bw = 1, cellColors = COLORS.CODE_BUBBLES) {
  const cell = (text) => h("div", { class: "cell", onclick: () => copyToClipboard(text) },
    h("div", { class: "cell-code" }, text),
    svg(COPY_SVG));

  const col = (items) => h("div", { class: "gb-col" }, items.slice(0, rows).map(cell));

  return h("div", { class: "gb", style: `min-height:${72 * rows + bumpRadius}px` },
    canvasLayer((ctx, w, hh) => drawGrid(ctx, w, hh, rows, bumpRadius, bw, bumpRadius, lineColor, cellColors)),
    h("div", { class: "gb-content", style: `bottom:${bumpRadius}px` }, col(leftItems), col(rightItems)));
}

function ovalBubble(width, height, text = null, bump = 12, fill = "#FFFFFF", line = "#D3D3D3", bw = 1) {
  const el = h("div", {
    class: "oval",
    style: `width:${width}px;height:${height}px;` + (text != null ? `padding:${bump}px ${bump * 2}px;` : ""),
  });
  el.append(canvasLayer((ctx, w, hh) => {
    ctx.save();
    ctx.translate(bw, bw);
    ovalCloudPath(ctx, w - 2 * bw, hh - 2 * bw, bump);
    strokeThenFill(ctx, fill, line, bw);
    ctx.fillStyle = "rgba(0,255,255,0.2)";
    ctx.fill();
    ctx.restore();
  }));
  if (text != null) {
    el.append(h("div", { class: "oval-in" },
      animatedArrow(true, 26, 30),
      h("div", { class: "oval-txt" }, text),
      animatedArrow(true, 26, 30)));
  }
  return el;
}

// ------------------------------------------------------------ kéz + kis buborékok
function friendArm() {
  const img = h("img", { class: "arm-img", src: "hands.webp", alt: "" });
  const bottom = h("div", { class: "arm-bottom" },
    h("div", { class: "arm-imgwrap" }, img, h("div", { class: "arm-bubble" }, ovalBubble(44, 22))));
  const small = h("div", { class: "arm-small" });
  const topIn = h("div", { class: "arm-topin" }, ovalBubble(250, 55, "Ajánló kódok"), small);
  const top = h("div", { class: "arm-top" }, topIn);
  const arm = h("div", { class: "arm" }, bottom, top);

  let sig = "";
  const update = () => {
    const place = arm.clientHeight - 6;
    const imgH = img.clientHeight;
    const space = Math.max(place - imgH, 0);

    img.style.maxHeight = Math.max(place - 55, 0) + "px";
    top.style.height = space + "px";
    small.style.height = Math.max(space - 55, 0) + "px";

    const s = space >= 170 ? "L" : space >= 90 ? "M" : "S";
    if (s !== sig) {
      sig = s;
      small.replaceChildren();
      if (s === "L") small.append(ovalBubble(90, 45), ovalBubble(60, 30));
      else if (s === "M") small.append(ovalBubble(60, 30));
    }
  };
  observeSize(arm, update);
  observeSize(img, update);
  img.addEventListener("load", update);
  return arm;
}

// ------------------------------------------------------------ főoldal
function mainScreen() {
  const span = (cls, txt) => h("span", { class: cls }, txt);
  return [
    h("div", { class: "promo" }, span("s", "AKÁR\u00A0"), span("b", "120 000 FT"), span("s", "\u00A0JÓVÁIRÁS")),
    h("div", { class: "main" },
      h("div", { class: "main-top" },
        titleBar(t("title")),
        h("div", { class: "main-grid" }, gridBubble(INVITE_CODES.slice(0, 3), INVITE_CODES.slice(-3), 3))),
      h("div", { class: "main-arm" }, friendArm())),
  ];
}

// ------------------------------------------------------------ kártyák
const cardPlain = (text) => ({ sub: false, parts: [{ plain: text }] });
const cardTxt = (key) => cardPlain(t(key));
const cardSub = (key) => ({ sub: true, parts: [{ plain: t(key) }] });
const cardLink = (key, replace) => ({ sub: false, parts: getWithUrlOrCode(t(key), replace) });

function contentCard(title, content) {
  return h("div", { class: "card" },
    h("div", { class: "card-body" },
      h("div", { class: "card-h" }, title),
      content.map((c) => c.sub
        ? h("div", { class: "card-sub" }, richNodes(c.parts))
        : h("div", null, " • ", richNodes(c.parts)))));
}

const titleCard = (title) => h("div", { class: "card card-title" }, h("div", null, title));
const cardColumn = (...kids) => h("div", { class: "cards" }, kids);

function licenseScreen() {
  const items = [1, 2, 3, 4, 5, 6].map((i) => cardTxt("license_text_" + i));
  return cardColumn(contentCard(t("license"), items));
}

// ------------------------------------------------------------ követelmények
function moreInfo(web, pdf) {
  return [
    cardSub("more_info"),
    cardLink("requirement_1_more_info_1", { "hivatalos weboldalra": web }),
    cardLink("requirement_1_more_info_2", { "hivatalos hirdetményt": pdf }),
  ];
}

const selfAccountLine = () => cardLink("requirement_1_text_1", {
  "szelfis számlanyitás": "https://granitbank.hu/szelfisszamlanyitas",
  "[code]": "",
});

function requirement1() {
  return [
    cardSub("main_requirements"),
    selfAccountLine(),
    cardTxt("requirement_1_text_2"),
    cardTxt("requirement_1_text_3"),
    cardSub("other_requirements"),
    ...[4, 5, 6, 7, 8, 9].map((i) => cardTxt("requirement_1_text_" + i)),
    cardSub("eligible_packages"),
    cardTxt("requirement_1_packages"),
    ...moreInfo(
      "https://granitbank.hu/lakossag/ugyfelajanlas",
      "https://granitbank.hu/api/cms/assets/CD515AD8-3E3C-450C-832A-79AAC1049CF2/HIRDETMENY_az_Ugyfelajanlasi_Programrol_20261106.pdf"),
  ];
}

function requirement2() {
  return [
    cardSub("main_requirements"),
    selfAccountLine(),
    cardTxt("requirement_2_text_2"), cardTxt("requirement_2_text_4"), cardTxt("requirement_2_text_5"),
    cardSub("requirement_2_packages_info_1"),
    cardTxt("requirement_2_packages_info_1_1"), cardTxt("requirement_2_packages_info_1_2"),
    cardTxt("requirement_2_packages_info_1_3"), cardTxt("requirement_2_packages_info_1_4"),
    cardSub("requirement_2_packages_info_2"),
    cardTxt("requirement_2_packages_info_1_1"),
    cardSub("other_requirements"),
    cardTxt("requirement_2_text_3"), cardTxt("requirement_2_text_6"),
    cardTxt("requirement_1_text_7"), cardTxt("requirement_1_text_8"), cardTxt("requirement_1_text_9"),
    cardSub("eligible_packages"),
    cardTxt("requirement_2_packages"),
    ...moreInfo(
      "https://granitbank.hu/szelfisszamlanyitas",
      "https://granitbank.hu/api/cms/assets/E4DB2538-E281-4454-AC13-A550DD69EB34/Hirdetmeny_szlanyitasi_akcio_20261106.pdf"),
  ];
}

function requirement3() {
  return [
    cardSub("main_requirements"),
    cardTxt("requirement_3_text_1"), cardTxt("requirement_3_text_2"), cardTxt("requirement_3_text_3"),
    ...moreInfo(
      "https://granitbank.hu/lakossag/megtakaritasok/ertekpapirok/rendszeres",
      "https://granitbank.hu/api/cms/assets/A2116AFB-B57A-45BD-82D5-BC56CB7797EE/HIRDETMENY_Rendszeres_megtakaritasi_akciorol_20261001-1231-ig.pdf?_rsc=gFv51BnMMK0R0v2K"),
  ];
}

function requirementsScreen() {
  return cardColumn(
    titleCard(t("button_3_text")),
    contentCard(t("requirement_1_title"), requirement1()),
    contentCard(t("requirement_2_title"), requirement2()),
    contentCard(t("requirement_3_title"), requirement3()));
}

// ------------------------------------------------------------ könyvtárak (lusta betöltés)
let librariesPromise = null;
const loadLibraries = () => (librariesPromise ??= fetch("aboutlibraries.json").then((r) => r.json()));

function librariesScreen(isStillCurrent) {
  const col = cardColumn(titleCard(t("libraries_title")));
  loadLibraries().then((data) => {
    if (!isStillCurrent()) return;
    for (const lib of data.libraries || []) {
      col.append(contentCard(lib.name, [
        cardPlain(t("library_version") + "\u00A0" + lib.artifactVersion),
        cardPlain(t("library_owner") + "\u00A0" + (lib.developers?.[0]?.name ?? "")),
        { sub: false, parts: getWithUrlOrCode(t("library_web"), { "[url]": lib.website }, true) },
        cardPlain(t("library_licence") + "\u00A0" + (lib.licenses?.[0] ?? "")),
      ]));
    }
  }).catch((e) => console.error("aboutlibraries.json", e));
  return col;
}

// ------------------------------------------------------------ "Hogyan" oldal
function stepLayout(icon, ...body) {
  return h("div", { class: "step" },
    h("div", { class: "step-icon" }, icon),
    h("div", { class: "step-body" }, body));
}

function firstStep() {
  const code = randomCode();
  const url = "https://granitbank.hu";
  return stepLayout(
    [svg(PERSON_SVG), h("div", { class: "step-frame" })],
    h("div", { class: "b18" }, t("step_1")),
    h("div", { class: "step-code", onclick: () => copyToClipboard(code) }, code),
    h("div", { class: "b18" }, t("step_1_1"), h("span", { class: "step-url", onclick: () => openUrl(url) }, url)));
}

function secondStep() {
  return stepLayout(svg(CHECK_SVG), h("div", { class: "b18" }, t("step_2")));
}

function thirdStep() {
  return stepLayout(
    h("div", { class: "step-icon-center" }, h("img", { src: "card.webp", alt: "" })),
    h("div", { class: "b18" }, t("step_3")),
    h("div", { class: "b18" }, t("step_3_1")),
    h("button", { class: "btn btn-primary", onclick: () => showScreen(SCREENS.REQUIREMENTS) }, t("button_3_text")));
}

// A telefonkeret referencia-mérete: a képernyő-terület koordinátái ehhez viszonyítva értendők.
// A phone.webp bármekkorára átméretezhető, ha az oldalarány (514:1005) megmarad.
const PHONE_REF = { w: 514, h: 1005, screen: { x: 23, y: 106, w: 467, h: 790 } };

function phoneBox(buildContent) {
  const { w, h: ph, screen: s } = PHONE_REF;
  const screen = h("div", {
    class: "phone-screen",
    style: `left:${(s.x / w) * 100}%;top:${(s.y / ph) * 100}%;width:${(s.w / w) * 100}%;height:${(s.h / ph) * 100}%`,
  }, buildContent());
  return h("div", { class: "phone" },
    h("img", { src: "phone.webp", alt: "", decoding: "async" }),
    screen);
}

function connectedFlowRow(builders) {
  const canvas = h("canvas");
  const row = h("div", { class: "flow" }, canvas, builders.map((b) => phoneBox(b)));

  function frame(now) {
    if (!row.isConnected) return;               // elhagytuk az oldalt -> leáll
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, hh = canvas.clientHeight;
    const pw = (w * dpr) | 0, ph = (hh * dpr) | 0;
    if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, hh);

    const pr = row.getBoundingClientRect();
    const centers = [];
    for (let i = 1; i < row.children.length; i++) {
      const r = row.children[i].getBoundingClientRect();
      centers.push([r.left - pr.left + r.width / 2, r.top - pr.top + r.height / 2]);
    }
    const progress = (now % 1200) / 1200;
    ctx.lineCap = "round";

    for (let i = 0; i < centers.length - 1; i++) {
      const [sx, sy] = centers[i], [ex, ey] = centers[i + 1];
      ctx.strokeStyle = "#455A64";
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();

      const dx = ex - sx, dy = ey - sy;
      const len = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const ux = dx / len, uy = dy / len;
      const gcx = sx + dx * progress, gcy = sy + dy * progress;
      const half = 40;
      const gx0 = gcx - ux * half, gy0 = gcy - uy * half;
      const gx1 = gcx + ux * half, gy1 = gcy + uy * half;

      const grad = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
      grad.addColorStop(0, "rgba(0,229,255,0)");
      grad.addColorStop(0.5, "#00E5FF");
      grad.addColorStop(1, "rgba(0,229,255,0)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 10;
      ctx.beginPath(); ctx.moveTo(gx0, gy0); ctx.lineTo(gx1, gy1); ctx.stroke();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return row;
}

function howScreen() {
  return h("div", { class: "how" },
    titleBar(t("button_2_text")),
    connectedFlowRow([firstStep, secondStep, thirdStep]));
}

// ------------------------------------------------------------ váz, navigáció, elrendezés
let appEl, screenHost, topBtnsEl, scrollEl, snow;
let currentScreen = SCREENS.MAIN;
let screenToken = 0;

function showScreen(screen) {
  currentScreen = screen;
  const token = ++screenToken;
  let content;
  switch (screen) {
    case SCREENS.MAIN: content = mainScreen(); break;
    case SCREENS.HOW: content = howScreen(); break;
    case SCREENS.REQUIREMENTS: content = requirementsScreen(); break;
    case SCREENS.LICENSE: content = licenseScreen(); break;
    case SCREENS.LIBRARIES: content = librariesScreen(() => token === screenToken); break;
  }
  screenHost.replaceChildren(...[].concat(content));
}

function layout() {
  const winW = window.innerWidth, winH = window.innerHeight;
  const hp = winW > 768 ? Math.floor((Math.min(winW, 1024) - 768) / 2) + 8 : 8;
  const screenH = Math.max(winH - topBtnsEl.clientHeight - 6, 0);
  appEl.style.setProperty("--hp", hp + "px");
  appEl.style.setProperty("--screen-h", screenH + "px");
  appEl.classList.toggle("tall", screenH > 740);
  snow.setCount(Math.round(winW / 18));
}

function buildApp() {
  toastEl = h("div", { class: "toast" }, h("div", null, t("copied")));
  snow = createSnow();

  const topButtons = [
    ["button_1_text", SCREENS.MAIN],
    ["button_2_text", SCREENS.HOW],
    ["button_3_text", SCREENS.REQUIREMENTS],
  ];
  topBtnsEl = h("div", { class: "topbtns" }, topButtons.map(([label, screen]) =>
    h("button", {
      class: "btn btn-top",
      onclick: () => {
        showScreen(screen);
        scrollEl.scrollTo({ top: 0, behavior: "smooth" });
      },
    }, t(label))));

  screenHost = h("div", { class: "screen" });

  const footer = h("div", { class: "footer" },
    h("div", null,
      h("div", { class: "clickable", onclick: () => showScreen(SCREENS.LICENSE) }, t("license")),
      h("div", { class: "copyright" }, t("copyright"))),
    h("div", null,
      h("div", { class: "clickable", onclick: () => showScreen(SCREENS.LIBRARIES) }, t("libraries"))));

  scrollEl = h("div", { class: "granit-scroll" },
    h("div", { class: "column" },
      h("div", { class: "topbar" }, topBtnsEl),
      screenHost,
      h("div", { class: "divider" }),
      footer));

  appEl = h("div", { class: "app" },
    toastEl,
    h("img", { class: "bg", src: "background.webp", alt: "" }),
    snow.canvas,
    scrollEl);

  document.getElementById("root").append(appEl);

  layout();
  observeSize(topBtnsEl, layout);
  window.addEventListener("resize", layout);
  showScreen(SCREENS.MAIN);
}

// ------------------------------------------------------------ indulás
async function init() {
  try {
    const res = await fetch("strings.json");
    const list = await res.json();
    for (const { key, value } of list) texts[key] = value;
  } catch (e) {
    console.error("strings.json", e);
  }
  buildApp();
  document.getElementById("html_loading")?.remove();
}

init();
