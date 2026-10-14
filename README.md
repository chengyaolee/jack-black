# Jack Black ♠️
### Lightweight Vegas Blackjack Game & Hi-Lo Card Counting Trainer

A lightweight, zero-dependency, browser-based Blackjack game and card counting trainer. Includes authentic Vegas casino rules, custom programmatic SVG cards and casino chips, Web Audio sound synthesis, a Speed Counting Drill mode, and a multi-seat Vegas table with an erratic AI $\Delta$ parameter.

---

## 🚀 Quick Start

### Option 1: Direct in Browser
Open `index.html` directly in your favorite modern browser (Chrome, Edge, Safari, Firefox). No installation or compilation needed!

```bash
open index.html
```

### Option 2: Local Static Server
You can also run it using any static HTTP server:

```bash
# Using Node / npm
npm start
# or npx serve . -l 3000

# or using Python 3
python3 -m http.server 3000
```
Then visit `http://localhost:3000` in your browser.

---

## 🎮 Game Modes

### 1. ⚡ Speed Drill (Practice Mode)
A flashcard drill engineered to train rapid visual pattern recognition and mental arithmetic:
- **Speed Settings:** Beginner (1.5s/card), Casino Dealer (0.8s/card), Speed Demon (0.35s/card), or custom slider (0.2s - 2.0s).
- **Cluster Dealing:** Single card, pairs, or triplets dealing.
- **Batch Check-ins:** Deals $N$ cards (5, 10, 15, 20) before pausing for your count.
- **Continuous Shoe Toggle:** Test yourself round-by-round or maintain a continuous running count across a 6-deck shoe.
- **Interactive Numpad & Keyboard:** Supports on-screen numpad, keyboard numbers, `+/-` sign toggle, and `Enter`.
- **Round Breakdown:** Shows your guess vs actual count, exact response time in milliseconds, and a timeline of each card with its `+1 / 0 / -1` tag and mathematical step-by-step summing.
- **Session Scoring:** Performance report with accuracy %, average speed, streak, and rank titles (e.g., *MIT Blackjack Legend*, *Vegas Pit Boss Nightmare*).

### 2. 🎰 Vegas Table (AI Simulation Mode)
Play authentic Las Vegas blackjack alongside AI players:
- **Table Seat Selector:** Play 1 to 5 seats. You occupy your seat, and AI bots occupy the remaining positions.
- **The AI "Crazy" Parameter ($\Delta \in [0.0, 1.0]$):**
  - **$\Delta = 0.0$:** 100% mathematically optimal GTO Basic Strategy play.
  - **$\Delta > 0.0$:** The engine rolls a random float $r \in [0, 1]$. If $r \le \Delta$, the AI chooses a random *legal* casino move (e.g. hitting on hard 18, splitting 10s, standing on 12 against a 10).
  - *Why this helps:* Simulates unpredictable table companions who take the dealer's bust cards or hit unexpectedly, training you to maintain your count under casino chaos.
- **Vegas Casino Rules Engine:**
  - 6-deck shoe with 75% penetration cut-card and Fisher-Yates shuffle.
  - Natural Blackjack pays 3:2.
  - Dealer stands on all 17s (S17).
  - Double Down allowed on any initial 2 cards.
  - Double After Split (DAS) allowed.
  - Pair splitting (Aces receive 1 card each).
  - Insurance offered when dealer shows an Ace (pays 2:1).

---

## 🧠 Card Counting & Hint Engine

### Hi-Lo System
* **`+1`**: `2, 3, 4, 5, 6` (Low cards that favor the dealer when remaining in shoe)
* **`0`**: `7, 8, 9` (Neutral cards)
* **`-1`**: `10, J, Q, K, A` (High cards that favor the player)

### Real-Time Metrics
* **Running Count (RC):** Accurately registers only cards revealed face-up. Dealer's hole card is not counted until flipped face up!
* **Decks Remaining:** Estimated to nearest half-deck (standard human counting method).
* **True Count (TC):** $\text{Running Count} / \text{Decks Remaining}$.

### Learning Toggles (HUD)
1. **💡 Betting Hints:** Evaluates True Count before bets are placed. Advises table minimum on neutral/negative counts, and ramps bets (2x, 4x, 8x) on favorable counts. Warns you if you overbet on negative shoes!
2. **🎯 Strategy Hints:** Evaluates your hand vs the dealer upcard using full Basic Strategy tables + **Illustrious 18 Count Deviations** (e.g., standing on 16 vs 10 when $\text{TC} \ge 0$, taking insurance when $\text{TC} \ge +3$). Recommended action button pulses with gold glow.
3. **👁️ Peek Count:** Hidden by default so you count in your head; click or hover to inspect Running Count, True Count, and shoe penetration.
4. **📖 Strategy Chart:** Interactive color-coded Vegas Basic Strategy matrix (Hard, Soft, Pairs).
5. **🎓 Counting Guide:** Tutorial explaining values, true count conversion, bet ramping, and deviations.

---

## ⌨️ Keyboard Shortcuts

* **`Space`**: Deal Cards / Stand / Advance Hand
* **`H`**: Hit
* **`S`**: Stand
* **`D`**: Double Down
* **`P`**: Split Pairs
* **`0-9`, `+`, `-`, `Enter`**: Numpad inputs during Practice Mode

---

## 🎨 Asset & Architecture Strategy

* **Zero External Downloads:** Programmatic SVG playing cards with precise pip coordinates, royal court illustrations, and casino diamond backs.
* **Web Audio API:** Synthesized card slides, card flips, chip clinks, win fanfares, and bust sound effects.
* **Casino Baize:** CSS radial gradient felt with gold embossed banners and 3D casino chip styling.
