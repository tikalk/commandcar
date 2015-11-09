#!/usr/bin/env node
 
/**
 * Module dependencies.
 */
 
var program = require('commander');
var util = require('util');
var _ = require('underscore');
var request = require('request');
var fs = require('fs');
var jsonic = require('jsonic');
buildDatabaseFromFileSystem();

var database = [
		{
			api: 'facebook',
			protocol: 'https',
			host: 'graph.facebook.com',
			commands: [{
				 command: 'get',
				 path_template: '/{uid}?fields=name&access_token={access_token}',
				 ret: 'name',
				 options: [
				           {
				        	   short: 'u',
				        	   long: 'uid',
				        	   def: 'user id',
				        	   desc: 'facebook user id',
				           },
				           {
				        	   short: 'a',
				        	   long: 'access_token',
				        	   def: 'access token',
				        	   desc: 'access_token',
				           },
				           
				 ]
			 }]
		},
		{
			api: 'dropbox',
			protocol: 'https',
			host: 'api.dropbox.com',
			commands: [{
				 command: 'quota_info',
				 path_template: '/1/account/info?access_token={access_token}',
				 ret: 'quota_info',
				 options: [
				           {
				        	   short: 'a',
				        	   long: 'access_token',
				        	   def: 'access token',
				        	   desc: 'access_token',
				           }
				 ]
			}]
		}
];

_.each(database,function(api){
//	console.log('processing commands for ' + api.api);
	
	_.each(api.commands,function(command){
//		console.log('adding command: ' + api.api + '_' + command.command);	
		var theCommand = program.command(api.api + '_' + command.command);
		_.each(command.options,function(option){
//			console.log('adding option: ' + '-' + option.short + ', --' + option.long + ' [' + option.def + ']');
			theCommand.option('-' + option.short + ', --' + option.long + ' [' + option.def + ']',option.desc);
		});
		theCommand.action(function(options){
//			console.log('should call ' + api.api + '_' + command.command + ' with uid ')
			performRequest(api.api,command.command,options,function(err,ret){
				if(err){
					console.log('error: ' + err);
				}else{
					console.log(ret);
				}
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
		path = path.replace('{' + option.long + '}',options[option.long]);
	});
	url += path;
	
//	console.log('url: ' + url);
	
	request(url,function(error,response,body){
		if(error){
			callback(error);
		}else if(response.statusCode != 200){
//			console.log('status code: ' + response.statusCode);
			callback(body);
		}else{
//			console.log('body is: ' + util.inspect(body));
			var data = JSON.parse(body);
			callback(null,data[currentCommand['ret']]);
		}
	})
	
}

// TBD: need to work with the path module to make it compatible with windows???
function buildDatabaseFromFileSystem(){
	var database = [];
	var api;
	var files = fs.readdirSync('./apis/');
	_.each(files,function(file){
//		console.log('file: ' + util.inspect(file));
		if(fs.lstatSync('./apis/' + file).isDirectory()){
//			console.log('file: ' + './apis/' + file + ' is a directory');
			api = jsonic(fs.readFileSync('./apis/' + file + '/api.json', 'utf-8'));
			api['name'] = file;
			api['commands'] = [];
			console.log('working with an api: ' + util.inspect(api));
			var commands = fs.readdirSync('./apis/' + file + '/commands');
			_.each(commands,function(commandFile){
				var command = jsonic(fs.readFileSync('./apis/' + file + '/commands/' + commandFile, 'utf-8'));
				command['name'] = commandFile.split('.').pop();
				api.commands.push(command);
			});
			console.log('finsihed with an api: ' + util.inspect(api));
			database.push(api);
		}
	});
	console.log('database: ' + util.inspect(database));
}