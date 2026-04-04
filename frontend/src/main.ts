// ============================================================
// AUDIO SYSTEM — 文头字脑
// All audio is synthesized via Web Audio API at runtime.
// No external audio files are fetched. License: CC0 (synthesized).
// ============================================================

const AMBIENT_VOL = 0.15;
const SFX_VOL = 0.5;

interface AudioSystem {
  ctx: AudioContext | null;
  muted: boolean;
  _ambGain: GainNode | null;
  _ambLfo: OscillatorNode | null;
  _ambSrc: AudioBufferSourceNode | null;
  _noiseBuf: AudioBuffer | null;
}

const audio: AudioSystem = {
  ctx: null,
  muted: false,
  _ambGain: null,
  _ambLfo: null,
  _ambSrc: null,
  _noiseBuf: null,
};

function initAudio(): void {
  if (audio.ctx) return;
  audio.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  if (audio.ctx.state === 'suspended') {
    audio.ctx.resume();
  }
}

function buildNoiseBuf(): void {
  if (!audio.ctx) return;
  const sr = audio.ctx.sampleRate;
  const len = sr * 10;
  const data = new Float32Array(len);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  audio._noiseBuf = audio.ctx.createBuffer(1, len, sr);
  audio._noiseBuf.copyToChannel(data, 0);
}

function lp(sig: Float32Array, cutoff: number): Float32Array {
  const rc = 1 / (2 * Math.PI * cutoff);
  const dt = 1 / (audio.ctx?.sampleRate || 44100);
  const a = dt / (rc + dt);
  const out = new Float32Array(sig.length);
  out[0] = sig[0];
  for (let i = 1; i < sig.length; i++) out[i] = out[i - 1] + a * (sig[i] - out[i - 1]);
  return out;
}

function hp(sig: Float32Array, cutoff: number): Float32Array {
  const rc = 1 / (2 * Math.PI * cutoff);
  const dt = 1 / (audio.ctx?.sampleRate || 44100);
  const a = rc / (rc + dt);
  const out = new Float32Array(sig.length);
  out[0] = 0;
  for (let i = 1; i < sig.length; i++) out[i] = a * (out[i - 1] + sig[i] - sig[i - 1]);
  return out;
}

function bp(sig: Float32Array, lo: number, hi: number): Float32Array {
  return hp(lp(sig, hi), lo);
}

function startAmbient(): void {
  if (!audio.ctx || !audio._noiseBuf || audio._ambSrc) return;
  const bp_node = audio.ctx.createBiquadFilter();
  bp_node.type = 'bandpass';
  bp_node.frequency.value = 2000;
  bp_node.Q.value = 0.3;
  const lp_node = audio.ctx.createBiquadFilter();
  lp_node.type = 'lowpass';
  lp_node.frequency.value = 4000;
  const gainNode = audio.ctx.createGain();
  gainNode.gain.value = audio.muted ? 0 : AMBIENT_VOL;
  const src = audio.ctx.createBufferSource();
  src.buffer = audio._noiseBuf;
  src.loop = true;
  const lfo = audio.ctx.createOscillator();
  const lfoG = audio.ctx.createGain();
  lfo.type = 'sine';
  lfo.frequency.value = 0.08;
  lfoG.gain.value = AMBIENT_VOL * 0.4;
  lfo.connect(lfoG);
  lfoG.connect(gainNode.gain);
  src.connect(bp_node);
  bp_node.connect(lp_node);
  lp_node.connect(gainNode);
  gainNode.connect(audio.ctx.destination);
  src.start();
  lfo.start();
  audio._ambSrc = src;
  audio._ambGain = gainNode;
  audio._ambLfo = lfo;
}

function playClick(): void {
  if (!audio.ctx) return;
  const sr = audio.ctx.sampleRate;
  const n = Math.floor(sr * 0.3);
  const d = new Float32Array(n);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * 0.3;
  const f = bp(d, 2000, 6000);
  for (let i = 0; i < n; i++) d[i] = f[i] * 0.5;
  const f2 = bp(d.slice(0, Math.floor(sr * 0.2)), 3000, 10000);
  for (let i = 0; i < f2.length && i < n; i++) d[i] += f2[i] * 0.3;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const env = t < 0.01 ? i / (sr * 0.01) : Math.max(0, 1 - (t - 0.01) / 0.25);
    d[i] *= env * 0.6;
  }
  const buf = audio.ctx.createBuffer(1, n, sr);
  buf.copyToChannel(d, 0);
  const g = audio.ctx.createGain();
  g.gain.value = audio.muted ? 0 : SFX_VOL;
  const s = audio.ctx.createBufferSource();
  s.buffer = buf;
  s.connect(g);
  g.connect(audio.ctx.destination);
  s.start();
}

