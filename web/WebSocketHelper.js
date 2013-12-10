/*
  Provide wrappers around JSON.stringify and JSON.parse that handle binary data efficiently, by
  putting ArrayBuffers and things like Float32Arrays into a separate binary stream.

  Meant to work over Websockets in both Browser and Node.js

  See:
    http://www.khronos.org/registry/typedarray/specs/latest/
    https://developer.mozilla.org/en-US/docs/Web/JavaScript/Typed_arrays
    https://developer.mozilla.org/en-US/docs/Web/API/DataView
    https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify
  
*/
_ = require('underscore');

exports.stringify = stringify;
exports.parse = parse;
exports.RpcPendingQueue = RpcPendingQueue;

function stringify(msg) {

  var binaries = [];

  var json = JSON.stringify(msg, function(k, v) {
    if (v && v.constructor) {
      if (v.constructor === ArrayBuffer) {
        binaries.push(v);
        return {__wsType: 'ArrayBuffer', binaryIndex: binaries.length-1};
      }
      else if (v.constructor === DataView) {
        binaries.push(v.buffer);
        return {__wsType: 'DataView', binaryIndex: binaries.length-1, byteOffset: v.byteOffset, byteLength: v.byteLength};
      }
      else if (v.constructor === Int8Array) {
        binaries.push(v.buffer);
        return {__wsType: 'Int8Array', binaryIndex: binaries.length-1, byteOffset: v.byteOffset, length: v.length};
      }
      else if (v.constructor === Uint8Array) {
        binaries.push(v.buffer);
        return {__wsType: 'Uint8Array', binaryIndex: binaries.length-1, byteOffset: v.byteOffset, length: v.length};
      }
      else if (v.constructor === Int16Array) {
        binaries.push(v.buffer);
        return {__wsType: 'Int16Array', binaryIndex: binaries.length-1, byteOffset: v.byteOffset, length: v.length};
      }
      else if (v.constructor === Uint16Array) {
        binaries.push(v.buffer);
        return {__wsType: 'Uint16Array', binaryIndex: binaries.length-1, byteOffset: v.byteOffset, length: v.length};
      }
      else if (v.constructor === Int32Array) {
        binaries.push(v.buffer);
        return {__wsType: 'Int32Array', binaryIndex: binaries.length-1, byteOffset: v.byteOffset, length: v.length};
      }
      else if (v.constructor === Uint32Array) {
        binaries.push(v.buffer);
        return {__wsType: 'Uint32Array', binaryIndex: binaries.length-1, byteOffset: v.byteOffset, length: v.length};
      }
      else if (v.constructor === Float32Array) {
        binaries.push(v.buffer);
        return {__wsType: 'Float32Array', binaryIndex: binaries.length-1, byteOffset: v.byteOffset, length: v.length};
      }
      else if (v.constructor === Float64Array) {
        binaries.push(v.buffer);
        return {__wsType: 'Float64Array', binaryIndex: binaries.length-1, byteOffset: v.byteOffset, length: v.length};
      }
    }
    // ADD: more types to handle specially
    return v;
  });

  return {json: json, binaries: binaries};
}

function parse(json, binaries) {
  var msg = JSON.parse(json, function(k, v) {
    if (_.isObject(v) && v.__wsType) {
      if (v.__wsType === 'ArrayBuffer') {
        return binaries[v.binaryIndex];
      }
      else if (v.__wsType === 'DataView') {
        return new DataView(binaries[v.binaryIndex], v.byteOffset, v.byteLength);
      }
      else if (v.__wsType === 'Int8Array') {
        return new Int8Array(binaries[v.binaryIndex], v.byteOffset, v.length);
      }
      else if (v.__wsType === 'Uint8Array') {
        return new Uint8Array(binaries[v.binaryIndex], v.byteOffset, v.length);
      }
      else if (v.__wsType === 'Int16Array') {
        return new Int16Array(binaries[v.binaryIndex], v.byteOffset, v.length);
      }
      else if (v.__wsType === 'Uint16Array') {
        return new Uint16Array(binaries[v.binaryIndex], v.byteOffset, v.length);
      }
      else if (v.__wsType === 'Int32Array') {
        return new Int32Array(binaries[v.binaryIndex], v.byteOffset, v.length);
      }
      else if (v.__wsType === 'Uint32Array') {
        return new Uint32Array(binaries[v.binaryIndex], v.byteOffset, v.length);
      }
      else if (v.__wsType === 'Float32Array') {
        return new Float32Array(binaries[v.binaryIndex], v.byteOffset, v.length);
      }
      else if (v.__wsType === 'Float64Array') {
        return new Float64Array(binaries[v.binaryIndex], v.byteOffset, v.length);
      }
    }
    // ADD: more types to handle specially
    return v;
  });
  return msg;
}

/*
  Queue of outstanding RPC requests, indexed by ID. ID is an integer for now, but maybe it should be a hard-to-forge cookie.
  Especially coming from the server.
  
  We use an array instead of a hash because I think it's faster.
*/
function RpcPendingQueue() {
  this.pending = [];
  this.uniqueId = 567;
}

RpcPendingQueue.prototype.getNewId = function() {
  return this.uniqueId++;
}

RpcPendingQueue.prototype.get = function(rspId) {
  for (var i=0; i<this.pending.length; i++) {
    if (this.pending[i] && this.pending[i].rspId === rspId) {
      var ret = this.pending[i].rspFunc;
      this.pending[i] = null;
      return ret;
    }
  }
  return null;
};

RpcPendingQueue.prototype.add = function(rspId, rspFunc) {
  while (this.pending.length && this.pending[0] === null) {
    this.pending.shift();
  }
  this.pending.push({rspId: rspId, rspFunc: rspFunc});
  if (this.pending.length % 50 === 0) {
    console.log(wsc.url + ' ! pending=' + this.pending.length);
  }
};
