// The superior circle constant
const TAU = 6.283185307179586;

// Desired FPS
const FRAMES_PER_SECOND = 60;

// Maximum allowed number of frames to attempt to render at once.
// Larger values allow higher FPS to be reached and reduce visible lag,
// but this comes at the cost of reducing render accuracy and causing
// clipping.
const MAX_CATCH_UP_FRAMES = 3;

// Maximum allowed number of frames to be caught up before engine
// "forgives" the delay and allows the game to continue
const MAX_DELAY_FRAMES = 30;

// Debugging tools
const DEV_MODE = true;
const DEBUG_LEVEL = true;
let infFlow = false;
if (DEV_MODE) {
	(function () { var script = document.createElement('script'); script.src = "eruda.js"; document.body.append(script); script.onload = function () { eruda.init(); } })();
}


const LS_PLAYER_HUE = 'exit-path-3-player-hue';

const ENABLE_THOUGHTS = true;
// Desired frame time (in milliseconds). If frame time
// goes above this limit, lag reduction measures begin.
// The game runs at 60 fps, so any frame longer than 1000/60t
// milliseconds causes lag.
const FRAME_TIME = 1000 / FRAMES_PER_SECOND;
let startTime;
let leaveTime;
let frameCount = 0;
let timer = 0;
let frameTime = 0;
let bestTime = Infinity;

const EPSILON = 0.0001;

let width;

// HTML elements and canvas contexts
const bgLayerEl = document.getElementById('bg-layer');
const bg1El = document.getElementById('bg-1');
const bg2El = document.getElementById('bg-2');
const fgLayerEl = document.getElementById('fg-layer');
const gameLayerEl = document.getElementById('game-layer');
const gameObjectsEl = document.getElementById('game-objects');
const buttonsEl = document.getElementById('buttons');
const laserLightsEl = document.getElementById('laser-lights');
const movingSpikesEl = document.getElementById('moving-spikes');
const movingBlocksEl = document.getElementById('moving-blocks');
const wheelsEl = document.getElementById('wheels');
const pendulumsEl = document.getElementById('pendulums');
const playerSelvesEl = document.getElementById('player-selves');
const flowParticlesEl = document.getElementById('flow-particles');
const tpFlashesEl = document.getElementById('teleporter-flashes');
const startFlashesEl = document.getElementById('start-flashes');
const laserSmokesEl = document.getElementById('laser-smokes');
const flowMeterLayerEl = document.getElementById('flow-meter-layer');
const flowReadyTextEl = document.getElementById('flow-ready-text');
const devInfoEl = document.getElementById('dev-info');
const debugEl = document.getElementById('debug');
const timerEl = document.getElementById('timer');
const thoughtsEl = document.getElementById('thoughts');
const colorPickerEl = document.getElementById('color-picker');
const stageTextEl = document.getElementById('stage-text');
const themeNameEl = document.getElementById('theme-name');
const levelNameEl = document.getElementById('level-name');
const personalBestEl = document.getElementById('personal-best');
const hs1to5El = document.getElementById('one-to-five');
const hs6to10El = document.getElementById('six-to-ten');
const bgCtx = bgLayerEl.getContext('2d', { alpha: false });
const bg1Ctx = bg1El.getContext('2d');
const bg2Ctx = bg2El.getContext('2d');
const fgCtx = fgLayerEl.getContext('2d');
const gameCtx = gameLayerEl.getContext('2d');
const fmCtx = flowMeterLayerEl.getContext('2d');
const cpCtx = colorPickerEl.getContext('2d');

const scores = [];

function score(name, sc) {
	scores.push([name, sc]);
}

function initializeScores() {
	scores.sort((a, b) => {
		const as = a[1],
			ai = as.indexOf(':'),
			bs = b[1],
			bi = bs.indexOf(':');

		return (as.substring(0, ai) + as.substring(ai + 1)) -
			(bs.substring(0, bi) + bs.substring(bi + 1));
	});

	scores.splice(10);

	for (let i = 0; i < scores.length; i++) {
		const name = scores[i][0],
			sc = scores[i][1];
		if (i < 5) {
			hs1to5El.children[i].textContent = `${name} — ${sc}`;
		} else {
			hs6to10El.children[i - 5].textContent = `${name} — ${sc}`;
		}
	}
}

// Set widths
bgLayerEl.width = width;
gameLayerEl.width = width;

let stages, stageIndex;

let playButton, hsButton, backButton;

const widthDiff = window.innerWidth - document.body.clientWidth;

function updateWidth() {
	width = document.body.clientWidth + widthDiff;
	bgLayerEl.width = width;
	gameLayerEl.width = width;
	playButton.style.left = Math.floor(width / 2 - playButton.offsetWidth / 2) + 'px';
	hsButton.style.left = Math.floor(width / 2 - hsButton.offsetWidth / 2) + 'px';
	backButton.style.left = Math.floor(width / 2 - backButton.offsetWidth / 2) + 'px';
	if (stageIndex) {
		bgCtx.fillStyle = stages[stageIndex].theme.bgStyle;
	} else {
		bgCtx.fillStyle = '#333';
	}
	bgCtx.fillRect(0, 0, width, 400);
}

window.addEventListener('resize', updateWidth);


// CSS Fonts
/**
 * Creates a CSS font definition.
 * 
 * @param name The font's name
 * @param size The font's size in pixels
 * @param italic Whether the font should be italicized
 * @param bold Whether the font should be bolded
 */
function fontDefinition(name, size, italic, bold) {
	const family = `"${name}", sans-serif`;
	const style = italic ? 'italic' : 'normal';
	const weight = bold ? 'bold' : 'normal';
	// Use the standard TeX ratio for leading
	const leading = Math.floor(1.2 * size);
	return `${style} normal ${weight} ${size}px/${leading}px ${family}`;
}

// Shorthand for Arial fonts
function arial(size, bold) {
	return fontDefinition('Arial', size, false, bold);
}

function roboto(size, bold) {
	return fontDefinition('Roboto', size, false);
}

function drawSquare(ctx, squareX, squareY, squareWidth, polygonHeight, outline) {
	ctx.fillRect(squareX, squareY, squareWidth, polygonHeight);
	if (outline) {
		ctx.strokeRect(squareX, squareY, squareWidth, polygonHeight);
	}
}

function centerText(ctx, text, x, y) {
	const textWidth = ctx.measureText(text).width;
	ctx.fillText(text, x - textWidth / 2, y);
}
// Modified from https://www.html5canvastutorials.com/tutorials/html5-canvas-wrap-text-tutorial/
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
	if (lineHeight === undefined) {
		lineHeight = (+ctx.font.match(/(\d+)px/)[1]) * 1.2;
	}
	const words = text.split(' ');
	let line = '';
	for (let i = 0; i < words.length; i++) {
		const largerLine = line + words[i] + ' ';
		const largerWidth = ctx.measureText(largerLine).width;
		if (largerWidth > maxWidth && i > 0) {
			ctx.fillText(line, x, y);
			line = words[i] + ' ';
			y += lineHeight;
		}
		else {
			line = largerLine;
		}
	}
	ctx.fillText(line, x, y);
}

function wrapCenterText(ctx, text, x, y, maxWidth, lineHeight) {
	if (lineHeight === undefined) {
		lineHeight = (+ctx.font.match(/(\d+)px/)[1]) * 1.2;
	}
	const words = text.split(' ');
	let line = '';
	for (let i = 0; i < words.length; i++) {
		const largerLine = line + words[i] + ' ';
		const largerWidth = ctx.measureText(largerLine).width;
		if (largerWidth > maxWidth && i > 0) {
			const lineWidth = ctx.measureText(line).width;
			ctx.fillText(line, x - lineWidth / 2, y);
			line = words[i] + ' ';
			y += lineHeight;
		}
		else {
			line = largerLine;
		}
	}
	const lineWidth = ctx.measureText(line).width;
	ctx.fillText(line, x - lineWidth / 2, y);
}

/**
 * Returns a m:ss.ss representation of the given amount
 * of frames. For example, time(150) returns "0:02.50".
 * 
 * @param data An amount of frames
 * @returns A m:ss.ss representation of the given amount
 */
function time(data) {
	if (data < 0) { return '-' + time(-data); }
	let minutes = data / 3600 | 0;
	let seconds = ((data / 60) % 60).toFixed(2);
	/* Tabs left with zeroes. */
	if (seconds < 10) { seconds = "0" + seconds; }
	if (minutes < 10) { minutes = "0" + minutes; }
	return minutes + ":" + seconds;
};


function ellipse(ctx, cx, cy, rx, ry, rot, aStart, aEnd) {
	if (ctx.ellipse) {
		ctx.ellipse(cx, cy, rx, ry, rot, aStart, aEnd);
	} else {
		// Because IE is a horrible browser. From:
		// https://gist.github.com/floriancargoet/20cede87a76b4073177f
		ctx.save();
		ctx.translate(cx, cy);
		ctx.rotate(rot);
		ctx.translate(-rx, -ry);

		ctx.scale(rx, ry);
		ctx.arc(1, 1, 1, aStart, aEnd, false);
		ctx.restore();
	}
}

let paused = false, pauseButton;

// User input constants
const LEFT = 37,
	UP = 38,
	RIGHT = 39,
	DOWN = 40,
	SHIFT = 16;
const pressedKeys = new Set();

/*let mouseX = 200, mouseY = 200;
window.addEventListener('mousemove', e => {
	mouseX = e.clientX;
	mouseY = e.clientY;
}, true);*/

window.addEventListener('keydown', e => {
	const keyString = String.fromCharCode(e.keyCode).toUpperCase();
	pressedKeys.add(e.keyCode);
	pressedKeys.add(keyString);
	if (keyString === ' ' || e.keyCode === LEFT || e.keyCode === RIGHT || e.keyCode === UP || e.keyCode === DOWN) {
		e.preventDefault();
	}
	if (keyString === 'P') {
		pauseButton.click(); // Press P to pause
	}
});
window.addEventListener('keyup', e => {
	const keyString = String.fromCharCode(e.keyCode).toUpperCase();
	pressedKeys.delete(e.keyCode);
	pressedKeys.delete(keyString);
});

// Color picker setup (modified from https://jsfiddle.net/cse_tushar/GSkJT/)
let player,
	playerImage,
	playerHue;

try {
	playerHue = window.localStorage === null ? null : +window.localStorage.getItem(LS_PLAYER_HUE);
} catch (e) {
	playerHue = null;
}

if (playerHue === null) {
	playerHue = TAU / 3; // Green
}

const CP_RADIUS = 80;
for (let hue = TAU / 360; hue < TAU; hue += TAU / 360) {
	cpCtx.beginPath();
	cpCtx.moveTo(100, 100);
	cpCtx.arc(100, 100, CP_RADIUS, hue - TAU / 180, hue);
	cpCtx.closePath();
	cpCtx.fillStyle = `hsla(${hue}rad,100%,50%,0.3)`;
	cpCtx.fill();
}
cpCtx.fillStyle = '#FFF';
cpCtx.font = arial(15, true);
centerText(cpCtx, 'PICK YOUR COLOR', 100, 15);
cpCtx.font = arial(13, true);
centerText(cpCtx, 'PRESS "P" OR THE RESUME', 100, 195);
cpCtx.font = arial(12, true);
centerText(cpCtx, 'BUTTON (TOP LEFT) TO RESUME', 100, 215);

function setPlayerImage(hue) {
	playerImage = createImage(20, 20, ctx => {
		const playerGradient = ctx.createLinearGradient(0, 0, 20, 20);

		playerGradient.addColorStop(0.25, `hsl(${hue}rad,100%,50%)`);
		playerGradient.addColorStop(0.75, `hsl(${hue}rad,100%,30%)`);
		ctx.fillStyle = playerGradient;
		ctx.fillRect(0, 0, 20, 20);
	});
}

function setThree(hue) {
	document.getElementById('three').style.color = `hsl(${hue}rad,100%,50%)`;
}

setPlayerImage(playerHue);
setThree(playerHue);

colorPickerEl.addEventListener('click', event => {
	const cpLeft = colorPickerEl.offsetLeft + colorPickerEl.clientLeft,
		cpTop = colorPickerEl.offsetTop + colorPickerEl.clientTop,
		x = event.pageX - cpLeft,
		y = event.pageY - cpTop,
		dx = 100 - x,
		dy = 100 - y,
		distSquared = dx * dx + dy * dy;
	if (distSquared < CP_RADIUS * CP_RADIUS) {
		// Hit inside color picker!
		playerHue = Math.atan2(dy, dx) + TAU / 2;
		try {
			if (window.localStorage !== null) {
				window.localStorage.setItem(LS_PLAYER_HUE, playerHue);
			}
		} catch (e) {
			// Who cares?
		}
		setPlayerImage(playerHue);
		setThree(playerHue);
		player.clear();
		clearFlags();
		clearShards();
		drawFlags();
		drawShards();
		player.draw();
		const flowGradient = player.createFlowGradient();
		fmCtx.fillStyle = flowGradient;
		player.drawFlowMeter(-0.25, player.flowLevel);
	}
});

// Buttons
const buttonsToScreens = new Map();

/**
 * Creates an ingame-pressable button.
 * @param x The button's x-position
 * @param y The button's y-position
 * @param textContent The button's starting text
 * @param buttonScreen The game screen where the button is
 *                     displayed
 * @param callback Called when the button is pressed
 * @return The button as an HTML element
 */
function createButton(x, y, textContent, buttonScreen, callback) {
	const buttonEl = document.createElement('button');
	buttonEl.type = 'button';
	buttonEl.style.left = x + 'px';
	buttonEl.style.top = y + 'px';
	buttonEl.classList.add('button', buttonScreen + '-button');
	buttonEl.textContent = textContent;

	buttonsToScreens.set(buttonEl, buttonScreen);
	buttonEl.addEventListener('click', () => {
		callback(buttonEl);
	});
	buttonsEl.appendChild(buttonEl);
	return buttonEl;
}

pauseButton = createButton(5, 10, 'Pause', 'game', buttonEl => {
	paused = !paused;
	colorPickerEl.hidden = !paused;
	buttonEl.textContent = paused ? 'Resume' : 'Pause';
	const animEls = document.querySelectorAll('.wheel,.pendulum');
	for (const animEl of animEls) {
		animEl.style.animationPlayState = paused ? 'paused' : 'running';
	}
});

playButton = createButton(0, 200, 'PLAY', 'menu', buttonEl => {
	timer = 0;
	stageIndex = 0;
	player.startedMoving = false;
	stages[stageIndex].initialize();
	changeScreen('game');
});

hsButton = createButton(0, 300, 'FASTEST RUNNERS', 'menu', buttonEl => {
	changeScreen('highscores');
});

backButton = createButton(0, 300, 'BACK', 'highscores', buttonEl => {
	changeScreen('menu');
});

updateWidth();

createButton(5, 25, 'Skip Stage (+2:00)', 'game', buttonEl => {
	if (stages.length > stageIndex + 1) {
		timer += 7200;
		stages[++stageIndex].initialize();
	} else {
		bestTime = Math.min(timer, bestTime);
		personalBestEl.textContent = `PERSONAL BEST — ${time(bestTime)}`;
		// Do something when game ends
	}
});


// Automatically pause the game when tabs are switched
function pauseGame() {
	leaveTime = window.performance.now();
	paused = false;
	pauseButton.click();
}

document.addEventListener('visibilitychange', () => {
	if (document.hidden) {
		leaveTime = window.performance.now();
		paused = false;
		pauseButton.click();
	} else if (leaveTime !== undefined) {
		startTime += window.performance.now() - leaveTime;
	}
});

// Screens
let screen;

let cityTheme;

function changeScreen(newScreen) {
	screen = newScreen;
	for (const [buttonEl, buttonScreen] of buttonsToScreens.entries()) {
		const notScreen = buttonScreen !== screen;
		buttonEl.disabled = notScreen;
		buttonEl.hidden = notScreen;
	}
	if (screen === 'menu') {
		cityTheme.drawBackground(Math.floor(width + 400));
	} else if (screen === 'highscores') {
		testingTheme.drawBackground(width);
		bg1El.style.left = '0px';
		bg2El.style.left = '0px';
	}
	stageTextEl.hidden = themeNameEl.hidden = levelNameEl.hidden = fgLayerEl.hidden = gameLayerEl.hidden = flowMeterLayerEl.hidden = timerEl.hidden = screen !== 'game';
	colorPickerEl.hidden = screen !== 'game' || !paused;
	document.getElementById('ep3').hidden = screen !== 'menu';
	personalBestEl.hidden = screen !== 'menu' && screen !== 'highscores';
	personalBestEl.style.color = screen === 'menu' ? '#FFF' : '#000';
	document.getElementById('hs').hidden = document.getElementById('hs-instructions').hidden = hs1to5El.hidden = hs6to10El.hidden = screen !== 'highscores';
}

// Optimization from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/repeat
function repeat(str, count) {
	str = str + '';
	const maxCount = str.length * count;
	count = Math.floor(Math.log(count) / Math.log(2));
	while (count) {
		str += str;
		count--;
	}
	str += str.substring(0, maxCount - str.length);
	return str;
}

/**
 * Takes a number brightness and returns a grayscale color.
 * If 0 <= brightness <= 15, returns between 0=black and 15=white.
 * If 16 <= brightness <= 255, returns between 0=black and 255=white.
 * 
 * @param brightness Color brightness
 */
function gray(brightness) {
	brightness = Math.floor(brightness);
	return '#' + repeat((brightness).toString(16), 3);
}

function angle(x1, y1, x2, y2) {
	const ang = Math.atan2(y2 - y1, x2 - x1);
	// Return positive results
	return ang < 0 ? ang + TAU : ang;
}

// Returns the angle of p1 relative to p2
function anglePoints(p1, p2) {
	const x1 = p1 & X_MASK,
		y1 = (p1 & Y_MASK) >> 16,
		x2 = p2 & X_MASK,
		y2 = (p2 & Y_MASK) >> 16;
	return angle(x1, y1, x2, y2);
}

// Game images
function createImage(width, height, callback) {
	const imageEl = document.createElement('canvas');
	imageEl.width = width;
	imageEl.height = height;
	callback(imageEl.getContext('2d'));
	return imageEl;
}

const mirrorImage = createImage(20, 20, ctx => {
	const gradient = ctx.createLinearGradient(0, 0, 20, 20);
	gradient.addColorStop(0, '#6662');
	gradient.addColorStop(0.5, '#FFF2');
	gradient.addColorStop(1, '#6662');
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, 20, 20);
	ctx.strokeStyle = '#CCC4';
	ctx.lineWidth = 2;
	ctx.strokeRect(0, 0, 20, 20);
});

const flowBlockImage = createImage(20, 20, ctx => {
	const gradient = ctx.createLinearGradient(0, 0, 20, 20);
	gradient.addColorStop(0.25, '#888');
	gradient.addColorStop(0.75, '#444');
	ctx.fillStyle = gradient;
	ctx.beginPath();
	ctx.moveTo(10, 0);
	ctx.lineTo(20, 10);
	ctx.lineTo(10, 20);
	ctx.lineTo(0, 10);
	ctx.fill();
	ctx.strokeStyle = 'rgb(96,96,96)';
	ctx.lineWidth = 4;
	ctx.strokeRect(0, 0, 20, 20);
	ctx.globalCompositeOperation = 'destination-out';
	ctx.beginPath();
	ellipse(ctx, 10, 10, 4, 4, 0, 0, TAU);
	ctx.fill();
	ctx.globalCompositeOperation = 'source-over';
});

const leftMoverImage = createImage(20, 20, ctx => {
	const gradient = ctx.createLinearGradient(0, 0, 20, 20);
	gradient.addColorStop(0, '#111');
	gradient.addColorStop(0.5, '#666');
	gradient.addColorStop(1, '#111');
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, 20, 20);
	ctx.strokeStyle = 'rgb(96,96,96)';
	ctx.lineWidth = 3;
	ctx.strokeRect(0, 0, 20, 20);
	ctx.strokeStyle = 'rgb(160,160,160)';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(2, 3);
	ctx.lineTo(18, 3);
	ctx.moveTo(2, 17);
	ctx.lineTo(18, 17);
	ctx.stroke();
	ctx.lineWidth = 2;
	for (let i = 0; i < 2; i++) {
		ctx.beginPath();
		ctx.moveTo(9 + i * 7, 7);
		ctx.lineTo(4 + i * 7, 10);
		ctx.lineTo(9 + i * 7, 13);
		ctx.stroke();
	}
});

const bouncerImage = createImage(20, 20, ctx => {
	const gradient1 = ctx.createLinearGradient(0, 0, 20, 20);
	gradient1.addColorStop(0, '#666');
	gradient1.addColorStop(0.5, '#BBB');
	gradient1.addColorStop(1, '#666');
	ctx.fillStyle = gradient1;
	for (let i = 0; i < 20; i += 2) {
		ctx.fillRect(0, i, 20, 1);
	}
	const gradient2 = ctx.createLinearGradient(0, 0, 20, 20);
	gradient2.addColorStop(0, '#666');
	gradient2.addColorStop(1, '#222');
	ctx.fillStyle = gradient2;
	for (let i = 0; i < 20; i += 2) {
		ctx.fillRect(0, i + 1, 20, 1);
	}
	ctx.strokeStyle = '#444';
	ctx.lineWidth = 3;
	ctx.strokeRect(0, 0, 20, 20);
});

