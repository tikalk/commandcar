#!/usr/bin/env node
 
/**
 * Module dependencies.
 */
 

/*
 * TBD TBD TBD
 * last thing before v 0.1.0 do the oauth thing with aurthorization bearer
 * decide on main.js vs index.js
 * use the api_model list.json to get versions
 * add a list or search command for api_model
 */

var program = require('commander');
var util = require('util');
var _ = require('underscore');
var us = require('underscore.string');
var request = require('request');
var fs = require('fs');
var jsonic = require('jsonic');
var os = require('os');
var npm = require('npm');
var url = require('url');
var Path = require('path');
var yaml = require('yamljs');
var Chance = require('chance');
var chance = new Chance();
var homedir = require('homedir');
/*
 * ENV
 */

//var HOME_DIR = Path.join(os.homedir(),'.commandcar');

var HOME_DIR = Path.join(homedir(),'.commandcar');
//console.log('home dir: ' + HOME_DIR);
try{
	fs.mkdirSync(HOME_DIR);
}catch(e){
//	console.log('error creating home dir: %s',e);
	// ignore. it means it already exists
}

var USE_DIR = Path.join(HOME_DIR,'use');
//console.log('use dir: ' + USE_DIR);
try{
	fs.mkdirSync(USE_DIR);
}catch(e){
	// ignore. it means it already exists
}

/*
 * load database
 */

var database = loadDatabase();

/*
 * process database into commands, options etc
 */

_.each(database,function(apiContent,api){
//	console.log('processing commands for ' + api);
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
			var shorts = [];
//			console.log('found command: ' + commandName);
			var theCommand = program.command(commandName);
			
			// always start with the api key in order to keep its short name persistent over all the api methods
			if('security' in verbContent){
				var securityParameterName;
				var securityDefinition = _.keys(verbContent.security[0])[0];
				if(apiContent.securityDefinitions[securityDefinition].type == 'apiKey'){
					securityParameterName = apiContent.securityDefinitions[securityDefinition].name;
				}else if(apiContent.securityDefinitions[securityDefinition].type == 'oauth2'){
					securityParameterName = 'access_token';
				}
				if(securityParameterName){
					var short = getShort(securityParameterName,shorts);
					shorts.push(short);
					theCommand.option('-' + short + ', --' + securityParameterName + ' <' + securityParameterName + '>',securityParameterName);
				}
				
//				var apiKey = _.find(verbContent.security,function(item){
//					return 'api_key' in item;
//				})
//				if(apiKey){
//					var short = getShort(apiContent.securityDefinitions.api_key.name,shorts);
//					shorts.push(short);
//					theCommand.option('-' + short + ', --' + apiContent.securityDefinitions.api_key.name + ' <' + apiContent.securityDefinitions.api_key.name + '>',apiContent.securityDefinitions.api_key.name);
//				}
			}
			
			// also always add a "-r --ret" option
			theCommand.option('-r, --ret [return value]','specify return value');
			shorts.push('r');
			
			_.each(verbContent.parameters,function(parameter){
				var short = getShort(parameter.name,shorts);
				shorts.push(short);
				
				var leftTag = ' [';
				var rightTag = ']';
				if(parameter.required){
					leftTag = ' <';
					rightTag = '>';
				}
				
				theCommand.option('-' + short + ', --' + parameter.name + leftTag + parameter.name + rightTag,parameter.description);
			});
			
			theCommand.action(function(options,o1,o2){
				performRequest(api,path,verb,options,function(err,ret){
					if(err){
						console.log('error: ' + err);
					}else{
						console.log(ret);
					}
				});
			})
			
		})
	});
	
	// add use and unuse commands if applicable
	if('securityDefinitions' in apiContent){
		var securityParameterName;
		var securityDefinition = _.keys(apiContent.securityDefinitions)[0];
		if(apiContent.securityDefinitions[securityDefinition].type == 'apiKey'){
			securityParameterName = apiContent.securityDefinitions[securityDefinition].name;
		}else if(apiContent.securityDefinitions[securityDefinition].type == 'oauth2'){
			securityParameterName = 'access_token';
		}
		if(securityParameterName){
			var useCommand = program.command(api + '.use');
			var short = getShort(securityParameterName,[]);
			useCommand.option('-' + short + ', --' + securityParameterName + ' <' + securityParameterName + '>',securityParameterName);
			useCommand.action(function(options){
				use(api,options);
			})
			var unuseCommand = program.command(api + '.unuse');
			unuseCommand.action(function(options){
				unuse(api,options);
			})
		}
		
	}
	
