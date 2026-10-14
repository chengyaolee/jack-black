/**
 * Programmatic SVG Playing Cards Asset Generator
 * Generates crisp, scalable vector playing cards with zero image downloads.
 * Authentic pip arrangements, regal face card artwork, and casino diamond backs.
 */

export const SUITS = {
  SPADES: { name: 'Spades', symbol: '♠', color: '#1e293b', isRed: false },
  HEARTS: { name: 'Hearts', symbol: '♥', color: '#dc2626', isRed: true },
  DIAMONDS: { name: 'Diamonds', symbol: '♦', color: '#dc2626', isRed: true },
  CLUBS: { name: 'Clubs', symbol: '♣', color: '#1e293b', isRed: false }
};

export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export function getHiLoValue(rank) {
  if (['2', '3', '4', '5', '6'].includes(rank)) return 1;
  if (['7', '8', '9'].includes(rank)) return 0;
  if (['10', 'J', 'Q', 'K', 'A'].includes(rank)) return -1;
  return 0;
}

export function getCardBlackjackValues(rank) {
  if (rank === 'A') return [1, 11];
  if (['K', 'Q', 'J', '10'].includes(rank)) return [10];
  return [parseInt(rank, 10)];
}

// Precise standard pip coordinate layouts on 160x224 card viewBox
const PIP_CONFIG = {
  '2': [{ x: 80, y: 60 }, { x: 80, y: 164, rotate: 180 }],
  '3': [{ x: 80, y: 60 }, { x: 80, y: 112 }, { x: 80, y: 164, rotate: 180 }],
  '4': [
    { x: 55, y: 60 }, { x: 105, y: 60 },
    { x: 55, y: 164, rotate: 180 }, { x: 105, y: 164, rotate: 180 }
  ],
  '5': [
    { x: 55, y: 60 }, { x: 105, y: 60 },
    { x: 80, y: 112 },
    { x: 55, y: 164, rotate: 180 }, { x: 105, y: 164, rotate: 180 }
  ],
  '6': [
    { x: 55, y: 60 }, { x: 105, y: 60 },
    { x: 55, y: 112 }, { x: 105, y: 112 },
    { x: 55, y: 164, rotate: 180 }, { x: 105, y: 164, rotate: 180 }
  ],
  '7': [
    { x: 55, y: 60 }, { x: 105, y: 60 },
    { x: 80, y: 86 },
    { x: 55, y: 112 }, { x: 105, y: 112 },
    { x: 55, y: 164, rotate: 180 }, { x: 105, y: 164, rotate: 180 }
  ],
  '8': [
    { x: 55, y: 60 }, { x: 105, y: 60 },
    { x: 80, y: 86 },
    { x: 55, y: 112 }, { x: 105, y: 112 },
    { x: 80, y: 138, rotate: 180 },
    { x: 55, y: 164, rotate: 180 }, { x: 105, y: 164, rotate: 180 }
  ],
  '9': [
    { x: 55, y: 56 }, { x: 105, y: 56 },
    { x: 55, y: 92 }, { x: 105, y: 92 },
    { x: 80, y: 112 },
    { x: 55, y: 132, rotate: 180 }, { x: 105, y: 132, rotate: 180 },
    { x: 55, y: 168, rotate: 180 }, { x: 105, y: 168, rotate: 180 }
  ],
  '10': [
    { x: 55, y: 54 }, { x: 105, y: 54 },
    { x: 80, y: 76 },
    { x: 55, y: 92 }, { x: 105, y: 92 },
    { x: 55, y: 132, rotate: 180 }, { x: 105, y: 132, rotate: 180 },
    { x: 80, y: 148, rotate: 180 },
    { x: 55, y: 170, rotate: 180 }, { x: 105, y: 170, rotate: 180 }
  ]
};