const bouncerTopImage = createImage(20, 5, ctx => {
	const gradient1 = ctx.createLinearGradient(0, 0, 20, 5);
	gradient1.addColorStop(0, '#666');
	gradient1.addColorStop(1, '#222');
	ctx.fillStyle = gradient1;
	for (let i = 0; i < 20; i += 7) {
		ctx.beginPath();
		ctx.moveTo(i, 0);
		ctx.lineTo(i + 3.5, 0);
		ctx.lineTo(i - 1.5, 5);
		ctx.lineTo(i + 2, 5);
		ctx.fill();
	}
	const gradient2 = ctx.createLinearGradient(0, 0, 20, 5);
	gradient2.addColorStop(0, '#AAA');
	gradient2.addColorStop(1, '#666');
	ctx.fillStyle = gradient2;
	for (let i = 0; i < 20; i += 7) {
		ctx.beginPath();
		ctx.moveTo(i + 3.5, 0);
		ctx.lineTo(i + 7, 0);
		ctx.lineTo(i + 2, 5);
		ctx.lineTo(i + 5.5, 5);
		ctx.fill();
	}
});

const rightMoverImage = createImage(20, 20, ctx => {
	const gradient = ctx.createLinearGradient(0, 0, 20, 20);
	gradient.addColorStop(0, '#111');
	gradient.addColorStop(0.5, '#666');
	gradient.addColorStop(1, '#111');
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, 20, 20);
	ctx.strokeStyle = 'rgb(96,96,96)';
	ctx.lineWidth = 3;
	ctx.strokeRect(0, 0, 20, 20);
	ctx.strokeStyle = 'rgb(160,160,160)';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(2, 3);
	ctx.lineTo(18, 3);
	ctx.moveTo(2, 17);
	ctx.lineTo(18, 17);
	ctx.stroke();
	ctx.lineWidth = 2;
	for (let i = 0; i < 2; i++) {
		ctx.beginPath();
		ctx.moveTo(11 - i * 7, 7);
		ctx.lineTo(16 - i * 7, 10);
		ctx.lineTo(11 - i * 7, 13);
		ctx.stroke();
	}
});

const rightSpikeImage = createImage(10, 20, ctx => {
	const gradient1 = ctx.createLinearGradient(0, 0, 10, 20);
	gradient1.addColorStop(0, '#FFF');
	gradient1.addColorStop(1, '#DDD');
	ctx.fillStyle = gradient1;
	ctx.beginPath();
	ctx.moveTo(0, 0);
	ctx.lineTo(10, 3);
	ctx.lineTo(0, 3);
	ctx.moveTo(0, 7);
	ctx.lineTo(10, 10);
	ctx.lineTo(0, 10);
	ctx.moveTo(0, 13);
	ctx.lineTo(10, 17);
	ctx.lineTo(0, 17);
	ctx.fill();
	const gradient2 = ctx.createLinearGradient(0, 0, 10, 20);
	gradient2.addColorStop(0, 'rgb(196,196,196)');
	gradient2.addColorStop(1, 'rgb(128,128,128)');
	ctx.fillStyle = gradient2;
	ctx.beginPath();
	ctx.moveTo(0, 3);
	ctx.lineTo(10, 3);
	ctx.lineTo(0, 7);
	ctx.moveTo(0, 10);
	ctx.lineTo(10, 10);
	ctx.lineTo(0, 13);
	ctx.moveTo(0, 17);
	ctx.lineTo(10, 17);
	ctx.lineTo(0, 20);
	ctx.fill();
});

const rightMovingSpikeImage = createImage(20, 20, ctx => {
	const gradient1 = gameCtx.createLinearGradient(0, 0, 0, 5);
	gradient1.addColorStop(0, '#666');
	gradient1.addColorStop(1, '#FFF');
	ctx.fillStyle = gradient1;
	ctx.beginPath();
	ctx.moveTo(0, 0);
	ctx.lineTo(19, 5);
	ctx.lineTo(0, 5);
	ctx.fill();
	const gradient2 = gameCtx.createLinearGradient(0, 10, 0, 15);
	gradient2.addColorStop(0, '#666');
	gradient2.addColorStop(1, '#FFF');
	ctx.fillStyle = gradient2;
	ctx.beginPath();
	ctx.moveTo(0, 10);
	ctx.lineTo(19, 15);
	ctx.lineTo(0, 15);
	ctx.fill();
	ctx.fillStyle = '#999';
	ctx.beginPath();
	ctx.moveTo(0, 5);
	ctx.lineTo(19, 5);
	ctx.lineTo(0, 10);
	ctx.moveTo(0, 15);
	ctx.lineTo(19, 15);
	ctx.lineTo(0, 20);
	ctx.fill();
});

const flagImage = createImage(40, 100, ctx => {
	const gradient = ctx.createLinearGradient(0, 0, 20, 0);
	gradient.addColorStop(0, '#777');
	gradient.addColorStop(0.5, '#CCC');
	gradient.addColorStop(1, '#888');
	ctx.fillStyle = gradient;
	ctx.beginPath();
	ctx.moveTo(0, 100);
	ctx.quadraticCurveTo(0, 95, 10, 95);
	ctx.lineTo(18, 95);
	for (let i = 0; i < 9; i++) {
		ctx.lineTo(18, 67 - 7 * i);
		ctx.lineTo(13, 67 - 7 * i);
		ctx.lineTo(13, 66 - 7 * i);
		ctx.lineTo(18, 66 - 7 * i);
	}
	ctx.lineTo(18, 5);
	ctx.quadraticCurveTo(10, 5, 10, 0);
	ctx.lineTo(30, 0);
	ctx.quadraticCurveTo(30, 5, 22, 5);
	ctx.lineTo(22, 5);
	ctx.lineTo(22, 95);
	ctx.lineTo(30, 95);
	ctx.quadraticCurveTo(40, 95, 40, 100);
	ctx.fill();
	ctx.beginPath();
	for (let i = 0; i < 9; i++) {
		ellipse(ctx, 13, 10 + 7 * i, 3, 3, 0, 0, TAU);
	}
	ctx.fill();
});

const baseWheelImage = createImage(140, 140, ctx => {
	ctx.save();
	ctx.translate(70, 70);
	const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 70);
	gradient.addColorStop(0, '#BBB');
	gradient.addColorStop(0.55, '#DDD');
	; gradient.addColorStop(1, '#AAA');
	ctx.fillStyle = gradient;
	for (let i = 0; i < 20; i++) {
		ctx.rotate(TAU * 18 / 360);
		ctx.beginPath();
		ctx.moveTo(-18, 30);
		ctx.lineTo(0, 70);
		ctx.lineTo(18, 30);
		ctx.fill();
	}
	ctx.beginPath();
	ellipse(ctx, 0, 0, 31, 31, 0, 0, TAU);
	ctx.fill();
	ctx.restore();
	ctx.fillStyle = '#FFF';
	ctx.strokeStyle = '#444';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ellipse(ctx, 70, 70, 5, 5, 0, 0, TAU);
	ctx.fill();
	ctx.stroke();
});

const crusherImage = createImage(20, 20, ctx => {
	const gradient1 = gameCtx.createLinearGradient(0, 0, 20, 0);
	gradient1.addColorStop(0, '#999');
	gradient1.addColorStop(0.3, '#FFF');
	gradient1.addColorStop(1, '#999');
	ctx.fillStyle = gradient1;
	ctx.fillRect(0, 0, 20, 3);
	ctx.beginPath();
	ctx.moveTo(0, 3);
	ctx.lineTo(5, 20);
	ctx.lineTo(5, 3);
	ctx.moveTo(10, 3);
	ctx.lineTo(15, 20);
	ctx.lineTo(15, 3);
	ctx.fill();
	ctx.fillStyle = '#888';
	ctx.beginPath();
	ctx.moveTo(5, 3);
	ctx.lineTo(5, 20);
	ctx.lineTo(10, 3);
	ctx.moveTo(15, 3);
	ctx.lineTo(15, 20);
	ctx.lineTo(20, 3);
	ctx.fill();
});

const teleporterImage = createImage(20, 30, ctx => {
	const gradient = ctx.createLinearGradient(0, 0, 20, 30);
	gradient.addColorStop(0.25, '#AAA');
	gradient.addColorStop(0.75, '#777');
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, 20, 30);
	ctx.clearRect(3, 3, 14, 19);
});

const rightLaserBaseImage = createImage(10, 20, ctx => {
	const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 20);
	gradient.addColorStop(0, '#888');
	gradient.addColorStop(0.55, '#FFF');
	; gradient.addColorStop(1, '#888');
	ctx.fillStyle = gradient;
	ctx.beginPath();
	ellipse(ctx, 0, 10, 10, 10, 0, -TAU / 2, TAU / 2);
	ctx.fill();
});

// Helper function for sign drawing
function drawSign(ctx, x, y, width, height, fillIntensity) {
	if (fillIntensity === undefined) {
		fillIntensity = 80;
	}
	const gradient = ctx.createLinearGradient(x, y, x, y + height);
	gradient.addColorStop(0, gray(fillIntensity));
	gradient.addColorStop(0.3, gray(Math.floor(fillIntensity * 1.2)));
	gradient.addColorStop(0.5, gray(fillIntensity));

	ctx.fillStyle = gradient;
	ctx.strokeStyle = '#FFF';
	ctx.lineWidth = 1.5;
	ctx.fillRect(x, y, width, height);
	ctx.strokeRect(x, y, width, height);
}

function drawSignLight(ctx, x, y, size, fillIntensity) {
	if (fillIntensity === undefined) {
		fillIntensity = 80;
	}
	const lightGradient = ctx.createRadialGradient(x, y, 0, x, y + size, size);
	lightGradient.addColorStop(0, '#FFF4');
	lightGradient.addColorStop(1, '#AAA0');
	ctx.fillStyle = lightGradient;
	ctx.beginPath();
	ellipse(ctx, x, y + size / 2, size / 1.5, size * 0.8, 0, 0, TAU);
	ctx.fill();

	const gradient = ctx.createLinearGradient(x - size / 2, y, x + size / 2, y);
	gradient.addColorStop(0, gray(fillIntensity));
	gradient.addColorStop(0.4, gray(fillIntensity * 1.2));
	gradient.addColorStop(0.6, gray(fillIntensity));

	ctx.fillStyle = gradient;
	ctx.strokeStyle = gray(fillIntensity * 0.8);
	ctx.lineWidth = 0.3;
	ctx.beginPath();
	ctx.moveTo(x - size / 2, y - size / 20);
	ctx.lineTo(x, y - size / 2);
	ctx.lineTo(x + size / 2, y - size / 20);
	ctx.bezierCurveTo(x, y - size / 7, x, y - size / 7, x - size / 2, y - size / 20);
	ctx.fill();
	ctx.stroke();
}

function drawCitySign(ctx, text, x, y) {
	drawSign(ctx, x, y, 80, 40);
	drawSignLight(ctx, x + 15, y, 25);
	drawSignLight(ctx, x + 65, y, 25);
	ctx.font = arial(9);
	ctx.fillStyle = '#DDD';
	wrapCenterText(ctx, text, x + 40, y + 18, 80);
}
/**
 * Defines a theme for how a stage lays out its objects.
 */
class Theme {
	/**
	 * Constructs a new Theme object.
	 * 
	 * @param name The theme's name
	 */
	constructor(name) {
		this.name = name;
		this.gridPointsToImageLists = new Map();
	}
	/**
	 * Sets the theme's background style.
	 * 
	 * @param bgStyle The background style (as a CSS color or context
	 *                gradient) to use
	 * @return The Theme object (for chaining)
	 */
	setBgStyle(bgStyle) {
		this.bgStyle = bgStyle;
		return this;
	}
	/**
	 * Uses the given image for the first background layer.
	 * 
	 * @param bg1Image The image to use
	 * @return The Theme object (for chaining)
	 */
	setBg1Image(bg1Image) {
		this.bg1Image = bg1Image;
		return this;
	}
	/**
	 * Uses the given image for the second background layer.
	 * 
	 * @param bg1Image The image to use
	 * @return The Theme object (for chaining)
	 */
	setBg2Image(bg2Image) {
		this.bg2Image = bg2Image;
		return this;
	}
	/**
	 * Uses the given stroke style and line width for stage edges.
	 * @param strokeStyle Edge stroke style
	 * @param lineWidth Edge line width
	 * @return The Theme object (for chaining)
	 */
	setEdgeStyle(strokeStyle, lineWidth) {
		this.edgeStyle = strokeStyle;
		this.edgeWidth = lineWidth;
		return this;
	}
	/**
	 * Adds images to the Theme object's store of images for the
	 * given grid point.
	 * 
	 * @param gridPoint The grid point to add images for
	 * @param amount The amount of images to add
	 * @param callback A function that takes a number 0 <= i < amount
	 *                 and returns an image to be added
	 * @return The Theme object (for chaining)
	 */
	addImageRange(gridPoint, amount, callback) {
		const images = [];
		for (let i = 0; i < amount; i++) {
			images.push(callback(i));
		}
		if (this.gridPointsToImageLists.has(gridPoint)) {
			const existingImages = this.gridPointsToImageLists.get(gridPoint);
			existingImages.push(...images);
		} else {
			this.gridPointsToImageLists.set(gridPoint, images);
		}
		return this;
	}
	/**
	 * Adds images to the Theme object's store of images for the grid
	 * points representing blocks and all their variants (ramps).
	 * 
	 * @param amount The amount of images to add for each grid point
	 * @param lineWidth The width of block edge lines
	 * @param callback A function that takes (1) a number
	 *                 0 <= i < amount and (2) a Canvas context
	 *                 and returns an array containing a block fill
	 *                 style and a block stroke style
	 * @return The Theme object (for chaining)
	 */
	addBlockStyles(amount, lineWidth, callback) {
		this.addImageRange('■', amount,
			i => createImage(20, 20, ctx => {
				const [fillStyle, strokeStyle] = callback(i, ctx);
				ctx.fillStyle = fillStyle;
				ctx.strokeStyle = strokeStyle;
				ctx.lineWidth = lineWidth;
				ctx.fillRect(0, 0, 20, 20);
				ctx.strokeRect(0, 0, 20, 20);
			}));
		this.addImageRange('E', amount,
			i => createImage(20, 20, ctx => {

			}));
		this.addImageRange('¯', amount,
			i => createImage(20, 20, ctx => {
				const [fillStyle, strokeStyle] = callback(i, ctx);
				ctx.fillStyle = fillStyle;
				ctx.strokeStyle = strokeStyle;
				ctx.lineWidth = lineWidth;
				ctx.fillRect(0, 0, 20, 10);
				ctx.strokeRect(0, 0, 20, 10);
			}));
		this.addImageRange('_', amount,
			i => createImage(20, 20, ctx => {
				const [fillStyle, strokeStyle] = callback(i, ctx);
				ctx.fillStyle = fillStyle;
				ctx.strokeStyle = strokeStyle;
				ctx.lineWidth = lineWidth;
				ctx.fillRect(0, 10, 20, 10);
				ctx.strokeRect(0, 0, 10, 20);
			}));
		this.addImageRange('◢', amount,
			i => createImage(20, 20, ctx => {
				const [fillStyle, strokeStyle] = callback(i, ctx);
				ctx.fillStyle = fillStyle;
				ctx.strokeStyle = strokeStyle;
				ctx.lineWidth = lineWidth;
				ctx.beginPath();
				ctx.moveTo(0, 20);
				ctx.lineTo(20, 20);
				ctx.lineTo(20, 0);
				ctx.lineTo(0, 20);
				ctx.fill();
				ctx.stroke();
			}));
		this.addImageRange('◣', amount,
			i => createImage(20, 20, ctx => {
				const [fillStyle, strokeStyle] = callback(i, ctx);
				ctx.fillStyle = fillStyle;
				ctx.strokeStyle = strokeStyle;
				ctx.lineWidth = lineWidth;
				ctx.beginPath();
				ctx.moveTo(0, 0);
				ctx.lineTo(0, 20);
				ctx.lineTo(20, 20);
				ctx.lineTo(0, 0);
				ctx.fill();
				ctx.stroke();
			}));
		this.addImageRange('◤', amount,
			i => createImage(20, 20, ctx => {
				const [fillStyle, strokeStyle] = callback(i, ctx);
				ctx.fillStyle = fillStyle;
				ctx.strokeStyle = strokeStyle;
				ctx.lineWidth = lineWidth;
				ctx.beginPath();
				ctx.moveTo(20, 0);
				ctx.lineTo(0, 20);
				ctx.lineTo(0, 0);
				ctx.lineTo(20, 0);
				ctx.fill();
				ctx.stroke();
			}));
		this.addImageRange('◥', amount,
			i => createImage(20, 20, ctx => {
				const [fillStyle, strokeStyle] = callback(i, ctx);
				ctx.fillStyle = fillStyle;
				ctx.strokeStyle = strokeStyle;
				ctx.lineWidth = lineWidth;
				ctx.beginPath();
				ctx.moveTo(0, 0);
				ctx.lineTo(20, 0);
				ctx.lineTo(20, 20);
				ctx.lineTo(0, 0);
				ctx.fill();
				ctx.stroke();
			}));

		return this;
	}
	/**
	 * Returns an image for the given grid point, choosing an image
	 * randomly if more than one is available.
	 */
	getImageFor(gridPoint) {
		const images = this.gridPointsToImageLists.get(gridPoint);
		if (images === undefined) {
			return null; // No image found
		} else {
			// Return random image that matches grid point
			return images[Math.floor(Math.random() * images.length)];
		}
	}
	/**
	 * Draws the Theme object's background.
	 * 
	 * @param bgWidth The width of the background to draw
	 */
	drawBackground(bgWidth) {
		// Color background
		if (this.bgStyle) {
			bgCtx.fillStyle = this.bgStyle;
			bgCtx.fillRect(0, 0, width, 400);
		}
		// Set background widths (implicitly clears them)
		bg1El.width = bgWidth;
		bg2El.width = bgWidth;
		// Draw background art
		const bg1Image = this.bg1Image,
			bg2Image = this.bg2Image;
		if (bg1Image) {
			bg1Ctx.fillStyle = bg1Ctx.createPattern(bg1Image, 'repeat');
			bg1Ctx.fillRect(0, 0, bgWidth, 400);
		}
		if (bg2Image) {
			bg2Ctx.fillStyle = bg2Ctx.createPattern(bg2Image, 'repeat');
			bg2Ctx.fillRect(0, 0, bgWidth, 400);
		}
	}
}

const solitaryTheme = new Theme('Solitary Confinement')
	.setBgStyle('#888')
	.setBg2Image(createImage(25, 25, ctx => {
		const c1 = '#777',
			c2 = '#666';
		const gradient1 = ctx.createLinearGradient(0, 0, 25, 12.5);
		gradient1.addColorStop(0.25, c1);
		gradient1.addColorStop(0.75, c2);
		ctx.fillStyle = gradient1;
		ctx.fillRect(0, 0, 25, 12.5);
		const gradient2 = ctx.createLinearGradient(-12.5, 12.5, 12.5, 25);
		gradient2.addColorStop(0.25, c1);
		gradient2.addColorStop(0.75, c2);
		ctx.fillStyle = gradient2;
		ctx.fillRect(0, 12.5, 12.5, 12.5);
		const gradient3 = ctx.createLinearGradient(12.5, 12.5, 37.5, 25);
		gradient3.addColorStop(0.25, c1);
		gradient3.addColorStop(0.75, c2);
		ctx.fillStyle = gradient3;
		ctx.fillRect(12.5, 12.5, 12.5, 12.5);
		ctx.strokeStyle = '#555';
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.stroke();
	}))
	.addImageRange('□', 1, i => createImage(20, 20, ctx => {
		const c1 = gray(128),
			c2 = gray(96);
		const gradient1 = ctx.createLinearGradient(0, 0, 20, 10);
		gradient1.addColorStop(0.25, c1);
		gradient1.addColorStop(0.75, c2);
		ctx.fillStyle = gradient1;
		ctx.fillRect(0, 0, 20, 10);
		const gradient2 = ctx.createLinearGradient(-10, 10, 10, 20);
		gradient2.addColorStop(0.25, c1);
		gradient2.addColorStop(0.75, c2);
		ctx.fillStyle = gradient2;
		ctx.fillRect(0, 10, 10, 10);
		const gradient3 = ctx.createLinearGradient(10, 10, 30, 20);
		gradient3.addColorStop(0.25, c1);
		gradient3.addColorStop(0.75, c2);
		ctx.fillStyle = gradient3;
		ctx.fillRect(10, 10, 10, 10);
		ctx.strokeStyle = gray(64);
		ctx.lineWidth = 0.5;
		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.lineTo(20, 0);
		ctx.lineTo(20, 10);
		ctx.lineTo(0, 10);
		ctx.lineTo(0, 0);
		ctx.moveTo(10, 10);
		ctx.lineTo(10, 20);
		ctx.moveTo(0, 20);
		ctx.lineTo(20, 20);
		ctx.stroke();
	}))
	.addImageRange('▓', 4, i => createImage(20, 20, ctx => {
		const c1 = gray(40 + i * 4),
			c2 = gray(16 + i * 4);
		const gradient1 = ctx.createLinearGradient(0, 0, 20, 10);
		gradient1.addColorStop(0.25, c1);
		gradient1.addColorStop(0.75, c2);
		ctx.fillStyle = gradient1;
		ctx.fillRect(0, 0, 20, 10);
		const gradient2 = ctx.createLinearGradient(-10, 10, 10, 20);
		gradient2.addColorStop(0.25, c1);
		gradient2.addColorStop(0.75, c2);
		ctx.fillStyle = gradient2;
		ctx.fillRect(0, 10, 10, 10);
		const gradient3 = ctx.createLinearGradient(10, 10, 30, 20);
		gradient3.addColorStop(0.25, c1);
		gradient3.addColorStop(0.75, c2);
		ctx.fillStyle = gradient3;
		ctx.fillRect(10, 10, 10, 10);
		ctx.strokeStyle = gray(32 + i * 4);
		ctx.lineWidth = 0.5;
		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.lineTo(20, 0);
		ctx.lineTo(20, 10);
		ctx.lineTo(0, 10);
		ctx.lineTo(0, 0);
		ctx.moveTo(10, 10);
		ctx.lineTo(10, 20);
		ctx.moveTo(0, 20);
		ctx.lineTo(20, 20);
		ctx.stroke();
	}))
	.addImageRange('<', 1, i => leftMoverImage)
	.addImageRange('>', 1, i => rightMoverImage)
	.addBlockStyles(4, 5, (i, ctx) => {
		// Fill style
		const fillImage = createImage(20, 20, c => {
			const c1 = gray(80 + i * 4),
				c2 = gray(56 + i * 4);
			const gradient1 = ctx.createLinearGradient(0, 0, 20, 10);
			gradient1.addColorStop(0.25, c1);
			gradient1.addColorStop(0.75, c2);
			c.fillStyle = gradient1;
			c.fillRect(0, 0, 20, 10);
			const gradient2 = ctx.createLinearGradient(-10, 10, 10, 20);
			gradient2.addColorStop(0.25, c1);
			gradient2.addColorStop(0.75, c2);
			c.fillStyle = gradient2;
			c.fillRect(0, 10, 10, 10);
			const gradient3 = ctx.createLinearGradient(10, 10, 30, 20);
			gradient3.addColorStop(0.25, c1);
			gradient3.addColorStop(0.75, c2);
			c.fillStyle = gradient3;
			c.fillRect(10, 10, 10, 10);
			c.strokeStyle = gray(48 + i * 4);
			c.lineWidth = 0.5;
			c.beginPath();
			c.moveTo(0, 0);
			c.lineTo(20, 0);
			c.lineTo(20, 10);
			c.lineTo(0, 10);
			c.lineTo(0, 0);
			c.moveTo(10, 10);
			c.lineTo(10, 20);
			c.moveTo(0, 20);
			c.lineTo(20, 20);
			c.stroke();
		});
		const fillStyle = ctx.createPattern(fillImage, 'no-repeat');
		// Stroke style (no stroke)
		const strokeStyle = '#0000';
		return [fillStyle, strokeStyle];
	});