//	if(('securityDefinitions' in apiContent) && ('api_key' in apiContent.securityDefinitions)){
//		var useCommand = program.command(api + '.use');
//		var short = getShort(apiContent.securityDefinitions.api_key.name,[]);
//		useCommand.option('-' + short + ', --' + apiContent.securityDefinitions.api_key.name + ' <' + apiContent.securityDefinitions.api_key.name + '>',apiContent.securityDefinitions.api_key.name);
//		useCommand.action(function(options){
//			use(api,options);
//		})
//		var unuseCommand = program.command(api + '.unuse');
//		unuseCommand.action(function(options){
//			unuse(api,options);
//		})
//	}
	
	
})

program
	.command('uninstall')
	.option('-n, --name <name of the API>','name of the API')
	.action(function(options){
		var apiName = options.name;
		delete database[apiName];
		saveDatabase();
	});

program
	.command('install')
	.option('-n, --name <name of the API>','name of the API')
	.option('-f, --file [local yaml file]','local yaml file')
	.option('-u, --url [online yaml file]','online yaml file')
	.option('-a, --api_model [name of an api_model path]','name of an api_model path')
	.action(function(options){
//		console.log('loading ' + options.name);
		var apiName = options.name;
		
		if(options.file){
			if(Path.extname(options.file) == '.json'){
				database[apiName] = JSON.parse(fs.readFileSync(options.file, 'utf8'));
//				fs.writeFileSync(Path.join(os.tmpdir(),'commandcar-cache.json'),JSON.stringify(database));
				saveDatabase();
				console.log('installed %s',apiName);
			}else if(Path.extname(options.file) == '.yaml'){				
				database[apiName] = yaml.load(options.file);
//				fs.writeFileSync(Path.join(os.tmpdir(),'commandcar-cache.json'),JSON.stringify(database));
				saveDatabase();
				console.log('installed %s',apiName);
			}else{
				console.log('Can\'t install %s because file is neither json nor yaml',options.file);
			}
		}else{
			var url;
			if(options.api_model){
				url = 'https://apis-guru.github.io/api-models/' + options.api_model + '/swagger.yaml';
			}else{
				url = options.url;
			}
			request(url,function(error,response,body){
				if(error){
					console.log('error in installing API from url: %s',error);
				}else if(response.statusCode != '200'){
					console.log('error in installing API from url: %s',body);
				}else{
					// it's either json or yaml
					try{
						database[apiName] = JSON.parse(body);
					}catch(e){
						database[apiName] = yaml.parse(body);
					}
					
//					fs.writeFileSync(Path.join(os.tmpdir(),'commandcar-cache.json'),JSON.stringify(database));
					saveDatabase();
					console.log('installed %s',apiName);
				}
			})
		}
		
		
		
	});



program.parse(process.argv);

