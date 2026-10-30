// Shared helpers for all pages
const $ = (sel, root = document) => root.querySelector(sel);

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const PLAY_ICON = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';

function videoCard(v, { badge = true } = {}) {
  const media = v.thumbUrl
    ? `<img src="${esc(v.thumbUrl)}" alt="${esc(v.title)}" loading="lazy">`
    : `<video src="${esc(v.url)}#t=1" muted preload="metadata" playsinline></video>`;
  return `
    <article class="card" data-id="${esc(v.id)}">
      <div class="thumb">
        ${media}
        ${badge ? `<span class="badge ${v.featured ? 'hot' : ''}">${v.featured ? 'Featured' : esc(v.category)}</span>` : ''}
        <div class="play">${PLAY_ICON}</div>
      </div>
      <div class="card-meta">
        <div><h3>${esc(v.title)}</h3><small>${esc(v.client || v.category)}</small></div>
      </div>
    </article>`;
}

// Preview on hover for cards without thumbnail images
function enableHoverPreview(root) {
  root.querySelectorAll('.card').forEach((card) => {
    const vid = card.querySelector('.thumb video');
    if (!vid) return;
    card.addEventListener('mouseenter', () => vid.play().catch(() => {}));
    card.addEventListener('mouseleave', () => vid.pause());
  });
}

function openPlayer(v, { allowDownload = false } = {}) {
  let modal = $('#player');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'player';
    modal.className = 'modal';
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal || e.target.closest('.close')) closePlayer(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePlayer(); });
  }
  modal.innerHTML = `
    <button class="close" aria-label="Close">×</button>
    <div class="modal-inner">
      <video src="${esc(v.url)}" controls autoplay playsinline ${v.thumbUrl ? `poster="${esc(v.thumbUrl)}"` : ''}></video>
      <div class="modal-info">
        <div>
          <h3>${esc(v.title)}</h3>
          ${v.description ? `<p>${esc(v.description)}</p>` : ''}
          <div class="meta-list">
            ${v.client ? `<span>Client <b>${esc(v.client)}</b></span>` : ''}
            <span>Type <b>${esc(v.category)}</b></span>
            ${v.tools ? `<span>Tools <b>${esc(v.tools)}</b></span>` : ''}
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:start">
          <button class="btn btn-sm" onclick="copyText(location.origin + '/v/${esc(v.id)}')">Copy link</button>
          ${allowDownload ? `<a class="btn btn-sm" href="${esc(v.url)}" download>Download</a>` : ''}
        </div>
      </div>
    </div>`;
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closePlayer() {
  const modal = $('#player');
  if (!modal) return;
  modal.classList.remove('open');
  modal.innerHTML = '';
  document.body.style.overflow = '';
}

function toast(msg) {
  let t = $('#toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2200);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  toast('Link copied');
}

function setLogo(name) {
  const parts = String(name || 'Portfolio').trim().split(/\s+/);
  const first = esc(parts[0]);
  document.querySelectorAll('.logo').forEach((el) => (el.innerHTML = `${first}<span>.</span>`));
}