const testingTheme = new Theme('Testing Rooms')
	.setBgStyle('#BBB')
	.setBg1Image(createImage(75, 75, ctx => {
		ctx.strokeStyle = '#999';
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.lineTo(75, 75);
		ctx.moveTo(0, 75);
		ctx.lineTo(75, 0);
		ctx.stroke();
	}))
	.setBg2Image(createImage(200, 400, ctx => {
		const gradient = ctx.createLinearGradient(0, 0, 200, 0);
		gradient.addColorStop(0.25, '#BBBB');
		gradient.addColorStop(0.5, '#FFFB');
		gradient.addColorStop(0.75, '#BBBB');
		ctx.fillStyle = gradient;
		ctx.lineWidth = 0.5;
		ctx.beginPath();
		ctx.moveTo(50, 400);
		ctx.quadraticCurveTo(75, 350, 50, 300);
		ctx.quadraticCurveTo(75, 250, 50, 200);
		ctx.quadraticCurveTo(75, 150, 50, 100);
		ctx.quadraticCurveTo(75, 50, 50, 0);
		ctx.lineTo(150, 0);
		ctx.quadraticCurveTo(125, 50, 150, 100);
		ctx.quadraticCurveTo(125, 150, 150, 200);
		ctx.quadraticCurveTo(125, 250, 150, 300);
		ctx.quadraticCurveTo(125, 350, 150, 400);
		ctx.fill();
	}))
	.setEdgeStyle('#555', 1)
	.addImageRange('□', 1, i => createImage(20, 20, ctx => {
		ctx.fillStyle = '#5558';
		ctx.fillRect(0, 0, 20, 20);
	}))
	.addImageRange('<', 1, i => createImage(20, 20, ctx => {
		ctx.fillStyle = '#7778';
		ctx.fillRect(0, 0, 20, 20);
		ctx.strokeStyle = '#5558';
		ctx.lineWidth = 2;
		for (let i = 0; i < 2; i++) {
			ctx.beginPath();
			ctx.moveTo(9 + i * 7, 7);
			ctx.lineTo(4 + i * 7, 10);
			ctx.lineTo(9 + i * 7, 13);
			ctx.stroke();
		}
	}))
	.addImageRange('>', 1, i => createImage(20, 20, ctx => {
		ctx.fillStyle = '#7778';
		ctx.fillRect(0, 0, 20, 20);
		ctx.strokeStyle = '#5558';
		ctx.lineWidth = 2;
		for (let i = 0; i < 2; i++) {
			ctx.beginPath();
			ctx.moveTo(11 - i * 7, 7);
			ctx.lineTo(16 - i * 7, 10);
			ctx.lineTo(11 - i * 7, 13);
			ctx.stroke();
		}
	}))
	.addBlockStyles(1, 5, (i, ctx) => {
		// Fill style
		const fillImage = createImage(20, 20, c => {
			c.fillStyle = '#9998';
			c.fillRect(0, 0, 20, 20);
		});
		const fillStyle = ctx.createPattern(fillImage, 'no-repeat');
		// Stroke style (no stroke)
		const strokeStyle = '#0000';
		return [fillStyle, strokeStyle];
	});

cityTheme = new Theme('Skyline City')
	.setBgStyle('#333')
	.setBg1Image(createImage(400, 400, ctx => {
		ctx.fillStyle = '#000';
		ctx.beginPath();
		ctx.moveTo(0, 400);
		ctx.lineTo(0, 350);
		ctx.lineTo(25, 350);
		ctx.lineTo(25, 200);
		ctx.quadraticCurveTo(40, 160, 55, 200);
		ctx.lineTo(55, 250);
		ctx.lineTo(65, 250);
		ctx.lineTo(65, 245);
		ctx.quadraticCurveTo(70, 230, 75, 245);
		ctx.lineTo(75, 265);
		ctx.lineTo(55, 265);
		ctx.lineTo(55, 300);
		ctx.lineTo(75, 350);
		ctx.lineTo(100, 350);
		ctx.lineTo(125, 250);
		ctx.lineTo(125, 200);
		ctx.lineTo(115, 200);
		ctx.lineTo(115, 185);
		ctx.lineTo(130, 160);
		ctx.quadraticCurveTo(140, 185, 160, 185);
		ctx.lineTo(160, 150);
		ctx.lineTo(162, 150);
		ctx.lineTo(162, 185);
		ctx.lineTo(165, 185);
		ctx.lineTo(165, 200);
		ctx.lineTo(165, 250);
		ctx.lineTo(175, 350);
		ctx.lineTo(200, 350);
		ctx.lineTo(190, 300);
		ctx.lineTo(210, 300);
		ctx.quadraticCurveTo(210, 275, 190, 275);
		ctx.lineTo(210, 275);
		ctx.quadraticCurveTo(210, 250, 190, 250);
		ctx.lineTo(210, 250);
		ctx.quadraticCurveTo(210, 225, 190, 225);
		ctx.lineTo(210, 225);
		ctx.lineTo(210, 200);
		ctx.lineTo(185, 200);
		ctx.quadraticCurveTo(220, 185, 255, 200);
		ctx.lineTo(230, 200);
		ctx.lineTo(230, 225);
		ctx.lineTo(250, 225);
		ctx.quadraticCurveTo(230, 225, 230, 250);
		ctx.lineTo(250, 250);
		ctx.quadraticCurveTo(230, 250, 230, 275);
		ctx.lineTo(250, 275);
		ctx.quadraticCurveTo(230, 275, 230, 300);
		ctx.lineTo(255, 300);
		ctx.lineTo(240, 350);
		ctx.lineTo(280, 350);
		ctx.lineTo(300, 200);
		ctx.lineTo(300, 150);
		ctx.quadraticCurveTo(270, 150, 270, 140);
		ctx.lineTo(290, 140);
		ctx.lineTo(290, 100);
		ctx.lineTo(292, 100);
		ctx.lineTo(292, 140);
		ctx.lineTo(370, 140);
		ctx.quadraticCurveTo(370, 150, 345, 150);
		ctx.lineTo(345, 200);
		ctx.lineTo(365, 350);
		ctx.lineTo(400, 350);
		ctx.lineTo(400, 400);
		ctx.fill();
	}))
	.setBg2Image(createImage(400, 400, ctx => {
		ctx.fillStyle = '#222';
		ctx.beginPath();
		ctx.moveTo(0, 400);
		ctx.lineTo(0, 300);
		ctx.quadraticCurveTo(0, 350, 25, 350);
		ctx.lineTo(50, 350);
		ctx.lineTo(50, 250);
		ctx.lineTo(35, 210);
		ctx.lineTo(30, 170);
		ctx.lineTo(35, 170);
		ctx.lineTo(35, 110);
		ctx.lineTo(38, 110);
		ctx.lineTo(38, 170);
		ctx.lineTo(40, 170);
		ctx.quadraticCurveTo(50, 200, 70, 170);
		ctx.lineTo(75, 170);
		ctx.lineTo(70, 210);
		ctx.quadraticCurveTo(85, 270, 100, 210);
		ctx.lineTo(100, 100);
		ctx.quadraticCurveTo(100, 80, 80, 80);
		ctx.quadraticCurveTo(140, 60, 140, 80);
		ctx.lineTo(140, 250);
		ctx.lineTo(120, 350);
		ctx.lineTo(165, 350);
		ctx.quadraticCurveTo(185, 335, 165, 325);
		ctx.quadraticCurveTo(135, 310, 165, 300);
		ctx.quadraticCurveTo(185, 285, 165, 275);
		ctx.quadraticCurveTo(135, 260, 165, 250);
		ctx.quadraticCurveTo(185, 235, 165, 225);
		ctx.quadraticCurveTo(135, 210, 165, 200);
		ctx.quadraticCurveTo(185, 185, 165, 175);
		ctx.quadraticCurveTo(135, 160, 165, 150);
		ctx.quadraticCurveTo(185, 135, 145, 125);
		ctx.quadraticCurveTo(180, 90, 215, 125);
		ctx.quadraticCurveTo(170, 135, 195, 150);
		ctx.quadraticCurveTo(220, 160, 195, 175);
		ctx.quadraticCurveTo(170, 185, 195, 200);
		ctx.quadraticCurveTo(220, 210, 195, 225);
		ctx.quadraticCurveTo(170, 235, 195, 250);
		ctx.quadraticCurveTo(220, 260, 195, 275);
		ctx.quadraticCurveTo(170, 285, 195, 300);
		ctx.quadraticCurveTo(220, 310, 195, 325);
		ctx.quadraticCurveTo(170, 335, 195, 350);
		ctx.lineTo(240, 350);
		ctx.lineTo(230, 335);
		ctx.lineTo(230, 325);
		ctx.lineTo(240, 310);
		ctx.lineTo(230, 295);
		ctx.lineTo(230, 285);
		ctx.lineTo(240, 270);
		ctx.lineTo(230, 255);
		ctx.lineTo(230, 245);
		ctx.lineTo(240, 230);
		ctx.lineTo(230, 215);
		ctx.lineTo(230, 205);
		ctx.lineTo(240, 190);
		ctx.lineTo(230, 175);
		ctx.lineTo(230, 165);
		ctx.lineTo(240, 150);
		ctx.lineTo(230, 135);
		ctx.lineTo(230, 125);
		ctx.lineTo(240, 110);
		ctx.lineTo(230, 95);
		ctx.lineTo(230, 85);
		ctx.lineTo(240, 70);
		ctx.quadraticCurveTo(270, 70, 270, 150);
		ctx.lineTo(285, 150);
		ctx.lineTo(285, 50);
		ctx.lineTo(288, 50);
		ctx.lineTo(288, 150);
		ctx.lineTo(290, 150);
		ctx.quadraticCurveTo(290, 170, 270, 170);
		ctx.lineTo(280, 350);
		ctx.lineTo(300, 350);
		ctx.quadraticCurveTo(320, 250, 280, 200);
		ctx.quadraticCurveTo(280, 170, 310, 170);
		ctx.lineTo(300, 130);
		ctx.lineTo(320, 130);
		ctx.lineTo(320, 90);
		ctx.lineTo(340, 90);
		ctx.lineTo(340, 325);
		ctx.lineTo(350, 350);
		ctx.lineTo(360, 350);
		ctx.quadraticCurveTo(360, 330, 390, 330);
		ctx.lineTo(390, 320);
		ctx.quadraticCurveTo(350, 320, 350, 300);
		ctx.lineTo(350, 270);
		ctx.lineTo(390, 270);
		ctx.lineTo(390, 260);
		ctx.quadraticCurveTo(350, 260, 350, 250);
		ctx.lineTo(350, 210);
		ctx.lineTo(390, 210);
		ctx.lineTo(390, 200);
		ctx.quadraticCurveTo(350, 200, 350, 180);
		ctx.lineTo(350, 150);
		ctx.lineTo(390, 150);
		ctx.lineTo(390, 140);
		ctx.quadraticCurveTo(350, 140, 350, 120);
		ctx.lineTo(350, 90);
		ctx.lineTo(380, 90);
		ctx.lineTo(380, 40);
		ctx.lineTo(383, 40);
		ctx.lineTo(383, 90);
		ctx.lineTo(400, 90);
		ctx.quadraticCurveTo(400, 110, 360, 110);
		ctx.lineTo(360, 120);
		ctx.lineTo(400, 120);
		ctx.lineTo(400, 150);
		ctx.quadraticCurveTo(400, 170, 360, 170);
		ctx.lineTo(360, 180);
		ctx.lineTo(400, 180);
		ctx.lineTo(400, 210);
		ctx.quadraticCurveTo(400, 230, 360, 230);
		ctx.lineTo(360, 240);
		ctx.lineTo(400, 240);
		ctx.lineTo(400, 270);
		ctx.quadraticCurveTo(400, 290, 360, 290);
		ctx.lineTo(360, 300);
		ctx.lineTo(400, 300);
		ctx.lineTo(400, 400);
		ctx.fill();
	}))
	.addImageRange('□', 1, i => createImage(20, 20, ctx => {
		const gradient1 = ctx.createLinearGradient(0, 0, 20, 20);
		gradient1.addColorStop(0, '#666');
		gradient1.addColorStop(0.5, '#BBB');
		gradient1.addColorStop(1, '#666');
		ctx.fillStyle = gradient1;
		for (let i = 0; i < 20; i += 2) {
			ctx.fillRect(0, i, 20, 1);
		}
		const gradient2 = ctx.createLinearGradient(0, 0, 20, 20);
		gradient2.addColorStop(0, '#666');
		gradient2.addColorStop(1, '#222');
		ctx.fillStyle = gradient2;
		for (let i = 0; i < 20; i += 2) {
			ctx.fillRect(0, i + 1, 20, 1);
		}
		ctx.strokeStyle = '#444';
		ctx.lineWidth = 3;
		ctx.strokeRect(0, 0, 20, 20);
	}))
	.addImageRange('▓', 3, i => createImage(20, 20, ctx => {
		const gradient = ctx.createLinearGradient(0, 0, 20, 20);
		gradient.addColorStop(0.25, gray(40 + 4 * i));
		gradient.addColorStop(0.75, gray(16 + 4 * i));
		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, 20, 20);
	}))
	.addImageRange('<', 1, i => leftMoverImage)
	.addImageRange('>', 1, i => rightMoverImage)
	.addBlockStyles(3, 2, (i, ctx) => {
		// Fill style
		const fillImage = createImage(20, 20, c => {
			const gradient = c.createLinearGradient(0, 0, 20, 20);
			gradient.addColorStop(0.25, gray(80 + 6 * i));
			gradient.addColorStop(0.75, gray(32 + 6 * i));
			c.fillStyle = gradient;
			c.fillRect(0, 0, 20, 20);
		});
		const fillStyle = ctx.createPattern(fillImage, 'no-repeat');
		// Stroke style
		const strokeStyle = '#' + repeat(i + 3, 3);
		return [fillStyle, strokeStyle];
	});

const govCenterTheme = new Theme('Government Center')
	.setBgStyle('#002')
	.setBg1Image(createImage(60, 60, ctx => {
		const gradient = ctx.createLinearGradient(60, 0, 0, 60);
		gradient.addColorStop(0.3, '#0030');
		gradient.addColorStop(0.5, '#338');
		gradient.addColorStop(0.7, '#0030');
		ctx.strokeStyle = gradient;
		ctx.lineWidth = 20;
		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.lineTo(60, 60);
		ctx.stroke();
	}))
	.setBg2Image(createImage(60, 60, ctx => {
		const gradient = ctx.createLinearGradient(0, 0, 60, 60);
		gradient.addColorStop(0.3, '#0030');
		gradient.addColorStop(0.5, '#338');
		gradient.addColorStop(0.7, '#0030');
		ctx.strokeStyle = gradient;
		ctx.lineWidth = 20;
		ctx.beginPath();
		ctx.moveTo(60, 0);
		ctx.lineTo(0, 60);
		ctx.stroke();
	}))
	.addImageRange('□', 1, i => createImage(20, 20, ctx => {
		const c1 = gray(128),
			c2 = gray(96);
		const gradient1 = ctx.createLinearGradient(0, 0, 20, 10);
		gradient1.addColorStop(0.25, c1);
		gradient1.addColorStop(0.75, c2);
		ctx.fillStyle = gradient1;
		ctx.fillRect(0, 0, 20, 10);
		const gradient2 = ctx.createLinearGradient(-10, 10, 10, 20);
		gradient2.addColorStop(0.25, c1);
		gradient2.addColorStop(0.75, c2);
		ctx.fillStyle = gradient2;
		ctx.fillRect(0, 10, 10, 10);
		const gradient3 = ctx.createLinearGradient(10, 10, 30, 20);
		gradient3.addColorStop(0.25, c1);
		gradient3.addColorStop(0.75, c2);
		ctx.fillStyle = gradient3;
		ctx.fillRect(10, 10, 10, 10);
		ctx.strokeStyle = gray(64);
		ctx.lineWidth = 0.5;
		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.lineTo(20, 0);
		ctx.lineTo(20, 10);
		ctx.lineTo(0, 10);
		ctx.lineTo(0, 0);
		ctx.moveTo(10, 10);
		ctx.lineTo(10, 20);
		ctx.moveTo(0, 20);
		ctx.lineTo(20, 20);
		ctx.stroke();
	}))
	.setEdgeStyle('#338', 5)
	.addBlockStyles(1, 5, (i, ctx) => {
		// Fill style
		const fillImage = createImage(20, 20, c => {
			c.fillStyle = '#55A4';
			c.fillRect(0, 0, 20, 20);
		});
		const fillStyle = ctx.createPattern(fillImage, 'no-repeat');
		// Stroke style (no stroke)
		const strokeStyle = '#0000';
		return [fillStyle, strokeStyle];
	});

/**
 * Draws the given 20x20 image rotated at the given angle and
 * reflected accordingly.
 * 
 * @param image The 20x20 image to draw
 * @param ctx The Canvas context to use when drawing
 * @param x The x-coordinate to draw at
 * @param y The y-coordinate to draw at
 * @param angle The angle to draw at
 * @param rX Whether or not to reflect the x-axis
 * @param rY Whether or not to reflect the y-axis
 */
function drawTransformedImage(image, ctx, x, y, angle, rX, rY) {
	ctx.save();
	ctx.translate(x + 10, y + 10);
	ctx.rotate(angle);
	ctx.scale(rX ? -1 : 1, rY ? -1 : 1);
	ctx.drawImage(image, -10, -10);
	ctx.restore();
}

function createLaserLightEl(x, y) {
	const size = 80;
	const laserLightEl = createImage(size, size * 2, ctx => {
		const lightGradient = ctx.createRadialGradient(size / 2, 10, 0, size / 2, size * 1.8, size * 0.7);
		lightGradient.addColorStop(0, '#FFF8');
		lightGradient.addColorStop(1, '#FFF0');
		ctx.fillStyle = lightGradient;
		ctx.fillRect(0, 0, size, size * 2);
	});
	laserLightEl.classList.add('laser-light');
	laserLightEl.style.left = (x - size / 2) + 'px';
	laserLightEl.style.top = y + 'px';
	return laserLightEl;
}


function createWheelEl(x, y, radius) {
	const wheelEl = createImage(radius * 3, radius * 3, ctx => {
		ctx.drawImage(baseWheelImage, 0, 0, radius * 3, radius * 3);
	});
	wheelEl.classList.add('wheel');
	wheelEl.style.left = (x - 1.5 * radius) + 'px';
	wheelEl.style.top = (y - 1.5 * radius) + 'px';
	return wheelEl;
}

