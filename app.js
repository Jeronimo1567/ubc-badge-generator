/* ------------------------------------------------------------------
   UBC 2026 — badge generator
   Everything renders client-side on a <canvas>. No uploads, no backend.
------------------------------------------------------------------- */

const NAVY   = '#2a3a45';
const ORANGE = '#e9873d';
const PAPER  = '#f4f1ec';
const RADIUS = 0.13;            // photo corner radius, as a fraction of its width

const FORMATS = {
  banner: { w: 1600, h: 900 },   // X / Twitter, LinkedIn
  story:  { w: 1080, h: 1920 },  // Instagram / X stories
};

const state = {
  format: 'banner',
  headline: 'I’M ATTENDING',
  name: '',
  club: '',
  img: null,
  zoom: 1,
  ox: 0, oy: 0,   // pan, as a fraction of the photo frame's width
  frame: null,    // last drawn photo frame {x,y,w,h}
};

// the official lockup, recoloured for dark backgrounds
const logo = new Image();
logo.src = 'assets/logo-lockup-dark.png';

// College.xyz partner lockup, supplied in white for the navy artwork
const collegeLogo = new Image();
collegeLogo.src = 'assets/college-xyz-logo.png';

/* Drop-in support for your own artwork.
   Export your badge background (with the headline, logo, date and URL already
   on it, and the photo area left empty), put it in assets/, and fill this in.
   `frame` is where the photo goes, in the artwork's own pixel coordinates.
   When a template is set, only the photo and the optional name/club are drawn
   on top of it.

   banner: { src: 'assets/template-banner.png', w: 1600, h: 900,
             frame: { x: 980, y: 210, w: 480, h: 480 },
             credit: { x: 96, y: 676, size: 36, align: 'left' } },
*/
const TEMPLATES = {
  banner: null,
  story: null,
};

for (const key of Object.keys(TEMPLATES)) {
  const t = TEMPLATES[key];
  if (!t) continue;
  t.img = new Image();
  t.img.src = t.src;
}

/* ---------------------------- text helpers ---------------------------- */

// letter-spaced text, drawn glyph by glyph so it looks identical everywhere
function trackedWidth(ctx, text, track) {
  let w = 0;
  for (const ch of text) w += ctx.measureText(ch).width + track;
  return w - (text.length ? track : 0);
}

function tracked(ctx, text, x, y, track, align = 'left') {
  const w = trackedWidth(ctx, text, track);
  let cx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + track;
  }
  return w;
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
}

/* ------------------------------ the logo ------------------------------ */

function drawLogo(ctx, x, y, w, align = 'left') {
  if (!logo.complete || !logo.naturalWidth) return 0;
  const h = w * (logo.naturalHeight / logo.naturalWidth);
  const lx = align === 'center' ? x - w / 2 : x;
  ctx.drawImage(logo, lx, y, w, h);
  return h;
}

function drawPartnerCredit(ctx, x, y, logoWidth, fontSize, align = 'left') {
  if (!collegeLogo.complete || !collegeLogo.naturalWidth) return 0;

  const label = 'BY';
  const track = fontSize * 0.16;
  const gap = fontSize * 0.8;
  const logoHeight = logoWidth * (collegeLogo.naturalHeight / collegeLogo.naturalWidth);

  ctx.font = `700 ${fontSize}px Archivo, sans-serif`;
  const labelWidth = trackedWidth(ctx, label, track);
  const totalWidth = labelWidth + gap + logoWidth;
  const startX = align === 'right' ? x - totalWidth : align === 'center' ? x - totalWidth / 2 : x;

  ctx.fillStyle = 'rgba(244,241,236,.58)';
  tracked(ctx, label, startX, y + (logoHeight + fontSize * 0.38) / 2, track);
  ctx.drawImage(collegeLogo, startX + labelWidth + gap, y, logoWidth, logoHeight);

  return totalWidth;
}

/* ---------------------------- backdrop art ---------------------------- */

