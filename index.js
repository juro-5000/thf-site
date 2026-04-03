const IMAGES = ["img/1.webp","img/2.webp","img/3.webp","img/4.webp","img/5.webp","img/6.webp"];

const slides = IMAGES.map((src, i) => {
  const div = document.createElement('div');
  div.className = 'slide' + (i === 0 ? ' active' : '');
  div.style.backgroundImage = 'url(' + src + ')';
  document.getElementById('hero').insertBefore(div, document.getElementById('hero').firstChild);
  return div;
});

const dotsWrap = document.getElementById('nav-dots');
const dotEls = IMAGES.map((_, i) => {
  const d = document.createElement('div');
  d.className = 'ndot' + (i === 0 ? ' active' : '');
  d.onclick = () => goTo(i);
  dotsWrap.appendChild(d);
  return d;
});

let cur = 0;
function goTo(n) {
  slides[cur].classList.remove('active');
  dotEls[cur].classList.remove('active');
  cur = n;
  slides[cur].classList.add('active');
  dotEls[cur].classList.add('active');
}
setInterval(() => goTo((cur + 1) % IMAGES.length), 4500);

// Scroll — fade out hero, keep it opaque until scroll starts
window.addEventListener('scroll', () => {
  const heroH = document.getElementById('hero').offsetHeight;
  const progress = Math.min(window.scrollY / (heroH * 0.55), 1);
  slides.forEach(s => { s.style.opacity = s.classList.contains('active') ? (1 - progress) : 0; });
  document.getElementById('hero-overlay').style.opacity = 1 - progress * 0.5;
  document.getElementById('hero-content').style.opacity = Math.max(0, 1 - progress * 2.5);
  checkVisible();
});

function checkVisible() {
  [document.getElementById('divider'), document.getElementById('what-is'),
   ...document.querySelectorAll('.fcard'), document.getElementById('platforms'),
   document.getElementById('rules')]
  .forEach(el => {
    if (el && el.getBoundingClientRect().top < window.innerHeight * 0.9)
      el.classList.add('visible');
  });
}
checkVisible();

// Copy to clipboard
let toastTimer;
function copyText(text, label) {
  navigator.clipboard.writeText(text).then(() => {
    const t = document.getElementById('copy-toast');
    t.textContent = label || 'Copied!';
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
  });
}

// Player count
async function fetchStatus() {
  const dot = document.getElementById('status-dot');
  const txt = document.getElementById('player-text');
  try {
    const res = await fetch('https://api.mcstatus.io/v2/status/java/thfproject.xyz');
    const data = await res.json();
    if (data.online) {
      const n = data.players?.online ?? 0;
      txt.textContent = n === 1 ? '1 player online' : n + ' players online';
      dot.className = 'status-dot';
    } else {
      dot.className = 'status-dot offline';
      txt.textContent = 'Server offline';
    }
  } catch(e) {
    dot.className = 'status-dot offline';
    txt.textContent = 'Could not reach server';
  }
}
fetchStatus();
setInterval(fetchStatus, 30000);
