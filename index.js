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
var url = require('url');
var path = require('path');
var yaml = require('yamljs');

/*
 * ENV
 */
var SCOPE = '@shaharsol';
//var SCOPE = '@commandcar';

var APIS_DIR = path.join(__dirname,'node_modules',SCOPE);
//console.log('api dir: ' + APIS_DIR);
/*
 * make sure we have a USE dir
 */

var USE_DIR = path.join(os.tmpdir(),'commandcar-use');
//console.log('use dir: ' + USE_DIR);
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
	console.log('couldnt find cache, building database');
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

_.each(database,function(apiContent,api){
	console.log('processing commands for ' + api);
	var commandName;
	_.each(apiContent.paths,function(pathContent,path){
		var parts = path.split('/');
		var includedParts = [];
		_.each(parts,function(part){
			if(part && !us(part).startsWith('{') && !us(part).endsWith('}')){
				includedParts.push(part);
			}
		});
		var rejoinedParts = includedParts.join('_').replace('-','_');
		_.each(pathContent,function(verbContent,verb){
			commandName = api + '.' + verb + '_' +  rejoinedParts;
			console.log('found command: ' + commandName);
			var theCommand = program.command(commandName);
			_.each(verbContent.parameters,function(parameter){
				theCommand.option('--' + parameter.name,parameter.description);
			});
			// TBD
			/*
			 * 
			 * also, add use and unuse with this particular key!
			 */
			if('security' in verbContent){
				var apiKey = _.find(verbContent.security,function(item){
					return 'api_key' in item;
				})
				if(apiKey){
					theCommand.option('--' + apiContent.securityDefinitions.api_key.name,apiContent.securityDefinitions.api_key.name);
				}
			}
			theCommand.action(function(options){
	//			console.log('should call ' + api.name + '_' + command.name + ' with uid ')
//				performCommand(api,commandName,options,function(err,ret){
				performCommand(api,path,verb,options,function(err,ret){
					if(err){
						console.log('error: ' + err);
					}else{
						console.log(ret);
					}
				});
			})
			
		})
	});
	
	
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
		    	database = buildDatabaseFromFileSystem();
		    }
		});
	});