// SVG paths for suits with smooth curves
function getSuitPath(suitKey, size = 20) {
  const half = size / 2;
  switch (suitKey) {
    case 'HEARTS':
      return `<path d="M 0,${-size * 0.15} C ${-size * 0.5},${-size * 0.65} ${-size},${-size * 0.1} 0,${size * 0.55} C ${size},${-size * 0.1} ${size * 0.5},${-size * 0.65} 0,${-size * 0.15} Z" />`;
    case 'DIAMONDS':
      return `<path d="M 0,${-size * 0.55} L ${size * 0.42},0 L 0,${size * 0.55} L ${-size * 0.42},0 Z" />`;
    case 'CLUBS':
      return `
        <circle cx="0" cy="${-size * 0.22}" r="${size * 0.24}" />
        <circle cx="${-size * 0.22}" cy="${size * 0.08}" r="${size * 0.24}" />
        <circle cx="${size * 0.22}" cy="${size * 0.08}" r="${size * 0.24}" />
        <path d="M 0,${-size * 0.05} L ${-size * 0.08},${size * 0.5} L ${size * 0.08},${size * 0.5} Z" />
      `;
    case 'SPADES':
    default:
      return `
        <path d="M 0,${-size * 0.55} C ${-size * 0.5},${-size * 0.05} ${-size * 0.45},${size * 0.3} 0,${size * 0.18} C ${size * 0.45},${size * 0.3} ${size * 0.5},${-size * 0.05} 0,${-size * 0.55} Z" />
        <path d="M 0,${size * 0.1} L ${-size * 0.09},${size * 0.5} L ${size * 0.09},${size * 0.5} Z" />
      `;
  }
}

// Stylized face card artwork (Jack, Queen, King)
function getFaceCardArt(rank, suit) {
  const isRed = suit.isRed;
  const strokeColor = suit.color;
  const gold = '#eab308';
  const blue = '#2563eb';
  const mantleColor = isRed ? '#f87171' : '#60a5fa';

  let crownOrHat = '';
  let details = '';

  if (rank === 'J') {
    crownOrHat = `
      <!-- Jack Hat with Feather -->
      <path d="M 60,65 Q 80,50 100,65 L 105,75 L 55,75 Z" fill="${blue}" stroke="${strokeColor}" stroke-width="1.5" />
      <path d="M 75,55 Q 60,40 50,42 Q 65,48 78,57" fill="none" stroke="${gold}" stroke-width="2.5" stroke-linecap="round" />
    `;
    details = `
      <!-- Halberd / Spear -->
      <line x1="50" y1="55" x2="50" y2="155" stroke="${gold}" stroke-width="2" />
      <polygon points="50,48 45,60 55,60" fill="${gold}" />
    `;
  } else if (rank === 'Q') {
    crownOrHat = `
      <!-- Queen Ornate Crown -->
      <polygon points="58,72 63,55 72,65 80,50 88,65 97,55 102,72" fill="${gold}" stroke="${strokeColor}" stroke-width="1.5" />
      <circle cx="80" cy="50" r="3" fill="${isRed ? '#dc2626' : '#2563eb'}" />
    `;
    details = `
      <!-- Royal Scepter with Rose -->
      <line x1="52" y1="75" x2="52" y2="150" stroke="${gold}" stroke-width="2" />
      <circle cx="52" cy="72" r="5" fill="${isRed ? '#dc2626' : '#ec4899'}" stroke="${gold}" stroke-width="1" />
    `;
  } else if (rank === 'K') {
    crownOrHat = `
      <!-- King Imperial Crown -->
      <rect x="58" y="65" width="44" height="8" rx="2" fill="${gold}" stroke="${strokeColor}" stroke-width="1.5" />
      <polygon points="58,65 65,48 73,58 80,45 87,58 95,48 102,65" fill="${gold}" stroke="${strokeColor}" stroke-width="1.5" />
      <circle cx="80" cy="45" r="3.5" fill="${isRed ? '#dc2626' : '#2563eb'}" />
    `;
    details = `
      <!-- Sword of Justice -->
      <line x1="108" y1="55" x2="108" y2="150" stroke="${gold}" stroke-width="2.5" />
      <line x1="100" y1="70" x2="116" y2="70" stroke="${gold}" stroke-width="2" />
      <!-- Beard -->
      <path d="M 72,100 Q 80,112 88,100" fill="none" stroke="${strokeColor}" stroke-width="2.5" stroke-linecap="round" />
    `;
  }

  return `
    <g class="face-art">
      <!-- Outer Decorative Tapestry Border -->
      <rect x="36" y="36" width="88" height="152" rx="4" fill="#fafafa" stroke="${gold}" stroke-width="1.5" stroke-dasharray="3,2" />
      
      <!-- Mantle / Robe -->
      <path d="M 45,155 L 45,115 Q 60,105 80,105 Q 100,105 115,115 L 115,155 Z" fill="${mantleColor}" stroke="${strokeColor}" stroke-width="1.5" />
      <path d="M 65,110 L 80,135 L 95,110 Z" fill="${gold}" stroke="${strokeColor}" stroke-width="1.5" />
      
      <!-- Head / Face -->
      <circle cx="80" cy="88" r="15" fill="#fed7aa" stroke="${strokeColor}" stroke-width="1.5" />
      
      <!-- Eyes & Smile -->
      <circle cx="75" cy="85" r="1.5" fill="${strokeColor}" />
      <circle cx="85" cy="85" r="1.5" fill="${strokeColor}" />
      <path d="M 77,93 Q 80,96 83,93" fill="none" stroke="${strokeColor}" stroke-width="1.2" stroke-linecap="round" />
      
      ${crownOrHat}
      ${details}
      
      <!-- Center Emblem Badge -->
      <g transform="translate(80, 142) scale(0.65)" fill="${strokeColor}">
        ${getSuitPath(suit.name.toUpperCase(), 24)}
      </g>
    </g>
  `;
}