// fine paper grain, built once and reused as a pattern
const grain = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 180;
  const g = c.getContext('2d');
  const d = g.createImageData(180, 180);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = Math.random() * 255;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
    d.data[i + 3] = 12;
  }
  g.putImageData(d, 0, 0);
  return c;
})();

function drawBackdrop(ctx, W, H) {
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, W, H);

  // the fine contour lines that sweep up the right of the conference artwork
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1, W * 0.0008);
  for (let i = 0; i < 26; i++) {
    const t = i / 25;
    ctx.strokeStyle = `rgba(244,241,236,${0.08 + t * 0.11})`;
    ctx.beginPath();
    ctx.moveTo(W * (0.24 + t * 0.20), H * 1.05);
    ctx.bezierCurveTo(
      W * (0.60 + t * 0.20), H * (0.98 - t * 0.10),
      W * (0.68 + t * 0.24), H * (0.46 - t * 0.16),
      W * (1.02 + t * 0.14), H * (-0.08 + t * 0.26)
    );
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = ctx.createPattern(grain, 'repeat');
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/* ------------------------------ the photo ----------------------------- */

function drawPhoto(ctx, x, y, w, h) {
  state.frame = { x, y, w, h };
  const r = w * RADIUS;

  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = PAPER;
  ctx.fill();

  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();

  if (state.img) {
    const img = state.img;
    const base = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const s = base * state.zoom;
    const dw = img.naturalWidth * s;
    const dh = img.naturalHeight * s;
    const maxX = Math.max(0, (dw - w) / 2);
    const maxY = Math.max(0, (dh - h) / 2);
    const ox = Math.max(-maxX, Math.min(maxX, state.ox * w));
    const oy = Math.max(-maxY, Math.min(maxY, state.oy * w));
    ctx.drawImage(img, x + (w - dw) / 2 + ox, y + (h - dh) / 2 + oy, dw, dh);
  } else {
    // click target: plus sign + prompt
    const cx = x + w / 2, cy = y + h * 0.43, arm = w * 0.07;
    ctx.strokeStyle = 'rgba(42,58,69,.38)';
    ctx.lineWidth = w * 0.014;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - arm, cy); ctx.lineTo(cx + arm, cy);
    ctx.moveTo(cx, cy - arm); ctx.lineTo(cx, cy + arm);
    ctx.stroke();

    ctx.setLineDash([w * 0.03, w * 0.025]);
    ctx.strokeStyle = 'rgba(42,58,69,.20)';
    ctx.lineWidth = w * 0.008;
    roundRect(ctx, x + w * 0.05, y + h * 0.05, w * 0.9, h * 0.9, r * 0.72);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(42,58,69,.45)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `700 ${w * 0.048}px Archivo, sans-serif`;
    tracked(ctx, 'CLICK TO ADD', cx, y + h * 0.66, w * 0.012, 'center');
    tracked(ctx, 'YOUR PHOTO', cx, y + h * 0.73, w * 0.012, 'center');
  }
  ctx.restore();
}

/* ------------------------------- layouts ------------------------------ */

function drawCredit(ctx, x, y, size, align = 'left') {
  let cursor = y;
  if (state.name) {
    ctx.fillStyle = PAPER;
    ctx.font = `700 ${size}px Archivo, sans-serif`;
    tracked(ctx, state.name, x, cursor, size * 0.01, align);
    cursor += size * 1.2;
  }
  if (state.club) {
    ctx.fillStyle = 'rgba(244,241,236,.68)';
    ctx.font = `300 ${size * 0.74}px Jost, sans-serif`;
    tracked(ctx, state.club, x, cursor, size * 0.05, align);
  }
}