program
	.command('install')
	.option('-a, --api [api name]','api name')
	.action(function(options){
		console.log('installing ' + SCOPE + "/" + options.api);
		npm.load(function (err) {
			if(err){
				console.log('error installing from npm: ' + err);
			}else{
				npm.commands.install(__dirname,[SCOPE + "/" + options.api], function (er, data) {
					if(er){
						console.log('npm error: ' + er);
					}
					database = buildDatabaseFromFileSystem();
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

function performCommand(api,path,verb,options,callback){
	switch(command){
	case 'use':
		use(api,options,callback);
		break;
	case 'unuse':
		unuse(api,callback);
		break;
	default:
		performRequest(api,path,verb,options,callback);
	}
}

function use(api,options,callback){
	try{
		var currentApi = _.find(database,function(item){return item.name == api;});
		var useOptions = {};
		_.each(currentApi.use_options,function(useOption){
			useOptions[useOption.long] = options[useOption.long];
		});
		fs.writeFileSync(path.join(USE_DIR,api + '.json'),JSON.stringify(useOptions));
		callback(null);
	}catch(e){
		callback(e);
	}
}

function unuse(api,callback){
	try{
		fs.unlinkSync(path.join(USE_DIR,api + '.json'));
		callback(null);
	}catch(e){
		callback(e);
	}
}

function performRequest(api,path,verb,options,callback){
	
	// is the host known? or is passed as -h --host?
	// facebook host is known: graph.facebook.com
	// gradle host is always param: 192.8.9.10
	
	// some api take authorization bearer as headers
	// some allow auth to pass as params
	// some require basic auth
	var theUrl;
	var form;
	var pathStr = '';
	
	// TBD add port (i.e. default 80 but surely not always)
	// TBD consider passing the entire api and command objects, and not only thier names, 
	// hence not having to find them...
	
	try{
		useOptions = jsonic(fs.readFileSync(path.join(USE_DIR,api + '.json'), 'utf8'));
		_.each(useOptions,function(value,key){
			options[key] = value;
		})
	}catch(e){
		
	}
	
//	theUrl = currentApi.protocol + '://' + currentApi.hostname;
	pathStr = currentCommand.path_template;
	_.each(currentCommand.options,function(option){
		pathStr = pathStr.replace('{' + option.long + '}',(typeof options[option.long] == 'undefined' ? '' : options[option.long]));
	});
//	theUrl += path;
	
	
	var pathParts = pathStr.split('?');
	
	var urlObj = {
		protocol: currentApi.protocol,
		hostname: currentApi.hostname,
		pathname: pathParts[0],
		search: pathParts[1]
	}
	if('port' in currentApi){
		urlObj['port'] = currentApi.port;
	}
	// TBD: dont forget basic auth!
	
	theUrl = url.format(urlObj);
//	console.log('url: ' + theUrl);
	
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
	
//	console.log('is form: ' + (form? 'y':'n'))
	if('form' in currentCommand){
		_.each(currentCommand.form,function(value,key){
			if(us(value).startsWith('{') && us(value).endsWith('}')){
				var optionName = value.substr(1,value.length - 2);
				value = options[optionName];
			}
			form[key] = value;
		});
	}
//	console.log('form: ' + util.inspect(form));

	
	if('oauth_headers_access_token_option_name' in currentApi){
		headers['Authorization'] = 'Bearer ' + options[currentApi.oauth_headers_access_token_option_name];
	}
	
	
	
	var requestOptions = {
		url: theUrl,
		method: verb,
		headers: headers,
	}
	
	if(body){
		requestOptions['body'] = body;
	}
	if(!_.isEmpty(form)){
		requestOptions['form'] = form;
	}
	
//	console.log('requestOptions: ' + util.inspect(requestOptions));
	
	request(requestOptions,function(error,response,body){
		if(error){
			callback(error);
		}else if(response.statusCode < 200 || response.statusCode > 299){
//			console.log('status code: ' + response.statusCode);
			callback(body);
		}else{
//			console.log('body is: ' + util.inspect(body));
			var ret;
			if('ret' in currentCommand){
				var data = JSON.parse(body);
				ret = data[currentCommand['ret']];
			}else{
				ret = body;
			}
			var data = JSON.parse(body);
			callback(null,ret);
		}
	})
	
}

// TBD: need to work with the path module to make it compatible with windows???
function buildDatabaseFromFileSystem(){
	var database = {};
	var api;
//	var files = fs.readdirSync(__dirname + '/apis/');
	try{
		if(fs.lstatSync(APIS_DIR).isDirectory()){
			var files = fs.readdirSync(APIS_DIR);
			_.each(files,function(file){
				
				// now i expect file to be a yaml file
				console.log('found file: ' + file);
				console.log('extname is: ' + path.extname(file));
				
				if(path.extname(file) == '.yaml'){
					console.log('found a yaml!');
					var apiName = path.basename(file,'.yaml');
					database[apiName] = yaml.load(path.join(APIS_DIR,file));
				}
				
				
			});
		}else{
			console.log('APIS_DIR doesnt seem to be a directory...');
		}	
	}catch(e){
		console.log('error building db: ' + e);
	}
	
//	console.log('database: ' + util.inspect(database,{depth:8}));
	fs.writeFileSync(path.join(os.tmpdir(),'commandcar-cache.json'),JSON.stringify(database));
	return database;
}

function loadDatabaseFromCache(){
	var cache = null;
	try{
		console.log('reading cache from: ' + path.join(os.tmpdir(),'commandcar-cache.json'));
		cache = fs.readFileSync(path.join(os.tmpdir(),'commandcar-cache.json'), 'utf-8');
		cache = jsonic(cache);
	}catch(e){
		
	}
	return cache;
}