
module.exports = {
  rootUri: '/',
  data: [{
    directory: './testdata/test1',
    uri: 'api/test1',
    defaultMimeType: 'application/xml',
    defaultMethod: 'POST',
    parser: 'xml',
  }, {
    directory: './testdata/test2',
    uri: 'api/test2',
    defaultMimeType: 'application/json',
    defaultMethod: 'GET',
    parser: 'json',
  }]
};