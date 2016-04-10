"use strict";
var px = require("../px");
var ui = require("../ui");
var dom = require("../dom");
var etg = require("../etg");
var gfx = require("../gfx");
var mkAi = require("../mkAi");
var sock = require("../sock");
var Card = require("../Card");
var Game = require("../Game");
var Cards = require("../Cards");
var Effect = require("../Effect");
var Skills = require("../Skills");
var etgutil = require("../etgutil");
var redhor = new Uint16Array([
	12, 0, 900,
	144, 145, 796,
	301, 103, 796,
	459, 103, 754,
]), redver = new Uint16Array([
	103, 301, 600,
	144, 12, 301,
	275, 12, 144,
	624, 459, 600,
	754, 301, 600,
	796, 12, 301,
]);
function startMatch(game, foeDeck, spectate) {
	if (sock.trade){
		sock.userEmit("canceltrade");
		delete sock.trade;
	}
	function drawTgting(spr, col) {
		fgfx.drawRect(spr.position.x - spr.width / 2, spr.position.y - spr.height / 2, spr.width, spr.height);
	}
	function drawBorder(obj, spr) {
		if (obj) {
			if (game.targeting) {
				if (game.targeting.filter(obj)){
					fgfx.lineStyle(2, 0xff0000);
					drawTgting(spr, 0xff0000);
					fgfx.lineStyle(2, 0xffffff);
				}
			} else if (obj.canactive() && !(obj.owner == game.player2 && game.player2.isCloaked())) {
				fgfx.lineStyle(2, obj.card.element == 8 ? 0 : 0xffffff);
				fgfx.drawRect(spr.position.x - spr.width / 2, spr.position.y - spr.height / 2 - 1, spr.width, (obj.type == etg.Weapon || obj.type == etg.Shield ? 12 : 10));
			}
		}
	}
	function drawStatus(obj, spr) {
		var statuses = spr.children[0].children;
		statuses[0].visible = obj.status.get("psionic");
		statuses[1].visible = obj.status.get("aflatoxin");
		statuses[2].visible = !obj.status.get("aflatoxin") && obj.status.get("poison") > 0;
		statuses[3].visible = obj.status.get("airborne") || obj.status.get("ranged");
		statuses[4].visible = obj.status.get("momentum");
		statuses[5].visible = obj.status.get("adrenaline");
		statuses[6].visible = obj.status.get("poison") < 0;
		statuses[7].visible = obj.status.get("delayed");
		statuses[8].visible = obj == obj.owner.gpull;
		statuses[9].visible = obj.status.get("frozen");
		statuses[10].visible = obj.hasactive("prespell", "protectonce");
		spr.alpha = obj.isMaterial() ? 1 : .7;
	}
	function addNoHealData(game) {
		var data = game.dataNext || {};
		if (game.noheal){
			data.p1hp = Math.max(game.player1.hp, 1);
			data.p1maxhp = game.player1.maxhp;
		}
		return data;
	}
	function endClick(discard) {
		if (game.turn == game.player1 && game.phase <= etg.MulliganPhase2){
			if (!game.ai) sock.emit("mulligan", {draw: true});
			game.progressMulligan();
		}else if (game.winner) {
			if (sock.user) {
				if (game.arena) {
					sock.userEmit("modarena", { aname: game.arena, won: game.winner == game.player2, lv: game.level-4 });
				}
				if (game.winner == game.player1) {
					if (game.quest){
						if (game.autonext) {
							var data = addNoHealData(game);
							var newgame = require("../Quest").mkQuestAi(game.quest[0], game.quest[1] + 1, game.area);
							newgame.addData(data);
							return;
						}else if (sock.user.quests[game.quest[0]] <= game.quest[1] || !(game.quest[0] in sock.user.quests)) {
							sock.userExec("updatequest", { quest: game.quest[0], newstage: game.quest[1] + 1 });
						}
					}else if (game.daily){
						if (game.endurance) {
							var data = addNoHealData(game);
							data.endurance--;
							var newgame = mkAi.mkAi(game.level, true)();
							newgame.addData(data);
							newgame.dataNext = data;
							return;
						}
						else {
							sock.userExec("donedaily", { daily: game.daily == 4 ? 5 : game.daily == 3 ? 0 : game.daily });
						}
					}
				}else if (!game.endurance && game.level !== undefined){
					sock.user.streak[game.level] = 0;
				}
			}
			require("./Result")(game, foeDeck);
		} else if (game.turn == game.player1) {
			if (discard == undefined && game.player1.hand.length == 8) {
				discarding = true;
			} else {
				discarding = false;
				if (!game.ai) sock.emit("endturn", {bits: discard});
				game.player1.endturn(discard);
				game.targeting = null;
				foeplays.removeChildren();
			}
		}
	}
	function cancelClick(){
		if (resigning) {
			resign.value = "Resign";
			resigning = false;
		} else if (game.turn == game.player1) {
			if (game.phase <= etg.MulliganPhase2 && game.player1.hand.length) {
				game.player1.drawhand(game.player1.hand.length - 1);
				if (!game.ai) sock.emit("mulligan");
			} else if (game.targeting) {
				game.targeting = null;
			} else discarding = false;
		}
	}
	var resigning, discarding, aiDelay = 0, aiState, aiCommand;
	if (sock.user && !game.endurance && (game.level !== undefined || !game.ai)) {
		sock.userExec("addloss", { pvp: !game.ai, l: game.level, g: -game.cost });
	}
	var gameui = new PIXI.Graphics();
	if (!spectate) {
		gameui.hitArea = new PIXI.math.Rectangle(0, 0, 900, 600);
		gameui.interactive = true;
	}
	for(var j=0; j<3; j++){
		gameui.lineStyle(1, [0x121212, 0x6a2e0d, 0x8a3e1d][j]);
		for (var i=0; i<redhor.length; i+=3){
			gameui.moveTo(redhor[i+1], redhor[i]-j);
			gameui.lineTo(redhor[i+2], redhor[i]-j);
		}
		for (var i=0; i<redver.length; i+=3){
			gameui.moveTo(redver[i]+j, redver[i+1]);
			gameui.lineTo(redver[i]+j, redver[i+2]);
		}
	}
	var cloakgfx = new PIXI.Graphics();
	cloakgfx.beginFill(0);
	cloakgfx.drawRect(130, 20, 660, 280);
	gameui.addChild(cloakgfx);
	var floodgfx = new PIXI.Graphics();
	floodgfx.beginFill(0x003F7F, .375);
	floodgfx.drawRect(149, 146, 644, 64);
	floodgfx.drawRect(149, 210, 244, 64);
	floodgfx.drawRect(107, 390, 644, 64);
	floodgfx.drawRect(507, 326, 244, 64);
	gameui.addChild(floodgfx);
	var endturn = dom.button("Accept Hand", function(){endClick()});
	var cancel = dom.button("Mulligan", cancelClick);
	var resign = dom.button("Resign", function() {
		if (resigning){
			if (!game.ai) sock.emit("foeleft");
			game.setWinner(game.player2);
			endClick();
		}else{
			resign.value = "Confirm";
			resigning = true;
		}
	});
	var turntell = new dom.text("");
	turntell.style.pointerEvents = "none";
	var foename = dom.text((game.level === undefined ? "" : ["Commoner", "Mage", "Champion", "Demigod", "Arena1", "Arena2"][game.level] + "\n") + (game.foename || "-"));
	foename.style.textAlign = "center";
	foename.style.width = "140px";
	var div = dom.div([8, 20, resign],
		[762, 580, turntell],
		[0, 40, foename]);
	if (!spectate) {
		dom.add(div, [800, 530, endturn], [800, 560, cancel]);
	}
	var activeInfo = {
		firebolt:function(){
			return 3+Math.floor((game.player1.quanta[etg.Fire]-game.targeting.src.card.cost)/4);
		},
		drainlife:function(){
			return 2+Math.floor((game.player1.quanta[etg.Darkness]-game.targeting.src.card.cost)/5);
		},
		icebolt:function(){
			var bolts = Math.floor((game.player1.quanta[etg.Water]-game.targeting.src.card.cost)/5);
			return (2+bolts) + " " + (35+bolts*5) + "%";
		},
		catapult:function(t){
			return Math.ceil(t.truehp()*(t.status.get("frozen")?150:100)/(t.truehp()+100));
		},
		adrenaline:function(t){
			return "Extra: " + etg.getAdrenalRow(t.trueatk());
		},
		fractal:function(){
			return "Copies: " + Math.min((6+Math.floor((game.player1.quanta[etg.Aether]-game.targeting.src.card.cost)/2)), 9-game.player1.hand.length);
		},
	};
	function setInfo(obj) {
		if (!cloakgfx.visible || obj.owner != game.player2 || obj.status.get("cloak")) {
			var info = obj.info(), actinfo = game.targeting && game.targeting.filter(obj) && activeInfo[game.targeting.text];
			if (actinfo) info += "\n" + actinfo(obj);
			infobox.text = info;
			infobox.style.display = "";
		}
	}
	var handsprite = [new Array(8), new Array(8)];
	var creasprite = [new Array(23), new Array(23)];
	var permsprite = [new Array(16), new Array(16)];
	var shiesprite = new Array(2);
	var weapsprite = new Array(2);
	var marksprite = [document.createElement("span"), document.createElement("span")], markspritexy = [];
	var quantatext = [[], []];
	var hptext = [new dom.text(""), new dom.text("")], hpxy = [];
	var playerOverlay = [new PIXI.Sprite(gfx.nopic), new PIXI.Sprite(gfx.nopic)];
	var handOverlay = [new PIXI.Sprite(gfx.nopic), new PIXI.Sprite(gfx.nopic)];
	var sabbathOverlay = [document.createElement("span"), document.createElement("span")];
	var sacrificeOverlay = [new PIXI.Sprite(gfx.sacrifice), new PIXI.Sprite(gfx.sacrifice)];
	for (var j = 0;j < 2;j++) {
		hptext[j].style.textAlign = "center";
		hptext[j].style.width = "100px";
		hptext[j].style.pointerEvents = "none";
		hptext[j].style.fontSize = "12px";
		hptext[j].style.lineHeight = "1.1";
		playerOverlay[j].width = 95;
		playerOverlay[j].height = 80;
		sabbathOverlay[j].className = "sabbath";
		sabbathOverlay[j].style.display = "none";
		handOverlay[j].position.set(j ? 3 : 759, j ? 75 : 305);
		sacrificeOverlay[j].position.set(j ? 800 : 0, j ? 7 : 502);
		(function(_j) {
			for (var i = 0;i < 8;i++) {
				handsprite[j][i] = new PIXI.Sprite(gfx.nopic);
				handsprite[j][i].position = ui.cardPos(j, i);
				var handtext = new PIXI.Sprite(gfx.nopic);
				handtext.position.set(64, 11);
				handtext.anchor.set(1, 0);
				handsprite[j][i].addChild(handtext);
				handtext = new PIXI.Sprite(gfx.nopic);
				handtext.position.set(0, -1);
				handsprite[j][i].addChild(handtext);
				gameui.addChild(handsprite[j][i]);
				(function(_i) {
					px.setClick(handsprite[j][i], function() {
						if (game.phase != etg.PlayPhase) return;
						var cardinst = game.players(_j).hand[_i];
						if (cardinst) {
							if (!_j && discarding) {
								endClick(_i);
							} else if (game.targeting) {
								if (game.targeting.filter(cardinst)) {
									game.targeting.cb(cardinst);
								}
							} else if (!_j && cardinst.canactive()) {
								if (cardinst.card.type != etg.Spell) {
									console.log("summoning", _i);
									if (!game.ai) sock.emit("cast", {bits: game.tgtToBits(cardinst)});
									cardinst.useactive();
								} else {
									game.getTarget(cardinst, cardinst.card.active.cast, function(tgt) {
										if (!game.ai) sock.emit("cast", {bits: game.tgtToBits(cardinst) | game.tgtToBits(tgt) << 9});
										cardinst.useactive(tgt);
									});
								}
							}
						}
					}, false);
				})(i);
			}
			function makeInst(insts, i, pos, scale){
				if (scale === undefined) scale = 1;
				var spr = new PIXI.Sprite(gfx.nopic);
				var statuses = new PIXI.Container();
				for (var k=0; k<7; k++){
					var icon = new PIXI.Sprite(gfx.s[k]);
					icon.alpha = .6;
					icon.anchor.y = 1;
					icon.position.set(-34 * scale + [4, 1, 1, 0, 3, 2, 1][k] * 8, 36 * scale);
					statuses.addChild(icon);
				}
				for (var k=0; k<3; k++){
					var icon = new PIXI.Sprite(gfx.sborder[k]);
					icon.position.set(-32 * scale, -40 * scale);
					icon.scale.set(scale, scale);
					statuses.addChild(icon);
				}
				var bubble = new PIXI.Sprite(gfx.protection);
				bubble.position.set(-40 * scale, -40 * scale);
				bubble.scale.set(scale, scale);
				statuses.addChild(bubble);
				spr.addChild(statuses);
				var stattext = new PIXI.Sprite(gfx.nopic);
				stattext.position.set(-32 * scale, -31 * scale);
				spr.addChild(stattext);
				var activetext = new PIXI.Sprite(gfx.nopic);
				activetext.position.set(-32 * scale, -40 * scale);
				spr.addChild(activetext);
				spr.anchor.set(.5, .5);
				spr.position = pos;
				px.setClick(spr, function() {
					if (game.phase != etg.PlayPhase) return;
					var inst = insts ? insts[i] : game.players(_j)[i];
					if (!inst) return;
					if (game.targeting && game.targeting.filter(inst)) {
						game.targeting.cb(inst);
					} else if (_j == 0 && !game.targeting && inst.canactive()) {
						game.getTarget(inst, inst.active.cast, function(tgt) {
							if (!game.ai) sock.emit("cast", {bits: game.tgtToBits(inst) | game.tgtToBits(tgt) << 9});
							inst.useactive(tgt);
						});
					}
				}, false);
				return spr;
			}
			for (var i = 0;i < 23;i++) {
				creasprite[j][i] = makeInst(game.players(j).creatures, i, ui.creaturePos(j, i));
			}
			for (var i = 0;i < 23;i++){
				gameui.addChild(creasprite[j][j?22-i:i]);
			}
			for (var i = 0;i < 16;i++) {
				permsprite[j][i] = makeInst(game.players(j).permanents, i, ui.permanentPos(j, i));
			}
			for (var i = 0;i < 16;i++){
				gameui.addChild(permsprite[j][j?15-i:i]);
			}
			px.setInteractive.apply(null, handsprite[j]);
			px.setInteractive.apply(null, creasprite[j]);
			px.setInteractive.apply(null, permsprite[j]);
			markspritexy[j] = new PIXI.math.Point(740, 470);
			marksprite[j].style.transform = "translate(-50%,-50%)";
			marksprite[j].style.textAlign = "center";
			marksprite[j].style.pointerEvents = "none";
			marksprite[j].style.fontSize = "18px";
			marksprite[j].style.textShadow = "2px 2px 1px rgb(0,0,0),2px 2px 2px rgb(0,0,0)";
			weapsprite[j] = makeInst(null, "weapon", new PIXI.math.Point(670, 508), 5/4);
			shiesprite[j] = makeInst(null, "shield", new PIXI.math.Point(710, 540), 5/4);
			if (j){
				gameui.addChild(shiesprite[j]);
				gameui.addChild(weapsprite[j]);
				ui.reflectPos(weapsprite[j]);
				ui.reflectPos(shiesprite[j]);
				ui.reflectPos(markspritexy[j]);
			}else{
				gameui.addChild(weapsprite[j]);
				gameui.addChild(shiesprite[j]);
			}
			playerOverlay[j].anchor.set(.5, .5);
			playerOverlay[j].position.set(50, 555);
			hpxy[j] = new PIXI.math.Point(50, 550);
			if (j) {
				ui.reflectPos(hpxy[j]);
				ui.reflectPos(playerOverlay[j]);
				playerOverlay[j].y += 15;
			}
			var quantaxy = [j ? 792 : 0, j ? 106 : 308];
			for (var k = 1;k < 13;k++) {
				quantatext[j][k-1] = dom.text("");
				quantatext[j][k-1].style.fontSize = "16px";
				quantatext[j][k-1].style.pointerEvents = "none";
				var quantaicon = document.createElement("span");
				quantaicon.className = "ico e"+k;
				dom.add(div, [quantaxy[0] + ((k & 1) ? 32 : 86), quantaxy[1] + Math.floor((k - 1) / 2) * 32 + 4, quantatext[j][k-1]],
					[quantaxy[0] + ((k & 1) ? 0 : 54), quantaxy[1] + Math.floor((k - 1) / 2) * 32, quantaicon]);
			}
			px.setClick(playerOverlay[j], function() {
				if (game.phase == etg.PlayPhase && game.targeting && game.targeting.filter(game.players(_j))) {
					game.targeting.cb(game.players(_j));
				}
			}, false);
		})(j);
		dom.add(div, [markspritexy[j].x, markspritexy[j].y, marksprite[j]],
			[hpxy[j].x-50, playerOverlay[j].y - 24, hptext[j]],
			[j ? 792 : 0, j ? 80 : 288, sabbathOverlay[j]]);
		gameui.addChild(handOverlay[j]);
		gameui.addChild(sacrificeOverlay[j]);
		gameui.addChild(playerOverlay[j]);
	}
	px.setInteractive.apply(null, weapsprite);
	px.setInteractive.apply(null, shiesprite);
	px.setInteractive.apply(null, playerOverlay);
	var fgfx = new PIXI.Graphics();
	gameui.addChild(fgfx);
	var anims = new PIXI.Container();
	gameui.addChild(anims);
	Effect.register(anims);
	var foeplays = new PIXI.Container();
	gameui.addChild(foeplays);
	var cardart = new PIXI.Sprite(gfx.nopic);
	cardart.anchor.set(.5, 0);
	gameui.addChild(cardart);
	var infobox = dom.text("");
	infobox.className = "infobox";
	infobox.style.display = "none";
	div.appendChild(infobox);
	var cursor = null, currow = handsprite[0], currowi = 0, currowo = 0;
	function onkeydown(e) {
		var ch = String.fromCharCode(e.keyCode), chi;
		if (e.keyCode == 27) {
			resign.click();
		} else if (ch == " " || e.keyCode == 13) {
			endClick();
		} else if (ch == "\b" || ch == "0") {
			cancelClick();
		} else if (ch == "\n" || e.keyCode == 192 || e.key == "`") {
			if (cursor) cursor.click();
		} else if (ch == "N") {
			cursor = null;
			currow = handsprite[0];
			currowo = currowi = 0;
		} else if (ch >= "1" && ch <= "8") {
			currowo = e.keyCode - 49;
			cursor = currow[currowi+currowo];
		} else if (~(chi = "SW".indexOf(ch))) {
			playerOverlay[chi].click();
		} else if (~(chi = "QA".indexOf(ch))) {
			shiesprite[chi].click();
		} else if (~(chi = "ED".indexOf(ch))) {
			weapsprite[chi].click();
		} else if (~(chi = "RF".indexOf(ch))) {
			currow = handsprite[chi];
			currowi = 0;
		} else if (~(chi = "ZXC".indexOf(ch))) {
			currow = creasprite[e.shiftKey?1:0];
			currowi = chi == 0 ? 0 : chi == 1 ? 8 : 15;
		} else if (~(chi = "VB".indexOf(ch))) {
			currow = permsprite[e.shiftKey?1:0];
			currowi = chi*8;
		} else if (~(chi = "HL".indexOf(ch))) {
			currowo += chi?1:-1;
			if (currowo > 8) currowo = 0;
			else if (currowo < 0) currowo = 8;
			cursor = currow[currowi+currowo];
		} else if (~(chi = "JK".indexOf(ch))) {
			var jkmap = [
				handsprite[0], 0,
				permsprite[0], 8,
				permsprite[0], 0,
				creasprite[0], 15,
				creasprite[0], 8,
				creasprite[0], 0,
				creasprite[1], 0,
				creasprite[1], 8,
				creasprite[1], 15,
				permsprite[1], 0,
				permsprite[1], 8,
				handsprite[1], 0,
			];
			for(var i=0; i<jkmap.length; i+=2){
				if (currow == jkmap[i] && jkmap[i+1] == currowi) break;
			}
			i += chi?2:-2;
			if (i<0) i = jkmap.length-2;
			else if (i>=jkmap.length) i = 0;
			currow = jkmap[i];
			currowi = jkmap[i+1];
			cursor = currow[currowi+currowo];
		} else return;
		e.preventDefault();
	}
	function onmousemove(e) {
		dom.style(infobox, {
			left: px.mouse.x + "px",
			top: px.mouse.y + "px",
		});
	}
	var cmds = {
		endturn: function(data) {
			(data.spectate == 1 ? game.player1 : game.player2).endturn(data.bits);
			if (data.spectate) foeplays.removeChildren();
		},
		cast: function(data) {
			var bits = data.spectate == 1 ? data.bits^4104 : data.bits, c = game.bitsToTgt(bits & 511), t = game.bitsToTgt((bits >> 9) & 511);
			console.log("cast", c.toString(), (t || "-").toString(), bits);
			var sprite = new PIXI.Sprite(gfx.nopic);
			sprite.position.set((foeplays.children.length & 7) * 99, (foeplays.children.length >> 3) * 19);
			if (c.type == etg.Spell){
				sprite.card = c.card;
			}
			else{
				sprite.card = {
					element: c.card.element,
					costele: c.castele,
					cost: c.cast,
					name: c.active.cast.name[0],
					upped: c.card.upped,
					shiny: c.card.shiny,
				};
			}
			foeplays.addChild(sprite);
			c.useactive(t);
		},
		foeleft: function(data){
			if (!game.ai) game.setWinner(data.spectate == 1 ? game.player2 : game.player1);
		},
		mulligan: function(data){
			if (data.draw === true) {
				game.progressMulligan();
			} else {
				var pl = data.spectate == 1 ? game.player1 : game.player2;
				pl.drawhand(pl.hand.length - 1);
			}
		},
	};
	if (!spectate){
		document.addEventListener("mousemove", onmousemove);
		document.addEventListener("keypress", onkeydown);
	}
	function gameStep(){
		if (game.turn == game.player2 && game.ai) {
			if (game.phase == etg.PlayPhase){
				if (!aiCommand){
					Effect.disable = true;
					aiState = require("../ai/search")(game, aiState);
					Effect.disable = false;
					if (aiState.length <= 2){
						aiCommand = true;
					}
				}
				var now;
				if (aiCommand && (now = Date.now()) > aiDelay){
					cmds[aiState[0]]({bits: aiState[1]});
					aiState = undefined;
					aiCommand = false;
					aiDelay = now + (game.turn == game.player1 ? 2000 : 200);
				}
			}else if (game.phase <= etg.MulliganPhase2){
				cmds.mulligan({draw: require("../ai/mulligan")(game.player2)});
			}
		}
		var cardartcode, cardartx;
		floodgfx.visible = false;
		infobox.style.display = "none";
		if (!cloakgfx.visible){
			foeplays.children.forEach(function(foeplay){
				if (foeplay.card instanceof Card && px.hitTest(foeplay)) {
					cardartcode = foeplay.card.code;
				}
			});
		}
		for (var j = 0;j < 2;j++) {
			var pl = game.players(j);
			if (j == 0 || game.player1.precognition) {
				for (var i = 0;i < pl.hand.length;i++) {
					if (px.hitTest(handsprite[j][i])) {
						cardartcode = pl.hand[i].card.code;
					}
				}
			}
			for (var i = 0;i < 16;i++) {
				var pr = pl.permanents[i];
				if (pr && (j == 0 || !cloakgfx.visible || pr.status.get("cloak")) && px.hitTest(permsprite[j][i])) {
					cardartcode = pr.card.code;
					cardartx = permsprite[j][i].position.x;
					setInfo(pr);
				}
			}
			if (j == 0 || !cloakgfx.visible) {
				for (var i = 0;i < 23;i++) {
					var cr = pl.creatures[i];
					if (cr && px.hitTest(creasprite[j][i])) {
						cardartcode = cr.card.code;
						cardartx = creasprite[j][i].position.x;
						setInfo(cr);
					}
				}
				if (pl.weapon && px.hitTest(weapsprite[j])) {
					cardartcode = pl.weapon.card.code;
					cardartx = weapsprite[j].position.x;
					setInfo(pl.weapon);
				}
				if (pl.shield && px.hitTest(shiesprite[j])) {
					cardartcode = pl.shield.card.code;
					cardartx = shiesprite[j].position.x;
					setInfo(pl.shield);
				}
			}
		}
		if (cardartcode) {
			cardart.texture = gfx.getArt(cardartcode);
			cardart.visible = true;
			cardart.position.set(cardartx || 654, px.mouse.y > 300 ? 44 : 300);
			if (px.mouse.y < 300) marksprite[0].style.display = cardartx >= 670 && cardartx <= 760 ? "none" : "";
			else marksprite[1].style.display = cardartx >= 140 && cardartx <= 230 ? "none" : "";
		} else {
			cardart.visible = false;
			for(var j=0; j<2; j++){
				marksprite[j].style.display = "";
			}
		}
		if (game.phase != etg.EndPhase) {
			turntell.text = discarding ? "Discard" :
				game.targeting ? game.targeting.text :
				(game.turn == game.player1 ? "Your Turn" : "Their Turn") + (game.phase >= 2 ? "" : " " + (game.first == game.player1 ? ", First": ", Second"));
			if (game.turn == game.player1){
				endturn.text = discarding ? "" : game.phase == etg.PlayPhase ? "End Turn" : "Accept Hand";
				cancel.text = game.phase != etg.PlayPhase ? "Mulligan" : game.targeting || discarding || resigning ? "Cancel" : "";
			}else cancel.text = endturn.text = "";
		}else{
			turntell.text = (game.turn == game.player1 ? "Your" : "Their") + " Turn " + (game.winner == game.player1?", Won":", Lost");
			endturn.text = "Continue";
			cancel.text = "";
		}
		foeplays.children.forEach(function(foeplay){
			foeplay.texture = foeplay.card instanceof Card ? gfx.getCardImage(foeplay.card.code) : gfx.getAbilityImage(foeplay.card);
		});
		foeplays.visible = !(cloakgfx.visible = game.player2.isCloaked());
		fgfx.clear();
		fgfx.beginFill(0, 0);
		fgfx.lineStyle(2, 0xffffff);
		for (var j = 0;j < 2;j++) {
			var pl = game.players(j);
			for (var i = 0;i < 23;i++) {
				drawBorder(pl.creatures[i], creasprite[j][i]);
			}
			for (var i = 0;i < 16;i++) {
				drawBorder(pl.permanents[i], permsprite[j][i]);
			}
			drawBorder(pl.weapon, weapsprite[j]);
			drawBorder(pl.shield, shiesprite[j]);
		}
		if (game.targeting) {
			fgfx.lineStyle(2, 0xff0000);
			for (var j = 0;j < 2;j++) {
				if (game.targeting.filter(game.players(j))) {
					var spr = playerOverlay[j];
					fgfx.drawRect(spr.position.x - spr.width / 2, spr.position.y - spr.height / 2, spr.width, spr.height);
				}
				for (var i = 0;i < game.players(j).hand.length;i++) {
					if (game.targeting.filter(game.players(j).hand[i])) {
						var spr = handsprite[j][i];
						fgfx.drawRect(spr.position.x, spr.position.y, spr.width, spr.height);
					}
				}
			}
		}
		fgfx.lineStyle(0, 0, 0);
		for (var j = 0;j < 2;j++) {
			var pl = game.players(j);
			sacrificeOverlay[j].visible = pl.sosa;
			sabbathOverlay[j].style.display = pl.flatline ? "" : "none";
			handOverlay[j].texture = (pl.usedactive ? gfx.silence :
				pl.sanctuary ? gfx.sanctuary :
				pl.nova >= 3 ? gfx.singularity : gfx.nopic);
			var i = 0;
			for (;i < pl.hand.length;i++) {
				var isfront = j == 0 || game.player1.precognition,
					card = pl.hand[i].card,
					hspr = handsprite[j][i];
				hspr.texture = isfront ? gfx.getHandImage(card.code) : gfx.cback;
				if (isfront){
					hspr.tint = pl.canspend(card.costele, card.cost) ? 0xffffff : 0x555555;
					hspr.children[0].texture = card.cost ? gfx.getTextImage(card.cost + ":" + card.costele, 11, card.upped ? "#000" : "#fff", ui.maybeLightenStr(card)) : gfx.nopic;
					hspr.children[1].texture = gfx.Text(card.name, 11, card.upped && handsprite[j][i].tint == 0xffffff ? "#000" : "#fff");
				} else {
					hspr.tint = 0xffffff;
					hspr.children[0].texture = hspr.children[1].texture = gfx.nopic;
				}
				hspr.visible = true;
			}
			for(;i<8; i++) {
				handsprite[j][i].visible = false;
			}
			for (var i = 0;i < 23;i++) {
				var cr = pl.creatures[i];
				if (cr && !(j == 1 && cloakgfx.visible)) {
					creasprite[j][i].texture = gfx.getCreatureImage(cr.card.code);
					creasprite[j][i].visible = true;
					var child = creasprite[j][i].children[1];
					var charges = cr.status.get("charges");
					child.texture = gfx.Text(cr.trueatk() + " | " + cr.truehp() + (charges ? " x" + charges : ""), 11, cr.card.upped ? "#000" : "#fff", ui.maybeLightenStr(cr.card));
					var child2 = creasprite[j][i].children[2];
					child2.texture = gfx.getTextImage(cr.activetext(), 11, cr.card.upped ? "#000" : "#fff");
					drawStatus(cr, creasprite[j][i]);
				} else creasprite[j][i].visible = false;
			}
			for (var i = 0;i < 16;i++) {
				var pr = pl.permanents[i];
				if (pr && pr.status.get("flooding")) floodgfx.visible = true;
				if (pr && !(j == 1 && cloakgfx.visible && !pr.status.get("cloak"))) {
					permsprite[j][i].texture = gfx.getPermanentImage(pr.card.code);
					permsprite[j][i].visible = true;
					var child = permsprite[j][i].children[1], child2 = permsprite[j][i].children[2];
					if (pr.card.type == etg.Pillar) {
						child.texture = gfx.getTextImage("1:" + (pr.status.get("pendstate") ? pr.owner.mark : pr.card.element) + " x" + pr.status.get("charges"), 11, pr.card.upped ? "#000" : "#fff", ui.maybeLightenStr(pr.card));
						child2.texture = gfx.nopic;
					}else{
						if (pr.active.auto && pr.active.auto == Skills.locket) {
							child.texture = gfx.getTextImage("1:" + (pr.status.get("mode") || pr.owner.mark), 11, pr.card.upped ? "#000" : "#fff", ui.maybeLightenStr(pr.card));
						}
						else{
							var charges = pr.status.get("charges");
							child.texture = gfx.Text((charges || "").toString(), 11, pr.card.upped ? "#000" : "#fff", ui.maybeLightenStr(pr.card));
						}
						child2.texture = gfx.getTextImage(pr.activetext(), 11, pr.card.upped ? "#000" : "#fff");
					}
					drawStatus(pr, permsprite[j][i]);
				} else permsprite[j][i].visible = false;
			}
			var wp = pl.weapon;
			if (wp && !(j == 1 && cloakgfx.visible)) {
				weapsprite[j].visible = true;
				var charges = wp.status.get("charges")
				var child = weapsprite[j].children[1];
				child.texture = gfx.Text(wp.trueatk() + (charges ? " x" + charges : ""), 12, wp.card.upped ? "#000" : "#fff", ui.maybeLightenStr(wp.card));
				child.visible = true;
				var child = weapsprite[j].children[2];
				child.texture = gfx.getTextImage(wp.activetext(), 12, wp.card.upped ? "#000" : "#fff");
				child.visible = true;
				weapsprite[j].texture = gfx.getWeaponShieldImage(wp.card.code);
				drawStatus(wp, weapsprite[j]);
			} else weapsprite[j].visible = false;
			var sh = pl.shield;
			if (sh && !(j == 1 && cloakgfx.visible)) {
				shiesprite[j].visible = true;
				var charges = sh.status.get("charges")
				var child = shiesprite[j].children[1];
				child.texture = gfx.Text(charges ? "x" + charges : sh.truedr().toString(), 12, sh.card.upped ? "#000" : "#fff", ui.maybeLightenStr(sh.card));
				child.visible = true;
				var child = shiesprite[j].children[2];
				child.texture = gfx.getTextImage(sh.activetext(), 12, sh.card.upped ? "#000" : "#fff");
				child.visible = true;
				shiesprite[j].texture = gfx.getWeaponShieldImage(sh.card.code);
				drawStatus(sh, shiesprite[j]);
			} else shiesprite[j].visible = false;
			marksprite[j].className = "ico e"+pl.mark;
			marksprite[j].textContent = pl.markpower != 1 ? pl.markpower : "";
			for (var i = 1;i < 13;i++) {
				quantatext[j][i-1].text = pl.quanta[i] || "";
			}
			fgfx.beginFill(0);
			fgfx.drawRect(playerOverlay[j].x - 41, playerOverlay[j].y - 25, 82, 16);
			if (pl.hp > 0){
				fgfx.beginFill(ui.elecols[etg.Life]);
				fgfx.drawRect(playerOverlay[j].x - 40, playerOverlay[j].y - 24, 80 * pl.hp / pl.maxhp, 14);
				if (!cloakgfx.visible && game.expectedDamage[j]) {
					fgfx.beginFill(ui.elecols[game.expectedDamage[j] >= pl.hp ? etg.Fire : game.expectedDamage[j] > 0 ? etg.Time : etg.Water]);
					fgfx.drawRect(playerOverlay[j].x - 40 + 80 * pl.hp / pl.maxhp, playerOverlay[j].y - 24, -80 * Math.min(game.expectedDamage[j], pl.hp) / pl.maxhp, 14);
				}
			}
			if (px.hitTest(playerOverlay[j])){
				setInfo(pl);
			}else{
				var poison = pl.status.get("poison"), poisoninfo = (poison > 0 ? poison + " 1:2" : poison < 0 ? -poison + " 1:7" : "") + (pl.status.get("neuro") ? " 1:10" : "");
				hptext[j].text = pl.hp + "/" + pl.maxhp + "\n" + pl.deck.length + "cards" + (!cloakgfx.visible && game.expectedDamage[j] ? "\nDmg: " + game.expectedDamage[j] : "") + (poisoninfo ? "\n" + poisoninfo : "");
			}
		}
		if (cursor) {
			fgfx.lineStyle(1, 0x336699);
			fgfx.beginFill(0, 0);
			if (!currow || currow == handsprite[0] || currow == handsprite[1]) {
				fgfx.drawRect(cursor.position.x, cursor.position.y, cursor.width, cursor.height);
			}else drawTgting(cursor);
		}
		Effect.next(cloakgfx.visible);
	}
	gameStep();
	var gameInterval = setInterval(gameStep, 30);
	px.view({view:gameui, dom:div, endnext:function() {
		document.removeEventListener("keypress", onkeydown);
		document.removeEventListener("mousemove", onmousemove);
		clearInterval(gameInterval);
	}, cmds:cmds});
}
function deckPower(deck, amount) {
	if (amount > 1){
		var res = deck.slice();
		for (var i = 1;i < amount;i++) {
			Array.prototype.push.apply(res, deck);
		}
		return res;
	}else return deck;
}
module.exports = function(data, ai, spectate) {
	var game = new Game(data.seed, data.flip);
	game.addData(data);
	game.player1.maxhp = game.player1.hp;
	game.player2.maxhp = game.player2.hp;
	var deckpower = [data.p1deckpower, data.p2deckpower];
	var decks = [data.urdeck, data.deck];
	for (var j = 0;j < 2;j++) {
		var pl = game.players(j);
		etgutil.iterdeck(decks[j], function(code){
			var idx;
			if (code in Cards.Codes) {
				pl.deck.push(Cards.Codes[code]);
			} else if (~(idx = etgutil.fromTrueMark(code))) {
				pl.mark = idx;
			}
		});
		if (deckpower[j]) {
			pl.deck = deckPower(pl.deck, deckpower[j]);
			pl.deckpower = deckpower[j];
		}
		else if (pl.drawpower > 1){
			pl.deck = deckPower(pl.deck, 2);
			pl.deckpower = 2;
		}
	}
	var foeDeck = game.player2.deck.slice();
	game.turn.drawhand(7);
	game.turn.foe.drawhand(7);
	if (data.foename) game.foename = data.foename;
	if (ai) game.ai = true;
	startMatch(game, foeDeck, spectate);
	return game;
}