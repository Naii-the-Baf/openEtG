"use strict";
const ui = require("./ui"),
	gfx = require("./gfx"),
	Thing = require("./Thing");
function maybeTgtPos(pos){
	return pos instanceof Thing ? ui.tgtToPos(pos) : pos;
}
function Death(pos){
	PIXI.Graphics.call(this);
	this.step = 0;
	this.position = maybeTgtPos(pos);
}
function Text(text, pos){
	PIXI.Sprite.call(this, gfx.getTextImage(text, 16, "#fff"));
	this.step = 0;
	this.position = maybeTgtPos(pos);
	for(var i=0; i<anims.children.length; i++){
		var a = anims.children[i];
		if (a.position.x == this.position.x && a.position.y == this.position.y){
			this.position.y += 16;
			i=-1;
		}
	}
	this.anchor.x = .5;
}
function SpriteFade(texture, pos, anchor) {
	PIXI.Sprite.call(this, texture);
	if (!anchor) this.anchor.set(0.5, 0.5);
	else this.anchor.set(anchor.x, anchor.y);
	this.step = 0;
	this.position = maybeTgtPos(pos) || new PIXI.math.Point(450, 300);
}
function SpriteFadeText(targs, pos, anchor){
	return new SpriteFade(gfx.Text.call(null, targs), pos, anchor);
}
function SpriteFadeHandImage(card, pos, anchor){
	return new SpriteFade(gfx.getHandImage(card), pos, anchor);
}
function nop(){}
function make(cons){
	return typeof PIXI === "undefined" ? nop : function(){
		if (exports.disable || !anims) return;
		var effect = Object.create(cons.prototype);
		var effectOverride = cons.apply(effect, arguments);
		anims.addChild(effectOverride || effect);
	}
}
if (typeof PIXI === "undefined"){
	exports.disable = true;
	exports.register = exports.next = nop;
}else{
	var anims;
	exports.disable = false;
	exports.register = function(doc){
		anims = doc;
	}
	exports.next = function(p2cloaked){
		if (anims){
			for (var i = anims.children.length - 1;i >= 0;i--) {
				var child = anims.children[i];
				if ((p2cloaked && new PIXI.math.Rectangle(130, 20, 660, 280).contains(child.position.x, child.position.y)) || child.next()){
					anims.removeChild(child);
				}
			}
		}
	}
	Death.prototype = Object.create(PIXI.Graphics.prototype);
	Text.prototype = Object.create(PIXI.Sprite.prototype);
	SpriteFade.prototype = Object.create(PIXI.Sprite.prototype);
	Death.prototype.next = function(){
		if (++this.step==15){
			return true;
		}
		this.clear();
		this.beginFill(0, 1-this.step/15);
		this.drawRect(-30, -30, 60, 60);
	}
	Text.prototype.next = function(){
		if (++this.step==36){
			return true;
		}
		this.position.y -= 2;
		this.alpha = 1-Math.sqrt(this.step)/6;
	}
	SpriteFade.prototype.next = function() {
		if (++this.step == 128) {
			return true;
		}
		if (this.step > 64) this.alpha = 2-this.step/64;
	}
}
exports.mkDeath = make(Death);
exports.mkText = make(Text);
exports.mkSpriteFade = make(SpriteFade);
exports.mkSpriteFadeText = make(SpriteFadeText);
exports.mkSpriteFadeHandImage = make(SpriteFadeHandImage);