function createMovingSpikeEl(angle, reflect) {
	const movingSpikeEl = createImage(20, 20, ctx => {
		drawTransformedImage(rightMovingSpikeImage, ctx, 0, 0, angle, false, reflect);
	});
	movingSpikeEl.classList.add('moving-spike');
	return movingSpikeEl;
}

function createPendulumEl() {
	const pendulumEl = createImage(40, 40, ctx => {
		ctx.drawImage(baseWheelImage, 0, 0, 40, 40);
	});
	pendulumEl.classList.add('pendulum');
	return pendulumEl;
}

function think(thought, newScreen, callback) {
	if (ENABLE_THOUGHTS) {
		// Fixes an extremely cryptic bug. Consider stages A -> B -> C, where there's a thought between A and B and A is longer than B. Then when the player finishes A, the stage index is incremented and a thought appears. B is set to load when the thought animation ends. However, the game is still  going and thinks it's at stage B, but nothing has been reset yet, so the player's x-value is at the end of A, which is later than the end of B, so the game thinks the player has finished B. So the game increments the stage index and fully loads C. Then the thought animation ends and B is loaded correctly, except the stage index is now the stage index for C, so the game now thinks the ending of B is the ending of C.
		changeScreen('thought');
		const thoughtEl = document.createElement('div');
		thoughtEl.classList.add('thought');
		thoughtEl.style.width = Math.floor(width) + 'px';
		thoughtEl.innerHTML = thought;
		thoughtsEl.appendChild(thoughtEl);
		thoughtEl.addEventListener('animationend', () => {
			thoughtsEl.removeChild(thoughtEl);
			if (callback) {
				callback();
			}
			changeScreen(newScreen);
		});
	} else {
		if (callback) {
			callback();
		}
		changeScreen(newScreen);
	}
}

/**
 * Creates a flow particle.
 * @param x1 The particle's starting x-coordinate
 * @param y1 The particle's starting y-coordinate
 * @param x2 The particle's ending x-coordinate
 * @param y2 The particle's ending y-coordinate
 * @param duration Transition duration in seconds
 */
function addFlowParticleEl(x1, y1, x2, y2, duration) {
	const flowParticleEl = document.createElement('div');
	flowParticleEl.classList.add('flow-particle');
	flowParticleEl.style.left = x1 + 'px';
	flowParticleEl.style.top = y1 + 'px';
	flowParticleEl.style.backgroundColor = `hsla(${playerHue}rad,100%,50%,0.5)`;
	flowParticlesEl.appendChild(flowParticleEl);
	flowParticleEl.addEventListener('transitionend', e => {
		if (e.propertyName === 'background-color') {
			flowParticlesEl.removeChild(flowParticleEl);
		}
	});
	window.setTimeout(() => {
		flowParticleEl.style.transition = `width ${duration}s, height ${duration}s, left ${duration}s, top ${duration}s, background-color ${duration}s`;
		flowParticleEl.style.left = x2 + 'px';
		flowParticleEl.style.top = y2 + 'px';
		flowParticleEl.style.width = '1px';
		flowParticleEl.style.height = '1px';
		flowParticleEl.style.backgroundColor = `hsla(${playerHue}rad,100%,50%,0)`;
	}, 100);
}

function addTeleporterFlashEl(bottomX, bottomY) {
	const tpFlashEl = document.createElement('div');
	tpFlashEl.classList.add('teleporter-flash');
	tpFlashEl.style.left = `${bottomX}px`;
	tpFlashEl.style.top = '0px';
	tpFlashEl.style.width = '20px';
	tpFlashEl.style.height = `${bottomY}px`;
	tpFlashesEl.appendChild(tpFlashEl);
	tpFlashEl.addEventListener('animationend', () => {
		tpFlashesEl.removeChild(tpFlashEl);
	});
}

function addStartFlashEl() {
	const startFlashEl = document.createElement('div');
	startFlashEl.classList.add('start-flash');
	startFlashEl.style.width = Math.floor(width) + 'px';
	startFlashesEl.appendChild(startFlashEl);
	startFlashEl.addEventListener('animationend', () => {
		startFlashesEl.removeChild(startFlashEl);
	});
}

/**
 * Creates a laser smoke particle.
 * @param x1 The particle's starting x-coordinate
 * @param y1 The particle's starting y-coordinate
 * @param x2 The particle's ending x-coordinate
 * @param y2 The particle's ending y-coordinate
 * @param duration Transition duration in seconds
 */
function addLaserSmokeEl(x1, y1, x2, y2, duration) {
	const laserSmokeEl = document.createElement('div');
	laserSmokeEl.classList.add('laser-smoke');
	laserSmokeEl.style.left = x1 + 'px';
	laserSmokeEl.style.top = y1 + 'px';
	laserSmokesEl.appendChild(laserSmokeEl);
	laserSmokeEl.addEventListener('transitionend', e => {
		if (e.propertyName === 'background-color') {
			laserSmokesEl.removeChild(laserSmokeEl);
		}
	});
	window.setTimeout(() => {
		laserSmokeEl.style.transition = `width ${duration}s, height ${duration}s, left ${duration}s, top ${duration}s, background-color ${duration}s`;
		laserSmokeEl.style.left = x2 + 'px';
		laserSmokeEl.style.top = y2 + 'px';
		laserSmokeEl.style.width = '1px';
		laserSmokeEl.style.height = '1px';
		laserSmokeEl.style.backgroundColor = '#BBB0';
	}, 100);
}

// Gameplay
const X_MASK = 0xFFFF, // First 16 bits [0, 65535]
	Y_MASK = 0x1FF0000, // Next 9 bits after x [0, 511]
	C_MASK = 0x2000000, // Next bit after y [0, 1]
	A_MASK = 0x7C000000, // Next 5 bits after c [0, 31]
	B_MASK = 0xFC000000, // Next 6 bits after c [0, 63]
	R_MASK = 0xFE000000, // Next 7 bits after y [0, 127]
	T_MASK = 0x6000000, // Next 2 bits after y [0, 3]
	D_MASK = 0xF8000000; // Next 5 bits after t [0, 31]

/*
Uint32Arrays that store a stage's elements (where each
element is described in at most 32 bits).
 
Block, Slab, Motivator, Inhibitor, Mover, Spike, PendulumOrigin: (x: 16 bits, y: 9 bits),
Bouncer: (x: 16 bits, y: 9 bits, anim: 5 bits)
Flag: (x: 16 bits, y: 9 bits, complete: 1 bit, anim: 5 bits)
Crusher: (x: 16 bits, y: 9 bits, origin: 5 bits)
Wheel: (x: 16 bits, y: 9 bits, radius: 7 bits)
Moving Block: (x: 16 bits, 9: 9 bits, dir: 1 bit, size: 6 bits)
Moving Spike: (x: 16 bits, y: 9 bits, type: 2 bits, diff: 5 bits)
Teleporter: (x: 16 bits, y: 9 bits, playerin: 1 bit)
Ramp, Laser: (x: 16 bits, y: 9 bits, type: 2 bits, issecurity: 1 bit)
Laser Sighting: (x: 16 bits, y: 9 bits, issighting: 1 bit)
*/
let solidSet,
	partialSolidSet,
	grid,
	movingBlocks,
	movingBlockEls,
	ramps,
	blocks,
	slabs,
	motivators,
	inhibitors,
	bouncers,
	leftMovers,
	rightMovers,
	leftSpikes,
	rightSpikes,
	upSpikes,
	downSpikes,
	flags,
	crushers,
	wheels,
	wheelEls,
	movingSpikes,
	movingSpikeEls,
	pendulumOrigins,
	pendulumVels,
	pendulumAccs,
	pendulumEls,
	teleporters,
	sisterIndices,
	lasers,
	laserSightings,
	laserAngles,
	laserLightEls,
	laserLines,
	edgeLines;

function clearPendulumLines() {
	let i = pendulumEls.length;
	gameCtx.globalCompositeOperation = 'destination-out';
	gameCtx.lineWidth = 3;
	gameCtx.strokeStyle = '#FFF';
	while (i--) {
		const p = pendulumEls[i],
			o = pendulumOrigins[i],
			ox = o & X_MASK,
			oy = (o & Y_MASK) >> 16,
			a = pendulumAccs[i],
			x = 91 * Math.sin(a) + ox,
			y = 91 * Math.cos(a) + oy;
		if (Math.max(x + camera.prevX, ox + camera.prevX) > -20 &&
			Math.min(x + camera.prevX, ox + camera.prevX) < width) {
			gameCtx.beginPath();
			gameCtx.moveTo(ox + camera.prevX, oy);
			gameCtx.lineTo(x + camera.prevX, y);
			gameCtx.stroke();
			gameCtx.clearRect(ox + camera.prevX - 1, oy - 1, 2, 2);
		}
	}
	gameCtx.globalCompositeOperation = 'source-over';
}

function clearBouncers() {
	let i = bouncers.length;
	while (i--) {
		const b = bouncers[i],
			bx = Math.floor((b & X_MASK) + camera.prevX),
			by = (b & Y_MASK) >> 16,
			a = (b & A_MASK) >> 26;
		if (bx > -20 && bx < width) {
			gameCtx.clearRect(bx - 1, by - Math.floor(a / 2) - 5, 22, Math.floor(a / 2) + 8);
		}
	}
}

function clearFlags() {
	let i = flags.length;
	while (i--) {
		const f = flags[i];
		// Flag is completed, continue animation
		if (f & C_MASK) {
			const fx = ((f & X_MASK) + 4.5) + camera.prevX,
				fy = (f & Y_MASK) >> 16,
				a = (f & A_MASK) >> 26;
			if (fx > -27 && fx < width) {
				gameCtx.clearRect(fx, fy - 85, 27, 40);
			}
		}
	}
}

function clearCrushers() {
	let i = crushers.length;
	while (i--) {
		const c = crushers[i],
			cx = Math.floor((c & X_MASK) + camera.prevX),
			cy = (c & Y_MASK) >> 16,
			co = 20 * ((c & A_MASK) >> 26);
		if (cx > -15 && cx - 5 < width) {
			gameCtx.clearRect(cx - 1, co - 1, 12, cy - co + 2);
			gameCtx.clearRect(cx - 6, cy - 1, 22, 22);
		}
	}
}

function clearShards() {
	let i = shards.length;
	while (i--) {
		let s = shards[i];
		gameCtx.clearRect(s[0] + camera.prevX - 1, s[1] - 1, s[2] + 2, s[3] + 2);
	}
}
let movingPlatformSpeed = 1;
function updateMovingBlocks(numFrames) {
	let i = movingBlocks.length;
	while (i--) {
		const mb = movingBlocks[i],
			mbEl = movingBlockEls[i],
			y = (mb & Y_MASK) >> 16,
			w = ((mb & B_MASK) >>> 26) * 20,
			gridY = Math.floor(y / 20);
		let x = mb & X_MASK,
			dir = (mb & C_MASK) >> 25;
		if (dir === 0) {
			x -= movingPlatformSpeed;
			const gridLeft = Math.floor(x / 20) - 1;
			if (partialSolidSet.has(grid[gridY][gridLeft])) {
				// Switch directions
				x = gridLeft * 20 + 40;
				dir = 1;
			}
		} else {
			x += movingPlatformSpeed;
			const gridRight = Math.floor((x + w) / 20) + 1;
			if (partialSolidSet.has(grid[gridY][gridRight])) {

				// Switch directions
				x = gridRight * 20 - w - 20;
				dir = 0;
			}
		}
		// Update corresponding edge lines
		for (let j = 0; j < 8; j++) {
			const el = edgeLines[8 * i + j];
			// x-value may be x + w depending on which end of which
			// edge line it is
			const elX = j === 2 || j === 3 || j === 5 || j === 7 ? x + w : x;
			edgeLines[8 * i + j] = (el & ~X_MASK) | elX;
		}
		mbEl.style.left = x + 'px';
		movingBlocks[i] = (mb & ~X_MASK & ~C_MASK) | x | (dir << 25);
	}
}

/**
 * Draws the paths for the moving parts of laser bases and
 * actual lasers.
 * 
 * @param pad Pixels of extra space for the drawing
 * @param cx Camera's x-coordinate
 * @param drawLights Whether or not to draw blinking laser lights
 */
function drawLaserPaths(pad, cx, drawLights) {
	let i = lasers.length;
	while (i--) {
		const l = lasers[i],
			x = Math.floor((l & X_MASK) + cx),
			y = (l & Y_MASK) >> 16,
			angle = laserAngles[i];
		gameCtx.save();
		gameCtx.translate(x, y);
		gameCtx.rotate(angle);
		gameCtx.fillRect(10 - pad, -2 - pad, 5 + 2 * pad, 4 + 2 * pad);
		if ((l & D_MASK) && drawLights) { // Security laser
			gameCtx.fillStyle = player.escaping ? '#F00' : '#0F0';
			gameCtx.beginPath();
			ellipse(gameCtx, 5, 0, 2 + 2 * pad, 2 + 2 * pad, 0, 0, TAU);
			gameCtx.fill();
		}
		gameCtx.restore();
	}
	gameCtx.beginPath();
	const laserLinesLength = laserLines.length;
	for (let i = 0; i < laserLinesLength; i += 2) {
		let endpoint1 = laserLines[i],
			x1 = Math.floor((endpoint1 & X_MASK) + cx),
			y1 = (endpoint1 & Y_MASK) >> 16,
			endpoint2 = laserLines[i + 1],
			x2 = Math.floor((endpoint2 & X_MASK) + cx),
			y2 = (endpoint2 & Y_MASK) >> 16;
		if (Math.max(x1, x2) > 0 && Math.min(x1, x2) < width) {
			gameCtx.moveTo(x1, y1);
			gameCtx.lineTo(x2, y2);
		}
	}
	gameCtx.stroke();
}

function clearLasers() {
	gameCtx.lineWidth = 7;
	gameCtx.fillStyle = '#FFF';
	gameCtx.strokeStyle = '#FFF';
	gameCtx.globalCompositeOperation = 'destination-out';
	drawLaserPaths(2, camera.prevX, true);
	const laserLinesLength = laserLines.length;
	gameCtx.beginPath();
	for (let i = 0; i < laserLinesLength; i += 2) {
		let endpoint1 = laserLines[i],
			x1 = Math.floor((endpoint1 & X_MASK) + camera.prevX),
			y1 = (endpoint1 & Y_MASK) >> 16,
			endpoint2 = laserLines[i + 1],
			x2 = Math.floor((endpoint2 & X_MASK) + camera.prevX),
			y2 = (endpoint2 & Y_MASK) >> 16;
		if (Math.max(x1, x2) > 0 && Math.min(x1, x2) < width) {
			ellipse(gameCtx, x1, y1, 2, 2, 0, 0, TAU);
			ellipse(gameCtx, x2, y2, 2, 2, 0, 0, TAU);
		}
	}
	gameCtx.fill();
	gameCtx.globalCompositeOperation = 'source-over';
}

/**
 * Returns information relevant to the intersection of the
 * line segment from p0 to p1 (with direction vector d0)
 * and the line segment from p2 to p3 (with direction vector
 * d1).
 * The line that passes through p0 and p1 intersects the line that passes through p2 and p3 precisely at the point p = p0 + t * d0 = p2 + s * d1 (if it exists).
 * t and s are normalized such that 0 <= t <= 1 iff the
 * intersection is on the first line segment, and 0 <= s
 * <= 1 iff the intersection is on the second line segment.
 * 
 * Modified from StackOverflow: https://stackoverflow.com/questions/563198/how-do-you-detect-where-two-line-segments-intersect
 */
const siResult = [0, 0];
function segmentIntersection(p0_x, p0_y, p1_x, p1_y, p2_x, p2_y, p3_x, p3_y) {
	const d0_x = p1_x - p0_x,
		d0_y = p1_y - p0_y,
		d1_x = p3_x - p2_x,
		d1_y = p3_y - p2_y,
		cross = -d1_x * d0_y + d0_x * d1_y,
		t = (d1_x * (p0_y - p2_y) - d1_y * (p0_x - p2_x)) / cross,
		s = (-d0_y * (p0_x - p2_x) + d0_x * (p0_y - p2_y)) / cross;
	// Store result in siResult to avoid creating a new
	// array for return
	siResult[0] = t;
	siResult[1] = s;
}

/**
 * Returns true if the line segment from p0 to p1 intersects the line
 * segment from p2 to p3, and false otherwise. Uses the methodology
 * described in segmentIntersection.
 */
function segmentsIntersect(
	p0_x, p0_y, p1_x, p1_y,
	p2_x, p2_y, p3_x, p3_y) {
	segmentIntersection(
		p0_x, p0_y, p1_x, p1_y,
		p2_x, p2_y, p3_x, p3_y);
	const t = siResult[0],
		s = siResult[1];
	return t >= 0 && t <= 1 && s >= 0 && s <= 1;
}

function updateLasers() {
	laserLines = [];
	const px = player.x + 10,
		py = player.y + 10 + (player.sliding ? 5 : 0),
		edgeLinesLength = edgeLines.length;
	let i = lasers.length;
	while (i--) {
		const l = lasers[i],
			x = l & X_MASK,
			y = (l & Y_MASK) >> 16,
			defaultAngle = (TAU / 4) * ((l & T_MASK) >> 25);
		// Step 1: The laser's *sighting* is defined as the
		// latest player position that the laser is able to
		// hit WITHOUT using mirrors. Update the laser's
		// sighting if the laser sees the player this frame.
		const sightingAngle = angle(x, y, px, py);
		const sx = x + Math.cos(sightingAngle),
			sy = y + Math.sin(sightingAngle);
		// Only allow laser to see up to 90 degrees from its
		// initial direction. cc = counterclockwise
		const ccDist = Math.abs(sightingAngle - defaultAngle);
		let updateSighting = !player.rewinding && Math.min(ccDist, TAU - ccDist) < TAU / 8;
		for (let j = 0; j < edgeLinesLength && updateSighting; j += 2) {
			const endpoint1 = edgeLines[j],
				x1 = endpoint1 & X_MASK,
				y1 = (endpoint1 & Y_MASK) >> 16,
				endpoint2 = edgeLines[j + 1],
				x2 = endpoint2 & X_MASK,
				y2 = (endpoint2 & Y_MASK) >> 16;
			if (segmentsIntersect(
				px, py, // p0
				sx, sy, // p1
				x1, y1, // p2
				x2, y2  // p3
			)) {
				updateSighting = false;
			}
		}
		if (updateSighting) {
			// Store latest sighting
			laserSightings[i] = Math.floor(px) | (Math.floor(py)) << 16 | (1 << 25);
		}
		// Step 2: Angle the laser towards the latest
		// sighting. If the laser is already angled towards
		// the latest sighting, bring the laser angle back
		// to its default position.
		const sighting = laserSightings[i];
		let gotoAngle;
		if ((sighting & C_MASK) && !player.rewinding) { // Sighting exists
			gotoAngle = angle(
				x,
				y,
				sighting & X_MASK,
				(sighting & Y_MASK) >> 16
			);
			// Laser already angled towards latest sighting
			let gotoDist = Math.abs(laserAngles[i] - gotoAngle);
			gotoDist = Math.min(gotoDist, TAU - gotoDist);
			if (gotoDist < EPSILON) {
				// Nullify sighting so laser can go back
				laserSightings[i] = 0;
			}
		} else { // Bring laser back
			gotoAngle = defaultAngle;
		}
		let angleDiff = gotoAngle - laserAngles[i];
		// Always take the shortest path (clockwise or
		// counterclockwise)
		if (Math.abs(angleDiff - TAU) < Math.abs(angleDiff)) {
			angleDiff -= TAU;
		}
		// Restrict maximum speed
		const LASER_SPEED = TAU / 1200;
		if (angleDiff < -LASER_SPEED) {
			angleDiff = -LASER_SPEED;
		} else if (angleDiff > LASER_SPEED) {
			angleDiff = LASER_SPEED;
		}
		laserAngles[i] += angleDiff;
		laserAngles[i] %= TAU;
		// Step 3: If security laser and player isn't escaping, adjust laser light and end
		if ((l & D_MASK)) {
			const laserLightEl = laserLightEls[i];
			if (player.escaping) {
				laserLightEl.hidden = true;
			} else {
				laserLightEl.hidden = false;
				laserLightEl.style.transform = `rotate(${laserAngles[i] - TAU / 4}rad)`;
				continue;
			}
		}
		// STEP 4: FIRE THE LASER!
		if (!(sighting & C_MASK)) {
			continue; // Don't fire if going back
		}
		let ang = laserAngles[i],
			lx = x + 15 * Math.cos(ang),
			ly = y + 15 * Math.sin(ang);
		for (let j = 0; j < 20; j++) {
			// Find nearest edge intersecting laser
			let leastT = Infinity,
				cx = Math.cos(ang),
				cy = Math.sin(ang),
				leastX1, leastX2, leastY1, leastY2,
				leastIsMirror;
			for (let k = 0; k < edgeLinesLength; k += 2) {
				const endpoint1 = edgeLines[k],
					x1 = endpoint1 & X_MASK,
					y1 = (endpoint1 & Y_MASK) >> 16,
					isMirror = endpoint1 & C_MASK,
					endpoint2 = edgeLines[k + 1],
					x2 = endpoint2 & X_MASK,
					y2 = (endpoint2 & Y_MASK) >> 16;
				segmentIntersection(
					lx, ly, // p0
					lx + cx, ly + cy, // p1
					x1, y1, // p2
					x2, y2  // p3
				);
				const t = siResult[0],
					s = siResult[1];
				if (t >= 0 && t <= leastT && s >= 0 && s <= 1) {
					leastT = t;
					leastIsMirror = isMirror;
					leastX1 = x1;
					leastY1 = y1;
					leastX2 = x2;
					leastY2 = y2;
				}
			}
			if (leastT === Infinity) {
				break; // Should never happen
			} else {
				// Must be at least 0 or else the game goes crazy
				// (shoving negatives into a uint is a no-no)
				const ix = lx + leastT * cx,
					iy = ly + leastT * cy;
				laserLines.push(
					Math.floor(lx) | (Math.floor(ly) << 16),
					Math.floor(Math.max(0, ix)) | (Math.floor(Math.max(0, iy)) << 16)
				);
				// Restart process from reflected angle
				if (leastIsMirror) {
					// c is the laser's direction vector
					// m is the mirror's direction vector
					const mx = leastX2 - leastX1,
						my = leastY2 - leastY1;
					// Positive indicates laser on one
					// side of mirror, negative indicates
					// laser on other side.
					// https://stackoverflow.com/questions/1560492/how-to-tell-whether-a-point-is-to-the-right-or-left-side-of-a-line
					const pos = mx * (ly - leastY1) - my * (lx - leastX1);
					let mirrorAngle = Math.atan2(my, mx);
					// Make sure mirror angle is in the
					// interval [0, tau)
					if (mirrorAngle < 0) {
						mirrorAngle += TAU;
					}
					// Flip mirror angle if laser on other
					// side
					if (pos < 0) {
						mirrorAngle = (mirrorAngle + TAU / 2) % TAU;
					}
					// Dot product of the two vectors
					const dot = cx * mx + cy * my;
					// Magnitude of m
					const magM = Math.sqrt(mx * mx + my * my);
					// Use dot product cosine identity to
					// find angle between vectors
					let angBetween = Math.acos(dot / magM);
					// Correct angle between if laser on
					// other side of mirror
					if (pos < 0) {
						angBetween = TAU / 2 - angBetween;
					}
					ang = (mirrorAngle + angBetween) % TAU;

					// Restart process
					lx = ix + Math.cos(ang);
					ly = iy + Math.sin(ang);
					leastT = Infinity;
				} else {
					break;
				}
			}
		}
		// Step 4: Add laser smoke
		const lastLineEnding = laserLines[laserLines.length - 1],
			lastX = lastLineEnding & X_MASK,
			lastY = (lastLineEnding & Y_MASK) >> 16;
		addLaserSmokeEl(
			lastX,
			lastY,
			lastX + Math.random() * 10 - 5,
			lastY - 15,
			1 + Math.random() * 2
		);
	}
}