function playCollect(): void {
  if (!audio.ctx) return;
  const sr = audio.ctx.sampleRate;
  const freqs = [523.25, 659.25, 783.99, 1046.5];
  const n = Math.floor(sr * 0.5);
  const d = new Float32Array(n);
  for (let f = 0; f < freqs.length; f++) {
    const freq = freqs[f];
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const dec = Math.exp(-t * 8);
      const fm = 1 + 0.002 * Math.sin(2 * Math.PI * 6 * t);
      d[i] += Math.sin(2 * Math.PI * freq * fm * t) * dec * 0.25;
      d[i] += Math.sin(2 * Math.PI * freq * 2 * t) * dec * 0.08;
      d[i] += Math.sin(2 * Math.PI * freq * 3 * t) * dec * 0.03;
    }
  }
  const mv = Math.max(...Array.from(d).map(Math.abs));
  if (mv > 0) for (let i = 0; i < n; i++) d[i] /= mv;
  const fade = Math.floor(sr * 0.1);
  for (let i = 0; i < n; i++) if (i > n - fade) d[i] *= (n - i) / fade;
  const buf = audio.ctx.createBuffer(1, n, sr);
  buf.copyToChannel(d, 0);
  const g = audio.ctx.createGain();
  g.gain.value = audio.muted ? 0 : SFX_VOL;
  const s = audio.ctx.createBufferSource();
  s.buffer = buf;
  s.connect(g);
  g.connect(audio.ctx.destination);
  s.start();
}

function playSubmit(): void {
  if (!audio.ctx) return;
  const sr = audio.ctx.sampleRate;
  const n = Math.floor(sr * 0.4);
  const d = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const dec = Math.exp(-t * 15);
    const freq = 150 + 50 * Math.exp(-t * 20);
    d[i] += Math.sin(2 * Math.PI * freq * t) * dec * 0.6;
    d[i] += (Math.random() * 2 - 1) * dec * 0.1;
  }
  const ds = Math.floor(sr * 0.05);
  const dl = Math.floor(sr * 0.1);
  for (let i = 0; i < dl; i++) {
    const t = i / sr;
    const dec = Math.exp(-t * 20);
    if (ds + i < n) d[ds + i] += (Math.random() * 2 - 1) * dec * 0.3;
  }
  const hpF = hp(lp(d, 800), 60);
  const mv = Math.max(...Array.from(hpF).map(Math.abs));
  if (mv > 0) for (let i = 0; i < n; i++) hpF[i] /= mv;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    if (t < 0.02) hpF[i] *= t / 0.02;
    if (t > 0.3) hpF[i] *= (0.4 - t) / 0.1;
  }
  const buf = audio.ctx.createBuffer(1, n, sr);
  buf.copyToChannel(hpF as Float32Array<ArrayBuffer>, 0);
  const g = audio.ctx.createGain();
  g.gain.value = audio.muted ? 0 : SFX_VOL;
  const s = audio.ctx.createBufferSource();
  s.buffer = buf;
  s.connect(g);
  g.connect(audio.ctx.destination);
  s.start();
}

const SVG_ON = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>';
const SVG_OFF = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>';

function toggleMute(): void {
  audio.muted = !audio.muted;
  const btn = document.getElementById('mute-btn');
  if (btn) {
    btn.innerHTML = audio.muted ? SVG_OFF : SVG_ON;
    btn.setAttribute('aria-label', audio.muted ? '取消静音' : '静音');
  }
  if (audio._ambGain && audio.ctx) {
    audio._ambGain.gain.setTargetAtTime(audio.muted ? 0 : AMBIENT_VOL, audio.ctx.currentTime, 0.1);
  }
}

(window as unknown as { _audio: AudioSystem })._audio = audio;

document.addEventListener('click', () => { initAudio(); }, { once: true });

document.addEventListener('keydown', (e) => {
  if (e.key === 'm' || e.key === 'M') { initAudio(); toggleMute(); }
});

