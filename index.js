var restify = require('restify');
var globby = require('globby');
var Promise = require('bluebird');
var readFile = Promise.promisify(require('read-file'));
var parseXml = Promise.promisify(require('xml2js').parseString);
var deepEqual = require('deep-equal');
var fs = require('fs');

var path = require('path');

var config = require('./config.js');

var server = restify.createServer();
server.use(parseBodyString);

var parseMaps = {
  xml: findMatchingXml
};

Promise.resolve(config.data)
.map(function(data) {
  var uri = config.rootUri + data.uri;
  
  var filePattern = data.directory + '/*req*';
  
  var method = data.defaultMethod.toLowerCase();
  
  return Promise.resolve(globby(filePattern))
    .map(function(requestFile) {
      
      var absReq = path.isAbsolute(requestFile) ? requestFile : path.resolve('.', requestFile);
      var dir = path.dirname(absReq);
      var filename = path.basename(absReq);
      
      return {
        req: absReq,
        resp: path.join(dir, filename.replace('req', 'rsp'))
      };
    })
    .tap(function(files) {
      console.log('Registering: %s %s', method.toUpperCase(), uri);
      files.forEach(function(file) {
        console.log('\t%s -> %s', file.req, file.resp);
      });
    })
    .then(function(files) {
      server[method](uri, function(req, res) {
        var startTime = new Date();
        var search;
        if (method === 'get') {
          search = req.url;
        } else {
          search = req.bodyString;
        }
        
        var parser = parseMaps[data.parser];
        
        if (!parser) {
          console.log('Unknown parser in config: ', data.parser);
          res.set(500, 'Unknown parser in config: ', data.parser);
          return;
        }
        
        return parser(search, files)
          .then(function(file) {
            if (!file) {
              console.error('No match for: ');
              console.error(search);
              res.send(404);
              return;
            } else {
              console.log('Found match:', file.resp);
              res.writeHead(200, {
                'content-type': data.defaultMimeType
              });
              return streamFileToResponse(file.resp, res);
            }
          })
          .catch(function(err) {
            console.error(err);
            res.send(500, err);
          })
          .finally(function() {
            console.log('Total time: ', new Date() - startTime);
          })
      });
    });
  
})
.then(function() {
  // Everything's registered now start the server
  server.listen(8080, function() {
    console.log('%s listening at %s', server.name, server.url);
  });
})
.catch(function(err) {
  console.error(err);
});

function findMatchingXml(body, potentials) {
  return parseXml(body)
    .then(function(xml) {
      // Use reduce to read in series but not read more files than we have to
      return Promise.reduce(potentials, function(result, file) {
        if (result) {
          // Already found a match, no need to read anything more
          return result;
        } else {
          return readFile(file.req, {encoding: 'utf8'})
            .then(parseXml)
            .then(function(contents) {
              return deepEqual(contents, xml) ? file : false;
            })
            .catch(function(err) {
              // Error parsing xml... probably not an issue (?)
              return false;
            });
        }
      }, false);
    });
}

function streamFileToResponse(filename, resp) {
  return new Promise(function(resolve) {
    
    var readStream = fs.createReadStream(filename);
    
    readStream.on('open', function() {
      readStream.pipe(resp);
    });
    
    readStream.on('end', function() {
      resolve();
    });
  });
}

// Middleware that parses the request body into req.bodyString
function parseBodyString(req, res, next) {
  var body = '';
  
  req.on('data', function(chunk, encoding) {
    body += chunk.toString(encoding);
  });
  
  req.on('end', function() {
    req.bodyString = body;
    next();
  });
}
