"use strict";
var px = require("../px");
var dom = require("../dom");
var etg = require("../etg");
var gfx = require("../gfx");
var chat = require("../chat");
var sock = require("../sock");
var Cards = require("../Cards");
var tutor = require("../tutor");
var etgutil = require("../etgutil");
var options = require("../options");
var DeckDisplay = require("../DeckDisplay");
var CardSelector = require("../CardSelector");

module.exports = function(arena, ainfo, acard, startempty) {
	var aupped;
	if (arena){
		if (!sock.user || (!startempty && ainfo.deck === undefined) || acard === undefined) arena = false;
		else aupped = Cards.Codes[acard].upped;
	}
	function updateField(renderdeck){
		if (deckimport){
			deckimport.value = etgutil.encoderaw(decksprite.deck) + etgutil.toTrueMarkSuffix(editormark);
			deckimport.dispatchEvent(new Event("change"));
		}
	}
	function sumCardMinus(cardminus, code){
		var sum = 0;
		for (var i=0; i<2; i++){
			for (var j=0; j<2; j++){
				sum += cardminus[etgutil.asShiny(etgutil.asUpped(code, i==0), j==0)] || 0;
			}
		}
		return sum;
	}
	function processDeck() {
		for (var i = decksprite.deck.length - 1;i >= 0;i--) {
			if (!(decksprite.deck[i] in Cards.Codes)) {
				var index = etgutil.fromTrueMark(decksprite.deck[i]);
				if (~index) {
					editormark = index;
				}
				decksprite.deck.splice(i, 1);
			}
		}
		marksprite.className = "ico e"+editormark;
		if (decksprite.deck.length > 60) decksprite.deck.length = 60;
		decksprite.deck.sort(Cards.codeCmp);
		if (sock.user) {
			cardsel.cardminus = cardminus = [];
			for (var i = decksprite.deck.length - 1;i >= 0;i--) {
				var code = decksprite.deck[i], card = Cards.Codes[code];
				if (card.type != etg.Pillar) {
					if (sumCardMinus(cardminus, code) == 6) {
						decksprite.deck.splice(i, 1);
						continue;
					}
				}
				if (!card.isFree()) {
					if ((cardminus[code] || 0) < (cardpool[code] || 0)) {
						px.adjust(cardminus, code, 1);
					} else {
						code = etgutil.asShiny(code, !card.shiny);
						card = Cards.Codes[code];
						if (card.isFree()){
							decksprite.deck[i] = code;
						}else if ((cardminus[code] || 0) < (cardpool[code] || 0)) {
							decksprite.deck[i] = code;
							px.adjust(cardminus, code, 1);
						} else {
							decksprite.deck.splice(i, 1);
						}
					}
				}
			}
			if (arena){
				decksprite.deck.unshift(acard, acard, acard, acard, acard);
			}
		}
		updateField();
		decksprite.renderDeck(0);
	}
	function setCardArt(code){
		cardArt.texture = gfx.getArt(code);
		cardArt.visible = true;
	}
	function incrpool(code, count){
		if (code in Cards.Codes && (!arena || (!Cards.Codes[code].isOf(Cards.Codes[acard].asUpped(false).asShiny(false))) && (aupped || !Cards.Codes[code].upped))){
			cardpool[code] = (cardpool[code] || 0) + count;
		}
	}
	function quickDeck(number) {
		return function() {
			if (quickNum.classList.contains("selectedbutton")) {
				saveButton();
				sock.userExec("changeqeck", { number: number, name: tname.textcache });
				sock.user.qecks[number] = tname.textcache;
				fixQuickButtons();
				quickNum.classList.remove("selectedbutton");
			}
			else {
				loadDeck(sock.user.qecks[number]);
			}
		}
	}
	function saveTo() {
		this.classList.toggle("selectedbutton");
	}
	function fixQuickButtons(){
		for (var i = 0;i < 10;i++) {
			buttons.children[i].classList[sock.user.selectedDeck == sock.user.qecks[i]?"add":"remove"]("selectedbutton");
		}
	}
	function saveDeck(force){
		var dcode = etgutil.encoderaw(decksprite.deck) + etgutil.toTrueMarkSuffix(editormark);
		var olddeck = sock.getDeck();
		if (decksprite.deck.length == 0){
			sock.userExec("rmdeck", {name: sock.user.selectedDeck});
		}else if (olddeck != dcode){
			sock.userExec("setdeck", { d: dcode, name: sock.user.selectedDeck });
		}else if (force) sock.userExec("setdeck", {name: sock.user.selectedDeck });
	}
	function loadDeck(x){
		if (!x) return;
		saveDeck();
		deckname.value = sock.user.selectedDeck = x;
		tname.text = x;
		fixQuickButtons();
		decksprite.deck = etgutil.decodedeck(sock.getDeck());
		processDeck();
	}
	function importDeck(){
		var dvalue = options.deck.trim();
		decksprite.deck = ~dvalue.indexOf(" ") ? dvalue.split(" ") : etgutil.decodedeck(dvalue);
		processDeck();
	}
	var cardminus, cardpool;
	if (sock.user){
		cardminus = [];
		cardpool = [];
		etgutil.iterraw(sock.user.pool, incrpool);
		etgutil.iterraw(sock.user.accountbound, incrpool);
	}else cardpool = null;
	var editorui = px.mkView(function(){cardArt.visible = false}), div = dom.div([8, 32, ["Clear", function(){
		if (sock.user) {
			cardsel.cardminus = cardminus = [];
		}
		decksprite.deck.length = arena?5:0;
		decksprite.renderDeck(decksprite.deck.length);
	}]]);
	var stage = { view:editorui, dom:div, endnext: function() { document.removeEventListener("mousemove", resetCardArt, true); } };
	function sumscore(){
		var sum = 0;
		for(var k in artable){
			sum += arattr[k]*artable[k].cost;
		}
		return sum;
	}
	function makeattrui(y, name){
		function modattr(x){
			arattr[name] += x;
			if (arattr[name] >= (data.min || 0) && (!data.max || arattr[name] <= data.max)){
				var sum = sumscore();
				if (sum <= arpts){
					bv.text = arattr[name];
					curpts.text = (arpts-sum)/45;
					return;
				}
			}
			arattr[name] -= x;
		}
		y = 128+y*20;
		var data = artable[name];
		var bv = dom.text(arattr[name]);
		var bm = dom.button("-", modattr.bind(null, -(data.incr || 1)));
		var bp = dom.button("+", modattr.bind(null, data.incr || 1));
		bm.style.width = bp.style.width = "14px";
		dom.add(div, [4, y, name], [38, y, bm], [56, y, bv], [82, y, bp]);
	}
	function saveButton() {
		if (deckname.value) {
			sock.user.selectedDeck = deckname.value;
			fixQuickButtons();
			tname.text = sock.user.selectedDeck;
			saveDeck();
		}
	}
	if (arena){
		dom.add(div, [8, 58, ["Save & Exit", function() {
			if (decksprite.deck.length < 35 || sumscore()>arpts) {
				chat("35 cards required before submission", "System");
				return;
			}
			var data = { d: etgutil.encoderaw(decksprite.deck.slice(5)) + etgutil.toTrueMarkSuffix(editormark), lv: aupped };
			for(var k in arattr){
				data[k] = arattr[k];
			}
			if (!startempty){
				data.mod = true;
			}
			sock.userEmit("setarena", data);
			chat("Arena deck submitted", "System");
			startMenu();
		}]], [8, 84, ["Exit", function() {
			require("./ArenaInfo")(arena);
		}]]);
		var arpts = aupped?515:425, arattr = {hp:parseInt(ainfo.hp || 200), mark:parseInt(ainfo.mark || 2), draw:parseInt(ainfo.draw || 1)};
		var artable = {
			hp: { min: 65, max: 200, incr: 45, cost: 1 },
			mark: { cost: 45 },
			draw: { cost: 135 },
		};
		var curpts = new dom.text((arpts-sumscore())/45);
		dom.add(div, [4, 188, curpts]);
		makeattrui(0, "hp");
		makeattrui(1, "mark");
		makeattrui(2, "draw");
	} else {
		var quickNum = dom.button("Save to #", saveTo);
		dom.add(div, [8, 58, ["Save & Exit", function() {
			if (sock.user) saveDeck(true);
			startMenu();
		}]], [8, 84, ["Import", importDeck]]);
		if (sock.user) {
			var tname = dom.text(sock.user.selectedDeck),
				buttons = document.createElement("div");
			dom.add(div, [100, 8, tname],
			[8, 110, ["Save", saveButton
			]], [8, 136, ["Load", function() {
				loadDeck(deckname.value);
			}]], [8, 162, ["Exit", function() {
				if (sock.user) sock.userExec("setdeck", { name: sock.user.selectedDeck });
				startMenu();
			}]], [220, 8, quickNum], [300, 8, buttons]);
			for (var i = 0;i < 10;i++) {
				var b = dom.button(i+1, quickDeck(i));
				b.className = "editbtn";
				buttons.appendChild(b);
			}
			fixQuickButtons();
		}
	}
	var editormark = 0, marksprite = document.createElement("span");
	dom.add(div, [66, 200, marksprite]);
	for (var i = 0;i < 13;i++) {
		(function(_i) {
			dom.add(div, [100 + i * 32, 234,
				dom.icob(i, function() {
					editormark = _i;
					marksprite.className = "ico e"+_i;
					updateField();
				})
			]);
		})(i);
	}
	var decksprite = new DeckDisplay(60, setCardArt,
		function(i){
			var code = decksprite.deck[i], card = Cards.Codes[code];
			if (!arena || code != acard){
				if (sock.user && !card.isFree()) {
					px.adjust(cardminus, code, -1);
				}
				decksprite.rmCard(i);
				updateField();
			}
		}, arena ? (startempty ? [] : etgutil.decodedeck(ainfo.deck)) : etgutil.decodedeck(sock.getDeck())
	);
	editorui.addChild(decksprite);
	var cardsel = new CardSelector(stage, setCardArt,
		function(code){
			if (decksprite.deck.length < 60) {
				var card = Cards.Codes[code];
				if (sock.user && !card.isFree()) {
					if (!(code in cardpool) || (code in cardminus && cardminus[code] >= cardpool[code]) ||
						(card.type != etg.Pillar && sumCardMinus(cardminus, code) >= 6)) {
						return;
					}
					px.adjust(cardminus, code, 1);
				}
				decksprite.addCard(code, arena?5:0);
				updateField();
			}
		}, !arena, !!cardpool
	);
	cardsel.cardpool = cardpool;
	cardsel.cardminus = cardminus;
	editorui.addChild(cardsel);
	var cardArt = new PIXI.Sprite(gfx.nopic);
	cardArt.position.set(734, 8);
	editorui.addChild(cardArt);
	if (!arena){
		if (sock.user){
			var deckname = document.createElement("input");
			deckname.id = "deckname";
			deckname.style.width = "80px";
			deckname.placeholder = "Name";
			deckname.value = sock.user.selectedDeck;
			deckname.addEventListener("keypress", function(e){
				if (e.keyCode == 13) {
					loadDeck(this.value);
				}
			});
			deckname.addEventListener("click", function(e){
				this.setSelectionRange(0, 99);
			});
			dom.add(div, [4, 4, deckname]);
		}
		var deckimport = document.createElement("input");
		deckimport.id = "deckimport";
		deckimport.style.width = "190px";
		deckimport.placeholder = "Deck";
		deckimport.addEventListener("click", function(){this.setSelectionRange(0, 333)});
		deckimport.addEventListener("keypress", function(e){
			if (e.keyCode == 13){
				this.blur();
				importDeck();
			}
		});
		options.register("deck", deckimport);
		dom.add(div, [520, 238, deckimport]);
	}
	function resetCardArt() { cardArt.visible = false }
	document.addEventListener("mousemove", resetCardArt, true);
	if (!arena && sock.user) stage = tutor(tutor.Editor, 4, 220, stage);
	px.view(stage);

	if (!arena){
		deckimport.focus();
		deckimport.setSelectionRange(0, 333);
	}
	processDeck();
}
var startMenu = require("./MainMenu");