const muteBtn = document.getElementById('mute-btn');
if (muteBtn) {
  muteBtn.addEventListener('click', (e) => { e.stopPropagation(); initAudio(); toggleMute(); });
  if (audio.muted) { muteBtn.innerHTML = SVG_OFF; muteBtn.setAttribute('aria-label', '取消静音'); }
}

// ============================================================
// FRAGMENT SYSTEM — 文头字脑
// ============================================================

interface Fragment {
  id?: number;
  title: string;
  fullTitle: string;
  description: string;
  positionX: number;
  positionY: number;
  angle: number;
}

interface CollectFragment {
  id: number;
  title: string;
  fullTitle: string;
  description: string;
}

interface PaginatedResult<T> {
  items: T[];
  hasMore: boolean;
  total: number;
}

const collectedFragments: CollectFragment[] = [];
let todayFragments: Fragment[] = [];

function buildFragmentHTML(title: string): string {
  return title.split('').map((ch) =>
    ch === '█'
      ? '<span class="fragment__char fragment__char--worn">█</span>'
      : '<span class="fragment__char">' + ch + '</span>'
  ).join('');
}

function renderFragments(): void {
  const layer = document.getElementById('fragments-layer');
  if (!layer) return;

  layer.innerHTML = '';

  todayFragments.forEach((frag) => {
    const el = document.createElement('div');
    el.className = 'fragment fragment-torn';
    el.innerHTML = buildFragmentHTML(frag.title);

    el.style.left = frag.positionX.toFixed(1) + '%';
    el.style.top = frag.positionY.toFixed(1) + '%';
    el.style.transform = 'rotate(' + frag.angle.toFixed(1) + 'deg)';
    el.style.position = 'fixed';
    el.style.zIndex = '10';

    el.onclick = () => openFragmentDetail(frag);

    layer.appendChild(el);
  });
}

function openFragmentDetail(frag: Fragment): void {
  const audioSys = (window as unknown as { _audio: AudioSystem | undefined })._audio;
  if (audioSys) audioSys.ctx && playClick();

  const overlay = document.querySelector('.fragment-overlay');
  const detail = document.querySelector('.fragment-detail');
  if (!overlay || !detail) return;

  const fragEl = detail.querySelector('.fragment-detail__fragment');
  if (fragEl) {
    fragEl.innerHTML = '';
    const fragDiv = document.createElement('div');
    fragDiv.className = 'fragment fragment-torn';
    fragDiv.innerHTML = buildFragmentHTML(frag.title);
    fragEl.appendChild(fragDiv);
  }

  const textEl = detail.querySelector('.fragment-detail__text');
  if (textEl) {
    textEl.textContent = frag.fullTitle;
  }

  const contextEl = detail.querySelector('.fragment-detail__context');
  if (contextEl) {
    contextEl.textContent = frag.description;
  }

  const collectBtn = document.getElementById('collect-btn');
  if (collectBtn) {
    const isUncollected = !frag.id;
    collectBtn.style.display = isUncollected ? 'block' : 'none';
    if (isUncollected) {
      collectBtn.onclick = () => collectFragment(frag);
    }
  }

  overlay.classList.add('is-active');
  syncFragmentsVisibility();
}

function collectFragment(frag: Fragment): void {
  const audioSys = (window as unknown as { _audio: AudioSystem | undefined })._audio;
  if (audioSys) audioSys.ctx && playSubmit();

  const fragToSave: CollectFragment = {
    id: 0,
    title: frag.title,
    fullTitle: frag.fullTitle,
    description: frag.description
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).go.main.App.SaveFragment(fragToSave).then((id: number) => {
    fragToSave.id = id;
    collectedFragments.push(fragToSave);
    todayFragments = [];
    renderFragments();
    renderNarrative();
  }).catch((e: Error) => {
    console.warn('SaveFragment failed:', e);
  });

  closeModal();
}

function closeModal(): void {
  const overlay = document.querySelector('.fragment-overlay');
  if (overlay) overlay.classList.remove('is-active');
  syncFragmentsVisibility();
}

function syncFragmentsVisibility(): void {
  const layer = document.getElementById('fragments-layer');
  if (!layer) return;
  const anyActive = document.querySelector('.fragment-overlay.is-active') !== null;
  layer.classList.toggle('hidden', anyActive);
}

