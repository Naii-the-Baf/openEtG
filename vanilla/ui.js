'use strict';
var etg = require('./etg');
var gfx = require('./gfx');
var util = require('../util');
var options = require('../options');
var Effect = require('./Effect');
exports.elecols = new Uint32Array([
	0xaa9988,
	0xaa5599,
	0x776688,
	0x996633,
	0x665544,
	0x55aa00,
	0xcc5522,
	0x225588,
	0x888877,
	0x3388dd,
	0xccaa22,
	0x333333,
	0x55aacc,
	0xddccbb,
	0xddbbcc,
	0xbbaacc,
	0xccbb99,
	0xbbaa99,
	0xaacc77,
	0xddaa88,
	0x88aacc,
	0xccccbb,
	0x99bbee,
	0xeedd88,
	0x999999,
	0xaaddee,
]);
exports.maybeLighten = function(card) {
	return exports.elecols[card.element + card.upped * 13];
};
var Point;
if (typeof PIXI === 'undefined') {
	Point = function(x, y) {
		this.x = x;
		this.y = y;
	};
	Point.prototype.set = Point;
} else Point = PIXI.math.Point;
function reflectPos(obj) {
	var pos = obj instanceof Point ? obj : obj.position;
	pos.set(900 - pos.x, 600 - pos.y);
}
var crpos = new Uint8Array([
	3,
	1,
	5,
	1,
	1,
	1,
	2,
	1,
	4,
	1,
	6,
	1,
	0,
	1,
	1,
	2,
	3,
	2,
	5,
	2,
	7,
	2,
	0,
	0,
	2,
	0,
	4,
	0,
	6,
	0,
	0,
	2,
	2,
	2,
	4,
	2,
	6,
	2,
	1,
	0,
	3,
	0,
	5,
	0,
	7,
	0,
]);
function creaturePos(j, i) {
	var column = crpos[i * 2],
		row = crpos[i * 2 + 1];
	var p = new Point(
		151 + column * 79 + (row == 1 ? 79 / 2 : 0),
		344 + row * 33,
	);
	if (j) reflectPos(p);
	return p;
}
function permanentPos(j, i) {
	var p = new Point(140 + (i % 8) * 64, 504 + Math.floor(i / 8) * 40);
	if (j) reflectPos(p);
	return p;
}
function tgtToPos(t) {
	if (t instanceof etg.Creature) {
		return creaturePos(t.owner == t.owner.game.player2, t.getIndex());
	} else if (t instanceof etg.Weapon) {
		var p = new Point(666, 512);
		if (t.owner == t.owner.game.player2) reflectPos(p);
		return p;
	} else if (t instanceof etg.Shield) {
		var p = new Point(710, 532);
		if (t.owner == t.owner.game.player2) reflectPos(p);
		return p;
	} else if (t instanceof etg.Permanent) {
		return permanentPos(t.owner == t.owner.game.player2, t.getIndex());
	} else if (t.type == etg.Player) {
		var p = new Point(50, 560);
		if (t == t.owner.game.player2) reflectPos(p);
		return p;
	} else if (t instanceof etg.CardInstance) {
		return new Point(
			t.owner == t.owner.game.player2 ? 20 : 780,
			(t.owner == t.owner.game.player2 ? 140 : 300) +
				20 * t.owner.hand.indexOf(t),
		);
	} else console.log('Unknown target');
}
var tximgcache = {};
function getTextImage(text, size, color, bgcolor, width) {
	if (!gfx.loaded || !text) return gfx.nopic;
	var key = JSON.stringify(arguments);
	if (key in tximgcache) {
		return tximgcache[key];
	}
	var x = 0,
		y = 0,
		h = Math.floor(size * 1.4),
		w = 0;
	function pushIcon(texture, num) {
		if (num === undefined) num = 1;
		setMode(1);
		var w = size * num;
		if (width && x + w > width) {
			x = 0;
			y += h;
		}
		for (var i = 0; i < num; i++) {
			iconxy.push(texture, x, y);
			x += size;
		}
	}
	var canvas = document.createElement('canvas'),
		ctx = canvas.getContext('2d');
	var textxy = [],
		font = (ctx.font = size + 'px sans-serif'),
		mode = 0,
		iconxy = [];
	function setMode(m) {
		if (mode != m) {
			if (x) x += 3;
			mode = m;
		}
	}
	function pushText(text) {
		text = text.trim();
		if (!text) return;
		setMode(0);
		var w = ctx.measureText(text).width;
		if (!width || x + w <= width) {
			textxy.push(text, x, y + size);
			x += w;
			return;
		}
		var idx = 0,
			endidx = 0,
			oldblock = '';
		util.iterSplit(text, ' ', function(word) {
			var nextendidx = endidx + word.length + 1;
			var newblock = text.slice(idx, nextendidx - 1);
			if (width && x + ctx.measureText(newblock).width >= width) {
				textxy.push(oldblock, x, y + size);
				newblock = word;
				idx = endidx;
				x = 0;
				y += h;
			}
			oldblock = newblock;
			endidx = nextendidx;
		});
		if (idx != text.length) {
			textxy.push(oldblock, x, y + size);
			x += ctx.measureText(oldblock).width;
			if (width && x >= width) {
				x = 0;
				y += h;
			}
		}
	}
	text = text.replace(/\|/g, ' | ');
	var sep = /\d\d?:\d\d?|\n/g,
		reres,
		lastindex = 0;
	while ((reres = sep.exec(text))) {
		var piece = reres[0];
		if (reres.index != lastindex) {
			pushText(text.slice(lastindex, reres.index));
		}
		if (piece == '\n') {
			w = Math.max(w, x);
			x = 0;
			y += h;
		} else {
			var parse = piece.split(':');
			var num = parseInt(parse[0]);
			var icon = gfx.e[parseInt(parse[1])];
			if (num < 4) {
				pushIcon(icon, num);
			} else {
				setMode(1);
				mode = 0;
				pushText(num.toString());
				mode = 1;
				pushIcon(icon);
			}
		}
		lastindex = reres.index + piece.length;
	}
	if (lastindex != text.length) pushText(text.slice(lastindex));
	canvas.width = width || Math.max(w, x);
	canvas.height = y + h;
	if (bgcolor) {
		ctx.fillStyle = PIXI.utils.hex2string(bgcolor);
		ctx.fillRect(0, 0, canvas.width, canvas.height);
	}
	ctx.font = font;
	ctx.fillStyle = color || 'black';
	for (var i = 0; i < textxy.length; i += 3) {
		ctx.fillText(textxy[i], textxy[i + 1], textxy[i + 2]);
	}
	if (iconxy.length) {
		var rend = require('./px').mkRenderTexture(canvas.width, canvas.height);
		var spr = new PIXI.Sprite(new PIXI.Texture(new PIXI.BaseTexture(canvas)));
		for (var i = 0; i < iconxy.length; i += 3) {
			var ico = new PIXI.Sprite(iconxy[i]);
			ico.position.set(iconxy[i + 1], iconxy[i + 2]);
			ico.scale.set(size / 32, size / 32);
			spr.addChild(ico);
		}
		rend.render(spr);
		return (tximgcache[key] = rend);
	} else {
		return (tximgcache[key] = new PIXI.Texture(new PIXI.BaseTexture(canvas)));
	}
}
var sounds = {},
	musics = {},
	currentMusic;
