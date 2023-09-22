import enums from './enum.json' assert { type: 'json' };
import * as etg from './etg.js';
import * as etgutil from './etgutil.js';
import * as wasm from './rs/pkg/etg.js';

export default class Card {
	constructor(Cards, code, realcode) {
		this.Cards = Cards;
		this.idx = wasm.card_index(Cards.set, code);
		this.code = realcode;
	}

	get shiny() {
		return !!(this.code & 16384);
	}

	get upped() {
		return ((this.code & 0x3fff) - 1000) % 4000 > 1999;
	}

	valueOf() {
		return this.code;
	}

	isFree() {
		return this.pillar && !this.upped && !this.rarity && !this.shiny;
	}

	toString() {
		return this.code.toString();
	}

	asUpped(upped) {
		return this.Cards.Codes[etgutil.asUpped(this.code, upped)];
	}

	asShiny(shiny) {
		return this.Cards.Codes[etgutil.asShiny(this.code, shiny)];
	}
}

for (const k of Object.getOwnPropertyNames(wasm)) {
	if (k.startsWith('card_')) {
		Object.defineProperty(Card.prototype, k.slice(5), {
			get() {
				return wasm[k](this.Cards.set, this.idx);
			},
		});
	}
}