// Ace Large Center Art
function getAceArt(suit) {
  const isSpade = suit.name === 'Spades';
  const size = isSpade ? 72 : 56;
  const fill = suit.color;

  let filigree = '';
  if (isSpade) {
    filigree = `
      <g stroke="#94a3b8" stroke-width="1.2" fill="none" opacity="0.6">
        <path d="M 40,112 Q 60,75 80,75 Q 100,75 120,112" />
        <path d="M 40,112 Q 60,150 80,150 Q 100,150 120,112" />
        <circle cx="80" cy="112" r="38" stroke-dasharray="2,3" />
      </g>
    `;
  }

  return `
    <g class="ace-center">
      ${filigree}
      <g transform="translate(80, 112)" fill="${fill}">
        ${getSuitPath(suit.name.toUpperCase(), size)}
      </g>
      <text x="80" y="165" font-family="'Times New Roman', serif" font-weight="bold" font-size="11" fill="${suit.color}" text-anchor="middle" letter-spacing="1">
        ${suit.name.toUpperCase()}
      </text>
    </g>
  `;
}

/**
 * Returns full SVG string for front of card
 */
export function generateCardFrontSVG(rank, suitKey) {
  const suit = SUITS[suitKey] || SUITS.SPADES;
  const isRed = suit.isRed;
  const color = suit.color;
  const isFaceCard = ['J', 'Q', 'K'].includes(rank);
  const isAce = rank === 'A';

  // Corner pip font sizing
  const rankFontSize = rank === '10' ? '22' : '24';
  const miniSuitSize = 14;

  let centerContent = '';
  if (isFaceCard) {
    centerContent = getFaceCardArt(rank, suit);
  } else if (isAce) {
    centerContent = getAceArt(suit);
  } else {
    // Number pips
    const pips = PIP_CONFIG[rank] || [];
    centerContent = pips.map(p => {
      const rot = p.rotate ? `rotate(${p.rotate})` : '';
      return `
        <g transform="translate(${p.x}, ${p.y}) ${rot}" fill="${color}">
          ${getSuitPath(suitKey, 20)}
        </g>
      `;
    }).join('\n');
  }

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 224" class="card-svg w-full h-full select-none" preserveAspectRatio="xMidYMid meet">
      <defs>
        <filter id="card-soft-shadow" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.15" />
        </filter>
        <linearGradient id="card-sheen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#ffffff" />
          <stop offset="100%" stop-color="#f8fafc" />
        </linearGradient>
      </defs>

      <!-- Card Base -->
      <rect x="2" y="2" width="156" height="220" rx="10" fill="url(#card-sheen)" stroke="#cbd5e1" stroke-width="1.5" />
      
      <!-- Subtle Inner Border -->
      <rect x="7" y="7" width="146" height="210" rx="7" fill="none" stroke="#f1f5f9" stroke-width="1" />

      <!-- Top-Left Corner Index -->
      <g transform="translate(14, 26)">
        <text x="0" y="0" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-weight="800" font-size="${rankFontSize}" fill="${color}" text-anchor="middle">
          ${rank}
        </text>
        <g transform="translate(0, 14) scale(0.65)" fill="${color}">
          ${getSuitPath(suitKey, miniSuitSize)}
        </g>
      </g>

      <!-- Bottom-Right Inverted Corner Index -->
      <g transform="translate(146, 198) rotate(180)">
        <text x="0" y="0" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-weight="800" font-size="${rankFontSize}" fill="${color}" text-anchor="middle">
          ${rank}
        </text>
        <g transform="translate(0, 14) scale(0.65)" fill="${color}">
          ${getSuitPath(suitKey, miniSuitSize)}
        </g>
      </g>

      <!-- Center Elements -->
      ${centerContent}
    </svg>
  `;
}

/**
 * Returns full SVG string for back of card (Authentic Casino Diamond Weave)
 */
export function generateCardBackSVG(theme = 'navy') {
  const isRedTheme = theme === 'burgundy';
  const baseColor = isRedTheme ? '#831843' : '#1e3a8a';
  const darkColor = isRedTheme ? '#500724' : '#0f172a';
  const goldColor = '#fbbf24';

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 224" class="card-svg w-full h-full select-none" preserveAspectRatio="xMidYMid meet">
      <defs>
        <pattern id="casino-diamond-${theme}" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="16" height="16" fill="${baseColor}" />
          <path d="M 0,0 L 16,16 M 16,0 L 0,16" stroke="${goldColor}" stroke-width="0.8" opacity="0.45" />
          <circle cx="8" cy="8" r="2.5" fill="${goldColor}" opacity="0.6" />
          <circle cx="0" cy="0" r="1.5" fill="${goldColor}" opacity="0.5" />
          <circle cx="16" cy="16" r="1.5" fill="${goldColor}" opacity="0.5" />
        </pattern>
        <linearGradient id="back-sheen-${theme}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.15" />
          <stop offset="100%" stop-color="#000000" stop-opacity="0.25" />
        </linearGradient>
      </defs>

      <!-- Card Base with White Border -->
      <rect x="2" y="2" width="156" height="220" rx="10" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" />
      
      <!-- Pattern Body with Double Inset Gold Border -->
      <rect x="8" y="8" width="144" height="208" rx="6" fill="url(#casino-diamond-${theme})" stroke="${darkColor}" stroke-width="1.5" />
      <rect x="12" y="12" width="136" height="200" rx="4" fill="none" stroke="${goldColor}" stroke-width="1.2" opacity="0.85" />
      
      <!-- Center Casino Medallion -->
      <circle cx="80" cy="112" r="28" fill="${darkColor}" stroke="${goldColor}" stroke-width="2" />
      <circle cx="80" cy="112" r="23" fill="${baseColor}" stroke="${goldColor}" stroke-width="1" stroke-dasharray="2,2" />
      
      <!-- Medallion Spade Logo -->
      <g transform="translate(80, 112) scale(0.85)" fill="${goldColor}">
        <path d="M 0,-14 C -8,-2 -7,7 0,4 C 7,7 8,-2 0,-14 Z" />
        <path d="M 0,3 L -2,12 L 2,12 Z" />
      </g>
      
      <!-- Sheen Overlay -->
      <rect x="2" y="2" width="156" height="220" rx="10" fill="url(#back-sheen-${theme})" pointer-events="none" />
    </svg>
  `;
}

