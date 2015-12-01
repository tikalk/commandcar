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
var Chance = require('chance');
var chance = new Chance();
var camelcase = require('camelcase');
var querystring = require('querystring');

/*
 * ENV
 */

var USE_DIR = path.join(os.tmpdir(),'commandcar-use');
console.log('use dir: ' + USE_DIR);
try{
	fs.mkdirSync(USE_DIR);
}catch(e){
	// ignore. it means it already exists
}

/*
 * load database
 */

var database = loadDatabaseFromCache();

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
			var shorts = [];
			console.log('found command: ' + commandName);
			var theCommand = program.command(commandName);
			
			// always start with the api key in order to keep its short name persistent over all the api methods
			if('security' in verbContent){
				var apiKey = _.find(verbContent.security,function(item){
					return 'api_key' in item;
				})
				if(apiKey){
					var short = getShort(apiContent.securityDefinitions.api_key.name,shorts);
					shorts.push(short);
					theCommand.option('-' + short + ', --' + apiContent.securityDefinitions.api_key.name + ' <' + apiContent.securityDefinitions.api_key.name + '>',apiContent.securityDefinitions.api_key.name);
				}
			}
			
			// also always add a "-r --ret" option
			theCommand.option('-r, --ret [return value]','specify return value');
			
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
			// TBD
			/*
			 * 
			 * also, add use and unuse with this particular key!
			 */
			
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
	if(('securityDefinitions' in apiContent) && ('api_key' in apiContent.securityDefinitions)){
		var useCommand = program.command(api + '.use');
		var short = getShort(apiContent.securityDefinitions.api_key.name,[]);
		useCommand.option('-' + short + ', --' + apiContent.securityDefinitions.api_key.name + ' <' + apiContent.securityDefinitions.api_key.name + '>',apiContent.securityDefinitions.api_key.name);
		useCommand.action(function(options){
			use(api,options);
		})
		var unuseCommand = program.command(api + '.unuse');
		unuseCommand.action(function(options){
			unuse(api,options);
		})
	}
	
	
})

program
	.command('load')
	.option('-n, --name <name of the API>','name of the API')
	.option('-f, --file [local yaml file]','local yaml file')
	.option('-u, --url [online yaml file]','online yaml file')
	.option('-a, --api_model [name of an api_model path]','name of an api_model path')
	.action(function(options){
		console.log('loading ' + options.name);
		
		if(options.file){
			if(path.extname(options.file) == '.yaml'){
//				var apiName = path.basename(options.file,'.yaml');
				var apiName = options.name;
				database[apiName] = yaml.load(options.file);
				fs.writeFileSync(path.join(os.tmpdir(),'commandcar-cache.json'),JSON.stringify(database));
			}else{
				console.log('Can\'t load because file is not yaml');
			}
		}else{
			var url;
			if(options.api_model){
				url = 'https://raw.githubusercontent.com/APIs-guru/api-models/master/APIs/' + options.api_model + '/swagger.yaml';
			}else{
				url = options.url;
			}
			request(url,function(error,response,body){
				if(error){
					console.log('error in loading yaml from url: ' + error);
				}else if(response.statusCode != '200'){
					console.log('error in loading yaml from url: ' + body);
				}else{
					var apiName = options.name;
					database[apiName] = yaml.parse(body);
					fs.writeFileSync(path.join(os.tmpdir(),'commandcar-cache.json'),JSON.stringify(database));
				}
			})
		}
		
		
		
	});



program.parse(process.argv);

function use(api,options){
	try{
		
		var useOptions = {};
		if(('securityDefinitions' in database[api]) && ('api_key' in database[api].securityDefinitions)){
//			console.log('options name: ' + database[api].securityDefinitions.api_key.name);
//			console.log('value: ' + )
			useOptions[database[api].securityDefinitions.api_key.name] = options[normalizeParameterName(database[api].securityDefinitions.api_key.name)];
		}
		fs.writeFileSync(path.join(USE_DIR,api + '.json'),JSON.stringify(useOptions));
		
	}catch(e){
		console.log(e);
	}
}