function layoutBanner(ctx, W, H) {
  drawBackdrop(ctx, W, H);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  ctx.fillStyle = ORANGE;
  ctx.font = '800 84px Archivo, sans-serif';
  tracked(ctx, state.headline, 96, 258, 1.5);

  drawLogo(ctx, 96, 300, 560);

  ctx.fillStyle = PAPER;
  ctx.font = '700 54px Archivo, sans-serif';
  tracked(ctx, 'NOV 20–21 · AUSTIN TX', 96, 588, 1.5);

  drawCredit(ctx, 96, 676, 36);

  ctx.fillStyle = PAPER;
  ctx.font = '700 27px Archivo, sans-serif';
  tracked(ctx, 'UNIVERSITYBLOCKCHAIN.ORG', 96, 800, 5);

  drawPartnerCredit(ctx, 1380, 770, 190, 19, 'right');

  drawPhoto(ctx, 980, 210, 480, 480);
}

function layoutStory(ctx, W, H) {
  drawBackdrop(ctx, W, H);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  drawPhoto(ctx, (W - 620) / 2, 420, 620, 620);

  ctx.fillStyle = ORANGE;
  ctx.font = '800 84px Archivo, sans-serif';
  tracked(ctx, state.headline, W / 2, 1216, 2, 'center');

  drawLogo(ctx, W / 2, 1270, 760, 'center');

  ctx.fillStyle = PAPER;
  ctx.font = '700 50px Archivo, sans-serif';
  tracked(ctx, 'NOV 20–21 · AUSTIN TX', W / 2, 1580, 2, 'center');

  drawCredit(ctx, W / 2, 1664, 38, 'center');

  ctx.fillStyle = PAPER;
  ctx.font = '700 26px Archivo, sans-serif';
  tracked(ctx, 'UNIVERSITYBLOCKCHAIN.ORG', 84, 1806, 4.5);

  drawPartnerCredit(ctx, W - 84, 1778, 180, 18, 'right');
}

const LAYOUTS = { banner: layoutBanner, story: layoutStory };

// your own artwork, with just the photo and credit composited on top
function layoutTemplate(ctx, t) {
  ctx.drawImage(t.img, 0, 0, t.w, t.h);
  drawPhoto(ctx, t.frame.x, t.frame.y, t.frame.w, t.frame.h);
  if (t.credit) drawCredit(ctx, t.credit.x, t.credit.y, t.credit.size, t.credit.align || 'left');
}

function render(canvas) {
  const t = TEMPLATES[state.format];
  const { w, h } = t && t.img.complete && t.img.naturalWidth ? t : FORMATS[state.format];
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  if (t && t.img.complete && t.img.naturalWidth) layoutTemplate(ctx, t);
  else LAYOUTS[state.format](ctx, w, h);
  return canvas;
}

/* ------------------------------- wiring ------------------------------- */

const preview    = document.getElementById('preview');
const stageInner = document.getElementById('stageInner');
const photoHit   = document.getElementById('photoHit');
const fileInput  = document.getElementById('fileInput');
const adjust     = document.getElementById('adjustField');
const details    = document.getElementById('detailsField');
const emptyNote  = document.getElementById('emptyNote');
const zoomEl     = document.getElementById('zoom');

function syncPhotoHit() {
  if (state.img || !state.frame) {
    photoHit.hidden = true;
    return;
  }
  const canvasRect = preview.getBoundingClientRect();
  const stageRect = stageInner.getBoundingClientRect();
  const f = state.frame;
  photoHit.style.left = `${canvasRect.left - stageRect.left + (f.x / preview.width) * canvasRect.width}px`;
  photoHit.style.top = `${canvasRect.top - stageRect.top + (f.y / preview.height) * canvasRect.height}px`;
  photoHit.style.width = `${(f.w / preview.width) * canvasRect.width}px`;
  photoHit.style.height = `${(f.h / preview.height) * canvasRect.height}px`;
  photoHit.hidden = false;
}

const draw = () => {
  render(preview);
  requestAnimationFrame(syncPhotoHit);
};
window.addEventListener('resize', syncPhotoHit);

/* format + headline pickers */
function segGroup(id, apply) {
  const root = document.getElementById(id);
  root.addEventListener('click', e => {
    const btn = e.target.closest('.seg');
    if (!btn) return;
    root.querySelectorAll('.seg').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    apply(btn.dataset);
    draw();
  });
}
segGroup('formatGroup', d => { state.format = d.format; });
segGroup('headlineGroup', d => { state.headline = d.headline; });

