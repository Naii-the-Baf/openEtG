#!/bin/env node
"use strict"
var Us = require("../srv/Us");
Us.load(process.argv[2], function(user){
	console.log(user);
	user.auth = user.salt = "";
	Us.stop();
});
