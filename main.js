#!/usr/bin/env node
 
/**
 * Module dependencies.
 */
 
var program = require('commander');
var util = require('util');
var _ = require('underscore');
var us = require('underscore.string');
var request = require('request');
var fs = require('fs');
var jsonic = require('jsonic');
var Rsync = require('rsync');
var os = require('os');
var npm = require('npm');
/*
 * ENV
 */
//var SCOPE = '@commandcar';
var SCOPE = '@shaharsol';

var APIS_DIR = __dirname + '/node_modules/' + SCOPE;
console.log('api dir: ' + APIS_DIR);
/*
 * make sure we have a USE dir
 */

var USE_DIR = os.tmpdir() + 'use';
try{
	fs.mkdirSync(USE_DIR);
}catch(e){
	// ignore. it means it already exists
}

/*
 * load database
 */

var database = loadDatabaseFromCache();
if(!database){
//	console.log('couldnt find cache, building database');
	database = buildDatabaseFromFileSystem();
}



//var database = [
//		{
//			name: 'facebook',
//			protocol: 'https',
//			host: 'graph.facebook.com',
//			commands: [{
//				 name: 'get',
//				 path_template: '/{uid}?fields=name&access_token={access_token}',
//				 ret: 'name',
//				 options: [
//				           {
//				        	   short: 'u',
//				        	   long: 'uid',
//				        	   def: 'user id',
//				        	   desc: 'facebook user id',
//				           },
//				           {
//				        	   short: 'a',
//				        	   long: 'access_token',
//				        	   def: 'access token',
//				        	   desc: 'access_token',
//				           },
//				           
//				 ]
//			 }]
//		},
//		{
//			name: 'dropbox',
//			protocol: 'https',
//			host: 'api.dropbox.com',
//			commands: [{
//				 name: 'quota_info',
//				 path_template: '/1/account/info?access_token={access_token}',
//				 ret: 'quota_info',
//				 options: [
//				           {
//				        	   short: 'a',
//				        	   long: 'access_token',
//				        	   def: 'access token',
//				        	   desc: 'access_token',
//				           }
//				 ]
//			}]
//		}
//];

_.each(database,function(api){
//	console.log('processing commands for ' + api.name);
	
	_.each(api.commands,function(command){
//		console.log('adding command: ' + api.name + '_' + command.name);	
		var theCommand = program.command(api.name + '.' + command.name);
//		var theCommand = program.command(api.name + ' <' + command.name + '>');
		_.each(command.options,function(option){
//			console.log('adding option: ' + '-' + option.short + ', --' + option.long + ' [' + option.def + ']');
			theCommand.option('-' + option.short + ', --' + option.long + ' [' + option.def + ']',option.desc);
		});
		theCommand.action(function(options){
//			console.log('should call ' + api.name + '_' + command.name + ' with uid ')
			performCommand(api.name,command.name,options,function(err,ret){
				if(err){
					console.log('error: ' + err);
				}else{
					console.log(ret);
				}
			});
		})
	})
	
})

program
	.command('load')
	.option('-l, --location [location of directory]','location of directory')
	.action(function(options){
		console.log('loading ' + options.location);
		var rsync = new Rsync()
					.flags('avz')
					.source(options.location)
					.destination(APIS_DIR);
		rsync.execute(function(error, code, cmd) {
		    if(error){
		    	console.log(code + ' : ' + error);
		    }else{
		    	buildDatabaseFromFileSystem();
		    }
		});
	});

program
	.command('install')
	.option('-a, --api [api name]','api name')
	.action(function(options){
		console.log('installing ' + "@shaharsol/" + options.api);
		npm.load(function (err) {
			if(err){
				console.log('error installing from npm: ' + err);
			}else{
				npm.commands.install(["@shaharsol/" + options.api], function (er, data) {
					buildDatabaseFromFileSystem();
				});
				npm.on("log", function (message) {
					console.log(message);
				});
				
			}
		});

	});



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

function performCommand(api,command,options,callback){
	switch(command){
	case 'use':
		use(api,options,callback);
		break;
	case 'unuse':
		unuse(api,callback);
		break;
	default:
		performRequest(api,command,options,callback);
	}
}

function use(api,options,callback){
	try{
		var currentApi = _.find(database,function(item){return item.name == api;});
		var useOptions = {};
		_.each(currentApi.use_options,function(useOption){
			useOptions[useOption.long] = options[useOption.long];
		});
		fs.writeFileSync(USE_DIR + '/' + api + '.json',JSON.stringify(useOptions));
		callback(null);
	}catch(e){
		callback(e);
	}
}