function renderNarrative(): void {
  const container = document.getElementById('narrative-content');
  if (!container) return;

  const items = container.querySelectorAll('.narrative-item');
  items.forEach((item) => item.remove());
  const placeholder = container.querySelector('.placeholder');
  if (placeholder) placeholder.remove();

  if (collectedFragments.length === 0) {
    const p = document.createElement('p');
    p.className = 'placeholder';
    p.textContent = '……';
    container.appendChild(p);
    return;
  }

  collectedFragments.forEach((frag) => {
    const item = document.createElement('div');
    item.className = 'narrative-item fade-in';

    const word = document.createElement('p');
    word.className = 'text-vertical narrative-item__word';
    word.textContent = frag.fullTitle;
    item.appendChild(word);

    item.style.cursor = 'pointer';
    item.onclick = () => {
      const tf: Fragment = {
        id: frag.id,
        title: frag.title,
        fullTitle: frag.fullTitle,
        description: frag.description,
        positionX: 0,
        positionY: 0,
        angle: 0
      };
      openFragmentDetail(tf);
    };

    container.appendChild(item);
  });
}

function setupModal(): void {
  const overlay = document.querySelector('.fragment-overlay');
  const closeBtn = document.querySelector('.fragment-detail__close');

  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
  }
  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
}

function setupRestart(): void {
  const restartBtn = document.getElementById('restart-btn');
  const overlay = document.getElementById('restart-overlay');
  const confirmBtn = document.getElementById('restart-confirm');
  const cancelBtn = document.getElementById('restart-cancel');

  if (!restartBtn || !overlay) {
    return;
  }

  const overlayEl = overlay;
  function doRestart(): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).go.main.App.ResetGame()
      .then(() => {
        overlayEl.classList.remove('is-active');
        collectedFragments.length = 0;
        todayFragments = [];
        (window as unknown as { _creationPage: number })._creationPage = 1;

        const collectionContainer = document.getElementById('collection');
        if (collectionContainer) collectionContainer.innerHTML = '';
        renderNarrative();
        (window as unknown as { _loadCreations: (page: number) => Promise<void> })._loadCreations(1);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (window as any).go.main.App.GenFragment() as Promise<Fragment | null>;
      })
      .then((frag: Fragment | null | undefined) => {
        if (frag) {
          todayFragments = [frag];
          renderFragments();
        }
      })
      .catch((e: Error) => {
        console.warn('Restart failed:', e);
      });

    overlayEl.classList.remove('is-active');
    syncFragmentsVisibility();
  }

  restartBtn.addEventListener('click', () => {
    overlayEl.classList.add('is-active');
    syncFragmentsVisibility();
  });

  if (confirmBtn) {
    confirmBtn.addEventListener('click', (e) => {
      e.preventDefault();
      doRestart();
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      overlayEl.classList.remove('is-active');
      syncFragmentsVisibility();
    });
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.remove('is-active');
      syncFragmentsVisibility();
    }
  });
}

async function initFragmentSystem(): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = await (window as any).go.main.App.LoadCollected() as CollectFragment[];
    if (items) {
      collectedFragments.length = 0;
      items.forEach((c) => {
        collectedFragments.push({
          id: c.id,
          title: c.title,
          fullTitle: c.fullTitle,
          description: c.description
        });
      });
    }
  } catch (e) {
    console.warn('LoadCollected failed:', e);
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const frag = await (window as any).go.main.App.GenFragment() as Fragment | null;
    if (frag) {
      todayFragments = [frag];
    }
  } catch (e) {
    console.warn('GenFragment failed:', e);
  }

  renderFragments();
  renderNarrative();
  setupModal();
  setupRestart();
}

initFragmentSystem();
(window as unknown as { _renderNarrative: () => void })._renderNarrative = renderNarrative;

// ============================================================
// CREATION PANEL — 文头字脑
// ============================================================

const CHAR_LIMIT = 100;
const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_DIMENSION = 800;
const PAGE_SIZE = 5;
let creationPage = 1;
let totalCreations = 0;
let isLoadingCreations = false;

interface CreationItem {
  id: number;
  content: string;
}

async function loadCreations(page: number): Promise<void> {
  if (isLoadingCreations) return;
  isLoadingCreations = true;

  creationPage = page;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (window as any).go.main.App.LoadCreations(page, PAGE_SIZE) as PaginatedResult<CreationItem>;
    if (result && result.items) {
      totalCreations = result.total || 0;
      renderCollection(result.items, true);
      renderPagination();
    }
  } catch (e) {
    console.warn('Failed to load creations:', e);
  }

  isLoadingCreations = false;
}

