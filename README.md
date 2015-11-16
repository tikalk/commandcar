# commandcar - curl on steroids

commandcar is a CLI tool that can easily communicate with any API. It simplifies unreadable and complicated curl commands, and has some nice features to make automation of API calls much simpler and bash scripts more streamlined.

Here's an example of what it can look like
```
commandcar facebook.like --post_id 123456789 --access_token abcdefghijklmnopqrstuvwxyz 
```

# Installing

use [npm](https://www.npmjs.com/) to install commandcar.

```
sudo npm install commandcar -g
``` 

# Using commandcar

A fresh commandcar install is a powerful yet empty skeleton. In order to make commandcar usable you first need to `load` or `install` an API definition, and that's how you extend its power. 

Basically, you `load` your own API definitions, and when you `install`, you install an API definition that another generous developer had already defined and pushed to the commandcar repository.

# Installing an API

Search for the API you wish to install by browsing our [apis repository](https://github.com/shaharsol/commandcar/tree/master/apis), and then install it like this:

```
sudo commandcar install facebook
```

# Loading an API

Define an API in a folder somewhere on your local machine (see next section) and load it like this:

```
sudo commandcar load --location ~/dev/commandcar/apis/my_api
```

# API Definition

An API Definition is a file system directory. The name of the directory gives the API its name. In the root of the directory resides an `api.json` manifest file.

API commands are described each in their own json file under the `commands` sub directory. So essentially, it should all look something like:

```
+- Facebook
   +- api.json
   +- commands
      +- get.json
      +- like.json
      +- comment.json
```

# api.json

The file should contain the paramteres that are applied to all (or at least, most) commands in the API. for example:

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
# Examples

The best way to learn more about API definition would be to take a look at how we defined the [instagram API](https://github.com/shaharsol/commandcar/tree/master/apis/instagram) ourselves.

# use command

use is a special command that is added to any API and doesn't need to be defined. If you're doing a lot of API calls with identical parameters, for instance an access_token, then you can `use` them instead, and then they will be included in any following call to the API, until you `unuse` it or untull you `use` another parameter value.

for example:

```
commandcar facebook.use --access_token abcdefghijklmnopqrstuvwxyz
commandcar facebook.like --post_id 1234567
commandcar facebook.comment --post_id 1234567 --text "what a cool post"
commandcar facebook.add_friend --uid 987654321
```

