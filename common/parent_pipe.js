/*
  I wish I could use cluster for this, but it uses fd 3 as a bidirectional socket
  which can't be easily forwarded with ssh.
*/
'use strict';
console._stdout = process.stderr;
const _ = require('lodash');
const async = require('async');
const child_process = require('child_process');
const logio = require('../common/logio');

exports.ParentJsonPipe = ParentJsonPipe;

function ParentJsonPipe(o, handlers) {
  this.handlers = _.extend({
    rpc_handshake: (cb) => {
      cb(null, 'handshake');
    },
  }, handlers);
  this.stdin = process.stdin;
  this.stdout = process.stdout;

  let datas = [];
  this.stdin.on('data', (buf) => {
    while (buf.length) {
      let eol = buf.indexOf(10); // newline
      if (eol < 0) {
        datas.push(buf);
        return;
      } else {
        datas.push(buf.slice(0, eol));
        let rx = JSON.parse(datas.join(''));
        datas = [];
        this.handleRx(rx);
        buf = buf.slice(eol+1);
      }
    }
  });
}

ParentJsonPipe.prototype.tx = function(tx) {
  this.stdout.write(JSON.stringify(tx));
  this.stdout.write('\n');
};

ParentJsonPipe.prototype.emitInParent = function() {
  this.tx({
    cmd: 'emit',
    params: arguments,
  });
};

ParentJsonPipe.prototype.handleRx = function(rx) {
  if (rx.method) {
    let cb = (err, result) => {
      this.tx({ id: rx.id, error: err, result: result });
    };
    let methodFunc = this.handlers['rpc_' + rx.method];
    if (!methodFunc) {
      logio.E('parent', 'No such method', rx.method);
      return cb('No such method', null);
    }
    methodFunc.call(this.handlers, ...rx.params, cb);
  }
};
