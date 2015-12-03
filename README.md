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

A fresh commandcar install is a powerful yet empty skeleton. In order to make commandcar usable you need to `load` API definitions, and that's how you extend its power.

API Definitions are [swagger2.0](https://github.com/swagger-api/swagger-spec/blob/master/versions/2.0.md) files. You can create them yourself -- for example if you're developing an API and want to use commandcar to run automated tests against it -- or you can use existing public files. commandcar accepts either `json` or `yaml` swagger files.  

# Loading an API

There are three methods to load an API definition:

## Loading a local file

```
commandcar load --name my_api --file ~/dev/commandcar/apis/my_api.json

```

## Loading from a URL

```
commandcar load --name my_api --url http://some.domain.com/my/api/swagger.yaml

```

## Loading from api-models

[api-models](https://github.com/APIs-guru/api-models) is a GitHub repository of public available swagger files for many public APIs. 

```
commandcar load --name instagram --api_model instagram.com/1.0.0
```

You can browse through the available APIs [here](https://github.com/APIs-guru/api-models/tree/master/APIs) and use the relative path to the directory containing the swagger file from this path onward. For example, the instagram API v1 resides here: https://github.com/APIs-guru/api-models/tree/master/APIs/instagram.com/1.0.0. Use "instagram.com/1.0.0" as the value for the --api_model argument.

# Loads are not persistent

To avoid permission issues, commandcar caches the loads you make in a temporary storage. This doesn't need to affect you dramatically as the cache will not purge during CLI sessions, however if you're running commandcar within other bash scripts it may be a good idea to include any `load` commands in the script before actually invoking the API commands just to be on safe side. 

# Invoking APIs using commandcar

Once you've loaded API defintions, you can use `commandcar -h` to see the new commands and options you can use. Here's an example from the instagram API:

```
  Commands:

    instagram.get_geographies_media_recent [options] 
    instagram.get_locations_search [options]         
    instagram.get_locations [options]                
    instagram.get_locations_media_recent [options]   
    instagram.get_media_popular [options]            
    instagram.get_media_search [options]             
    instagram.get_media_shortcode [options]          
    instagram.get_media [options]                    
    instagram.get_media_comments [options]           
    instagram.post_media_comments [options]          
    instagram.delete_media_comments [options]        
    instagram.delete_media_likes [options]           
    instagram.get_media_likes [options]              
    instagram.post_media_likes [options]             
    instagram.get_tags_search [options]              
    instagram.get_tags [options]                     
    instagram.get_tags_media_recent [options]        
    instagram.get_users_search [options]             
    instagram.get_users_self_feed [options]          
    instagram.get_users_self_media_liked [options]   
    instagram.get_users_self_requested_by [options]  
    instagram.get_users [options]                    
    instagram.get_users_followed_by [options]        
    instagram.get_users_follows [options]            
    instagram.get_users_media_recent [options]       
    instagram.get_users_relationship [options]       
    instagram.post_users_relationship [options]      
    instagram.use [options]                          
    instagram.unuse                                  
    load [options]                                   

  Options:

    -h, --help  output usage information
```

You can then run help for any given command and see what your options are. For example, `commandcar instagram.get_media_search -h` will result in:

```
  Usage: instagram.get_media_search [options]

  Options:

    -h, --help                           output usage information
    -a, --access_token <access_token>    access_token
    -r, --ret [return value]             specify return value
    -l, --lat <lat>                      Latitude of the center search coordinate. If used, `lng` is required.
    -L, --lng <lng>                      Longitude of the center search coordinate. If used, `lat` is required.
    -m, --min_timestamp [min_timestamp]  A unix timestamp. All media returned will be taken later than this timestamp.
    -M, --max_timestamp [max_timestamp]  A unix timestamp. All media returned will be taken earlier than this timestamp.
    -d, --distance [distance]            Default is 1km (distance=1000), max distance is 5km.

```

# use command

use is a special command that is added to any API that has `securityDefinitions`. If you're doing a lot of API calls with identical authorization parameters, for instance an access_token, then you can `use` them instead, and then they will be included in any following call to the API, until you `unuse` it or until you `use` another parameter value.

for example:

```
commandcar facebook.use --access_token abcdefghijklmnopqrstuvwxyz
commandcar facebook.like --post_id 1234567
commandcar facebook.comment --post_id 1234567 --text "what a cool post"
commandcar facebook.add_friend --uid 987654321
```

Note: Facebook is used as an example API throughout this doc, though we didn't practically implement it as a swagger file.

# -r --ret

This is an option that is attached automatically to any command and enables you to specify exactly what you wish to receive as output. 

So for example let's assume you make this call:

```
commandcar facebook.get_user --accees_token 123456 --ret first_name
```

Now let's assume that the API response is:
```
{
   "uid": "123456789",
   "first_name": "John",
   "last_name": "Doe"
}
```

Then the output would be simply `John` instead of the entire json.

# Gitter

We're on [gitter](https://gitter.im/tikalk/commandcar) if you want to talk with us.