function drawLasers() {
	gameCtx.lineWidth = 4;
	gameCtx.fillStyle = '#EEE';
	gameCtx.strokeStyle = '#F00';
	drawLaserPaths(0, camera.x, Math.floor(timer / 30) % 2 === 0);
	gameCtx.lineWidth = 1;
	gameCtx.fillStyle = '#0000';
	gameCtx.strokeStyle = '#FFF';
	drawLaserPaths(0, camera.x, Math.floor(timer / 30) % 2 === 0);
}

function drawPendulums() {
	let i = pendulumEls.length;
	gameCtx.strokeStyle = '#DDD';
	gameCtx.lineWidth = 1;
	while (i--) {
		const p = pendulumEls[i],
			o = pendulumOrigins[i],
			ox = o & X_MASK,
			oy = (o & Y_MASK) >> 16,
			a = pendulumAccs[i],
			x = 90 * Math.sin(a) + ox,
			y = 90 * Math.cos(a) + oy;
		p.style.left = `${Math.floor(x) - 20}px`;
		p.style.top = `${Math.floor(y) - 20}px`;
		if (Math.max(x + camera.x, ox + camera.x) > -20 &&
			Math.min(x + camera.x, ox + camera.x) < width) {
			gameCtx.beginPath();
			gameCtx.moveTo(ox + camera.x, oy);
			gameCtx.lineTo(x + camera.x, y);
			gameCtx.stroke();
		}
	}
}

function updateMovingSpikeEls() {
	let i = movingSpikeEls.length;
	while (i--) {
		const m = movingSpikes[i],
			mEl = movingSpikeEls[i];
		mx = m & X_MASK,
			my = (m & Y_MASK) >> 16,
			mt = (m & T_MASK) >> 25,
			md = ((m & D_MASK) >>> 27);
		if (mt === 0 || mt === 1) {
			mx += md;
		} else {
			my += md;
		}
		mEl.style.left = mx + 'px';
		mEl.style.top = my + 'px';
	}
}


function drawBouncers(numFrames) {
	let i = bouncers.length;
	while (i--) {
		const b = bouncers[i],
			bx = b & X_MASK,
			by = (b & Y_MASK) >> 16;
		let a = (b & A_MASK) >> 26;
		if (a > 0) {
			a = Math.max(0, a - numFrames);
			bouncers[i] = (b & ~A_MASK) | (a << 26);
		}
		const x = Math.floor(bx + camera.x);
		if (x > -20 && x < width) {
			gameCtx.lineWidth = 1;
			gameCtx.strokeStyle = 'rgb(255,255,0)';
			gameCtx.beginPath();
			gameCtx.moveTo(x, by);
			gameCtx.lineTo(x + 19, by - Math.floor(a / 2) - 2);
			gameCtx.stroke();
			gameCtx.strokeStyle = 'rgb(255,128,0)';
			gameCtx.beginPath();
			gameCtx.moveTo(x + 20, by);
			gameCtx.lineTo(x + 1, by - Math.floor(a / 2) - 2);
			gameCtx.stroke();
			gameCtx.drawImage(bouncerTopImage, x, by - Math.floor(a / 2) - 5);
		}
	}
}

function drawFlags() {
	let i = flags.length;
	while (i--) {
		const f = flags[i];
		// Flag is completed, continue animation
		if (flags[i] & C_MASK) {
			const fx = (f & X_MASK) + 0.5,
				fy = (f & Y_MASK) >> 16,
				a = (f & A_MASK) >> 26;
			const flagX = fx + camera.x + 5;
			const flagFlow = Math.sin(timer * TAU / 180) * 5;
			const flagGradient = gameCtx.createLinearGradient(flagX + 5, fy - 75 + flagFlow, flagX + 15, fy - 55 + flagFlow);
			flagGradient.addColorStop(0, `hsl(${playerHue}rad,100%,50%)`);
			flagGradient.addColorStop(0.5, `hsl(${playerHue}rad,100%,40%)`);
			flagGradient.addColorStop(1, `hsl(${playerHue}rad,100%,50%)`);
			gameCtx.fillStyle = flagGradient;
			gameCtx.beginPath();
			gameCtx.moveTo(flagX, fy - 75);
			gameCtx.quadraticCurveTo(flagX + a / 2, fy - 75 + 2 * flagFlow, flagX + a, fy - 75 + flagFlow);
			gameCtx.quadraticCurveTo(flagX + a, fy - 75, flagX + a, fy - 75);
			gameCtx.quadraticCurveTo(flagX + a, fy - 55 + flagFlow, flagX + a, fy - 55 + flagFlow);
			gameCtx.quadraticCurveTo(flagX + a / 2, fy - 55 + flagFlow * 2, flagX, fy - 55);
			gameCtx.lineTo(flagX, fy - 55);
			gameCtx.fill();
		}
	}
}

function drawShards() {
	let i = shards.length;
	while (i--) {
		const s = shards[i],
			sa = Math.min(1, s[6] / 250);
		gameCtx.fillStyle = `hsla(${playerHue}rad,100%,50%,${sa})`;
		gameCtx.fillRect(s[0] + camera.x, s[1], s[2], s[3]);
	}
}

function drawCrushers() {
	let i = crushers.length;
	while (i--) {
		const c = crushers[i],
			cx = Math.floor((c & X_MASK) + camera.x),
			cy = (c & Y_MASK) >> 16,
			co = 20 * ((c & A_MASK) >> 26);
		if (cx > -15 && cx - 5 < width) {
			const crusherGradient = gameCtx.createLinearGradient(cx, co, cx + 10, co);
			crusherGradient.addColorStop(0, '#999');
			crusherGradient.addColorStop(0.3, '#FFF');
			crusherGradient.addColorStop(1, '#999');
			gameCtx.fillStyle = crusherGradient;
			gameCtx.fillRect(cx, co, 10, cy - co);
			gameCtx.drawImage(crusherImage, cx - 5, cy);
		}
	}
}

const camera = {
	left: -Infinity,
	right: 0,
	x: 0,
	prevX: 0
};

// Player shards
let shards = [];

// Amount of positions to store in history
const HISTORY_SIZE = 10000;
// Amount of times faster history plays versus gameplay
const HISTORY_SPEED = 10;
// Multiplier for amount of selves in history
const HISTORY_DENSITY = 2;
// Time and index of last recorded history position
let lastHistoryTime,
	lastFlagHistoryIndex,
	lastHistoryIndex;
const history = new Uint32Array(HISTORY_SIZE);

function shardCollide(s, vx, vy, numFrames) {
	let x = s[0],
		y = s[1],
		w = s[2],
		h = s[3];
	let i = bouncers.length;
	while (i--) {
		const b = bouncers[i],
			bx = b & X_MASK;
		if (bx < x + w && bx + 20 > x) {
			const by = (b & Y_MASK) >> 16;
			if (by < y + h && by + 20 > y) {
				if (vx < 0) {
					s[4] = vx * -1 / 3;
					x = bx + 20;
				}
				else if (vx > 0) {
					s[4] = vx * -1 / 3;
					x = bx - w;
				}
				if (vy < 0) {
					s[4] *= 0.8;
					s[5] = vy * -1 / 3;
					y = by + 20;
				}
				else if (vy > 0) {
					const a = (b & A_MASK) >> 26;
					s[5] = -4.2;
					y = by - 20;
					// Set bouncer animation
					bouncers[i] = (b & ~A_MASK) | (10 << 26);
				}
			}
		}
	}
	i = leftMovers.length;
	while (i--) {
		const m = leftMovers[i],
			mx = m & X_MASK;
		if (mx < x + w && mx + 20 > x) {
			const my = (m & Y_MASK) >> 16;
			if (my < y + h && my + 20 > y) {
				if (vx < 0) {
					s[4] = vx * -1 / 3;
					x = mx + 20;
				}
				else if (vx > 0) {
					s[4] = vx * -1 / 3;
					x = mx - w;
				}
				if (vy < 0) {
					s[4] *= 0.8;
					s[5] = vy * -1 / 3;
					y = my + 20;
				}
				else if (vy > 0) {
					s[4] *= 0.8;
					s[5] = vy * -1 / 3;
					y = my - h;
					x -= 1;
				}
			}
		}
	}
	i = rightMovers.length;
	while (i--) {
		const m = rightMovers[i],
			mx = m & X_MASK;
		if (mx < x + w && mx + 20 > x) {
			const my = (m & Y_MASK) >> 16;
			if (my < y + h && my + 20 > y) {
				if (vx < 0) {
					s[4] = vx * -1 / 3;
					x = mx + 20;
				}
				else if (vx > 0) {
					s[4] = vx * -1 / 3;
					x = mx - w;
				}
				if (vy < 0) {
					s[4] *= 0.8;
					s[5] = vy * -1 / 3;
					y = my + 20;
				}
				else if (vy > 0) {
					s[4] *= 0.8;
					s[5] = vy * -1 / 3;
					y = my - h;
					x += 1;
				}
			}
		}
	}
	i = ramps.length;
	while (i--) {
		const r = ramps[i],
			rx = r & X_MASK;
		if (rx < x + w && rx + 20 > x) {
			const baseY = (r & Y_MASK) >> 16,
				rt = (r & T_MASK) >> 25,
				// Ramp goes up as x goes up
				slopeIsPositive = rt % 2 === 0,
				// Flat part of ramp is on bottom
				flatOnBottom = rt < 2;
			// y-value of sloping part of ramp
			let slopeY;
			if (slopeIsPositive) {
				slopeY = baseY + rx - x + 20 - h;
			} else {
				slopeY = baseY + x - rx;
			}
			// Top and bottom y-values of ramp
			let topY, botY;
			if (flatOnBottom) {
				topY = Math.max(slopeY, baseY);
				botY = baseY + 20;
			} else {
				topY = baseY;
				botY = Math.min(slopeY + 20, baseY + 20);
			}
			if (topY < y + h && botY > y) {
				if (vx < 0) {
					if (flatOnBottom) {
						// Check if we are hitting the right side
						// by seeing if our x-value is high enough
						// that we must have crossed into the ramp
						// this very frame. We must also verify
						// that we're not about to board the ramp
						// by checking that our bottom y is low
						// enough that it's at or below the surface
						// of the ramp.
						if (x >= rx + 20 + vx * numFrames &&
							y + h >= topY - vx * numFrames
						) {
							s[4] = vx * -1 / 3;
							x = rx + 20;
						} else {
							s[4] *= 0.8;
							s[5] = vy * -1 / 3;
							y = topY - h;
						}
					} else {
						if (x >= rx + 20 + vx * numFrames) {
							s[4] = vx * -1 / 3;
							x = rx + 20;
						} else {
							s[4] *= 0.8;
							s[5] = vy * -1 / 3;
							y = botY;
						}
					}
				}
				else if (vx > 0) {
					if (flatOnBottom) {
						// Check if we are hitting the left side
						// by seeing if our x-value is low enough
						// that we must have crossed into the ramp
						// this very frame. We must also verify
						// that we're not about to board the ramp
						// by checking that our bottom y is low
						// enough that it's at or below the surface
						// of the ramp.
						if (x <= rx - w + vx * numFrames &&
							y + h >= topY + vx * numFrames
						) {
							s[4] = vx * -1 / 3;
							x = rx - w;
						} else {
							s[4] *= 0.8;
							s[5] = vy * -1 / 3;
							y = topY - h;
						}
					} else {
						if (x <= rx - w + vx * numFrames) {
							s[4] = vx * -1 / 3;
							x = rx - w;
						} else {
							s[4] *= 0.8;
							s[5] = vy * -1 / 3;
							y = botY;
						}
					}
				}
				if (vy < 0) {
					s[4] *= 0.8;
					s[5] = vy * -1 / 3;
					y = botY;
				}
				else if (vy > 0) {
					s[4] *= 0.8;
					s[5] = vy * -1 / 3;
					y = topY - h;
				}
			}
		}
	}
	i = blocks.length;
	while (i--) {
		const b = blocks[i],
			bx = b & X_MASK;
		if (bx < x + w && bx + 20 > x) {
			let by = (b & Y_MASK) >> 16;
			if (by < y + h && by + 20 > y) {
				if (vx < 0) {
					s[4] = vx * -1 / 3;
					x = bx + 20;
				}
				else if (vx > 0) {
					s[4] = vx * -1 / 3;
					x = bx - w;
				}
				if (vy < 0) {
					s[4] *= 0.8;
					s[5] = vy * -1 / 3;
					y = by + 20;
				}
				else if (vy > 0) {
					s[4] *= 0.8;
					s[5] = vy * -1 / 3;
					y = by - h;
				}
			}
		}
	}
	i = motivators.length;
	while (i--) {
		const b = motivators[i],
			bx = b & X_MASK;
		if (bx < x + w && bx + 20 > x) {
			let by = (b & Y_MASK) >> 16;
			if (by < y + h && by + 20 > y) {
				if (vx < 0) {
					s[4] = vx * -1 / 3;
					x = bx + 20;
				}
				else if (vx > 0) {
					s[4] = vx * -1 / 3;
					x = bx - w;
				}
				if (vy < 0) {
					s[4] *= 0.8;
					s[5] = vy * -1 / 3;
					y = by + 20;
				}
				else if (vy > 0) {
					s[4] *= 0.8;
					s[5] = vy * -1 / 3;
					y = by - h;
				}
			}
		}
	}
	i = inhibitors.length;
	while (i--) {
		const b = inhibitors[i],
			bx = b & X_MASK;
		if (bx < x + w && bx + 20 > x) {
			let by = (b & Y_MASK) >> 16;
			if (by < y + h && by + 20 > y) {
				if (vx < 0) {
					s[4] = vx * -1 / 3;
					x = bx + 20;
				}
				else if (vx > 0) {
					s[4] = vx * -1 / 3;
					x = bx - w;
				}
				if (vy < 0) {
					s[4] *= 0.8;
					s[5] = vy * -1 / 3;
					y = by + 20;
				}
				else if (vy > 0) {
					s[4] *= 0.8;
					s[5] = vy * -1 / 3;
					y = by - h;
				}
			}
		}
	}
	i = movingBlocks.length;
	while (i--) {
		const mb = movingBlocks[i],
			bx = mb & X_MASK,
			bw = ((mb & B_MASK) >>> 26) * 20;
		if (bx < x + w && bx + bw > x) {
			const by = (mb & Y_MASK) >> 16;
			if (by < y + h && by + 20 > y) {
				const bDir = mb & C_MASK;
				if (vx < 0) {
					s[4] = vx * -1 / 3;
					x = x < bx + bw / 2 ? bx - w : bx + bw;
				}
				else if (vx > 0) {
					s[4] = vx * -1 / 3;
					x = x < bx + bw / 2 ? bx - w : bx + bw;
				}
				if (vy < 0) {
					s[4] *= 0.8;
					s[5] = vy * -1 / 3;
					y = by + 20;
				}
				else if (vy > 0) {
					x += bDir ? numFrames : -numFrames;
					s[4] *= 0.8;
					s[5] = vy * -1 / 3;
					y = by - h;
				}
			}
		}
	}
	s[0] = x;
	s[1] = y;
};