/* photo input — reached by clicking the placeholder on the badge itself */
function loadFile(file) {
  const hasImageType = file && file.type.startsWith('image/');
  const hasImageExtension = file && /\.(jpe?g|png|gif|webp|heic|heif|avif)$/i.test(file.name);
  if (!file || (!hasImageType && !hasImageExtension)) return;
  const img = new Image();
  const objectUrl = URL.createObjectURL(file);
  img.onload = () => {
    URL.revokeObjectURL(objectUrl);
    state.img = img;
    state.zoom = 1; state.ox = 0; state.oy = 0;
    zoomEl.value = 100;
    adjust.hidden = false;
    details.hidden = false;
    document.getElementById('shareField').hidden = false;
    emptyNote.hidden = true;
    stageInner.classList.add('has-photo');
    preview.setAttribute('aria-label', 'Drag to reposition your photo');
    draw();
  };
  img.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    emptyNote.querySelector('p').textContent = 'That photo could not be opened. Please choose a JPG, PNG, HEIC, or WebP image.';
  };
  img.src = objectUrl;
}

fileInput.addEventListener('change', e => {
  loadFile(e.target.files[0]);
  e.target.value = '';            // so picking the same file twice still fires
});
document.querySelectorAll('label[for="fileInput"]').forEach(label => {
  label.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    fileInput.click();
  });
});

/* drag & drop anywhere on the badge */
['dragenter', 'dragover'].forEach(t => stageInner.addEventListener(t, e => {
  e.preventDefault();
  stageInner.classList.add('is-over');
}));
['dragleave', 'drop'].forEach(t => stageInner.addEventListener(t, e => {
  e.preventDefault();
  stageInner.classList.remove('is-over');
}));
stageInner.addEventListener('drop', e => loadFile(e.dataTransfer.files[0]));

/* pointer position in canvas coordinates */
function canvasPoint(e) {
  const r = preview.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (preview.width / r.width),
    y: (e.clientY - r.top) * (preview.height / r.height),
  };
}
function overFrame(e) {
  const f = state.frame;
  if (!f) return false;
  const p = canvasPoint(e);
  return p.x >= f.x && p.x <= f.x + f.w && p.y >= f.y && p.y <= f.y + f.h;
}

/* click the placeholder to upload, drag the photo to reposition */
let dragging = false, lastX = 0, lastY = 0;

preview.addEventListener('pointerdown', e => {
  if (!state.img || !overFrame(e)) return;
  dragging = true;
  preview.setPointerCapture(e.pointerId);
  lastX = e.clientX; lastY = e.clientY;
  preview.classList.add('dragging');
});

preview.addEventListener('click', e => {
  if (!state.img && overFrame(e)) fileInput.click();
});

preview.addEventListener('pointermove', e => {
  if (!dragging) {
    preview.classList.toggle('over-frame', overFrame(e));
    return;
  }
  const scale = preview.width / preview.getBoundingClientRect().width;
  state.ox += ((e.clientX - lastX) * scale) / state.frame.w;
  state.oy += ((e.clientY - lastY) * scale) / state.frame.w;
  lastX = e.clientX; lastY = e.clientY;
  draw();
});

['pointerup', 'pointercancel'].forEach(t => preview.addEventListener(t, () => {
  dragging = false;
  preview.classList.remove('dragging');
}));

/* zoom + details */
zoomEl.addEventListener('input', e => { state.zoom = e.target.value / 100; draw(); });
document.getElementById('recenter').addEventListener('click', () => {
  state.zoom = 1; state.ox = 0; state.oy = 0; zoomEl.value = 100; draw();
});
document.getElementById('nameInput').addEventListener('input', e => {
  state.name = e.target.value.trim(); draw();
});
document.getElementById('clubInput').addEventListener('input', e => {
  state.club = e.target.value.trim(); draw();
});