function unuse(api){
	try{
		fs.unlinkSync(path.join(USE_DIR,api + '.json'));
	}catch(e){
		console.log(e);
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
	
//	try{
//		useOptions = jsonic(fs.readFileSync(path.join(USE_DIR,api + '.json'), 'utf8'));
//		_.each(useOptions,function(value,key){
//			options[key] = value;
//		})
//	}catch(e){
//		
//	}
	
	
	
	
	var protocol = database[api].schemes[0];
	console.log('protocil: ' + protocol);
	var host = database[api].host;
	console.log('host: ' + host);

	
	
//	theUrl = currentApi.protocol + '://' + currentApi.hostname;
	pathStr = database[api].basePath + path
	console.log('pathStr: ' + pathStr);

	var pathParts = pathStr.split('/');
	var newParts = [];
	_.each(pathParts,function(pathPart){
		if(us(pathPart).startsWith('{') && us(pathPart).endsWith('}')){
			console.log('found a param');
			console.log('param name: ' + pathPart.substr(1,pathPart.length-2));
			console.log('cameld case: ' + normalizeParameterName(pathPart.substr(1,pathPart.length-2)));
			console.log('param value: ' + options[normalizeParameterName(pathPart.substr(1,pathPart.length-2))]);
			pathPart = options[normalizeParameterName(pathPart.substr(1,pathPart.length-2))];
		}
		newParts.push(pathPart);
	});
	pathStr = newParts.join('/');
	console.log('pathStr: ' + pathStr);
	
//	console.log(util.inspect(options));
	var query = {};
//	console.log('options: ' + util.inspect(options));
	_.each(database[api].paths[path][verb].parameters,function(parameter){
		console.log('parameter name: ' + parameter.name);
		console.log('parameter name cameled: ' + normalizeParameterName(parameter.name));
		console.log('parameter value: ' + options[normalizeParameterName(parameter.name)]);
		
		if(parameter['in'] == 'query'){
			query[parameter.name] = options[normalizeParameterName(parameter.name)];
		}
	}); 
	
	// do we have to add security params to query?
	if('security' in database[api].paths[path][verb]){
		var apiKey = _.find(database[api].paths[path][verb].security,function(item){
			return 'api_key' in item;
		})
		console.log('api def: ' + util.inspect(database[api].securityDefinitions.api_key))
		if(database[api].securityDefinitions.api_key['in'] == 'query'){
			query[database[api].securityDefinitions.api_key.name] = options[normalizeParameterName(database[api].securityDefinitions.api_key.name)]
		}
	}
	
	var queryString = querystring.stringify(query);
	
console.log('querystring: ' + queryString);
	
	var urlObj = {
		protocol: protocol,
		host: host,
		pathname: pathStr,
		query: query
	}
	// TBD: dont forget basic auth!
	
	theUrl = url.format(urlObj);
	console.log('url: ' + theUrl);
		
	var headers = {};
	var form = {};
	
	var requestOptions = {
		url: theUrl,
		method: verb.toUpperCase(),
		headers: headers,
	}
	
	if(!_.isEmpty(form)){
		requestOptions['form'] = form;
	}
	
//	console.log('requestOptions: ' + util.inspect(requestOptions));
	
	/*
	 * TBD
	 * look for headers parameters both in parameters and securityDefinition
	 * look for body param (swagger allows only one)
	 * look for form parameters 
	 * think of how to implement the ret
	 */
	
	
	request(requestOptions,function(error,response,body){
		if(error){
			callback(error);
		}else if(response.statusCode < 200 || response.statusCode > 299){
//			console.log('status code: ' + response.statusCode);
			callback(body);
		}else{
			console.log('body is: ' + util.inspect(body));
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
	var cache = {};
	try{
		console.log('reading cache from: ' + path.join(os.tmpdir(),'commandcar-cache.json'));
		cache = fs.readFileSync(path.join(os.tmpdir(),'commandcar-cache.json'), 'utf-8');
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
