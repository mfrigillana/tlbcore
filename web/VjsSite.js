// -*- js-indent-level:2 -*-
/*jsl:option explicit*/
"use strict";
var _                   = require('underscore');
var util                = require('util');
var http                = require('http');
var fs                  = require('fs');
var url                 = require('url');
var path                = require('path');
var websocket           = require('websocket');

var logio               = require('./logio');
var RpcEngines          = require('./RpcEngines');
var VjsApi              = require('./VjsApi');
var VjsDbs              = require('./VjsDbs');
var Auth                = require('./Auth');
var Provider            = require('./Provider');
var Topology            = require('./Topology');
var Safety              = require('./Safety');
var Image               = require('./Image');

exports.WebServer = WebServer;
exports.setVerbose = function(v) { verbose = v; };

// ======================================================================

var verbose = 1;

function WebServer() {
  var webServer = this;
  webServer.urlProviders = {};
  webServer.dirProviders = {};
  webServer.wsHandlers = {};
  webServer.serverAccessCounts = {};
  webServer.wwwRoot = null;
  webServer.tlbcoreWeb = path.dirname(module.filename);
};

WebServer.prototype.setUrl = function(url, p) {
  var webServer = this;
  if (_.isString(p)) {
    var st = fs.statSync(p);
    if (st.isDirectory()) {
      url = path.join(url, '/'); // ensure trailing slash, but doesn't yield more than one
      p = new Provider.RawDirProvider(p);
      webServer.dirProviders['GET ' + url] = p; 
    } else {
      p = new Provider.RawFileProvider(p);
    }
  }

  webServer.urlProviders['GET ' + url] = p; 
};

WebServer.prototype.setSocketProtocol = function(url, f) {
  var webServer = this;
  
  webServer.wsHandlers[url] = f;
};


WebServer.prototype.setupBaseProvider = function() {
  var webServer = this;

  if (webServer.baseProvider) return;
  var p = new Provider.ProviderSet();
  if (1) p.addCss(webServer.tlbcoreWeb + '/common.css');
  if (1) p.addCss(webServer.tlbcoreWeb + '/spinner-lib/spinner.css');
  // Add more CSS files here

  if (1) p.addScript(webServer.tlbcoreWeb + '/VjsPreamble.js');
  if (1) p.addScript(require.resolve('underscore'), 'underscore');
  if (1) p.addScript(webServer.tlbcoreWeb + '/MoreUnderscore.js');
  if (1) p.addScript(webServer.tlbcoreWeb + '/EventEmitter/EventEmitter.js', 'events');
  if (1) p.addScript(webServer.tlbcoreWeb + '/jquery/dist/jquery.js');
  if (1) p.addScript(webServer.tlbcoreWeb + '/ajaxupload-lib/ajaxUpload.js');       // http://valums.com/ajax-upload/
  if (0) p.addScript('swf-lib/swfobject.js');               // http://blog.deconcept.com/swfobject/
  if (1) p.addScript(webServer.tlbcoreWeb + '/mixpanel-lib/mixpanel.js');
  if (1) p.addScript(require.resolve('./VjsClient.js'));
  if (1) p.addScript(require.resolve('./VjsBrowser.js'));

  webServer.baseProvider = p;
};

WebServer.prototype.setupInternalUrls = function() {
  var webServer = this;

  webServer.urlProviders['POST /vjs.api'] = {
    start: function() {},
    mirrorTo: function(dst) {},
    handleRequest: function(req, res, suffix) {
      RpcEngines.PostJsonHandler(req, res, VjsApi.apis);
    }
  };
  

  webServer.urlProviders['POST /uploadImage'] = {
    start: function() {},
    mirrorTo: function(dst) {},
    handleRequest: function(req, res, suffix) {
      RpcEngines.UploadHandler(req, res, function(docFn, doneCb) {
        var userName = RpcEngines.cookieUserName(req);
        Image.mkImageVersions(docFn, {fullName: userName}, function(ii) {
          doneCb(ii);
        });
      });
    }
  };

  webServer.urlProviders['GET /vjs.api'] = {
    start: function() {},
    mirrorTo: function(dst) {},
    handleRequest: function(req, res, suffix) {
      RpcEngines.FetchDocHandler(req, res, VjsApi.fetchApis);
    }
  };

  // Files available from root of file server
  webServer.setUrl('/favicon.ico', webServer.tlbcoreWeb + '/images/vjs.ico');
  webServer.setUrl('/spinner-lib/spinner.gif', webServer.tlbcoreWeb + '/spinner-lib/spinner.gif');
};

WebServer.prototype.setupContent = function(dirs) {
  var webServer = this;
  
  webServer.setupBaseProvider();
  webServer.setupInternalUrls();

  _.each(dirs, function(dir) {
    require('../../' + dir + '/load').load(webServer);
  });

  webServer.startAllContent();
  webServer.mirrorAll();
};



WebServer.prototype.startAllContent = function() {
  var webServer = this;
  _.each(webServer.urlProviders, function(p, name) {
    p.start();
  });
};