var soundEnabled = false,
	musicEnabled = false;
function loadSounds() {
	if (soundEnabled) {
		for (var i = 0; i < arguments.length; i++) {
			sounds[arguments[i]] = new Audio('sound/' + arguments[i] + '.ogg');
		}
	}
}
function loadMusics() {
	if (musicEnabled) {
		for (var i = 0; i < arguments.length; i++) {
			musics[arguments[i]] = new Audio('sound/' + arguments[i] + '.ogg');
		}
	}
}
function playSound(name, dontreset) {
	if (soundEnabled && !Effect.disable) {
		var sound = sounds[name];
		if (!sound) {
			sound = sounds[name] = new Audio('sound/' + name + '.ogg');
		}
		if (!dontreset && sound.duration) sound.currentTime = 0;
		sound.play();
	}
}
function playMusic(name) {
	if (name == currentMusic || Effect.disable) return;
	var music;
	if (musicEnabled && (music = musics[currentMusic])) music.pause();
	currentMusic = name;
	if (musicEnabled) {
		music = musics[name];
		if (!music) {
			music = musics[name] = new Audio('sound/' + name + '.ogg');
			music.loop = true;
		}
		music.play();
	}
}
function changeSound(enabled) {
	soundEnabled = enabled;
	if (!soundEnabled) {
		for (var sound in sounds) {
			sounds[sound].pause();
		}
	}
}
function changeMusic(enabled) {
	musicEnabled = enabled;
	if (!musicEnabled) {
		var music = musics[currentMusic];
		if (music) music.pause();
	} else {
		var name = currentMusic;
		currentMusic = null;
		playMusic(name);
	}
}
function parseInput(data, key, value, limit) {
	var value = parseInt(value);
	if (value === 0 || value > 0) data[key] = Math.min(value, limit || Infinity);
}
function parsepvpstats(data) {
	parseInput(data, 'p1hp', options.pvphp);
	parseInput(data, 'p1drawpower', options.pvpdraw, 8);
	parseInput(data, 'p1markpower', options.pvpmark, 1188);
	parseInput(data, 'p1deckpower', options.pvpdeck);
}
function parseaistats(data) {
	parseInput(data, 'p2hp', options.aihp);
	parseInput(data, 'p2drawpower', options.aidraw, 8);
	parseInput(data, 'p2markpower', options.aimark, 1188);
	parseInput(data, 'p2deckpower', options.aideckpower);
}
exports.reflectPos = reflectPos;
exports.creaturePos = creaturePos;
exports.permanentPos = permanentPos;
exports.tgtToPos = tgtToPos;
if (typeof PIXI !== 'undefined') exports.getTextImage = getTextImage;
exports.loadSounds = loadSounds;
exports.loadMusics = loadMusics;
exports.playSound = playSound;
exports.playMusic = playMusic;
exports.changeSound = changeSound;
exports.changeMusic = changeMusic;
exports.parseInput = parseInput;
exports.parsepvpstats = parsepvpstats;
exports.parseaistats = parseaistats;
