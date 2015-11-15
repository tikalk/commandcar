# commandcar - curl on steroids

commandcar is a CLI tool that can easily communicate with any API. It simplifies unreadable and complicated curl commands, and has some nice features to make automation of API calls much simpler.

# Installing

use npm to install commandcar

```
npm install commandcar -g
``` 

This will install commandcar globally. Depending on your OS, you may want to use sudo to install it.

# Using commandcar

A fresh commandcar install is a pwerful though empty skeleton. In order to make commandcar usable you need to `load` or `install` an API definition. Basically, you `load` your own API definitions, and when you `install`, you install an API definition that another generous developer had already defined and pushed to the commandcar repository.

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