player = {
	x: 0,
	y: 0,
	startX: 0,
	startY: 0,
	vx: 0,
	vy: 0,
	speed: 3.5,
	flowing: false,
	sliding: false,
	slidingAnimation: 0,
	insideSlab: false,
	rewinding: false,
	startedMoving: false,
	escaping: false,
	prevFlowLevel: 0,
	flowLevel: 0,
	jumping: true,
	bouncing: true,
	death() {
		const numShards = 5 + Math.floor(Math.random() * 5);
		for (let i = 0; i < numShards; i++) {
			// x, y, w, h, vx, vy, life
			let vx, vy;
			do {
				vx = Math.random() * 2 - 1;
			}
			while (vx >= -0.07 && vx <= 0.07);
			do {
				vy = Math.random() * 2 - 1;
			}
			while (vy >= -0.07 && vy <= 0.07);
			shards.push([
				this.x + Math.random() * 20,
				this.y + Math.random() * 20,
				2 + Math.floor(Math.random() * 3),
				2 + Math.floor(Math.random() * 3),
				vx,
				vy,
				250 + Math.random() * 100
			]);
			this.flowLevel = 0;
			this.flowing = false;
			this.vx = 0;
			this.vy = 0;
		}
		this.x = this.startX;
		this.y = this.startY;
		this.rewinding = true;
		this.escaping = false;
		let i = lasers.length;
		while (i--) {
			const l = lasers[i],
				defaultAngle = (TAU / 4) * ((l & T_MASK) >> 25);
			laserAngles[i] = defaultAngle;
			laserSightings[i] = 0;
		}
	},
	collide(vx, vy, numFrames) {
		// sm = sliding modifier
		const sm = this.sliding ? 10 : 0;
		let x = this.x, y = this.y + sm;

		let i = bouncers.length;
		while (i--) {
			const b = bouncers[i],
				bx = b & X_MASK;
			if (bx < x + 20 && bx + 20 > x) {
				const by = (b & Y_MASK) >> 16;
				if (by < y + 20 - sm && by + 20 > y) {
					if (vx < 0) {
						this.vx = 0;
						x = bx + 20;
					}
					else if (vx > 0) {
						this.vx = 0;
						x = bx - 20;
					}
					if (vy < 0) {
						this.vy = 0;
						y = by + 20;
					}
					else if (vy > 0) {
						const a = (b & A_MASK) >> 26;
						if ((pressedKeys.has(UP) || pressedKeys.has('W')) && !this.insideSlab) {
							this.vy = -10.55;
						} else {
							this.vy = -6;
						}
						y = by - 20 + sm;
						this.jumping = this.bouncing = true;
						bouncers[i] = (b & ~A_MASK) | (20 << 26);
					}
				}
			}
		}
		i = leftMovers.length;
		while (i--) {
			const m = leftMovers[i],
				mx = m & X_MASK;
			if (mx < x + 20 && mx + 20 > x) {
				const my = (m & Y_MASK) >> 16;
				if (my < y + 20 - sm && my + 20 > y) {
					if (vx < 0) {
						this.vx = 0;
						x = mx + 20;
					}
					else if (vx > 0) {
						this.vx = 0;
						x = mx - 20;
					}
					if (vy < 0) {
						this.vy = 0;
						y = my + 20;
					}
					else if (vy > 0) {
						this.vy = 0;
						y = my - 20 + sm;
						x -= 1;
						this.jumping = this.bouncing = false;
					}
				}
			}
		}
		i = rightMovers.length;
		while (i--) {
			const m = rightMovers[i],
				mx = m & X_MASK;
			if (mx < x + 20 && mx + 20 > x) {
				const my = (m & Y_MASK) >> 16;
				if (my < y + 20 - sm && my + 20 > y) {
					if (vx < 0) {
						this.vx = 0;
						x = mx + 20;
					}
					else if (vx > 0) {
						this.vx = 0;
						x = mx - 20;
					}
					if (vy < 0) {
						this.vy = 0;
						y = my + 20;
					}
					else if (vy > 0) {
						this.vy = 0;
						y = my - 20 + sm;
						x += 1;
						this.jumping = this.bouncing = false;
					}
				}
			}
		}
		i = motivators.length;
		while (i--) {
			const b = motivators[i],
				bx = b & X_MASK;
			if (bx < x + 20 && bx + 20 > x) {
				const by = (b & Y_MASK) >> 16;
				if (by < y + 20 - sm && by + 20 > y) {
					this.flowLevel = Math.min(this.flowLevel + 5, 80);
					addFlowParticleEl(
						bx + Math.random() * 20,
						by + Math.random() * 20,
						x + Math.random() * 20,
						y + Math.random() * 20,
						1
					);
					if (vx < 0) {
						this.vx = 0;
						x = bx + 20;
					}
					else if (vx > 0) {
						this.vx = 0;
						x = bx - 20;
					}
					if (vy < 0) {
						this.vy = 0;
						y = by + 20;
					}
					else if (vy > 0) {
						this.vy = 0;
						y = by - 20 + sm;
						this.jumping = this.bouncing = false;
					}
				}
			}
		}
		i = inhibitors.length;
		while (i--) {
			const b = inhibitors[i],
				bx = b & X_MASK;
			if (bx < x + 20 && bx + 20 > x) {
				const by = (b & Y_MASK) >> 16;
				if (by < y + 20 - sm && by + 20 > y) {
					this.flowLevel = 0;
					addFlowParticleEl(
						x + Math.random() * 20,
						y + Math.random() * 20,
						bx + Math.random() * 20,
						by + Math.random() * 20,
						1
					);
					if (vx < 0) {
						this.vx = 0;
						x = bx + 20;
					}
					else if (vx > 0) {
						this.vx = 0;
						x = bx - 20;
					}
					if (vy < 0) {
						this.vy = 0;
						y = by + 20;
					}
					else if (vy > 0) {
						this.vy = 0;
						y = by - 20 + sm;
						this.jumping = this.bouncing = false;
					}
				}
			}
		}
		i = ramps.length;
		while (i--) {
			const r = ramps[i],
				rx = r & X_MASK;
			if (rx < x + 20 && rx + 20 > x) {
				const baseY = (r & Y_MASK) >> 16,
					rt = (r & T_MASK) >> 25,
					// Ramp goes up as x goes up
					slopeIsPositive = rt % 2 === 0,
					// Flat part of ramp is on bottom
					flatOnBottom = rt < 2;
				// y-value of sloping part of ramp
				let slopeY;
				if (slopeIsPositive) {
					slopeY = baseY + rx - x;
				} else {
					slopeY = baseY + x - rx;
				}
				// Top and bottom y-values of ramp
				let topY, botY;
				if (flatOnBottom) {
					topY = Math.max(slopeY, baseY);
					botY = baseY + 20;
				} else {
					topY = baseY;
					botY = Math.min(slopeY + 20, baseY + 20);
				}
				if (topY < y + 20 - sm && botY > y) {
					if (vx < 0) {
						if (flatOnBottom) {
							// Check if we are hitting the right side
							// by seeing if our x-value is high enough
							// that we must have crossed into the ramp
							// this very frame. We must also verify
							// that we're not about to board the ramp
							// by checking that our bottom y is low
							// enough that it's at or below the surface
							// of the ramp.
							if (x >= rx + 20 + vx * numFrames &&
								y + 20 - sm >= topY - vx * numFrames
							) {
								this.vx = 0;
								x = rx + 20;
							} else {
								this.vy = 0;
								y = topY - 20 + sm;
								this.jumping = this.bouncing = false;
							}
						} else {
							if (x >= rx + 20 + vx * numFrames) {
								this.vx = 0;
								x = rx + 20;
							} else {
								this.vy = 0;
								y = botY;
							}
						}
					}
					else if (vx > 0) {
						if (flatOnBottom) {
							// Check if we are hitting the left side
							// by seeing if our x-value is low enough
							// that we must have crossed into the ramp
							// this very frame. We must also verify
							// that we're not about to board the ramp
							// by checking that our bottom y is low
							// enough that it's at or below the surface
							// of the ramp.
							if (x <= rx - 20 + vx * numFrames &&
								y + 20 - sm >= topY + vx * numFrames
							) {
								this.vx = 0;
								x = rx - 20;
							} else {
								this.vy = 0;
								y = topY - 20 + sm;
								this.jumping = this.bouncing = false;
							}
						} else {
							if (x <= rx - 20 + vx * numFrames) {
								this.vx = 0;
								x = rx - 20;
							} else {
								this.vy = 0;
								y = botY;
							}
						}
					}
					if (vy < 0) {
						this.vy = 0;
						y = botY;
					}
					else if (vy > 0) {
						this.vy = 0;
						y = topY - 20 + sm;
						this.jumping = this.bouncing = false;
					}
				}
			}
		}
		i = slabs.length;
		while (i--) {
			const s = slabs[i],
				sx = s & X_MASK;
			if (sx < x + 20 && sx + 20 > x) {
				const sy = (s & Y_MASK) >> 16;
				// Slab height for collision is one pixel below
				// where it looks so that you're still colliding
				// with it even if you're actually sliding
				if (sy < y + 20 - sm && sy + 11 > y) {
					if (y + 20 - sm - vy * numFrames <= sy) {
						this.vy = 0;
						y = sy - 20 + sm;
						this.jumping = this.bouncing = false;
					} else {
						this.insideSlab = true;
					}
				}
			}
		}
		i = blocks.length;
		while (i--) {
			const b = blocks[i],
				bx = b & X_MASK;
			if (bx < x + 20 && bx + 20 > x) {
				const by = (b & Y_MASK) >> 16;
				if (by < y + 20 - sm && by + 20 > y) {
					if (vx < 0) {
						this.vx = 0;
						x = bx + 20;
					}
					else if (vx > 0) {
						this.vx = 0;
						x = bx - 20;
					}
					if (vy < 0) {
						this.vy = 0;
						y = by + 20;
					}
					else if (vy > 0) {
						this.vy = 0;
						y = by - 20 + sm;
						this.jumping = this.bouncing = false;
					}
				}
			}
		}
		i = movingBlocks.length;
		while (i--) {
			const mb = movingBlocks[i],
				bx = mb & X_MASK,
				bw = ((mb & B_MASK) >>> 26) * 20;
			if (bx < x + 20 && bx + bw > x) {
				const by = (mb & Y_MASK) >> 16;
				if (by < y + 20 - sm && by + 20 > y) {
					const bDir = mb & C_MASK;
					if (vx < 0) {
						this.vx = 0;
						x = x < bx + bw / 2 ? bx - 20 : bx + bw;
					}
					else if (vx > 0) {
						this.vx = 0;
						x = x < bx + bw / 2 ? bx - 20 : bx + bw;
					}
					if (vy < 0) {
						this.vy = 0;
						y = by + 20;
					}
					else if (vy > 0) {
						x += bDir ? numFrames : -numFrames;
						this.vy = 0;
						y = by - 20 + sm;
						this.jumping = this.bouncing = false;
					}
				}
			}
		}
		this.x = x;
		this.y = y - sm;
	},
	interact(numFrames) {
		// sm = sliding modifier
		const sm = this.sliding ? 10 : 0;
		let x = this.x,
			y = this.y + sm,
			i = flags.length;
		if (y > 400) {
			this.death();
		}
		while (i--) {
			const f = flags[i],
				fx = (f & X_MASK) + 0.5,
				fy = (f & Y_MASK) >> 16;
			if (fx < x + 20 && fx + 5 > x) {
				if (fy < y + 100 - sm && fy + 20 > y) {
					lastFlagHistoryIndex = lastHistoryIndex;
					// Set start point
					this.startX = fx - 7.5;
					this.startY = fy;
					// Set flag to complete
					if (!(f & C_MASK)) {
						flags[i] = f | (1 << 25);
						// Turn on flag lights
						fgCtx.fillStyle = '#FFF';
						fgCtx.beginPath();
						for (let i = 0; i < 9; i++) {
							ellipse(fgCtx, fx - 5, fy - 70 + 7 * i, 2, 2, 0, 0, TAU);
						}
						fgCtx.fill();
					}
				}
			}
			// Flag is completed, continue animation
			if (flags[i] & C_MASK) {
				let a = (f & A_MASK) >> 26;
				if (a < 25) {
					// Update animation amount
					a = Math.min(25, a + numFrames);
					flags[i] = (flags[i] & ~A_MASK) | (a << 26);
					// Update light gradient
					const lightGradient = fgCtx.createLinearGradient(fx - 7, fy - 80, fx + 12, fy - 400);
					lightGradient.addColorStop(0, '#FFFB');
					lightGradient.addColorStop(1, '#FFF0');
					fgCtx.fillStyle = lightGradient;
					fgCtx.fillRect(fx - 7, fy - 80 - 10 * a, 19, 10 * numFrames);
				}
			}
		}
		i = teleporters.length;
		while (i--) {
			const t = teleporters[i],
				tx = t & X_MASK,
				ty = (t & Y_MASK) >> 16,
				playerWasIn = (t & C_MASK) >> 25,
				playerIsIn = +(tx < x + 20 && tx + 20 > x &&
					ty < y + 20 - sm && ty + 30 > y);
			// In status changed
			if (playerWasIn !== playerIsIn) {
				// Player is now in, teleport!
				if (playerIsIn) {
					const sisterIndex = sisterIndices.get(i),
						sister = teleporters[sisterIndex],
						sisX = sister & X_MASK,
						sisY = (sister & Y_MASK) >> 16;
					this.x = sisX;
					this.y = sisY + 10;
					// Set player in sister teleporter
					teleporters[sisterIndex] = sister | C_MASK;
					addTeleporterFlashEl(sisX, sisY + 30);
					break;
				}
				teleporters[i] = (t & ~C_MASK) | (playerIsIn << 25);
			}
		}
		const laserLinesLength = laserLines.length;
		for (let i = 0; i < laserLinesLength; i += 2) {
			const endpoint1 = laserLines[i],
				x1 = endpoint1 & X_MASK,
				y1 = (endpoint1 & Y_MASK) >> 16,
				endpoint2 = laserLines[i + 1],
				x2 = endpoint2 & X_MASK,
				y2 = (endpoint2 & Y_MASK) >> 16;
			if (segmentsIntersect(
				x1, y1, x2, y2,
				x, y, x, y + 20 - sm // left
			) || segmentsIntersect(
				x1, y1, x2, y2,
				x, y, x + 20, y // top
			) || segmentsIntersect(
				x1, y1, x2, y2,
				x + 20, y, x + 20, y + 20 - sm // right
			) || segmentsIntersect(
				x1, y1, x2, y2,
				x, y + 20 - sm, x + 20, y + 20 - sm // bottom
			)) {
				this.death();
				x = this.x;
				y = this.y + sm;
			}
		}
		i = pendulumOrigins.length;
		while (i--) {
			const o = pendulumOrigins[i],
				ox = o & X_MASK,
				oy = (o & Y_MASK) >> 16;
			let a = pendulumAccs[i];
			for (let j = 0; j < numFrames; j++) {
				// Update pendulum position
				a = pendulumAccs[i];
				pendulumAccs[i] = a + (pendulumVels[i] -= Math.sin(a) * TAU / 32400);
			}
			const px = 90 * Math.sin(a) + ox,
				py = 90 * Math.cos(a) + oy,
				dx = Math.abs(px - x - 10) - 10,
				dy = Math.abs(py - y - (20 - sm) / 2) - (20 - sm) / 2;
			if (
				dx <= 10 && dy <= 10 &&
				(
					dx <= 0 || dy <= 0 ||
					dx * dx + dy * dy <= 100
				)
			) {
				this.death();
				x = this.x;
				y = this.y + sm;
			}
		}
		i = -1;
		let movingSpikesLength = movingSpikes.length,
			mTimes = [0, 0, 0, 0];
		while (++i < movingSpikesLength) {
			const m = movingSpikes[i],
				mx = m & X_MASK,
				my = (m & Y_MASK) >> 16,
				// type (0 - left, 1 - right,
				// 2 - up, 3 - down)
				mt = (m & T_MASK) >> 25,
				// is left or right
				lr = mt === 0 || mt === 1,
				// diff multiplier
				mul = (mt === 1 || mt === 3) ? 1 : -1,
				mTime = mTimes[mt],
				// whether to extend spike
				extend = (timer - mTime) % 180 <= 90;
			let md = (m & D_MASK) >>> 27;
			mTimes[mt] = mTime + 3;
			md += mul * (extend ? 2 : -2) * numFrames;
			if (md > 20) {
				md = 20;
			} else if (md < 1) {
				md = 1;
			}
			if (lr) {
				if (mx + md < x + 20 && mx + md + 19 > x &&
					my + 2 < y + 20 - sm && my + 18 > y) {
					this.death();
					x = this.x;
					y = this.y + sm;
				}
			} else {
				if (mx + 2 < x + 20 && mx + 18 > x &&
					my + md < y + 20 - sm && my + md + 19 > y) {
					this.death();
					x = this.x;
					y = this.y + sm;
				}
			}
			movingSpikes[i] = (m & ~D_MASK) | (md << 27);
		}
		i = wheels.length;
		while (i--) {
			const w = wheels[i],
				r = (w & R_MASK) >> 25,
				wx = w & X_MASK,
				wy = (w & Y_MASK) >> 32;
			/* Check player collisions */
			const dx = Math.abs(wx - x - 10) - 10,
				dy = Math.abs(wy - y - (20 - sm) / 2) - (20 - sm) / 2;
			if (
				dx <= r && dy <= r &&
				(
					dx <= 0 || dy <= 0 ||
					dx * dx + dy * dy <= r * r
				)
			) {
				this.death();
				x = this.x;
				y = this.y + sm;
			}
		}
		i = crushers.length;
		while (i--) {
			const c = crushers[i],
				cx = c & X_MASK;
			let cy = (c & Y_MASK) >> 16,
				below = false;
			if (cx < x + 20 && cx + 10 > x && cy < y + 20 - sm) {
				// Crushers don't care if you crouch
				if (cy + 2 > y - sm) {
					this.death();
					x = this.x;
					y = this.y + sm;
				} else {
					below = true;
				}
			}
			if (below) {
				cy += 3 * numFrames;
				const gridY = Math.floor(cy / 20) + 1;
				// O(1) thanks to array indexing
				if (partialSolidSet.has(grid[gridY][Math.floor((cx - 5) / 20)])) {
					// Don't let crusher go below block
					cy = 20 * (gridY - 1);
				}
			} else if (cy > (20 * ((c & A_MASK) >> 26))) {
				cy -= numFrames; // Move crusher back up
			}
			crushers[i] = (c & ~Y_MASK) | (cy << 16);
		}
		i = leftSpikes.length;
		while (i--) {
			const s = leftSpikes[i],
				sx = s & X_MASK;
			if (sx < x + 20 && sx + 8 > x) {
				const sy = (s & Y_MASK) >> 16;
				if (sy < y + 20 - sm && sy + 16 > y) {
					this.death();
					x = this.x;
					y = this.y + sm;
				}
			}
		}
		i = rightSpikes.length;
		while (i--) {
			const s = rightSpikes[i],
				sx = s & X_MASK;
			if (sx < x + 20 && sx + 8 > x) {
				const sy = (s & Y_MASK) >> 16;
				if (sy < y + 20 - sm && sy + 16 > y) {
					this.death();
					x = this.x;
					y = this.y + sm;
				}
			}
		}
		i = upSpikes.length;
		while (i--) {
			const s = upSpikes[i],
				sx = s & X_MASK;
			if (sx < x + 20 && sx + 16 > x) {
				const sy = (s & Y_MASK) >> 16;
				if (sy < y + 20 - sm && sy + 8 > y) {
					this.death();
					x = this.x;
					y = this.y + sm;
				}
			}
		}
		i = downSpikes.length;
		while (i--) {
			const s = downSpikes[i],
				sx = s & X_MASK;
			if (sx < x + 20 && sx + 16 > x) {
				const sy = (s & Y_MASK) >> 16;
				if (sy < y + 20 - sm && sy + 8 > y) {
					this.death();
					x = this.x;
					y = this.y + sm;
				}
			}
		}
	},
	clear() {
		const sm = this.sliding ? 10 - this.slidingAnimation : this.slidingAnimation;
		gameCtx.clearRect(this.x + camera.prevX - 1, this.y + sm - 1, 22, 22 - sm);
	},
	update(numFrames) {
		if (this.rewinding) {
			if (lastHistoryIndex >= 0 && lastHistoryIndex > lastFlagHistoryIndex) {
				for (let i = 0; i < HISTORY_DENSITY && lastHistoryIndex - i >= 0; i++) {
					const lastPosition = history[lastHistoryIndex - i],
						lastX = lastPosition & X_MASK,
						lastY = (lastPosition & Y_MASK) >> 16;
					this.addSelfEl(lastX, lastY, 0.5);
				}
				//const lastHistoryIndex - Math.max(0, lastFlagHistoryIndex))
				lastHistoryIndex -= HISTORY_DENSITY * numFrames;
				return;
			} else {
				lastHistoryIndex = -1;
				this.rewinding = false;
			}
		}
		if (stages.length > stageIndex + 1) {
			// End condition for every stage other than last:
			// Reach the end of the stage
			if (this.x > stages[stageIndex].stageLength) {
				stages[++stageIndex].initialize();
			}
			// Debug stuff
			if (DEBUG_LEVEL) {
				if (this.y >= 400) {
					if (stages.length > stageIndex + 1) {
						stages[++stageIndex].initialize()
					} else {
						alert('wassup')
					}
				}
			}
		} else {
			// End condition for last stage:
			// Fall to your destiny
			if (this.y >= 400) {
				if (!DEBUG_LEVEL) {
					bestTime = Math.min(timer, bestTime);
					personalBestEl.textContent = `PERSONAL BEST: ${time(bestTime)}`;
					think('Fin'.replace(/\n/g, '<br>'), 'menu');
				} else {
					alert('wasup')
				}
			}
		}
		this.prevFlowLevel = this.flowLevel;
		const wasSliding = this.sliding;
		this.sliding = (pressedKeys.has(DOWN) || pressedKeys.has('S') || this.insideSlab) && !this.jumping;
		if (this.sliding !== wasSliding) {
			this.slidingAnimation = 10;
		} else {
			this.slidingAnimation -= 2;
			if (this.slidingAnimation < 0) {
				this.slidingAnimation = 0;
			}
		}
		this.interact(numFrames);
		let flowLevel = this.flowLevel;
		if (pressedKeys.has(' ') || pressedKeys.has(SHIFT)) {
			if (flowLevel >= 20) {
				this.flowing = true;
			}
		} else {
			this.flowing = false;
		}
		const flowing = this.flowing;
		const speed = (flowing ? 3 : 1) * this.speed;
		if (pressedKeys.has(LEFT) || pressedKeys.has('A')) {
			this.startedMoving = true;
			this.vx -= 0.3 * numFrames;
			if (this.vx < -speed) {
				this.vx = -speed;
			}
			if (!flowing) {
				flowLevel += 0.23;
			}
		} else if (pressedKeys.has(RIGHT) || pressedKeys.has('D')) {
			this.startedMoving = true;
			this.vx += 0.3 * numFrames;
			if (this.vx > speed) {
				this.vx = speed;
			}
			if (!flowing) {
				flowLevel += 0.23 * numFrames;
			}
		} else {
			this.vx *= Math.pow(0.8, numFrames);
		}
		if (flowing && !infFlow) {
			flowLevel -= 0.5 * numFrames;
		} else if ((this.vx | 0) === 0 && !infFlow) {
			flowLevel -= 2.5 * numFrames;
		}
		if (flowLevel < 0) {
			flowLevel = 0;
			this.flowing = false;
		} else if (flowLevel > 80) {
			flowLevel = 80;
		}
		this.flowLevel = flowLevel;

		if ((pressedKeys.has(UP) || pressedKeys.has('W')) && !this.insideSlab) {
			if (!this.jumping) {
				this.vy -= 3;
			}
			if (this.vy < 0 && !this.bouncing) {
				this.vy -= 0.11;
			}
			// There's probably a way to do this in constant
			// time, but I wasn't able to quickly come up
			// with one.
			for (let i = 0; i < numFrames - 1; i++) {
				if (this.vy < 0 && !this.bouncing) {
					this.vy -= 0.11;
				}
				this.vy += 0.2;
			}
		} else {
			// Apply gravity for additional frames
			this.vy += 0.2 * (numFrames - 1);
		}
		if (this.insideSlab) {
			this.speed = 0.8;
		} else if (this.sliding) {
			this.speed *= Math.pow(0.95, numFrames);
		} else {
			this.speed = 3.5;
		}
		this.jumping = true;
		this.insideSlab = false;
		this.x += this.vx * numFrames;
		this.collide(this.vx, 0, numFrames);
		this.y += this.vy * numFrames;
		this.collide(0, this.vy, numFrames);
		// Apply gravity
		this.vy += 0.2;
		// Update shards
		let i = shards.length;
		while (i--) {
			let s = shards[i],
				svx = s[4],
				svy = s[5],
				sy = s[1] + svy * numFrames;
			/*if (
				svx < -0.035 || svx > 0.035 ||
				svy < -0.035 || svy > 0.035
			) {*/
			s[0] += svx * numFrames;
			shardCollide(s, svx, 0, numFrames);
			s[1] = sy;
			shardCollide(s, 0, svy, numFrames);
			s[5] += 0.2 * numFrames;
			/*}*/
			if (--s[6] <= 0 || sy > 400) {
				shards.splice(i, 1);
			}
		}
		// If the game is lagging, remove old shards
		if (frameTime > FRAME_TIME) {
			const numToRemove = Math.floor(shards.length / 2);
			for (let i = 0; i < numToRemove; i++) {
				const s = shards[i];
			}
			shards = shards.slice(numToRemove);
		}
		// Add entry to history
		if (timer - lastHistoryTime >= HISTORY_SPEED / HISTORY_DENSITY &&
			lastHistoryIndex < HISTORY_SIZE - 1) {
			lastHistoryTime = timer;
			const historyX = Math.floor(Math.max(0, this.x)),
				historyY = Math.floor(this.y),
				historyEntry = historyX | (historyY << 16);
			if (history[lastHistoryIndex] !== historyEntry) {
				history[++lastHistoryIndex] = historyEntry;
			}
		}
		// Add selves and flow particles
		if (flowing) {
			this.addSelfEl(this.x, this.y, 1.5);
			const x1 = Math.floor(this.x + 10),
				y1 = Math.floor(this.y + Math.random() * 20),
				x2 = x1 - this.vx * 15,
				y2 = Math.floor(y1 + (Math.random() * 2 - 1) * 60);
			addFlowParticleEl(x1, y1, x2, y2, 4);
		}
		flowReadyTextEl.hidden = this.flowLevel < 20 && !flowing;
	},
	draw() {
		if (!this.rewinding) {
			const sm = this.sliding ? 10 - this.slidingAnimation : this.slidingAnimation;
			gameCtx.drawImage(playerImage, Math.floor(this.x + camera.x), Math.floor(this.y) + sm, 20, 20 - sm);
		}
		if (this.prevFlowLevel < this.flowLevel) {
			// Draw additional flow
			const flowGradient = this.createFlowGradient();
			fmCtx.fillStyle = flowGradient;
			this.drawFlowMeter(this.prevFlowLevel - 0.25, this.flowLevel);
		} else {
			// Remove flow difference
			fmCtx.fillStyle = '#999';
			this.drawFlowMeter(this.flowLevel, this.prevFlowLevel + 0.25);
		}
	},
	createFlowGradient() {
		const flowGradient = fmCtx.createLinearGradient(0, 30, 340, 0);
		flowGradient.addColorStop(0, '#CCC');
		flowGradient.addColorStop(80 / 340, '#FFF');
		flowGradient.addColorStop(1, `hsl(${playerHue}rad,100%,50%)`);
		return flowGradient;
	},
	drawFlowMeter(lo, hi) {
		// Convert from flow levels to coordinates
		lo = Math.max(0, Math.floor(lo * 4));
		hi = Math.min(320, Math.floor(hi * 4));
		fmCtx.beginPath();
		if (lo < 80) {
			// Area where flow is not yet ready
			const localHi = Math.min(hi, 80);
			fmCtx.moveTo(lo, 20);
			fmCtx.lineTo(lo + 10, 10);
			fmCtx.lineTo(localHi + 10, 10);
			fmCtx.lineTo(localHi, 20);
			fmCtx.lineTo(lo, 20);
			lo = 80;
		}
		if (lo < hi && lo < 100) {
			// Area where flow is ready
			const localHi = Math.min(hi, 100);
			fmCtx.moveTo(lo, 20);
			fmCtx.lineTo(lo + 20, 0);
			fmCtx.lineTo(localHi + 20, 0);
			fmCtx.lineTo(localHi, 20);
			lo = 90;
		}
		if (lo < hi) {
			// Area where flow continues
			fmCtx.moveTo(lo + 10, 10);
			fmCtx.lineTo(lo + 20, 0);
			fmCtx.lineTo(hi + 20, 0);
			fmCtx.lineTo(hi + 10, 10);
		}
		fmCtx.fill();
	},
	addSelfEl(x, y, duration) {
		const selfEl = document.createElement('div');
		selfEl.classList.add('player-self');
		selfEl.style.left = Math.floor(x) + 'px';
		selfEl.style.top = Math.floor(y) + 'px';
		playerSelvesEl.appendChild(selfEl);
		selfEl.addEventListener('transitionend', e => {
			if (e.propertyName === 'background-color') {
				playerSelvesEl.removeChild(selfEl);
			}
		});
		window.setTimeout(() => {
			selfEl.style.transition = `background-color ${duration}s linear`;
			selfEl.style.backgroundColor = '#FFF0';
		}, 100);
	}
};