function use(api,options){
	try{
		
		var useOptions = {};
		
		if('securityDefinitions' in database[api]){
			var securityParameterName;
			var securityDefinition = _.keys(database[api].securityDefinitions)[0];
			if(database[api].securityDefinitions[securityDefinition].type == 'apiKey'){
				securityParameterName = database[api].securityDefinitions[securityDefinition].name;
			}else if(database[api].securityDefinitions[securityDefinition].type == 'oauth2'){
				securityParameterName = 'access_token';
			}
			if(securityParameterName){
				useOptions[securityParameterName] = options[normalizeParameterName(securityParameterName)];
				fs.writeFileSync(Path.join(USE_DIR,api + '.json'),JSON.stringify(useOptions));
				console.log('Use successful. any call on %s will now include --%s %s',api,securityParameterName,options[normalizeParameterName(securityParameterName)]);
			}
			
		}
		
//		if(('securityDefinitions' in database[api]) && ('api_key' in database[api].securityDefinitions)){
////			console.log('options name: ' + database[api].securityDefinitions.api_key.name);
////			console.log('value: ' + )
//			useOptions[database[api].securityDefinitions.api_key.name] = options[normalizeParameterName(database[api].securityDefinitions.api_key.name)];
//		}
//		fs.writeFileSync(Path.join(USE_DIR,api + '.json'),JSON.stringify(useOptions));
//		console.log('Use successful. any call on %s will now include --%s %s',api,database[api].securityDefinitions.api_key.name,options[normalizeParameterName(database[api].securityDefinitions.api_key.name)]);
		
	}catch(e){
		console.log('error in use command: %s',e);
	}
}

