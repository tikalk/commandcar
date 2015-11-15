# commandcar - curl on steroids

commandcar is a CLI tool that can easily communicate with any API. It simplifies unreadable and complicated curl commands, and has some nice features to make automation of API calls much simpler.

Here's an example of what it can look like
```
commandcar facebook.like --post_id 123456789 --access_token abcdefghijklmnopqrstuvwxyz 
```

# Installing

use npm to install commandcar

```
npm install commandcar -g
``` 

This will install commandcar globally. Depending on your OS, you may want to use sudo to install it.

# Using commandcar

A fresh commandcar install is a powerful though empty skeleton. In order to make commandcar usable you need to `load` or `install` an API definition. Basically, you `load` your own API definitions, and when you `install`, you install an API definition that another generous developer had already defined and pushed to the commandcar repository.

# Installing an API

Search for the API you wish to install, and then install it like this:

```
commandcar install facebook
```

# Loading an API

Define an API (see next section) and load it like this:

```
commandcar load ~/dev/commandcar/apis/my_api
```

# API Definition

An API Definition is a file system directory. The name of the directory describes the API. In the root of the directory resides an `api.json` manifest file.

API commands are described each in its own json file under the `commands` sub directory. So essentially, it should all look something like:

```
+- Facebook
   +- api.json
   +- commands
      +- get.json
      +- like.json
      +- comment.json
```

# api.json

The file should contain the most basic info in order to generate API calls to the API. for example:

```
{
	protocol: "https",
	hostname: "graph.facebook.com",
}
```

# command json

Specific info for each command. for example:

```
{
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
 }
			 
```

# use command

use is a special command that is added to any API and doesn't need to be defined. If you're doing a lot of API calls with identical parameters, for instance an access_token, then you can `use` them instead, and then they will be included in any following call to the API, until you `unuse` it or untull you `use` another parameter value.

for example:

```
commandcar facebook.use --access_token abcdefghijklmnopqrstuvwxyz
commandcar facebook.like --post_id 1234567
commandcar facebook.comment --post_id 1234567 --text "what a cool post"
commandcar facebook.add_friend --uid 987654321
```