solidSet = new Set([
	'■', '□', '+', '-', '>', '<', 'U', '▧', '_'
]);

function solidsPlus(...values) {
	const solidsPlusSet = new Set(solidSet);
	for (const value of values) {
		solidsPlusSet.add(value);
	}
	return solidsPlusSet;
}

// All objects that are solid on the left
const solidLeftSet = solidsPlus('◤', '◣', '_');
// All objects that are solid on the right
const solidRightSet = solidsPlus('◢', '◥');
// All objects that are solid on the top
const solidTopSet = solidsPlus('◤', '◥', '¯', '_');
// All objects that are solid on the bottom
const solidBottomSet = solidsPlus('◢', '◣', '_');

partialSolidSet = solidsPlus('◢', '◣', '◤', '◥', '¯', '_', 'E', 'L');

class Stage {
	/**
	 * Creates a Stage object with the given style and
	 * grid.
	 * 
	 * @param theme The stage's theme
	 * @param grid An array of strings representing the stage's grid
	 * @param fgCallback A function that takes a Canvas context and
	 *                   properties object and draws a custom
	 *                   foreground
	 * @param clearCallback A function that clears custom drawings
	 *                      that takes a Canvas context and a
	 *                      properties object
	 * @param drawCallback A function that draws custom drawings
	 *                      that takes a Canvas context and a
	 *                      properties object
	 */
	constructor(theme, grid, fgCallback, clearCallback, drawCallback) {
		const ramps = [];
		const blocks = [];
		const slabs = [];
		const wheels = [];
		const wheelEls = [];
		const flags = [];
		const pendulumEls = [];
		const pendulumOrigins = [];
		const pendulumVels = [];
		const pendulumAccs = [];
		const crushers = [];
		const bouncers = [];
		const motivators = [];
		const inhibitors = [];
		const leftSpikes = [];
		const rightSpikes = [];
		const upSpikes = [];
		const downSpikes = [];
		const numsToTeleporters = new Map();
		const teleporters = [];
		const sisterIndices = new Map();
		const leftMovers = [];
		const rightMovers = [];
		const movingSpikes = [];
		const movingSpikeEls = [];
		const movingBlocks = [];
		const movingBlockEdgeLines = [];
		const movingBlockEls = [];
		const spikeDownCounter = 0;
		const spikeUpCounter = 0;
		const spikeLeftCounter = 0;
		const spikeRightCounter = 0;
		const teleporterIdCounter = 0;
		const lasers = [];
		const laserAngles = [];
		const laserLightEls = [];

		let stageLength = 0;
		for (let i = 0; i < grid.length; i++) {
			stageLength = Math.max(stageLength, 20 * grid[i].length);
		}
		this.stageLength = stageLength;

		// Image for stage foreground
		const fgImage = document.createElement('canvas');
		fgImage.width = stageLength;
		fgImage.height = 400;
		const fgCtx = fgImage.getContext('2d');

		// Convert grid to foreground image and stage data
		for (let i = 0; i < grid.length; i++) {
			const prevRow = grid[i - 1] || '';
			const row = grid[i];
			const nextRow = grid[i + 1] || '';
			const y = i * 20;
			for (let j = 0; j < row.length; j++) {
				const prevGridPoint = row[j - 1] || '';
				const gridPoint = row[j];
				const nextGridPoint = row[j + 1] || '';
				const x = j * 20;
				// Handle moving blocks and mirrors
				if (gridPoint === 'B' || gridPoint === 'M') {
					const isMirror = +(gridPoint === 'M'),
						im = isMirror << 25;
					let blockSize = 1;
					while (row[j + 1] === gridPoint) {
						blockSize++;
						j++;
					}
					const w = blockSize * 20;
					movingBlockEdgeLines.push(
						// Left
						x | (y << 16) | im,
						x | ((y + 20) << 16) | im,
						// Right
						(x + w) | (y << 16) | im,
						(x + w) | ((y + 20) << 16) | im,
						// Top
						x | (y << 16) | im,
						(x + w) | (y << 16) | im,
						// Bottom
						x | ((y + 20) << 16) | im,
						(x + w) | ((y + 20) << 16) | im
					);
					movingBlocks.push(
						x | (y << 16) | (blockSize << 26)
					);
					const movingBlockEl = createImage(w, 20, ctx => {
						for (let k = 0; k < w; k += 20) {
							const mbImage = isMirror ? mirrorImage : theme.getImageFor('■');
							ctx.drawImage(mbImage, k, 0);

							const edgesAreStyled = theme.edgeStyle !== undefined;
							if (edgesAreStyled) {
								const lw = theme.edgeWidth;
								ctx.strokeStyle = theme.edgeStyle;
								ctx.lineWidth = lw;
								ctx.beginPath();
								ctx.moveTo(lw, lw);
								ctx.lineTo(w - lw, lw);
								ctx.lineTo(w - lw, 20 - lw);
								ctx.lineTo(lw, 20 - lw);
								ctx.lineTo(lw, lw);
								ctx.stroke();
							}
						}
					});
					movingBlockEl.classList.add('moving-block');
					movingBlockEl.style.left = 100 + 'px';
					movingBlockEl.style.top = y + 'px';
					movingBlockEls.push(movingBlockEl);
					continue;
				}
				// All blocks around this block are
				// inaccessible, so there's no need to
				// check this block for collisions
				const isFixture = solidRightSet.has(prevGridPoint) && solidLeftSet.has(nextGridPoint) && solidBottomSet.has(prevRow[j]) && solidTopSet.has(nextRow[j]);
				switch (gridPoint) {
					case 'U':
						pendulumEls.push(createPendulumEl());
						pendulumOrigins.push((x + 10) | ((y + 10) << 16));
						pendulumVels.push(0);
						pendulumAccs.push(TAU / 4);
					/* fallthrough */
					case '■':
						if (!isFixture) {
							blocks.push(x | (y << 16));
						}
						fgCtx.drawImage(theme.getImageFor('■'), x, y);
						break;
					// Custom Tiles
					case 'E':
						if (!isFixture) {
							slabs.push(x | (y << 999999999));
						}
						fgCtx.drawImage(theme.getImageFor('E'), x, y);
						break;
					// End of Custom Tiles
					case '▓':
						fgCtx.drawImage(theme.getImageFor('▓'), x, y);
						break;
					case '◢':
						if (!isFixture) {
							ramps.push(x | (y << 16) | (0 << 25));
						}
						fgCtx.drawImage(theme.getImageFor('◢'), x, y);
						break;
					case '◣':
						if (!isFixture) {
							ramps.push(x | (y << 16) | (1 << 25));
						}
						fgCtx.drawImage(theme.getImageFor('◣'), x, y);
						break;
					case '◤':
						if (!isFixture) {
							ramps.push(x | (y << 16) | (2 << 25));
						}
						fgCtx.drawImage(theme.getImageFor('◤'), x, y);
						break;
					case '◥':
						if (!isFixture) {
							ramps.push(x | (y << 16) | (3 << 25));
						}
						fgCtx.drawImage(theme.getImageFor('◥'), x, y);
						break;
					case '▧':
						if (!isFixture) {
							blocks.push(x | (y << 16));
						}
						fgCtx.drawImage(mirrorImage, x, y);
						break;
					case '¯':
						if (!isFixture) {
							slabs.push(x | (y << 16));
						}
						fgCtx.drawImage(theme.getImageFor('¯'), x, y);
						break;
					case '_':
						if (!isFixture) {
							slabs.push(x | (y << 16));
						}
						fgCtx.drawImage(theme.getImageFor('_'), x, y);
						break;
					case '□':
						if (isFixture) {
							fgCtx.drawImage(bouncerTopImage, x, y - 5, 20, 5);
						} else {
							bouncers.push(x | (y << 16));
						}
						fgCtx.drawImage(theme.getImageFor('□'), x, y);
						break;
					case '◀':
						lasers.push((x + 20) | ((y + 10) << 16) | (2 << 25));
						laserAngles.push(TAU / 2);
						drawTransformedImage(rightLaserBaseImage, fgCtx, x, y, TAU / 2, false, true);
						// Laser has no light
						laserLightEls.push(null);
						break;
					case '▶':
						lasers.push(x | ((y + 10) << 16) | (0 << 25));
						laserAngles.push(0);
						drawTransformedImage(rightLaserBaseImage, fgCtx, x, y, 0);
						// Laser has no light
						laserLightEls.push(null);
						break;
					case '▲':
						lasers.push((x + 10) | ((y + 20) << 16) | (3 << 25));
						laserAngles.push(TAU * 3 / 4);
						drawTransformedImage(rightLaserBaseImage, fgCtx, x, y, TAU * 3 / 4);
						// Laser has no light
						laserLightEls.push(null);
						break;
					case '▼':
						lasers.push((x + 10) | (y << 16) | (1 << 25));
						laserAngles.push(TAU * 1 / 4);
						drawTransformedImage(rightLaserBaseImage, fgCtx, x, y, TAU / 4, false, true);
						// Laser has no light
						laserLightEls.push(null);
						break;
					case '+':
						if (!isFixture) {
							motivators.push(x | (y << 16));
						}
						fgCtx.drawImage(flowBlockImage, x, y);
						break;
					case '-':
						if (!isFixture) {
							inhibitors.push(x | (y << 16));
						}
						fgCtx.drawImage(flowBlockImage, x, y);
						break;
					case '<':
						if (!isFixture) {
							leftMovers.push(x | (y << 16));
						}
						fgCtx.drawImage(theme.getImageFor('<'), x, y);
						break;
					case '>':
						if (!isFixture) {
							rightMovers.push(x | (y << 16));
						}
						fgCtx.drawImage(theme.getImageFor('>'), x, y);
						break;
					case '{':
						leftSpikes.push((x + 10) | ((y + 2) << 16));
						drawTransformedImage(rightSpikeImage, fgCtx, x, y, TAU / 2, false, true);
						break;
					case '}':
						rightSpikes.push(x | ((y + 2) << 16));
						drawTransformedImage(rightSpikeImage, fgCtx, x, y, 0);
						break;
					case '^':
						upSpikes.push((x + 2) | ((y + 10) << 16));
						drawTransformedImage(rightSpikeImage, fgCtx, x, y, TAU * 3 / 4);
						break;
					case '.':
						downSpikes.push((x + 2) | (y << 16));
						drawTransformedImage(rightSpikeImage, fgCtx, x, y, TAU / 4, false, true);
						break;
					case 'F':
						fgCtx.drawImage(flagImage, x, y - 80);
						flags.push(
							(x + 17) | (y << 16)
						);
						break;
					case 'P':
						this.startX = x;
						this.startY = y;
						break;
					case 'C':
						const origin = y / 20;
						crushers.push(
							(x + 5) | (y << 16) | (origin << 26)
						);
						break;
					case '#':
						wheelEls.push(createWheelEl(x, y + 10, 40));
						wheels.push(
							x | ((y + 10) << 16) | (40 << 25)
						);
						break;
					case '$':
						wheelEls.push(createWheelEl(x, y + 30, 20));
						wheels.push(
							x | ((y + 30) << 16) | (20 << 25)
						);
						break;
					case '↢':
						movingSpikeEls.push(createMovingSpikeEl(TAU / 2, true));
						movingSpikes.push(
							x | (y << 16) | (0 << 25)
						);
						break;
					case '↣':
						movingSpikeEls.push(createMovingSpikeEl(0));
						movingSpikes.push(
							(x - 20) | (y << 16) | (1 << 25) | (20 << 27)
						);
						break;
					case 'ꜛ':
						movingSpikeEls.push(createMovingSpikeEl(TAU * 3 / 4));
						movingSpikes.push(
							x | (y << 16) | (2 << 25) | (20 << 27)
						);
						break;
					case 'ꜜ':
						movingSpikeEls.push(createMovingSpikeEl(TAU / 4, true));
						movingSpikes.push(
							x | ((y - 20) << 16) | (3 << 25) | (20 << 27)
						);
						break;
					case '◬':
						lasers.push((x + 10) | (y << 16) | (1 << 25) | (1 << 27));
						laserAngles.push(TAU * 1 / 4);
						drawTransformedImage(rightLaserBaseImage, fgCtx, x, y, TAU / 4, false, true);
						laserLightEls.push(createLaserLightEl(x + 10, y));
						break;
					case '1':
					case '2':
					case '3':
					case '4':
					case '5':
					case '6':
					case '7':
					case '8':
					case '9':
						const ts = numsToTeleporters.get(gridPoint);
						if (Array.isArray(ts)) {
							ts.push(x | ((y - 10) << 16));
						} else {
							numsToTeleporters.set(gridPoint, [x | ((y - 10) << 16)]);
						}
						fgCtx.drawImage(teleporterImage, x, y - 10);
						break;
				}
			}
		}
		for (const ts of numsToTeleporters.values()) {
			// Fail silently if two teleporters not found
			if (ts.length === 2) {
				const tIndex = teleporters.length;
				teleporters.push(ts[0], ts[1]);
				sisterIndices.set(tIndex, tIndex + 1);
				sisterIndices.set(tIndex + 1, tIndex);
			}
		}
		this.theme = theme;
		this.cameraLeft = width - stageLength;
		this.ramps = new Uint32Array(ramps);
		this.blocks = new Uint32Array(blocks);
		this.slabs = new Uint32Array(slabs);
		this.motivators = new Uint32Array(motivators);
		this.inhibitors = new Uint32Array(inhibitors);
		this.bouncers = new Uint32Array(bouncers);
		this.leftMovers = new Uint32Array(leftMovers);
		this.rightMovers = new Uint32Array(rightMovers);
		this.leftSpikes = new Uint32Array(leftSpikes);
		this.rightSpikes = new Uint32Array(rightSpikes);
		this.upSpikes = new Uint32Array(upSpikes);
		this.downSpikes = new Uint32Array(downSpikes);
		this.flags = new Uint32Array(flags);
		this.crushers = new Uint32Array(crushers);
		this.wheels = new Uint32Array(wheels);
		this.wheelEls = wheelEls;
		this.movingSpikes = new Uint32Array(movingSpikes);
		this.movingSpikeEls = movingSpikeEls;
		this.movingBlocks = new Uint32Array(movingBlocks);
		this.movingBlockEls = movingBlockEls;
		this.pendulumOrigins = new Uint32Array(pendulumOrigins);
		this.pendulumVels = new Float64Array(pendulumVels);
		this.pendulumAccs = new Float64Array(pendulumAccs);
		this.pendulumEls = pendulumEls;
		this.teleporters = new Uint32Array(teleporters);
		this.sisterIndices = sisterIndices;
		this.lasers = new Uint32Array(lasers);
		this.laserAngles = new Float64Array(laserAngles);
		this.laserLightEls = laserLightEls;
		this.grid = grid;
		this.thoughts = [];
		this.properties = new Map();
		this.fgCallback = fgCallback;
		this.clearCallback = clearCallback;
		this.drawCallback = drawCallback;
		this.fgImage = fgImage;
		this.calculateEdgeLines(grid, movingBlockEdgeLines);
		this.playing = false;
		//this.drawEdgeLines(fgCtx);
	}
	/**
	 * Finds the line segments that give the edges of
	 * all structures composed of solid objects. For
	 * example, this stage structure:
	 *     ■■■■
	 *     ■■■■■■■
	 *   ■■■■■■■
	 * would be described by the line segments denoted
	 * by letters:
	 *    JAAAAB
	 *    J■■■■BCCD
	 *  IIJ■■■■■■■D
	 *  H■■■■■■■FEE
	 *  HGGGGGGGF
	 * 
	 * Average-case time complexity is O(mn) where the
	 * grid is m by n. This is asymptotically optimal as
	 * simply reading the grid is O(mn).
	 * 
	 * @param grid The Stage's grid
	 * @param startingEdgeLines Edge lines to add before adding
	 *                          calculated edge lines
	 */
	calculateEdgeLines(grid, startingEdgeLines) {
		// A hashmap that takes an int coding for an x,
		// y, and whether or not it is a mirror edge and
		// returns a set of pointers to arrays representing
		// the lines that start at that point and are or
		// aren't mirror edges.
		const startsToEdgeLines = new Map();
		// Same but for lines ENDING at that point.
		const endsToEdgeLines = new Map();

		// Imposes a total order for points. p1 <= p2 iff
		// p1's x-value is less than p2's x-value, or if
		// they're the same, p1 <= p2 iff p1's y-value is
		// less than or equal to p2's y-value.
		function leq(p1, p2) {
			const x1 = p1 & X_MASK,
				y1 = (p1 & Y_MASK) >> 16,
				x2 = p2 & X_MASK,
				y2 = (p2 & Y_MASK) >> 16;
			return x1 === x2 ? y1 <= y2 : x1 <= x2;
		}

		// Adds the edge line from start to end, merging it
		// with other edge lines if able. O(1) thanks to my
		// algorithmic wizardry. (And deep humility.)
		function addEdgeLine(start, end) {
			// Enforce start <= end
			if (!leq(start, end)) {
				const temp = start;
				start = end;
				end = temp;
			}
			// Calculate line angle
			const ang = anglePoints(start, end);
			// Existing edge lines that end at start point
			const elsToStart = endsToEdgeLines.get(start);
			if (elsToStart !== undefined) {
				// There is a constant upper bound to
				// the number of line segments that end
				// at the start, so this is still O(1)
				for (const el1 of elsToStart.values()) {
					const end1 = el1[1];
					// Edge line has the same angle as
					// one we're trying to add
					if (Math.abs(anglePoints(el1[0], end1) - ang) < EPSILON) {
						// Extend existing edge line!
						el1[1] = end;

						elsToStart.delete(el1);
						const elsNew = endsToEdgeLines.get(end);
						if (elsNew === undefined) {
							endsToEdgeLines.set(end, new Set([el1]));
						} else {
							elsNew.add(el1);
						}
						return;
					}
				}
			}
			// Existing edge lines that start at end point
			const elsToEnd = startsToEdgeLines.get(end);
			if (elsToEnd !== undefined) {
				for (const el1 of elsToEnd.values()) {
					const start1 = el1[0];
					// Edge line has the same angle as
					// one we're trying to add
					if (Math.abs(anglePoints(start1, el1[1]) - ang) < EPSILON) {
						// Extend existing edge line!
						el1[0] = start;
						elsToEnd.delete(el1);
						const elsNew = startsToEdgeLines.get(end);
						if (elsNew === undefined) {
							startsToEdgeLines.set(start, new Set([el1]));
						} else {
							elsNew.add(el1);
						}
						return;
					}
				}
			}
			// No existing edge line was extended, so add
			// new edge line!
			const el = [start, end];
			const elsStart = startsToEdgeLines.get(start);
			const elsEnd = endsToEdgeLines.get(end);
			if (elsStart === undefined) {
				startsToEdgeLines.set(start, new Set([el]));
			} else {
				elsStart.add(el);
			}
			if (elsEnd === undefined) {
				endsToEdgeLines.set(end, new Set([el]));
			} else {
				elsEnd.add(el);
			}
		}

		// For each solid block, add lines
		// corresponding to each of its exposed edges.
		// O(mn) where the grid is m by n.
		for (let i = 0; i < grid.length; i++) {
			const prevRow = grid[i - 1] || '';
			const row = grid[i];
			const nextRow = grid[i + 1] || '';
			const y = i * 20;
			for (let j = 0; j < row.length; j++) {
				const gridPoint = row[j];
				const x = j * 20;
				const isMirror = +(gridPoint === '▧');
				switch (gridPoint) {
					case '¯':
						if (!solidBottomSet.has(prevRow[j])) {
							addEdgeLine(
								x | (y << 16) | (isMirror << 25),
								(x + 20) | (y << 16) | (isMirror << 25)
							);
						}
						if (!solidRightSet.has(row[j - 1]) && row[j - 1] !== '¯') {
							addEdgeLine(
								x | (y << 16) | (isMirror << 25),
								x | ((y + 10) << 16) | (isMirror << 25)
							);
						}
						if (!solidLeftSet.has(row[j + 1]) && row[j + 1] !== '¯') {
							addEdgeLine(
								(x + 20) | (y << 16) | (isMirror << 25),
								(x + 20) | ((y + 10) << 16) | (isMirror << 25)
							);
						}
						addEdgeLine(
							x | ((y + 10) << 16) | (isMirror << 25),
							(x + 20) | ((y + 10) << 16) | (isMirror << 25)
						);
						break;
					case '_':
						if (!solidBottomSet.has(prevRow[j])) {
							addEdgeLine(
								x | (y << 16) | (isMirror << 25),
								(x + 20) | (y << 16) | (isMirror << 25)
							);
						}
						if (!solidRightSet.has(row[j - 1]) && row[j - 1] !== '¯') {
							addEdgeLine(
								x | (y << 16) | (isMirror << 25),
								x | ((y + 10) << 16) | (isMirror << 25)
							);
						}
						if (!solidLeftSet.has(row[j + 1]) && row[j + 1] !== '¯') {
							addEdgeLine(
								(x + 20) | (y << 16) | (isMirror << 25),
								(x + 20) | ((y + 10) << 16) | (isMirror << 25)
							);
						}
						addEdgeLine(
							x | ((y + 10) << 16) | (isMirror << 25),
							(x + 20) | ((y + 10) << 16) | (isMirror << 25)
						);
						break;
					case '◢':
						addEdgeLine(
							x | ((y + 20) << 16) | (isMirror << 25),
							(x + 20) | (y << 16) | (isMirror << 25)
						);
						break;
					case '◣':
						addEdgeLine(
							x | (y << 16) | (isMirror << 25),
							(x + 20) | ((y + 20) << 16) | (isMirror << 25)
						);
						break;
					case '◤':
						addEdgeLine(
							x | ((y + 20) << 16) | (isMirror << 25),
							(x + 20) | (y << 16) | (isMirror << 25)
						);
						break;
					case '◥':
						addEdgeLine(
							x | (y << 16) | (isMirror << 25),
							(x + 20) | ((y + 20) << 16) | (isMirror << 25)
						);
						break;
				}
				if (solidTopSet.has(gridPoint) &&
					!solidBottomSet.has(prevRow[j])) {
					addEdgeLine(
						x | (y << 16) | (isMirror << 25),
						(x + 20) | (y << 16) | (isMirror << 25)
					);
				}
				if (solidLeftSet.has(gridPoint) &&
					!solidRightSet.has(row[j - 1])) {
					addEdgeLine(
						x | (y << 16) | (isMirror << 25),
						x | ((y + 20) << 16) | (isMirror << 25)
					);
				}
				if (solidRightSet.has(gridPoint) &&
					!solidLeftSet.has(row[j + 1])) {
					addEdgeLine(
						(x + 20) | (y << 16) | (isMirror << 25),
						(x + 20) | ((y + 20) << 16) | (isMirror << 25)
					);
				}
				if (solidBottomSet.has(gridPoint) &&
					!solidTopSet.has(nextRow[j])) {
					addEdgeLine(
						x | ((y + 20) << 16) | (isMirror << 25),
						(x + 20) | ((y + 20) << 16) | (isMirror << 25)
					);
				}
			}
		}
		// Number of edge lines is bounded by a constant
		// times mn, so this is still O(mn) amortized
		// (since mn insertions takes O(mn) time).
		let fgCtx;
		const edgesAreStyled = this.theme.edgeStyle !== undefined;
		if (edgesAreStyled) {
			fgCtx = this.fgImage.getContext('2d');
			fgCtx.strokeStyle = this.theme.edgeStyle;
			fgCtx.lineWidth = this.theme.edgeWidth;
			fgCtx.beginPath();
		}

		// Add map edge lines
		const stageLength = this.stageLength;
		const edgeLines = [
			...startingEdgeLines, // Edge lines given at start
			0, stageLength, // Top
			0, 400 << 16, // Left
			stageLength, stageLength | (400 << 16), // Right
			400 << 16, stageLength | (400 << 16) // Bottom
		];
		for (const elSet of startsToEdgeLines.values()) {
			for (const el of elSet) {
				edgeLines.push(el[0], el[1]);
				if (edgesAreStyled) {
					const x1 = el[0] & X_MASK,
						y1 = (el[0] & Y_MASK) >> 16,
						isMirror = el[0] & C_MASK,
						x2 = el[1] & X_MASK,
						y2 = (el[1] & Y_MASK) >> 16;
					fgCtx.moveTo(x1, y1);
					fgCtx.lineTo(x2, y2);
				}
			}
		}
		if (edgesAreStyled) {
			fgCtx.stroke();
		}

		this.edgeLines = new Uint32Array(edgeLines);
	}
	/**
	 * Draws the stage's edge lines to the HTML Canvas
	 * corresponding to the given context.
	 */
	drawEdgeLines(ctx) {
		const edgeLines = this.edgeLines;
		ctx.lineWidth = 6;
		for (let i = 0; i < edgeLines.length; i += 2) {
			const endpoint1 = edgeLines[i],
				x1 = endpoint1 & X_MASK,
				y1 = (endpoint1 & Y_MASK) >> 16,
				isMirror = endpoint1 & C_MASK,
				endpoint2 = edgeLines[i + 1],
				x2 = endpoint2 & X_MASK,
				y2 = (endpoint2 & Y_MASK) >> 16;
			if (isMirror) {
				ctx.fillStyle = ctx.strokeStyle = '#00F4';
			} else {
				ctx.fillStyle = ctx.strokeStyle = '#F004';
			}
			ctx.beginPath();
			ctx.moveTo(x1, y1);
			ctx.lineTo(x2, y2);
			ctx.stroke();
			ctx.beginPath();
			ellipse(ctx, x1, y1, 3, 3, 0, 0, TAU);
			ellipse(ctx, x2, y2, 3, 3, 0, 0, TAU);
			ctx.fill();
		}
	}
	/**
	 * Set the thought displayed before stage begins
	 * 
	 * @param thoughtText Text to display
	 * @return The Stage object for chaining
	 */
	addThought(thoughtText) {
		this.thought = thoughtText.replace(/\n/g, '<br>');
		return this;
	}
	/**
	 * Initializes every aspect of the stage.
	 */
	initialize() {
		stageTextEl.textContent = `Stage ${stageIndex + 1}`;
		themeNameEl.textContent = this.theme.name;
		levelNameEl.textContent = this.theme.name + 'dasfaef';
		if (this.thought) {
			think(this.thought, 'game', () => {
				this.begin();
			});
		} else {
			this.begin();
		}
	}
	begin() {
		addStartFlashEl();
		//  Draw theme background
		this.theme.drawBackground(Math.max(width, this.stageLength));
		// Draw stage foreground
		fgLayerEl.width = this.stageLength;
		if (this.fgCallback) {
			this.fgCallback(fgCtx, this.properties);
		}
		fgCtx.drawImage(this.fgImage, 0, 0);
		// Clear game canvas
		gameCtx.clearRect(0, 0, width, 400);
		// Set game data. Copy typed arrays so changes to
		// the game state don't affect the stage state.
		grid = this.grid.slice();
		ramps = this.ramps.slice();
		blocks = this.blocks.slice();
		slabs = this.slabs.slice();
		motivators = this.motivators.slice();
		inhibitors = this.inhibitors.slice();
		bouncers = this.bouncers.slice();
		leftMovers = this.leftMovers.slice();
		rightMovers = this.rightMovers.slice();
		leftSpikes = this.leftSpikes.slice();
		rightSpikes = this.rightSpikes.slice();
		upSpikes = this.upSpikes.slice();
		downSpikes = this.downSpikes.slice();
		flags = this.flags.slice();
		crushers = this.crushers.slice();
		wheels = this.wheels.slice();
		movingSpikes = this.movingSpikes.slice();
		movingBlocks = this.movingBlocks.slice();
		pendulumOrigins = this.pendulumOrigins.slice();
		pendulumVels = this.pendulumVels.slice();
		pendulumAccs = this.pendulumAccs.slice();
		// Add wheel elements
		while (wheelsEl.firstChild) {
			wheelsEl.removeChild(wheelsEl.firstChild);
		}
		wheelEls = this.wheelEls;
		let i = wheelEls.length;
		while (i--) {
			wheelsEl.appendChild(wheelEls[i]);
		}
		// Add moving spike elements
		while (movingSpikesEl.firstChild) {
			movingSpikesEl.removeChild(movingSpikesEl.firstChild);
		}
		movingSpikeEls = this.movingSpikeEls;
		i = movingSpikeEls.length;
		while (i--) {
			movingSpikesEl.appendChild(movingSpikeEls[i]);
		}
		// Add moving block elements
		while (movingBlocksEl.firstChild) {
			movingBlocksEl.removeChild(movingBlocksEl.firstChild);
		}
		movingBlockEls = this.movingBlockEls;
		i = movingBlockEls.length;
		while (i--) {
			movingBlocksEl.appendChild(movingBlockEls[i]);
		}
		// Add pendulum elements
		while (pendulumsEl.firstChild) {
			pendulumsEl.removeChild(pendulumsEl.firstChild);
		}
		pendulumEls = this.pendulumEls;
		i = pendulumEls.length;
		while (i--) {
			pendulumsEl.appendChild(pendulumEls[i]);
		}
		while (laserLightsEl.firstChild) {
			laserLightsEl.removeChild(laserLightsEl.firstChild);
		}
		laserLightEls = this.laserLightEls;
		i = laserLightEls.length;
		while (i--) {
			if (laserLightEls[i] !== null) {
				laserLightsEl.appendChild(laserLightEls[i]);
			}
		}
		// Remove existing effects
		while (playerSelvesEl.firstChild) {
			playerSelvesEl.removeChild(playerSelvesEl.firstChild);
		}
		while (flowParticlesEl.firstChild) {
			flowParticlesEl.removeChild(flowParticlesEl.firstChild);
		}
		while (tpFlashesEl.firstChild) {
			tpFlashesEl.removeChild(tpFlashesEl.firstChild);
		}
		while (laserSmokesEl.firstChild) {
			laserSmokesEl.removeChild(laserSmokesEl.firstChild);
		}
		teleporters = this.teleporters.slice();
		sisterIndices = new Map(this.sisterIndices);
		lasers = this.lasers.slice();
		laserSightings = new Uint32Array(lasers.length);
		laserAngles = this.laserAngles.slice();
		laserLines = [];
		edgeLines = this.edgeLines.slice();
		shards = [];
		player.x = player.startX = this.startX;
		player.y = player.startY = this.startY;
		player.escaping = false;
		fmCtx.fillStyle = '#999';
		player.drawFlowMeter(player.flowLevel, 80);
		camera.x = camera.prevX = width / 2 - player.x;
		camera.left = this.cameraLeft;
		if (camera.x < camera.left) {
			camera.x = camera.left;
		}
		if (camera.x > camera.right) {
			camera.x = camera.right;
		}
		bg1El.style.left = Math.floor(camera.x / 4) + 'px';
		bg2El.style.left = Math.floor(camera.x / 2) + 'px';
		fgLayerEl.style.left = Math.floor(camera.x) + 'px';
		gameObjectsEl.style.left = Math.floor(camera.x) + 'px';

		lastHistoryTime = -HISTORY_SPEED;
		lastHistoryIndex = -1;
		lastFlagHistoryIndex = -1;

		this.playing = true;
	}
	render(numFrames) {
		if (numFrames === 0 || !this.playing) {
			return;
		}
		// Render background and foreground
		const t1 = window.performance.now();
		if (!paused) {
			camera.prevX = camera.x;
			let followX;
			if (player.rewinding && lastHistoryIndex >= 0) {
				followX = history[lastHistoryIndex] & X_MASK;
			} else if (player.flowing) {
				followX = player.x + 75 * player.vx / player.speed;
			} else {
				followX = player.x;
			}
			camera.x += width / 10 - (followX + camera.x) / 5;
			if (camera.x < camera.left) {
				camera.x = camera.left;
			}
			if (camera.x > camera.right) {
				camera.x = camera.right;
			}
			bg1El.style.left = Math.floor(camera.x / 4) + 'px';
			bg2El.style.left = Math.floor(camera.x / 2) + 'px';
			fgLayerEl.style.left = Math.floor(camera.x) + 'px';
			gameObjectsEl.style.left = Math.floor(camera.x) + 'px';
		}
		const t2 = window.performance.now();
		let t3, t4, t5;
		if (!paused) {
			// Render dynamic gameplay
			timerEl.textContent = time(timer);
			// Clear everything rendered last frame
			t3 = window.performance.now();
			if (this.clearCallback) {
				this.clearCallback(gameCtx, this.properties);
			}
			clearPendulumLines();
			clearCrushers();
			clearFlags();
			clearBouncers();
			clearShards();
			clearLasers();
			player.clear();
			// Update game
			t4 = window.performance.now();
			updateMovingBlocks(numFrames);
			updateLasers();
			player.update(numFrames);
			updateMovingSpikeEls();
			// Redraw everything rendered this frame
			t5 = window.performance.now();
			if (this.drawCallback) {
				this.drawCallback(gameCtx, this.properties);
			}
			drawPendulums();
			drawCrushers();
			drawFlags();
			drawBouncers(numFrames);
			drawShards();
			drawLasers();
			player.draw();
			//this.drawEdgeLines(fgCtx);
			if (!player.rewinding && player.startedMoving) {
				timer += numFrames;
			}
		}
		// Update UI
		const t6 = window.performance.now();
		frameTime = t6 - t1;
		if (DEV_MODE && !paused) {
			const backgroundPct = frameTime === 0 ? 0 : Math.floor(100 * (t2 - t1) / frameTime);
			const clearingPct = frameTime === 0 ? 0 : Math.floor(100 * (t4 - t3) / frameTime);
			const updatingPct = frameTime === 0 ? 0 : Math.floor(100 * (t5 - t4) / frameTime);
			const drawingPct = frameTime === 0 ? 0 : Math.floor(100 * (t6 - t5) / frameTime);
			devInfoEl.textContent = `Frame Time: ${frameTime.toFixed(2)}ms (Background: ${backgroundPct}%, Clearing: ${clearingPct}%, Updating: ${updatingPct}%, Drawing: ${drawingPct}%)`;
		}
	}
}