function unuse(api,callback){
	try{
		fs.unlinkSync(USE_DIR + '/' + api + '.json');
		callback(null);
	}catch(e){
		callback(e);
	}
}

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
	// TBD consider passing the entire api and command objects, and not only thier names, 
	// hence not having to find them...
	var currentApi = _.find(database,function(item){return item.name == api;});
	var currentCommand = _.find(currentApi.commands,function(item){return item.name == command;});
	
	url = currentApi.protocol + '://' + currentApi.hostname;
	path = currentCommand.path_template;
	_.each(currentCommand.options,function(option){
		path = path.replace('{' + option.long + '}',options[option.long]);
	});
	url += path;
	
//	console.log('url: ' + url);
	
	var verb = 'GET';
	if('verb' in currentCommand){
		verb = currentCommand.verb;
	}
	
	var headers = {};
	if('headers' in currentApi){
		headers = currentApi.headers;
	}
	if('headers' in currentCommand){
		_.each(currentCommand.headers,function(value,key){
			if(us(value).startsWith('{') && us(value).endsWith('}')){
				var optionName = value.substr(1,value.length - 2);
				value = options[optionName];
			}
			headers[key] = value;
		});
	}
	
	var body = false;
	if('body' in currentCommand){
		var optionName = currentCommand.body.substr(1,currentCommand.body.length - 2);
		body = options[optionName]
		
	}
	
	
	var form = {};
	
	console.log('is form: ' + (form? 'y':'n'))
	if('form' in currentCommand){
		_.each(currentCommand.form,function(value,key){
			if(us(value).startsWith('{') && us(value).endsWith('}')){
				var optionName = value.substr(1,value.length - 2);
				value = options[optionName];
			}
			form[key] = value;
		});
	}
	console.log('form: ' + util.inspect(form));

	
	if('oauth_headers_access_token_option_name' in currentApi){
		headers['Authorization'] = 'Bearer ' + options[currentApi.oauth_headers_access_token_option_name];
	}
	
	
	
	var requestOptions = {
		url: url,
		method: verb,
		headers: headers,
	}
	
	if(body){
		requestOptions['body'] = body;
	}
	if(!_.isEmpty(form)){
		requestOptions['form'] = form;
	}
	
	console.log('requestOptions: ' + util.inspect(requestOptions));
	
	request(requestOptions,function(error,response,body){
		if(error){
			callback(error);
		}else if(response.statusCode < 200 || response.statusCode > 299){
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
//	var files = fs.readdirSync(__dirname + '/apis/');
	try{
		if(fs.lstatSync(APIS_DIR).isDirectory()){
			var files = fs.readdirSync(APIS_DIR);
			_.each(files,function(file){
//				console.log('file: ' + util.inspect(file));
				if(fs.lstatSync(APIS_DIR + '/' + file).isDirectory()){
//					console.log('file: ' + __dirname + '/apis/' + file + ' is a directory');
					api = jsonic(fs.readFileSync(APIS_DIR + '/' + file + '/api.json', 'utf8'));
					api['name'] = file;
					api['commands'] = [];
					var commands = fs.readdirSync(APIS_DIR + '/' + file + '/commands');
					_.each(commands,function(commandFile){
						var command = jsonic(fs.readFileSync(APIS_DIR + '/' + file + '/commands/' + commandFile, 'utf8'));
						command['name'] = commandFile.split('.')[0];
						api.commands.push(command);
					});
					if('use_options' in api){
						var useCommand = {
							name: 'use',
							options: api.use_options,
						}
						var unuseCommand = {
							name: 'unuse'
						}
						api.commands.push(useCommand);
						api.commands.push(unuseCommand);
					}
					database.push(api);
				}
			});
		}	
	}catch(e){
		
	}
	
//	console.log('database: ' + util.inspect(database,{depth:8}));
	fs.writeFileSync(os.tmpdir() + 'cache.json',JSON.stringify(database));
	return database;
}

function loadDatabaseFromCache(){
	var cache = null;
	try{
		console.log('reading cache from: ' + os.tmpdir() + 'cache.json');
		cache = fs.readFileSync(os.tmpdir() + 'cache.json', 'utf-8');
		cache = jsonic(cache);
	}catch(e){
		
	}
	return cache;
}