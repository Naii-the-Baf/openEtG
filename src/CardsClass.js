import Card from './Card.js';
import * as etg from './etg.js';
import * as etgutil from './etgutil.js';

export default class Cards {
	constructor(CardsJson) {
		this.filtercache = [[], [], [], []];
		this.Codes = [];
		this.Names = Object.create(null);

		CardsJson.forEach((data, type) => {
			const keys = data[0],
				cardinfo = Object.create(null);
			for (let i = 1; i < data.length; i++) {
				cardinfo.E = i - 1;
				for (const carddata of data[i]) {
					keys.forEach((key, i) => {
						cardinfo[key] = carddata[i];
					});
					const cardcode = cardinfo.Code,
						card = new Card(this, type + 1, cardinfo);
					this.Codes[cardcode] = card;
					if (!card.upped) this.Names[cardinfo.Name.replace(/\W/g, '')] = card;
					cardinfo.Code = etgutil.asShiny(cardcode, true);
					const shiny = new Card(this, type + 1, cardinfo);
					this.Codes[cardinfo.Code] = shiny;
					const cacheidx = card.upped ? 1 : 0;
					if (!card.getStatus('token')) {
						this.filtercache[cacheidx].push(card);
						this.filtercache[cacheidx | 2].push(shiny);
					}
				}
			}
		});
		for (const fc of this.filtercache) {
			fc.sort(this.cardCmp, this);
		}
	}

	codeCmp = (x, y) => {
		const cx = this.Codes[etgutil.asShiny(x, false)],
			cy = this.Codes[etgutil.asShiny(y, false)];
		return (
			cx.upped - cy.upped ||
			cx.element - cy.element ||
			cy.getStatus('pillar') - cx.getStatus('pillar') ||
			cx.cost - cy.cost ||
			cx.type - cy.type ||
			(cx.code > cy.code) - (cx.code < cy.code) ||
			(x > y) - (x < y)
		);
	};

	cardCmp = (x, y) => this.codeCmp(x.code, y.code);

	filter(upped, filter, cmp, shiny) {
		const keys =
			this.filtercache[(upped ? 1 : 0) | (shiny ? 2 : 0)].filter(filter);
		return cmp ? keys.sort(cmp) : keys;
	}

	cardCount(counts, card) {
		return (
			counts[etgutil.asShiny(etgutil.asUpped(card.code, false), false)] ?? 0
		);
	}

	checkPool(pool, cardCount, cardMinus, card) {
		const uncode = etgutil.asShiny(etgutil.asUpped(card.code, false), false);

		if ((cardMinus[card.code] ?? 0) + 1 <= pool[card.code]) {
			cardMinus[card.code] = (cardMinus[card.code] ?? 0) + 1;
			cardCount[uncode] = (cardCount[uncode] ?? 0) + 1;
			return true;
		}

		if (!card.upped && !card.shiny) {
			return false;
		}

		if (card.rarity === 4 && card.shiny) {
			const scode = etgutil.asShiny(uncode, true);
			if ((cardMinus[scode] ?? 0) + 1 <= pool[scode]) {
				cardMinus[scode] = (cardMinus[scode] ?? 0) + 1;
				cardCount[scode] = (cardCount[scode] ?? 0) + 1;
				return true;
			}
			return false;
		}

		const amount =
			(card.rarity === -1 ? 1 : 6) * (card.upped && card.shiny ? 6 : 1);
		if ((cardMinus[uncode] ?? 0) + amount <= pool[uncode]) {
			cardMinus[uncode] = (cardMinus[uncode] ?? 0) + amount;
			cardCount[uncode] = (cardCount[uncode] ?? 0) + 1;
			return true;
		}
		return false;
	}

	filterDeck(deck, pool, preserve) {
		const cardMinus = [],
			cardCount = [];
		for (let i = deck.length - 1; i >= 0; i--) {
			let code = deck[i],
				card = this.Codes[code];
			if (!card.getStatus('pillar')) {
				if (this.cardCount(cardCount, code) >= 6) {
					deck.splice(i, 1);
					continue;
				}
			}
			if (!card.isFree()) {
				if (!this.checkPool(pool, cardCount, cardMinus, card)) {
					code = etgutil.asShiny(code, !card.shiny);
					card = this.Codes[code];
					if (
						card.isFree() ||
						this.checkPool(pool, cardCount, cardMinus, card)
					) {
						deck[i] = code;
					} else if (!preserve) {
						deck.splice(i, 1);
					}
				}
			}
		}
		return cardMinus;
	}

	isDeckLegal(deck, user, minsize = 30) {
		if (!user) return false;
		let pool = etgutil.deck2pool(
			user.accountbound ?? '',
			etgutil.deck2pool(user.pool),
		);
		const cardMinus = [],
			cardCount = [];
		let dlen = 0;
		for (let i = deck.length - 1; i >= 0; i--) {
			const code = deck[i];
			if (~etgutil.fromTrueMark(code)) continue;
			dlen++;
			const card = this.Codes[code];
			if (
				!card ||
				(!card.getStatus('pillar') && this.cardCount(cardCount, card) >= 6)
			) {
				return false;
			}
			if (
				!card.isFree() &&
				pool &&
				!this.checkPool(pool, cardCount, cardMinus, card)
			) {
				return false;
			}
		}
		if (dlen < minsize || dlen > 60) return false;
		return true;
	}
}
