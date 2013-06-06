//-*-C++-*-
#ifndef _TLBCORE_REALTIME_TcpJsonConn_H
#define _TLBCORE_REALTIME_TcpJsonConn_H

#include "../common/LogBase.h"
#include <uv.h>

struct TcpJsonConn;

struct JsonApi {
  virtual void call(Handle<Object> pkt, LogBase *sender)=0;
};

struct TcpJsonConnRxApi : JsonApi {
  TcpJsonConnRxApi(TcpJsonConn *_owner);
  void call(Handle<Object> pkt, LogBase *sender);
  TcpJsonConn *owner;
};

struct TcpJsonConn : LogBase {

  TcpJsonConn(string const &_debugname);
  virtual ~TcpJsonConn();

  // setup
  void connectTo(string const &hostport);
  void acceptFrom(uv_stream_t *server);
  sockaddr_storage getLocalAddr();
  sockaddr_storage getRemoteAddr();

  // LogBase
  void collectStatus(Handle<Object> ret);
  
  void txPkt(Handle<Object> wr);
  void txPing();

  // local
  void onRxLine(string const &s);
  void onRxJson(Handle<Object> pkt);
  void onConnect(uv_connect_t *req, int status);
  void onRead(ssize_t nread, uv_buf_t buf);
  void onResolve(uv_getaddrinfo_t *resolver, int status, struct addrinfo *res);
  void flushTxQ();
  
  JsonApi *onRx;
  TcpJsonConnRxApi tx;

  enum state_t {
    STATE_CLOSED,
    STATE_RESOLVING,
    STATE_CONNECTING,
    STATE_RW,
    STATE_W,
  } state;

  uv_stream_t *sock;

  deque<Persistent<Object> > txQ;
  string rxLinebuf;

  double lastConnectTs;

  int unrequitedPings;
  double lastPingTxTs;
  double lastPingRxTs;
  double lastPongTxTs;
  double lastPongRxTs;
  double lastRtt;

};

#endif