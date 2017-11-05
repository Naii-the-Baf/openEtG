var Cards = require("./Cards");
var etgutil = require("./etgutil");
var userutil = require("./userutil");

exports.bazaar = function(data, user){
	var cost = Math.ceil(userutil.calcWealth(data.cards, true)*3);
	if (user.gold >= cost){
		user.gold -= cost;
		user.pool = etgutil.mergedecks(user.pool, data.cards);
	}
}
exports.sellcard = function(data, user){
	if (etgutil.count(user.pool, data.card)){
		var card = Cards.Codes[data.card];
		var sellValue = userutil.sellValues[card.rarity] * (card.upped ? 6 : 1) * (card.shiny ? 6 : 1);
		if (sellValue){
			user.pool = etgutil.addcard(user.pool, data.card, -1);
			user.gold += sellValue;
		}
	}
}
function transmute(user, oldcard, func, use){
	var poolCount = etgutil.count(user.pool, oldcard);
	var newcard = func(oldcard, true);
	if (poolCount < use){
		var boundCount = etgutil.count(user.accountbound, oldcard);
		if (poolCount + boundCount >= use){
			user.accountbound = etgutil.addcard(user.accountbound, oldcard, -use);
			if (boundCount < use) user.pool = etgutil.addcard(user.pool, oldcard, boundCount-use);
			user.accountbound = etgutil.addcard(user.accountbound, newcard);
		}
	}else{
		user.pool = etgutil.addcard(user.pool, oldcard, -use);
		user.pool = etgutil.addcard(user.pool, newcard);
	}
}
function untransmute(user, oldcard, func, use){
	var poolCount = etgutil.count(user.pool, oldcard);
	var newcard = func(oldcard, false);
	if (poolCount == 0){
		var boundCount = etgutil.count(user.accountbound, oldcard);
		if (boundCount){
			user.accountbound = etgutil.addcard(user.accountbound, oldcard, -1);
			user.accountbound = etgutil.addcard(user.accountbound, newcard, use);
		}
	} else {
		user.pool = etgutil.addcard(user.pool, oldcard, -1);
		user.pool = etgutil.addcard(user.pool, newcard, use);
	}
}
exports.upgrade = function(data, user){
	var card = Cards.Codes[data.card];
	if (!card || card.upped) return;
	var use = ~card.rarity ? 6 : 1;
	transmute(user, card.code, etgutil.asUpped, use);
}
exports.downgrade = function(data, user){
	var card = Cards.Codes[data.card];
	if (!card || !card.upped) return;
	var use = ~card.rarity ? 6 : 1;
	untransmute(user, card.code, etgutil.asUpped, use);
}
exports.polish = function(data, user){
	var card = Cards.Codes[data.card];
	if (!card || card.shiny || card.rarity == 5) return;
	var use = ~card.rarity ? 6 : 2;
	transmute(user, card.code, etgutil.asShiny, use);
}
exports.unpolish = function(data, user){
	var card = Cards.Codes[data.card];
	if (!card || !card.shiny || card.rarity == 5) return;
	var use = ~card.rarity ? 6 : 2;
	untransmute(user, card.code, etgutil.asShiny, use);
}
function upshpi(cost, func){
	return function(data, user) {
		var card = Cards.Codes[data.c];
		if (card && user.gold >= cost && card.isFree()){
			user.gold -= cost;
			user.pool = etgutil.addcard(user.pool, func(data.c));
		}
	}
}
exports.uppillar = upshpi(50, function(code){ return etgutil.asUpped(code, true); });
exports.shpillar = upshpi(50, function(code){ return etgutil.asShiny(code, true); });
exports.upshpillar = upshpi(300, function(code) { return etgutil.asUpped(etgutil.asShiny(code, true), true); });
exports.upshall = function(data, user){
	var pool = etgutil.deck2pool(user.pool);
	var bound = etgutil.deck2pool(user.accountbound);
	pool.forEach(function(count, code){
		var card = Cards.Codes[code];
		if (!card || card.rarity == 5 || card.rarity < 1) return;
		var dcode = etgutil.asShiny(etgutil.asUpped(card.code, false), false);
		if (code == dcode) return;
		if (!(dcode in pool)) pool[dcode] = 0;
		pool[dcode] += count*(card.upped && card.shiny?36:6);
		pool[code] = 0;
	});
	bound.forEach(function(count, code){
		if (!(code in pool)) return;
		var card = Cards.Codes[code];
		if (!card || card.rarity == 5 || card.rarity < 1 || card.upped || card.shiny) return;
		pool[code] += Math.min(count, 6);
	});
	pool.forEach(function(count, code){
		var card = Cards.Codes[code];
		if (!card || card.rarity == 5 || card.rarity < 1 || card.upped || card.shiny) return;
		var base = 6, pc = 0;
		for(var i=1; i<4; i++){
			var upcode = etgutil.asShiny(etgutil.asUpped(code, i&1), i&2);
			pool[upcode] = Math.max(Math.min(Math.floor((count-base)/(i==3?36:6)), 6), 0);
			pc += pool[upcode]*(i==3?36:6);
			base += 36;
		}
		pool[code] -= pc;
	});
	bound.forEach(function(count, code){
		if (!(code in pool)) return;
		var card = Cards.Codes[code];
		if (!card || card.rarity == 5 || card.rarity < 1 || card.upped || card.shiny) return;
		pool[code] -= Math.min(count, 6);
	});
	var newpool = "";
	pool.forEach(function(count, code){
		if (count){
			if (count) newpool = etgutil.addcard(newpool, code, count);
		}
	});
	user.pool = newpool;
}
exports.addgold = function(data, user){
	user.gold += data.g;
}
exports.addloss = function (data, user){
	user[data.pvp?"pvplosses":"ailosses"]++;
	if (data.l !== undefined) user.streak[data.l] = 0;
	if (data.g) user.gold += data.g;
}
exports.addwin = function(data, user){
	var prefix = data.pvp?"pvp":"ai";
	user[prefix+"wins"]++;
	user[prefix+"losses"]--;
}
exports.setstreak = function(data, user){
	user.streak[data.l] = data.n;
}
exports.addcards = function(data, user){
	user.pool = etgutil.mergedecks(user.pool, data.c);
}
exports.addbound = function(data, user){
	user.accountbound = etgutil.mergedecks(user.accountbound, data.c);
}
exports.donedaily = function(data, user){
	if (data.daily == 6 && !(user.daily&64)){
		user.pool = etgutil.addcard(user.pool, data.c);
	}
	user.daily |= 1 << data.daily;
}
exports.changeqeck = function(data, user){
	user.qecks[data.number] = data.name;
}
exports.setdeck = function(data, user){
	if (data.d !== undefined) user.decks[data.name] = data.d;
	user.selectedDeck = data.name;
}
exports.rmdeck = function(data, user){
	delete user.decks[data.name];
}
exports.updatequest = function(data, user){
	user.quests[data.quest] = data.newstage;
}