if (!DEBUG_LEVEL) {
stages = [

	new Stage(solitaryTheme, [
		'■                          U                               ■',
		'■                         ■▼■                              ■',
		'■                          ■                               ■',
		'■                                                          ■',
		'■                                                          ■',
		'■                                                          ■',
		'■                E       MMMMM                             ■',
		'■                                                          ■',
		'■                                                          ■',
		'■                                                          ■',
		'■                    E  BBBB  E                            ■',
		'■                                                          ■',
		'■                                                          ■',
		'■                                                          ■',
		'■◣                                                         ■',
		'■■◣ P                                                      ■',
		'■■■■■■■■■■■■■+■■■■■■■■■■■■■+■■■■■■■■■■■■■■+■■■■■■■■■■■■■■■■■',
		'■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■',
		'■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■',
		'■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■'
	], ctx => {	
		drawSign(ctx, 300, 100, 100, 40);
		drawSignLight(ctx, 225, 220, 30);
		drawSignLight(ctx, 275, 220, 30);
		ctx.font = arial(9);
		ctx.fillStyle = '#DDD';
		drawSquare(ctx, 340, 103, 20, 20, false);
		centerText(ctx, 'Not a debug level', 350, 135);
		ctx.fillRect(242, 225, 16, 16);
		ctx.beginPath();		
		drawSign(ctx, 450, 220, 285, 40);
		drawSignLight(ctx, 485, 220, 30);
		drawSignLight(ctx, 593, 220, 30);
		drawSignLight(ctx, 700, 220, 30);
		ctx.font = arial(9);
		ctx.fillStyle = '#DDD';
		centerText(ctx, 'UP OR W TO JUMP', 500, 252);
		centerText(ctx, 'HOLD LONGER TO JUMP HIGHER', 650, 252);
		ctx.fillRect(500, 225, 16, 16);
	}),

]; }

function renderMenu() {

	bg1El.style.left = Math.floor(-frameCount % 400) + 'px';
	bg2El.style.left = Math.floor((-frameCount * 2) % 400) + 'px';
}

changeScreen('menu');

function loop(currentTime) {
	// Time (in milliseconds) elapsed since game loaded.
	const elapsedTime = currentTime - startTime;
	// We would like the amount of time to have elapsed
	// to be exactly enough that FRAME_TIME milliseconds
	// elapsed with each frame -- in other words, we
	// would like the frame rate to be FRAMES_PER_SECOND.
	const desiredTime = frameCount * FRAME_TIME;
	// The number of frames needed to catch desiredTime up.
	let numFrames = Math.max(0, Math.round((elapsedTime - desiredTime) / FRAME_TIME));
	if (numFrames >= MAX_DELAY_FRAMES) {
		frameCount += numFrames;
		numFrames = 1; // Forgive the rest of the frames
	} else {
		numFrames = Math.min(numFrames, MAX_CATCH_UP_FRAMES);
		frameCount += numFrames;
	}
	switch (screen) {
		case 'menu':
			renderMenu();
			break;
		case 'game':
			stages[stageIndex].render(numFrames);
			break;
	}
	window.requestAnimationFrame(loop);
}

score('Lionofgd', '3:41.17');
score('slowgamer', '34:46.13');
score('Daniel', '13:40.03');
score('David', '7:33.12');
score('Eliav', '6:39.78');
score('Charlie', '16:33.72');
score('soopergamer2000', '5:56.55');
score('lumlum developers', '6:36.65');
score('Ord Oreo', '10:55.13');
score('MyNameIsMiles', '4:53.32');
score('Akbaba', '4:30.20');
score('Rubio388', '4:16.12');
score('Steven', '4:05.32');
score('CanonRouge24', '3:56.17');
score('Leo Markwat', '8:44.90');
score('The IME', '3:53.98');
score('CoralKat', '6:22.87');
score('Kavin', '7:21.52');
score('Kruxe', '5:04.27');
score('TheMoneyLord', '4:31.45');
score('damota.markods', '5:36.83');
score('Count Bleck', '4:04.13');

initializeScores();

// Set game load time
startTime = window.performance.now();
window.requestAnimationFrame(loop);
