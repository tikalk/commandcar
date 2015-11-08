#!/usr/bin/env node
 
/**
 * Module dependencies.
 */
 
var program = require('commander');
var util = require('util');

program
	.command('facebook')
	.option('-u, --uid [user id]','facebook user id')
	.action(function(options){
		console.log('should call facebook with uid ' + options.uid)
	});

program
	.command('dropbox')
	.option('-u, --uid [user id]','dropbox user id')
	.action(function(options){
		console.log('should call dropbox with uid ' + options.uid)
	});

program.parse(process.argv);