function unuse(api){
	try{
		fs.unlinkSync(Path.join(USE_DIR,api + '.json'));
		console.log('All use paramteres for %s are clear.',api);
	}catch(e){
		console.log('error in unuse command: %s',e);
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
	var pathStr = '';
	var headers = {};
	var form = {};
	var body;
	
	// load use options
	try{
		useOptions = jsonic(fs.readFileSync(Path.join(USE_DIR,api + '.json'), 'utf8'));
		_.each(useOptions,function(value,key){
			options[key] = value;
//			console.log('loaded ' + options[key] + ' from cache: ' + value);
		})
	}catch(e){
		console.log('error loading use options: %s',e);
	}
	
	var protocol = database[api].schemes[0];
	var host = database[api].host;

	pathStr = database[api].basePath + path
//	console.log('pathStr: ' + pathStr);

	var pathParts = pathStr.split('/');
	var newParts = [];
	_.each(pathParts,function(pathPart){
		if(us(pathPart).startsWith('{') && us(pathPart).endsWith('}')){
//			console.log('found a param');
//			console.log('param name: ' + pathPart.substr(1,pathPart.length-2));
//			console.log('cameld case: ' + normalizeParameterName(pathPart.substr(1,pathPart.length-2)));
//			console.log('param value: ' + options[normalizeParameterName(pathPart.substr(1,pathPart.length-2))]);
			pathPart = options[normalizeParameterName(pathPart.substr(1,pathPart.length-2))];
		}
		newParts.push(pathPart);
	});
	pathStr = newParts.join('/');
//	console.log('pathStr: ' + pathStr);
	
//	console.log(util.inspect(options));
	var query = {};
//	console.log('options: ' + util.inspect(options));
	_.each(database[api].paths[path][verb].parameters,function(parameter){
//		console.log('parameter name: ' + parameter.name);
//		console.log('parameter name cameled: ' + normalizeParameterName(parameter.name));
//		console.log('parameter value: ' + options[normalizeParameterName(parameter.name)]);
		
		if(parameter['in'] == 'query'){
			query[parameter.name] = options[normalizeParameterName(parameter.name)];
		}else if(parameter['in'] == 'header'){
			headers[parameter.name] = options[normalizeParameterName(parameter.name)];
		}else if(parameter['in'] == 'formData'){
			form[parameter.name] = options[normalizeParameterName(parameter.name)];
		}else if(parameter['in'] == 'body'){
			body = options[normalizeParameterName(parameter.name)];
		}
	}); 
	
	// do we have to add security params to query?
	if('security' in database[api].paths[path][verb]){
		
		
		var securityParameterName;
		var securityDefinition = _.keys(database[api].paths[path][verb].security[0])[0];
		if(database[api].securityDefinitions[securityDefinition].type == 'apiKey'){
			if(database[api].securityDefinitions[securityDefinition]['in'] == 'query'){
				query[database[api].securityDefinitions[securityDefinition].name] = options[normalizeParameterName(database[api].securityDefinitions[securityDefinition].name)]
			}else if(database[api].securityDefinitions[securityDefinition]['in'] == 'header'){
				headers[database[api].securityDefinitions[securityDefinition].name] = options[normalizeParameterName(database[api].securityDefinitions[securityDefinition].name)]
			}
		}else if(database[api].securityDefinitions[securityDefinition].type == 'oauth2'){
			headers['Authorization'] = 'Bearer ' + options['access_token'];
		}
		
//		var apiKey = _.find(database[api].paths[path][verb].security,function(item){
//			return 'api_key' in item;
//		})
//		console.log('api def: ' + util.inspect(database[api].securityDefinitions.api_key))
//		if(database[api].securityDefinitions.api_key['in'] == 'query'){
//			query[database[api].securityDefinitions.api_key.name] = options[normalizeParameterName(database[api].securityDefinitions.api_key.name)]
//		}
	}
	
	var urlObj = {
		protocol: protocol,
		host: host,
		pathname: pathStr,
		query: query
	}
	// TBD: dont forget basic auth!
	
	theUrl = url.format(urlObj);
//	console.log('url: ' + theUrl);
		
	
	
	var requestOptions = {
		url: theUrl,
		method: verb.toUpperCase(),
		headers: headers,
	}
	
	if(!_.isEmpty(form)){
		requestOptions['form'] = form;
	}
	if(!_.isEmpty(headers)){
		requestOptions['headers'] = headers;
	}
	if(body){
		requestOptions['body'] = body;
	}
	
//	console.log('requestOptions: ' + util.inspect(requestOptions));
	
	/*
	 * TBD TBD TBD
	 * think of how to implement the ret
	 * TBD TBD TBD
	 */
	
	
	request(requestOptions,function(error,response,body){
		if(error){
			callback(error);
		}else if(response.statusCode < 200 || response.statusCode > 299){
//			console.log('status code: ' + response.statusCode);
			callback(body);
		}else{
//			console.log('body is: ' + util.inspect(body));
			var ret;
			if('ret' in options){
				var data = JSON.parse(body);
				ret = data[options.ret];
			}else{
				ret = body;
			}
			callback(null,ret);
		}
	})
	
}

function loadDatabase(){
	var cache = {};
	try{
//		console.log('reading cache from: ' + Path.join(os.tmpdir(),'commandcar-cache.json'));
//		cache = fs.readFileSync(Path.join(os.tmpdir(),'commandcar-cache.json'), 'utf-8');
		cache = fs.readFileSync(Path.join(HOME_DIR,'database.json'), 'utf-8');
		cache = jsonic(cache);
	}catch(e){
		
	}
	return cache;
}

function getShort(name,shorts){
	var test = name.charAt(0).toLowerCase();
	if(_.contains(shorts,test)){
		test = name.charAt(0).toUpperCase();
		if(_.contains(shorts,test)){
			test = name.charAt(name.length -1).toLowerCase();
			if(_.contains(shorts,test)){
				test = name.charAt(name.length -1).toUpperCase();
				if(_.contains(shorts,test)){
					test = chance.character({pool:'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'});
					while(_.contains(shorts,test)){
						test = chance.character({pool:'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'});
					}
				}
			}
		}
	}
	return test;
}

function normalizeParameterName(name){
	var parts = name.split('-');
	var newParts = [];
	newParts.push(parts[0]);
	for(var i=1;i<parts.length;i++){
		newParts.push(parts[i].charAt(0).toUpperCase() + parts[i].slice(1));
	}
	return newParts.join('');
}

function saveDatabase(){
	fs.writeFileSync(Path.join(HOME_DIR,'database.json'),JSON.stringify(database));
}
