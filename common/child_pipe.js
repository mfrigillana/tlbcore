var _ = require('underscore');
var async = require('async');
var path = require('path');
var child_process = require('child_process');
var events = require('events');
var logio = require('../web/logio');

exports.ChildJsonPipe = ChildJsonPipe;
exports.sshify = sshify;

function ChildJsonPipe(execName, execArgs, execOptions, o) {
  var m = this;

  if (o.shareMem) {
    // WRITEME: create a SHM or shared mmapped file with the child, for passing large
    // numerical arrays around.
  }
  m.baseName = o.baseName || execName;
  if (o.sshHost) {
    execArgs = sshify(execName, execArgs, o.sshHost);
    execName = 'ssh';
    m.baseName = o.sshHost + '$' + m.baseName;
    console.log(execName, execArgs.join(' '));
  }
  m.verbose = o.verbose || 0;
  var nChildren = o.nChildren || 1;

  m.children = _.map(_.range(nChildren), function(childi) {
    return child_process.spawn(execName, execArgs, _.extend({stdio: [
      'pipe',
      'pipe',
      o.captureStderr ? 'pipe' : 'inherit'
    ]}, execOptions));
  });
  m.queues = _.map(_.range(m.children.length), function(childi) {
    return [];
  });
  m.logs = [];
  m.rpcIdCtr = Math.floor(Math.random()*1000000000);
  _.each(_.range(m.children.length), function(childi) {
    var datas=[];
    m.children[childi].stdout.on('data', function(buf) {
      while (buf.length) {
        var eol = buf.indexOf(10); // newline
        if (eol < 0) {
          datas.push(buf);
          return;
        } else {
          datas.push(buf.slice(0, eol));
          var rep = JSON.parse(datas.join(''));
          datas = [];
          m.handleRx(childi, rep);
          buf = buf.slice(eol+1);
        }
      }
    });
    if (o.captureStderr) {
      m.children[childi].stderr.on('data', function(d) {
        m.logs.push(d);
        process.stderr.write(d);
      });
    }

    m.children[childi].on('close', function(code, signal) {
      if (m.verbose >= 1 || code != 0) {
        logio.I(m.baseName + childi.toString(), 'close, code=', code, 'signal=', signal);
        logio.I(m.baseName + childi.toString(), m.logs);
      }
      m.handleClose(childi);
      m.emit('close', code, signal);
    });
    m.children[childi].on('error', function(err) {
      logio.E(m.baseName + childi.toString(), 'Failed to start child process', err);
    });
  });
};

ChildJsonPipe.prototype = Object.create(events.EventEmitter.prototype);

ChildJsonPipe.prototype.close = function() {
  var m = this;
  for (var childi=0; childi<m.children.length; childi++) {
    m.children[childi].stdin.end();
  }
  m.emit('close');
};

// Return index of child with shortest outstanding queue length
ChildJsonPipe.prototype.chooseAvailChild = function() {
  var m = this;
  var bestLen = m.queues[0].length
  var besti = 0;
  for (var childi=1; childi<m.children.length; childi++) {
    if (m.queues[childi].length < bestLen) {
      bestLen = m.queues[childi].length;
      besti = childi;
    }
  }
  return besti;
};

ChildJsonPipe.prototype.tx = function(childi, req) {
  var m = this;
  m.children[childi].stdin.write(JSON.stringify(req));
  m.children[childi].stdin.write('\n');
};

ChildJsonPipe.prototype.handleRx = function(childi, rx) {
  var m = this;
  var q = m.queues[childi];
  var repInfo = null;
  if (rx.result || rx.error) {
    for (var qi=0; qi<q.length; qi++) {
      if (q[qi].id === rx.id) {
        repInfo = q[qi];
        if (!(rx.error && rx.error === 'progress')) {
          q.splice(qi, 1);
        }
      }
    }
    if (repInfo) {
      if (rx.error && rx.error === 'progress') {
        if (m.verbose>=2) logio.E(m.baseName + childi.toString(), 'rx', repInfo.method, 'progress', Date.now()-repInfo.t0)
        repInfo.cb('progress', rx.result);
      }
      else if (rx.error) {
        if (m.verbose>=1) logio.E(m.baseName + childi.toString(), 'rx', repInfo.method, rx.error, Date.now()-repInfo.t0)
        repInfo.cb(new Error(rx.error), rx.result);
      } else {
        if (m.verbose>=2) logio.I(m.baseName + childi.toString(), repInfo.method, Date.now()-repInfo.t0)
        repInfo.cb(null, rx.result);
      }
    } else {
      logio.E(m.baseName + childi.toString(), 'Unknown id', rx);
    }
  }
  else if (rx.cmd === 'emit') {
    m.emit.apply(m, rx.params);
  }
  else {
    logio.E(m.baseName + childi.toString(), 'Unknown message', rx);
  }
}

// run result = method(params...) in child, call cb(exception, result)
ChildJsonPipe.prototype.rpc = function(method, params, cb) {
  var m = this;
  var childi = m.chooseAvailChild();
  if (cb) {
    var id = m.rpcIdCtr++;
    m.queues[childi].push({id: id, cb: cb, method: method, t0: Date.now()});
    m.tx(childi, {method: method, params: params, id: id});
  }
  else {
    m.tx(childi, {method: method, params: params});
  }
};

// Do initial interaction with all the children
ChildJsonPipe.prototype.handshake = function(cb) {
  var m = this;
  async.each(_.range(m.children.length), function(childi, childDone) {
    var method = 'handshake';
    var params = [];
    var id = m.rpcIdCtr++;
    m.queues[childi].push({id: id, cb: childDone, method: method, t0: Date.now()});
    m.tx(childi, {method: method, params: params, id: id});
  }, cb);
};

ChildJsonPipe.prototype.handleClose = function(childi) {
  var m = this;
  m.children[childi] = null;
  while (m.queues[childi].length > 0) {
    var repInfo = m.queues[childi].shift();
    repInfo.cb('Connection closed', null);
  }
};

/*
  Convert a list of args into an ssh command line
  ie, sshify('python', 'foo.py', 'remote') => ['remote', 'cd dir && python foo.py']
*/
function sshify(execName, execArgs, sshHost) {
  var relDir = path.relative(process.env.HOME, process.cwd());

  var newArgs = _.map(execArgs, function(a) {
    if (/^\//.exec(a)) {
      a = path.relative(process.cwd(), a);
    }
    if (/^[-_a-zA-Z0-9\/\.]+$/.exec(a)) {
      return a;
    } else {
      return '"' + a.replace(/[^-_a-zA-Z0-9\/\. @{}\[\]]/g, '\\$&') + '"';
    }
  })
  return [sshHost, 'source /etc/profile && source .profile && cd ' + relDir + ' && ' + execName + ' ' + newArgs.join(' ')]
}