/**
 * Creates a complete DOM node for a card with 3D flip support
 */
export function createCardElement(card, options = {}) {
  const { faceUp = true, theme = 'navy', showCountBadge = false, animate = true } = options;

  const wrapper = document.createElement('div');
  wrapper.className = `card-wrapper relative select-none ${animate ? 'animate-card-deal' : ''}`;
  wrapper.dataset.rank = card.rank;
  wrapper.dataset.suit = card.suit;
  wrapper.dataset.hilo = getHiLoValue(card.rank);

  const inner = document.createElement('div');
  inner.className = `card-inner w-full h-full ${faceUp ? 'is-flipped' : ''}`;

  const front = document.createElement('div');
  front.className = 'card-face card-front absolute inset-0';
  front.innerHTML = generateCardFrontSVG(card.rank, card.suit);

  const back = document.createElement('div');
  back.className = 'card-face card-back absolute inset-0';
  back.innerHTML = generateCardBackSVG(theme);

  inner.appendChild(front);
  inner.appendChild(back);
  wrapper.appendChild(inner);

  if (showCountBadge) {
    const hilo = getHiLoValue(card.rank);
    const badge = document.createElement('div');
    const badgeColor = hilo > 0 ? 'bg-emerald-600 text-white' : (hilo < 0 ? 'bg-rose-600 text-white' : 'bg-slate-600 text-white');
    badge.className = `absolute -top-2 -right-2 px-1.5 py-0.5 rounded-full text-[10px] font-black shadow-md z-10 border border-white/40 ${badgeColor}`;
    badge.innerText = hilo > 0 ? `+${hilo}` : `${hilo}`;
    wrapper.appendChild(badge);
  }

  return wrapper;
}