WebServer.prototype.mirrorAll = function() {
  var webServer = this;

  if (webServer.wwwRoot) {
    _.each(webServer.urlProviders, function(p, name) {
      var m = /^GET (.*)$/.exec(name);
      if (m) {
        var dst = path.join(webServer.wwwRoot, m[1])
        p.mirrorTo(dst);
      }
    });
  }
};

WebServer.prototype.startHttpServer = function(port, bindHost) {
  var webServer = this;
  if (!port) port = 8000;
  if (!bindHost) bindHost = '127.0.0.1';
  
  webServer.httpServer = http.createServer(httpHandler);
  util.puts('Listening on ' + bindHost + ':' + port);
  webServer.httpServer.listen(port, bindHost);

  webServer.ws = new websocket.server({httpServer: webServer.httpServer});
  webServer.ws.on('request', wsRequestHandler);

  function httpHandler(req, res) {

    try {
      var up = url.parse(req.url, true);
    } catch (ex) {
      logio.E('http', 'Error parsing' + req.url, ex);
      return Provider.emit404(res, 'Invalid url');
    }

    var remote = req.connection.remoteAddress + '!http';
    
    if (!up.host) up.host = req.headers['host'];
    if (!up.host) up.host = 'localhost';
    if (up.host.match(/[^-\w\.\/\:]/)) {
      return Provider.emit404(res, 'Invalid host header');
    }

    var pathc = up.pathname.substr(1).split('/');
    if (pathc[0] === 'live') {
      pathc.shift();
    }
    var callid = req.method + ' /' + pathc.join('/');
    webServer.serverAccessCounts[callid] = (webServer.serverAccessCounts[callid] || 0) + 1;
    if (webServer.urlProviders[callid]) {
      logio.I('http', callid);
      webServer.urlProviders[callid].handleRequest(req, res, '');
      return;
    }

    for (var pathcPrefix = pathc.length-1; pathcPrefix >= 1; pathcPrefix--) {
      var prefix = req.method + ' /' + pathc.slice(0, pathcPrefix).join('/') + '/';
      if (webServer.dirProviders[prefix]) { 
        var suffix = pathc.slice(pathcPrefix, pathc.length).join('/');
        logio.I('http', prefix, suffix);
        webServer.dirProviders[prefix].handleRequest(req, res, suffix);
        return;
      }
    }

    logio.E(remote, '404 ' + callid);
    Provider.emit404(res, callid);
    return;
  }

  function wsRequestHandler(wsr) {
    var callid = wsr.resource;
    var handler = webServer.wsHandlers[callid];
    if (!handler) {
      logio.E('ws', callid);
      wsr.reject();
      return;
    }

    logio.I('ws', callid);
    
    if (0) {     // WRITEME: check origin
      wsr.reject();
      return;
    }

    var wsc = wsr.accept(null, wsr.origin);
    if (!wsc) {
      logio.E('wsr.accept failed');
      return;
    }

    var wss = new WebSocketServer(wsc, handler);
  }
};

function WebSocketServer(wsc, handler) {
  var self = this;
  self.wsc = wsc;
  self.handler = handler;
  self.binaries = [];

  self.handler('start');

  wsc.on('message', function(event) {
    if (event.type === 'utf8') {
      try {
        var msg = JSON.parse(event.utf8Data, function(k, v) {
          if (_.isObject(v) && v.type === 'blob') {
            return self.binaries[v.index];
          }
          return v;
        });
        self.binaries = [];
      } catch(ex) {
        logio.E('wsc.message', 'json parse error', ex);
        self.binaries = [];
        return;
      }
      logio.I('wsc.message', msg);
      self.handler(msg);
    }
    else if (event.type === 'binary') {
      logio.I('wsc.message binary len', event.binaryData.byteLength);
      self.binaries.push(event.binaryData);
    }
    else {
      logio.E('wsc.message unknown type', m.type);
    }
  });
  
  wsc.on('close', function(code, desc) {
    logio.I('wsc.close', code, desc);
    self.handler('close');
  });
}


WebSocketServer.prototype.txMsg = function(msg) {
  var self = this;
  var blobi = 0;
  var msgStr = JSON.stringify(msg, function(k, v) {
    if (v.constructor === ArrayBuffer) { // XXX portable?
      self.wsc.send(v);
      var ret = {type: 'blob', index: blobi};
      blobi++;
      return ret;
    }
    return v;
  });
  self.wsc.send(msgStr);
};

WebServer.prototype.getSiteHits = function(cb) {
  var webServer = this;
  var aic = RpcEngines.getApiAccessCounts();
  cb(Array.prototype.concat(
    _.map(_.sortBy(_.keys(webServer.serverAccessCounts), _.identity), function(k) {
      return {desc: 'http.' + k, hits: webServer.serverAccessCounts[k]};
    }),
    _.map(_.sortBy(_.keys(aic), _.identity), function(k) {
      return {desc: 'api.' + k, hits: aic[k]};
    })));
};

WebServer.prototype.getContentStats = function(cb) {
  var webServer = this;
  cb(_.map(_.sortBy(_.keys(webServer.urlProviders), _.identity), function(k) { 
    return _.extend({}, webServer.urlProviders[k].getStats(), {desc: k});
  }));
};