/* download + share */
const SITE = 'https://www.universityblockchain.org/';

function fileName() {
  const slug = (state.name || 'ubc-2026').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${slug}-ubc-2026-${state.format}.png`;
}

function caption() {
  const verb = state.headline.includes('SPEAKER') ? 'speaking at' : 'attending';
  return `I’m ${verb} the University Blockchain Conference — Nov 20–21, 2026 at UT Austin. See you there!`;
}

const badgeBlob = () => new Promise(res => render(document.createElement('canvas')).toBlob(res, 'image/png'));

function downloadBlob(blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName();
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

const shareFileSupport = navigator.share && navigator.canShare &&
  navigator.canShare({ files: [new File([''], 'badge.png', { type: 'image/png' })] });

function isPhoneOrTablet(nav = navigator) {
  const mobileHint = nav.userAgentData && nav.userAgentData.mobile === true;
  const mobileUserAgent = /Android|iPhone|iPod/i.test(nav.userAgent || '');
  const iPadDesktopMode = nav.platform === 'MacIntel' && nav.maxTouchPoints > 1;
  return mobileHint || mobileUserAgent || iPadDesktopMode;
}

const saveToPhotosSupport = isPhoneOrTablet() && shareFileSupport;

if (saveToPhotosSupport) document.getElementById('downloadLabel').textContent = 'Save to Photos';

const shareNote = document.getElementById('shareNote');
let noteTimer;
function say(msg) {
  shareNote.textContent = msg;
  shareNote.classList.add('is-live');
  clearTimeout(noteTimer);
  noteTimer = setTimeout(() => shareNote.classList.remove('is-live'), 8000);
}

async function saveBadge() {
  const blob = await badgeBlob();
  const file = new File([blob], fileName(), { type: 'image/png' });
  if (saveToPhotosSupport) {
    say('In the share sheet, choose Save Image to add the badge to Photos.');
    try {
      await navigator.share({ files: [file], title: 'UBC 2026 badge' });
      return;
    } catch (error) {
      if (error.name === 'AbortError') return;
    }
  }
  downloadBlob(blob);
}

document.getElementById('download').addEventListener('click', saveBadge);

// neither network lets a web page attach an image to a post, so hand the
// student the file and the caption, then open the composer for them
async function shareVia(url) {
  window.open(url, '_blank', 'noopener');   // opened first, or the popup gets blocked
  downloadBlob(await badgeBlob());
  let copied = false;
  try {
    await navigator.clipboard.writeText(`${caption()} ${SITE}`);
    copied = true;
  } catch { /* clipboard blocked — the composer is prefilled anyway */ }
  say(copied
    ? 'Badge downloaded and caption copied. Attach the image in the post that just opened.'
    : 'Badge downloaded. Attach the image in the post that just opened.');
}

document.getElementById('shareX').addEventListener('click', () => shareVia(
  `https://x.com/intent/post?text=${encodeURIComponent(caption())}&url=${encodeURIComponent(SITE)}`
));

document.getElementById('shareIn').addEventListener('click', () => shareVia(
  `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(`${caption()} ${SITE}`)}`
));

// where the browser supports it, hand over the actual image file
const nativeBtn = document.getElementById('shareNative');
if (shareFileSupport) {
  nativeBtn.hidden = false;
  nativeBtn.addEventListener('click', async () => {
    const file = new File([await badgeBlob()], fileName(), { type: 'image/png' });
    try {
      await navigator.share({ files: [file], text: `${caption()} ${SITE}` });
    } catch { /* dismissed */ }
  });
}

/* first paint once the logo and webfonts are available to the canvas */
const fonts = ['800 84px Archivo', '700 54px Archivo', '700 27px Archivo', '300 30px Jost'];
const ready = [
  ...fonts.map(f => document.fonts.load(f, 'UNIVERSITY BLOCKCHAIN 2026')),
  logo.decode().catch(() => {}),
  collegeLogo.decode().catch(() => {}),
];
Promise.all(ready).catch(() => {}).then(draw);

draw();
