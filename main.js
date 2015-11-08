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
			protocol: 'https',
			host: 'graph.facebook.com',
			commands: [{
				 command: 'get',
				 path_template: '/{uid}',
				 ret: 'name',
				 options: [
				           {
				        	   short: 'u',
				        	   long: 'uid',
				        	   def: 'user id',
				        	   desc: 'facebook user id',
				        	   api_param: ''
				        		  
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
			performRequest(api.api,command.command,options,function(err,ret){
				
			});
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



function performRequest(api,command,options,callback){
	// is the host known? or is passed as -h --host?
	// facebook host is known: graph.facebook.com
	// gradle host is always param: 192.8.9.10
	
	// some api take authorization bearer as headers
	// some allow auth to pass as params
	// some require basic auth
	var url;
	var form;
	var path = '';
	
	// TBD add port (i.e. default 80 but surely not always)
	var currentApi = _.find(database,function(item){return item.api == api;});
	var currentCommand = _.find(currentApi.commands,function(item){return item.command == command;});
	
	url = currentApi.protocol + '://' + currentApi.host;
	path = currentCommand.path_template;
	_.each(currentCommand.options,function(option){
		path = path.replace('{' + option.long + '}',options['long']);
	});
	url += path;
	
	console.log('url: ' + url);
	
//	request.post(url,function(error,response,body){
//		if(error){
//			callback(error);
//		}else if(response.statusCode != 200){
//			callback(body);
//		}else{
//			callback(null,body);
//		}
//	})
	
}