function totalPages(): number {
  return Math.ceil(totalCreations / PAGE_SIZE) || 1;
}

function setupEditor(): void {
  const editor = document.getElementById('player-text');
  const counter = document.getElementById('char-count');
  const btn = document.getElementById('submit-text');
  if (!editor || !counter || !btn) return;

  const editorEl = editor;
  const counterEl = counter;
  function updateState(): void {
    const len = editorEl.textContent?.length || 0;
    counterEl.textContent = Math.min(len, CHAR_LIMIT) + '/' + CHAR_LIMIT;
    counterEl.style.color = len > CHAR_LIMIT ? 'var(--color-accent)' : '';
    const content = editorEl.innerHTML.trim();
    (btn as HTMLButtonElement).disabled = !content || content === '<br>';
  }

  editorEl.addEventListener('input', updateState);
  updateState();

  btn.addEventListener('click', async () => {
    const audioSys = (window as unknown as { _audio: AudioSystem | undefined })._audio;
    if (audioSys) audioSys.ctx && playCollect();

    const content = editorEl.innerHTML.trim();
    if (!content || content === '<br>') {
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (window as any).go.main.App.SaveCreation(content) as boolean;
      if (result) {
        loadCreations(1);
      }
    } catch (e) {
      console.warn('SaveCreation failed:', e);
    }

    editorEl.innerHTML = '';
    counterEl.textContent = '0/' + CHAR_LIMIT;
    updateState();
  });
}

function setupImageUpload(): void {
  const input = document.getElementById('player-image');
  const editor = document.getElementById('player-text');
  if (!input || !editor) return;

  input.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      alert('仅支持 jpg/png/gif/webp');
      (e.target as HTMLInputElement).value = '';
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      alert('图片过大，请选择小于2MB的文件');
      (e.target as HTMLInputElement).value = '';
      return;
    }

    compressImage(file).then((base64) => {
      const img = document.createElement('img');
      img.src = base64;
      editor.appendChild(img);
      editor.focus();
      const counter = document.getElementById('char-count');
      if (counter) {
        counter.textContent = Math.min(editor.textContent?.length || 0, CHAR_LIMIT) + '/' + CHAR_LIMIT;
      }
      (e.target as HTMLInputElement).value = '';
    }).catch((err: Error) => {
      alert('图片处理失败，请重试');
      console.warn('Image compression failed:', err);
    });
  });
}

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;

        if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
          if (w > h) {
            h = Math.round(h * MAX_DIMENSION / w);
            w = MAX_DIMENSION;
          } else {
            w = Math.round(w * MAX_DIMENSION / h);
            h = MAX_DIMENSION;
          }
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function renderCollection(items: CreationItem[], clear: boolean): void {
  const container = document.getElementById('collection');
  if (!container) return;

  if (clear) {
    container.innerHTML = '';
  }

  if (!items || items.length === 0) {
    return;
  }

  items.forEach((c) => {
    const item = document.createElement('div');
    item.className = 'creation-item fade-in';
    item.dataset.id = String(c.id);

    if (c.content) {
      item.innerHTML = c.content;
    }

    container.appendChild(item);
  });
}



function renderPagination(): void {
  const container = document.getElementById('creation-pagination');
  if (!container) return;

  container.innerHTML = '';

  const pages = totalPages();
  if (pages <= 1) return;

  for (let i = 1; i <= pages; i++) {
    const start = (i - 1) * PAGE_SIZE + 1;
    const end = Math.min(i * PAGE_SIZE, totalCreations);
    const btn = document.createElement('button');
    btn.className = 'pagination-btn' + (i === creationPage ? ' is-active' : '');
    btn.textContent = `${start}-${end}`;
    btn.addEventListener('click', () => loadCreations(i));
    container.appendChild(btn);
  }
}

function initCreationPanel(): void {
  setupEditor();
  setupImageUpload();
  loadCreations(1);
}

initCreationPanel();

(window as unknown as { _creationPage: number })._creationPage = creationPage;
(window as unknown as { _loadCreations: (page: number) => Promise<void> })._loadCreations = loadCreations;
(window as unknown as { _renderCollection: (items: CreationItem[], clear: boolean) => void })._renderCollection = renderCollection;
