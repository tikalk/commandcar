#!/usr/bin/env node
 
/**
 * Module dependencies.
 */
 
var program = require('commander');
var util = require('util');
var _ = require('underscore');


var database = [
		{
			api: 'facebook',
			commands: [{
				 command: 'get',
				 options: [
				           {
				        	   short: 'u',
				        	   long: 'uid',
				        	   def: 'user id',
				        	   desc: 'facebook user id'
				        		  
				           }
				 ]
			 }]
		},
		{
			api: 'dropbox',
			commands: [{
				 command: 'get',
				 options: [
				           {
				        	   short: 'u',
				        	   long: 'uid',
				        	   def: 'user id',
				        	   desc: 'dropbox user id'
				        		  
				           }
				 ]
			}]
		}
];

_.each(database,function(api){
	console.log('processing commands for ' + api.api);
	
	_.each(api.commands,function(command){
		console.log('adding command: ' + api.api + '_' + command.command);	
		var theCommand = program.command(api.api + '_' + command.command);
		_.each(command.options,function(option){
			console.log('adding option: ' + '-' + option.short + ', --' + option.long + ' [' + option.def + ']');
			theCommand.option('-' + option.short + ', --' + option.long + ' [' + option.def + ']',option.desc);
		});
		theCommand.action(function(options){
			console.log('should call ' + api.api + '_' + command.command + ' with uid ')
		})
	})
	
})


//program
//	.command('facebook_get')
//	.option('-u, --uid [user id]','facebook user id')
//	.action(function(options){
//		console.log('should call facebook with uid ' + options.uid)
//	});
//
//program
//	.command('dropbox_get')
//	.option('-u, --uid [user id]','dropbox user id')
//	.action(function(options){
//		console.log('should call dropbox with uid ' + options.uid)
//	});

//console.log('prigram: ' + util.inspect(program));

program.parse(process.argv);