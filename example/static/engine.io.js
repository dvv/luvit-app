(function () { function require(p){ var path = require.resolve(p) , mod = require.modules[path]; if (!mod) throw new Error('failed to require "' + p + '"'); if (!mod.exports) { mod.exports = {}; mod.call(mod.exports, mod, mod.exports, require.relative(path)); } return mod.exports;}require.modules = {};require.resolve = function(path){ var orig = path , reg = path + '.js' , index = path + '/index.js'; return require.modules[reg] && reg || require.modules[index] && index || orig;};require.register = function(path, fn){ require.modules[path] = fn;};require.relative = function(parent) { return function(p){ if ('.' != p.charAt(0)) return require(p); var path = parent.split('/') , segs = p.split('/'); path.pop(); for (var i = 0; i < segs.length; i++) { var seg = segs[i]; if ('..' == seg) path.pop(); else if ('.' != seg) path.push(seg); } return require(path.join('/')); };};require.register("engine.io-client.js", function(module, exports, require){

/**
 * Client version.
 *
 * @api public.
 */

exports.version = '0.1.0';

/**
 * Protocol version.
 *
 * @api public.
 */

exports.protocol = 1;

/**
 * JSONP callbacks.
 */

exports.j = [];

/**
 * Utils.
 *
 * @api public
 */

exports.util = require('./util');

/**
 * Parser.
 *
 * @api public
 */

exports.parser = require('./parser');

/**
 * Socket constructor.
 *
 * @api public.
 */

exports.Socket = require('./socket');

/**
 * Export EventEmitter.
 */

exports.EventEmitter = require('./event-emitter')

/**
 * Export Transport.
 */

exports.Transport = require('./transport');

/**
 * Export transports
 */

exports.transports = require('./transports');

});require.register("transport.js", function(module, exports, require){

/**
 * Module dependencies.
 */

var util = require('./util')
  , parser = require('./parser')
  , EventEmitter = require('./event-emitter')

/**
 * Module exports.
 */

module.exports = Transport;

/**
 * Transport abstract constructor.
 *
 * @param {Object} options.
 * @api private
 */

function Transport (opts) {
  this.path = opts.path;
  this.host = opts.host;
  this.port = opts.port;
  this.secure = opts.secure;
  this.query = opts.query;
  this.readyState = '';
  this.writeBuffer = [];
};

/**
 * Inherits from EventEmitter.
 */

util.inherits(Transport, EventEmitter);

/**
 * Emits an error.
 *
 * @param {String} str
 * @return {Transport} for chaining
 * @api public
 */

Transport.prototype.onError = function (msg, desc) {
  var err = new Error(msg);
  err.type = 'TransportError';
  err.description = desc;
  this.emit('error', err);
  return this;
};

/**
 * Opens the transport.
 *
 * @api public
 */

Transport.prototype.open = function () {
  if ('closed' == this.readyState || '' == this.readyState) {
    this.readyState = 'opening';
    this.doOpen();
  }

  return this;
};

/**
 * Closes the transport.
 *
 * @api private
 */

Transport.prototype.close = function () {
  if ('opening' == this.readyState || 'open' == this.readyState) {
    this.doClose();
    this.onClose();
  }

  return this;
};

/**
 * Sends a packet.
 *
 * @param {Object} packet
 * @api private
 */

Transport.prototype.send = function (packet) {
  if ('open' == this.readyState) {
    this.writeBuffer.push(packet);
    this.flush();
  } else {
    throw new Error('Transport not open');
  }
};

/**
 * Sends multiple packets.
 *
 * @param {Array} packets
 * @api private
 */

Transport.prototype.sendMany = function (packets) {
  if ('open' == this.readyState) {
    this.writeBuffer.push.apply(this.writeBuffer, packets);
    this.flush();
  } else {
    throw new Error('Transport not open');
  }
}

/**
 * Flushes the send buffer.
 *
 * @api private
 */

Transport.prototype.flush = function () {
  if (this.flushing || !this.writeBuffer.length) return;

  var offset = this.writeBuffer.length
    , self = this

  this.flushing = true;
  // debug: flushing transport buffer with %d items, this.writeBuffer.length
  this.write(this.writeBuffer, function () {
    self.writeBuffer.splice(0, offset);
    self.flushing = false;
    self.emit('flush');

    if (self.writeBuffer.length) {
      // debug: flushing again
      self.flush();
    } else {
      // debug: flush drained
      self.emit('drain');
    }
  });
};

/**
 * Called upon open
 *
 * @api private
 */

Transport.prototype.onOpen = function () {
  this.readyState = 'open';
  this.flush();
  this.emit('open');
};

/**
 * Called with data.
 *
 * @param {String} data
 * @api private
 */

Transport.prototype.onData = function (data) {
  this.onPacket(parser.decodePacket(data));
};

/**
 * Called with a decoded packet.
 */

Transport.prototype.onPacket = function (packet) {
  this.emit('packet', packet);
};

/**
 * Called upon close.
 *
 * @api private
 */

Transport.prototype.onClose = function () {
  this.readyState = 'closed';
  this.emit('close');
};

});require.register("transports/websocket.js", function(module, exports, require){

/**
 * Module dependencies.
 */

var Transport = require('../transport')
  , parser = require('../parser')
  , util = require('../util')
  , global = this

/**
 * Module exports.
 */

module.exports = WS;

/**
 * WebSocket transport constructor.
 *
 * @api {Object} connection options
 * @api public
 */

function WS (opts) {
  Transport.call(this, opts);
};

/**
 * Inherits from Transport.
 */

util.inherits(WS, Transport);

/**
 * Transport name.
 *
 * @api public
 */

WS.prototype.name = 'websocket';

/**
 * Opens socket.
 *
 * @api private
 */

WS.prototype.doOpen = function () {
  if (!check()) {
    // let probe timeout
    return;
  }

  var self = this;

  this.socket = new (ws())(this.uri());
  this.socket.onopen = function () {
    self.onOpen();
  };
  this.socket.onclose = function () {
    self.onClose();
  };
  this.socket.onmessage = function (ev) {
    self.onData(ev.data);
  };
  this.socket.onerror = function (e) {
    self.onError('websocket error', e);
  };
};

/**
 * Writes data to socket.
 *
 * @param {Array} array of packets.
 * @param {Function} drain callback.
 * @api private
 */

WS.prototype.write = function (packets, fn) {
  for (var i = 0, l = packets.length; i < l; i++) {
    this.socket.send(parser.encodePacket(packets[i]));
  }
  fn();
};

/**
 * Closes socket.
 *
 * @api private
 */

WS.prototype.doClose = function () {
  this.socket.close();
};

/**
 * Generates uri for connection.
 *
 * @api private
 */

WS.prototype.uri = function () {
  var query = util.qs(this.query)
    , schema = this.secure ? 'wss' : 'ws'
    , port = ''

  // avoid port if default for schema
  if (this.port && (('wss' == schema && this.port != 443)
    || ('ws' == schema && this.port != 80))) {
    port = ':' + this.port;
  }

  // prepend ? to query
  if (query.length) {
    query = '?' + query;
  }

  return schema + '://' + this.host + port + this.path + query;
};

/**
 * Getter for WS constructor.
 *
 * @api private
 */

function ws () {




  return global.WebSocket || global.MozWebSocket;
}

/**
 * Feature detection for WebSocket.
 *
 * @return {Boolean} whether this transport is available.
 * @api public
 */

function check () {
  return !!ws();
}

});require.register("transports/polling.js", function(module, exports, require){

/**
 * Module dependencies.
 */

var Transport = require('../transport')
  , XHR = require('./polling-xhr')
  , JSON = require('./polling-jsonp')
  , util = require('../util')
  , parser = require('../parser')
  , global = this

/**
 * Module exports.
 */

module.exports = Polling;

/**
 * Polling interface.
 *
 * @param {Object} opts
 * @api private
 */

function Polling (opts) {
  Transport.call(this, opts);
}

/**
 * Inherits from Transport.
 */

util.inherits(Polling, Transport);

/**
 * Transport name.
 */

Polling.prototype.name = 'polling';

/**
 * Opens the socket (triggers polling). We write a PING message to determine
 * when the transport is open.
 *
 * @api private
 */

Polling.prototype.doOpen = function () {
  this.poll();
};

/**
 * Pauses polling.
 *
 * @param {Function} callback upon buffers are flushed and transport is paused
 * @api private
 */

Polling.prototype.pause = function (onPause) {
  var pending = 0
    , self = this

  this.readyState = 'pausing';

  function pause () {
    if (!--pending) {
      self.readyState = 'paused';
      onPause();
    }
  }

  if (this.polling) {
    pending++;
    this.once('data', function () {
      --pending || pause();
    });
  }

  if (this.writeBuffer.length) {
    pending++;
    this.once('drain', function () {
      --pending || pause();
    });
  }
};

/**
 * Starts polling cycle.
 *
 * @api public
 */

Polling.prototype.poll = function () {
  this.polling = true;
  this.doPoll();
};

/**
 * Overloads onData to detect payloads.
 *
 * @api private
 */

Polling.prototype.onData = function (data) {
  // if we got data we're not polling
  this.polling = false;
  this.emit('poll');

  // decode payload
  var packets = parser.decodePayload(data);

  for (var i = 0, l = packets.length; i < l; i++) {
    // if its the first message we consider the trnasport open
    if ('opening' == this.readyState) {
      this.onOpen();
    }

    // if its a close packet, we close the ongoing requests
    if ('close' == packets[i].type) {
      this.onClose();
      return;
    }

    // otherwise bypass onData and handle the message
    this.onPacket(packets[i]);
  }

  if ('open' == this.readyState) {
    // trigger next poll
    this.poll();
  } else {
    // debug: ignoring poll - transport state "%s", this.readyState
  }
};

/**
 * For polling, send a close packet.
 *
 * @api private
 */

Polling.prototype.doClose = function () {
  // debug: sending close packet
  this.send({ type: 'close' });
};

/**
 * Writes a packets payload.
 *
 * @param {Array} data packets
 * @param {Function} drain callback
 * @api private
 */

Polling.prototype.write = function (packets, fn) {
  this.doWrite(parser.encodePayload(packets), fn);
};

/**
 * Generates uri for connection.
 *
 * @api private
 */

Polling.prototype.uri = function () {
  var query = util.qs(this.query)
    , schema = this.secure ? 'https' : 'http'
    , port = ''

  // avoid port if default for schema
  if (this.port && (('https' == schema && this.port != 443)
    || ('http' == schema && this.port != 80))) {
    port = ':' + this.port;
  }

  // prepend ? to query
  if (query.length) {
    query = '?' + query;
  }

  return schema + '://' + this.host + port + this.path + query;
};

});require.register("transports/polling-xhr.js", function(module, exports, require){

/**
 * Module requirements.
 */

var Polling = require('./polling')
  , EventEmitter = require('../event-emitter')
  , util = require('../util')
  , global = this

/**
 * Module exports.
 */

module.exports = XHR;
module.exports.Request = Request;

/**
 * Empty function
 */

function empty () { }

/**
 * XHR Polling constructor.
 *
 * @param {Object} opts
 * @api public
 */

function XHR (opts) {
  Polling.call(this, opts);

  if (global.location) {
    this.xd = opts.host != global.location.hostname
      || global.location.port != opts.port;
  }

  // cache busting for IE
  if (global.ActiveXObject) {
    this.query.t = +new Date;
  }
};

/**
 * Inherits from Polling.
 */

util.inherits(XHR, Polling);

/**
 * Opens the socket
 *
 * @api private
 */

XHR.prototype.doOpen = function () {
  var self = this;
  util.defer(function () {
    Polling.prototype.doOpen.call(self);
  });
};

/**
 * Creates a request.
 *
 * @param {String} method
 * @api private
 */

XHR.prototype.request = function (opts) {
  opts = opts || {};
  opts.uri = this.uri();
  opts.xd = this.xd;
  return new Request(opts);
};

/**
 * Sends data.
 *
 * @param {String} data to send.
 * @param {Function} called upon flush.
 * @api private
 */

XHR.prototype.doWrite = function (data, fn) {
  var req = this.request({ method: 'POST', data: data })
    , self = this
  req.on('success', fn);
  req.on('error', function (err) {
    self.onError('xhr post error', err);
  });
  this.sendXhr = req;
};

/**
 * Starts a poll cycle.
 *
 * @api private
 */

XHR.prototype.doPoll = function () {
  // debug: xhr poll
  var req = this.request()
    , self = this
  req.on('data', function (data) {
    self.onData(data);
  });
  req.on('error', function (err) {
    self.onError('xhr poll error', err);
  });
  this.pollXhr = req;
};

/**
 * Request constructor
 *
 * @param {Object} options
 * @api public
 */

function Request (opts) {
  this.method = opts.method || 'GET';
  this.uri = opts.uri;
  this.xd = !!opts.xd;
  this.async = false !== opts.async;
  this.data = undefined != opts.data ? opts.data : null;
  this.create();
}

/**
 * Inherits from Polling.
 */

util.inherits(Request, EventEmitter);

/**
 * Creates the XHR object and sends the request.
 *
 * @api private
 */

Request.prototype.create = function () {
  var xhr = this.xhr = util.request(this.xd)
    , self = this

  xhr.open(this.method, this.uri, this.async);

  if ('POST' == this.method) {
    try {
      if (xhr.setRequestHeader) {
        // xmlhttprequest
        xhr.setRequestHeader('Content-type', 'text/plain;charset=UTF-8');
      } else {
        // xdomainrequest
        xhr.contentType = 'text/plain';
      }
    } catch (e) {}
  }

  if (this.xd && global.XDomainRequest && xhr instanceof XDomainRequest) {
    xhr.onerror = function (e) {
      self.onError(e);
    };
    xhr.onload = function () {
      self.onData(xhr.responseText);
    };
    xhr.onprogress = empty;
  } else {
    xhr.withCredentials = true;
    xhr.onreadystatechange = function () {
      var data;

      try {
        if (xhr.readyState != 4) return;
        if (200 == xhr.status) {
          data = xhr.responseText;
        } else {
          var err = new Error;
          err.code = xhr.status;
          err.type = 'StatusError';
          self.onError(err);
        }
      } catch (e) {
        self.onError(e);
      }

      if (undefined != data) {
        self.onData(data);
      }
    };
  }

  // debug: sending xhr with url %s | data %s, this.uri, this.data
  xhr.send(this.data);

  if (global.ActiveXObject) {
    this.index = Request.requestsCount++;
    Request.requests[this.index] = this;
  }
};

/**
 * Called upon successful response.
 *
 * @api private
 */

Request.prototype.onSuccess = function () {
  this.emit('success');
  this.cleanup();
}

/**
 * Called if we have data.
 *
 * @api private
 */

Request.prototype.onData = function (data) {
  this.emit('data', data);
  this.onSuccess();
}

/**
 * Called upon error.
 *
 * @api private
 */

Request.prototype.onError = function (err) {
  this.emit('error', err);
  this.cleanup();
}

/**
 * Cleans up house.
 *
 * @api private
 */

Request.prototype.cleanup = function () {
  // xmlhttprequest
  this.xhr.onreadystatechange = empty;

  // xdomainrequest
  this.xhr.onload = this.xhr.onerror = empty;

  try {
    this.xhr.abort();
  } catch(e) {}

  if (global.ActiveXObject) {
    delete Browser.requests[this.index];
  }

  this.xhr = null;
}

/**
 * Aborts the request.
 *
 * @api public
 */

Request.prototype.abort = function () {
  this.cleanup();
};

if (global.ActiveXObject) {
  Request.requestsCount = 0;
  Request.requests = {};

  global.attachEvent('onunload', function () {
    for (var i in Request.requests) {
      if (Request.requests.hasOwnProperty(i)) {
        Request.requests[i].abort();
      }
    }
  });
}

});require.register("transports/flashsocket.js", function(module, exports, require){

/**
 * Module dependencies.
 */

var WebSocket = require('./websocket')
  , util = require('../util')

/**
 * Module exports.
 */

module.exports = FlashWS;

/**
 * Noop.
 */

function empty () { }

/**
 * FlashWS constructor.
 *
 * @api public
 */

function FlashWS (options) {
  WebSocket.call(this, options);
};

/**
 * Inherits from WebSocket.
 */

util.inherits(FlashWS, WebSocket);

/**
 * Transport name.
 *
 * @api public
 */

FlashWS.prototype.name = 'flashsocket';

/**
 * Opens the transport.
 *
 * @api public
 */

FlashWS.prototype.doOpen = function () {
  if (!check()) {
    // let the probe timeout
    return;
  }

  var base = io.enginePath + '/support/web-socket-js/'
    , self = this

  function log (type) {
    return function (msg) {
      return self.log[type](msg);
    }
  };

  // TODO: proxy logging to client logger
  WEB_SOCKET_LOGGER = { log: log('debug'), error: log('error') };
  WEB_SOCKET_SWF_LOCATION = base + '/WebSocketMainInsecure.swf';
  WEB_SOCKET_SUPPRESS_CROSS_DOMAIN_SWF_ERROR = true;

  load(base + 'swfobject.js', base + 'web_socket.js', function () {
    FlashWs.prototype.doOpen.call(self);
  });
};

/**
 * Feature detection for FlashSocket.
 *
 * @return {Boolean} whether this transport is available.
 * @api public
 */

function check () {




  for (var i = 0, l = navigator.plugins.length; i < l; i++) {
    if (navigator.plugins[i].indexOf('Shockwave Flash')) {
      return true;
    }
  }

  return false;
};

/**
 * Lazy loading of scripts.
 * Based on $script by Dustin Diaz - MIT
 */

var scripts = {};

/**
 * Injects a script. Keeps tracked of injected ones.
 *
 * @param {String} path
 * @param {Function} callback
 * @api private
 */

function create (path, fn) {
  if (scripts[path]) return fn();

  var el = doc.createElement('script')
    , loaded = false

  el.onload = el.onreadystatechange = function () {
    var rs = el.readyState;

    if ((!rs || rs == 'loaded' || rs == 'complete') && !loaded) {
      el.onload = el.onreadystatechange = null;
      loaded = 1;
      // prevent double execution across multiple instances
      scripts[path] = true;
      fn();
    }
  };

  el.async = 1;
  el.src = path;

  head.insertBefore(el, head.firstChild);
};

/**
 * Loads scripts and fires a callback.
 *
 * @param {String} path (can be multiple parameters)
 * @param {Function} callback
 */

function load () {
  var total = arguments.length - 1
    , fn = arguments[total]

  for (var i = 0, l = total; i < l; i++) {
    create(arguments[i], function () {
      --total || fn();
    });
  }
};

});require.register("transports/index.js", function(module, exports, require){

/**
 * Module dependencies
 */

var XHR = require('./polling-xhr')
  , JSONP = require('./polling-jsonp')
  , websocket = require('./websocket')
  , flashsocket = require('./flashsocket')
  , util = require('../util')
  , global = this

/**
 * Export transports.
 */

exports.polling = polling;
exports.websocket = websocket;
exports.flashsocket = flashsocket;

/**
 * Polling transport polymorphic constructor.
 * Decides on xhr vs jsonp based on feature detection.
 *
 * @api private
 */

function polling (opts) {
  var xd = false;

  if (global.location) {
    xd = opts.host != global.location.hostname
      || global.location.port != opts.port;
  }

  if (util.request(xd) && !opts.forceJSONP) {
    return new XHR(opts);
  } else {
    return new JSONP(opts);
  }
};

});require.register("transports/polling-jsonp.js", function(module, exports, require){

/**
 * Module requirements.
 */

var Polling = require('./polling')
  , util = require('../util')

/**
 * Module exports.
 */

module.exports = JSONPPolling;

/**
 * Cached regular expressions.
 */

var rNewline = /\n/g

/**
 * Noop.
 */

function empty () { }

/**
 * JSONP Polling constructor.
 *
 * @param {Object} opts.
 * @api public
 */

function JSONPPolling (opts) {
  Transport.call(this, opts);

  // add callback to jsonp global
  var self = this;
  eio.j.push(function (msg) {
    self.onData(msg);
  });

  // append to query string
  this.query.j = eio.j.length - 1;
};

/**
 * Inherits from Polling.
 */

util.inherits(JSONPPolling, Polling);

/**
 * Opens the socket.
 *
 * @api private
 */

JSONPPolling.prototype.doOpen = function () {
  var self = this;
  util.defer(function () {
    Polling.prototype.doOpen.call(self);
  });
};

/**
 * Closes the socket
 *
 * @api private
 */

JSONPPolling.prototype.doClose = function () {
  if (this.script) {
    this.script.parentNode.removeChild(this.script);
    this.script = null;
  }

  if (this.form) {
    this.form.parentNode.removeChild(this.form);
    this.form = null;
  }

  Polling.prototype.doClose.call(this);
};

/**
 * Starts a poll cycle.
 *
 * @api private
 */

JSONPPolling.prototype.doPoll = function () {
  var script = document.createElement('script');

  if (this.script) {
    this.script.parentNode.removeChild(this.script);
    this.script = null;
  }

  script.async = true;
  script.src = this.uri();

  var insertAt = document.getElementsByTagName('script')[0]
  insertAt.parentNode.insertBefore(script, insertAt);
  this.script = script;

  if (util.ua.gecko) {
    setTimeout(function () {
      var iframe = document.createElement('iframe');
      document.body.appendChild(iframe);
      document.body.removeChild(iframe);
    }, 100);
  }
};

/**
 * Writes with a hidden iframe.
 *
 * @param {String} data to send
 * @param {Function} called upon flush.
 * @api private
 */

JSONPPolling.prototype.doWrite = function (data, fn) {
  var self = this

  if (!this.form) {
    var form = document.createElement('form')
      , area = document.createElement('textarea')
      , id = this.iframeId = 'socketio_iframe_' + this.index
      , iframe;

    form.className = 'socketio';
    form.style.position = 'absolute';
    form.style.top = '-1000px';
    form.style.left = '-1000px';
    form.target = id;
    form.method = 'POST';
    form.setAttribute('accept-charset', 'utf-8');
    area.name = 'd';
    form.appendChild(area);
    document.body.appendChild(form);

    this.form = form;
    this.area = area;
  }

  this.form.action = this.uri();

  function complete () {
    initIframe();
    fn();
  };

  function initIframe () {
    if (self.iframe) {
      self.form.removeChild(self.iframe);
    }

    try {
      // ie6 dynamic iframes with target="" support (thanks Chris Lambacher)
      iframe = document.createElement('<iframe name="'+ self.iframeId +'">');
    } catch (e) {
      iframe = document.createElement('iframe');
      iframe.name = self.iframeId;
    }

    iframe.id = self.iframeId;

    self.form.appendChild(iframe);
    self.iframe = iframe;
  };

  initIframe();

  // escape \n to prevent it from being converted into \r\n by some UAs
  this.area.value = data.replace(rNewline, '\\n');

  try {
    this.form.submit();
  } catch(e) {}

  if (this.iframe.attachEvent) {
    iframe.onreadystatechange = function () {
      if (self.iframe.readyState == 'complete') {
        complete();
      }
    };
  } else {
    this.iframe.onload = complete;
  }
};

});require.register("event-emitter.js", function(module, exports, require){

/**
 * Module exports.
 */

module.exports = EventEmitter;

/**
 * Event emitter constructor.
 *
 * @api public.
 */

function EventEmitter () {};

/**
 * Adds a listener
 *
 * @api public
 */

EventEmitter.prototype.on = function (name, fn) {
  if (!this.$events) {
    this.$events = {};
  }

  if (!this.$events[name]) {
    this.$events[name] = fn;
  } else if (isArray(this.$events[name])) {
    this.$events[name].push(fn);
  } else {
    this.$events[name] = [this.$events[name], fn];
  }

  return this;
};

EventEmitter.prototype.addListener = EventEmitter.prototype.on;

/**
 * Adds a volatile listener.
 *
 * @api public
 */

EventEmitter.prototype.once = function (name, fn) {
  var self = this;

  function on () {
    self.removeListener(name, on);
    fn.apply(this, arguments);
  };

  on.listener = fn;
  this.on(name, on);

  return this;
};

/**
 * Removes a listener.
 *
 * @api public
 */

EventEmitter.prototype.removeListener = function (name, fn) {
  if (this.$events && this.$events[name]) {
    var list = this.$events[name];

    if (isArray(list)) {
      var pos = -1;

      for (var i = 0, l = list.length; i < l; i++) {
        if (list[i] === fn || (list[i].listener && list[i].listener === fn)) {
          pos = i;
          break;
        }
      }

      if (pos < 0) {
        return this;
      }

      list.splice(pos, 1);

      if (!list.length) {
        delete this.$events[name];
      }
    } else if (list === fn || (list.listener && list.listener === fn)) {
      delete this.$events[name];
    }
  }

  return this;
};

/**
 * Removes all listeners for an event.
 *
 * @api public
 */

EventEmitter.prototype.removeAllListeners = function (name) {
  if (name === undefined) {
    this.$events = {};
    return this;
  }

  if (this.$events && this.$events[name]) {
    this.$events[name] = null;
  }

  return this;
};

/**
 * Gets all listeners for a certain event.
 *
 * @api publci
 */

EventEmitter.prototype.listeners = function (name) {
  if (!this.$events) {
    this.$events = {};
  }

  if (!this.$events[name]) {
    this.$events[name] = [];
  }

  if (!isArray(this.$events[name])) {
    this.$events[name] = [this.$events[name]];
  }

  return this.$events[name];
};

/**
 * Emits an event.
 *
 * @api public
 */

EventEmitter.prototype.emit = function (name) {
  if (!this.$events) {
    return false;
  }

  var handler = this.$events[name];

  if (!handler) {
    return false;
  }

  var args = Array.prototype.slice.call(arguments, 1);

  if ('function' == typeof handler) {
    handler.apply(this, args);
  } else if (isArray(handler)) {
    var listeners = handler.slice();

    for (var i = 0, l = listeners.length; i < l; i++) {
      listeners[i].apply(this, args);
    }
  } else {
    return false;
  }

  return true;
};

/**
 * Checks for Array type.
 *
 * @param {Object} object
 * @api private
 */

function isArray (obj) {
  return '[object Array]' == Object.prototype.toString.call(obj);
};

/**
 * Compatibility with WebSocket
 */

EventEmitter.prototype.addEventListener = EventEmitter.prototype.on;
EventEmitter.prototype.removeEventListener = EventEmitter.prototype.removeListener;
EventEmitter.prototype.dispatchEvent = EventEmitter.prototype.emit;

});require.register("socket.js", function(module, exports, require){

/**
 * Module dependencies.
 */

var util = require('./util')
  , transports = require('./transports')
  , EventEmitter = require('./event-emitter')

/**
 * Module exports.
 */

module.exports = Socket;

/**
 * Socket constructor.
 *
 * @param {Object} options
 * @api public
 */

function Socket (opts) {
  if ('string' == typeof opts) {
    var uri = util.parseUri(opts);
    opts = arguments[1] || {};
    opts.host = uri.host;
    opts.secure = uri.scheme == 'https' || uri.scheme == 'wss';
    opts.port = uri.port || (opts.secure ? 443 : 80);
  }

  opts = opts || {};

  this.host = opts.host || opts.hostname || 'localhost';
  this.port = opts.port || 80;
  this.query = opts.query || {};
  this.query.uid = rnd();
  this.upgrade = false !== opts.upgrade;
  this.path = opts.path || '/engine.io'
  this.forceJSONP = !!opts.forceJSONP;
  this.transports = opts.transports || ['polling', 'websocket', 'flashsocket'];
  this.readyState = '';
  this.writeBuffer = [];

  this.open();
};

/**
 * Inherits from EventEmitter.
 */

util.inherits(Socket, EventEmitter);

/**
 * Creates transport of the given type.
 *
 * @param {String} transport name
 * @return {Transport}
 * @api private
 */

Socket.prototype.createTransport = function (name) {
  // debug: creating transport "%s", name
  var query = clone(this.query)
  query.transport = name;

  if (this.sid) {
    query.sid = this.sid;
  }

  var transport = new transports[name]({
      host: this.host
    , port: this.port
    , secure: this.secure
    , path: this.path
    , query: query
    , forceJSONP: this.forceJSONP
  });

  return transport;
};

function clone (obj) {
  var o = {};
  for (var i in obj) {
    if (obj.hasOwnProperty(i)) {
      o[i] = obj[i];
    }
  }
  return o;
}

/**
 * Initializes transport to use and starts probe.
 *
 * @api private
 */

Socket.prototype.open = function () {
  this.readyState = 'opening';
  var transport = this.createTransport(this.transports[0]);
  transport.open();
  this.setTransport(transport);
};

/**
 * Sets the current transport. Disables the existing one (if any).
 *
 * @api private
 */

Socket.prototype.setTransport = function (transport) {
  var self = this;

  if (this.transport) {
    // debug: clearing existing transport
    this.transport.removeAllListeners();
  }

  // set up transport
  this.transport = transport;

  // set up transport listeners
  transport
    .on('packet', function (packet) {
      self.onPacket(packet);
    })
    .on('error', function (e) {
      self.onError(e);
    })
    .on('close', function () {
      self.onClose('transport close');
    })
};

/**
 * Probes a transport.
 *
 * @param {String} transport name
 * @api private
 */

Socket.prototype.probe = function (name) {
  // debug: probing transport "%s", name
  var transport = this.createTransport(name, { probe: 1 })
    , self = this

  transport.once('open', function () {
    // debug: probe transport "%s" opened - pinging, name
    transport.send({ type: 'ping', data: 'probe' });
    transport.once('message', function (msg) {
      if ('pong' == msg.type && 'probe' == msg.data) {
        // debug: probe transport "%s" pong - upgrading, name
        self.upgrading = true;
        self.emit('upgrading', name);

        // debug: pausing current transport "%s", self.transport.name
        self.transport.pause(function () {
          self.setTransport(self.transport);
          self.upgrading = false;
          self.flush();
          self.emit('upgrade', name);
        });
      } else {
        // debug: probe transport "%s" failed, name
        var err = new Error('probe error');
        err.transport = transport.name;
        self.emit('error', err);
      }
    });
  });

  transport.open();

  this.once('close', function () {
    // debug: socket closed prematurely - aborting probe
    transport.close();
  });

  this.once('upgrading', function (to) {
    if (to != name) {
      // debug: probe for "%s" succeeded - aborting "%s", to, name
      transport.close();
    }
  });
};

/**
 * Called when connection is deemed open.
 *
 * @api public
 */

Socket.prototype.onOpen = function () {
  // debug: socket open
  this.readyState = 'open';
  this.emit('open');
  this.onopen && this.onopen.call(this);
  this.flush();

  if (this.upgrade && this.transport.pause) {
    // debug: starting upgrade probes
    for (var i = 0, l = this.upgrades.length; i < l; i++) {
      this.probe(this.upgrades[i]);
    }
  }
};

/**
 * Handles a packet.
 *
 * @api private
 */

Socket.prototype.onPacket = function (packet) {
  if ('opening' == this.readyState || 'open' == this.readyState) {
    // debug: socket receive: type "%s" | data "%s", packet.type, packet.data
    switch (packet.type) {
      case 'open':
        this.onHandshake(util.parseJSON(packet.data));
        break;

      case 'ping':
        this.sendPacket('pong');
        this.setPingTimeout();
        break;

      case 'error':
        var err = new Error('server error');
        err.code = packet.data;
        this.emit('error', err);
        break;

      case 'message':
        this.emit('message', packet.data);
        this.onmessage && this.onmessage.call(this, packet.data);
        break;
    }
  } else {
    // debug: packet received with socket readyState "%s", this.readyState
  }
};

/**
 * Called upon handshake completion.
 *
 * @param {Object} handshake obj
 * @api private
 */

Socket.prototype.onHandshake = function (data) {
  this.emit('handshake', data);
  this.sid = data.sid;
  this.transport.query.sid = data.sid;
  this.upgrades = data.upgrades;
  this.pingTimeout = data.pingTimeout;
  this.pingInterval = data.pingInterval;
  this.onOpen();
  this.setPingTimeout();
};

/**
 * Clears and sets a ping timeout based on the expected ping interval.
 *
 * @api private
 */

Socket.prototype.setPingTimeout = function () {
  clearTimeout(this.pingTimeoutTimer);
  var self = this;
  this.pingTimeoutTimer = setTimeout(function () {
    self.onClose('ping timeout');
  }, this.pingInterval);
};

/**
 * Flush write buffers.
 *
 * @api private
 */

Socket.prototype.flush = function () {
  if (this.writeBuffer.length) {
    // debug: flushing %d packets in socket, this.writeBuffer.length
    this.transport.sendMany(this.writeBuffer);
    this.writeBuffer = [];
  }
};

/**
 * Sends a message.
 *
 * @param {String} message.
 * @return {Socket} for chaining.
 * @api public
 */

Socket.prototype.send = function (msg) {
  this.sendPacket('message', msg);
  return this;
};

/**
 * Sends a packet.
 *
 * @param {String} packet type.
 * @param {String} data.
 * @api private
 */

Socket.prototype.sendPacket = function (type, data) {
  var packet = { type: type, data: data };
  if ('open' != this.readyState || this.upgrading) {
    // debug: socket send - buffering packet: type "%s" | data "%s", type, data
    this.writeBuffer.push(packet);
  } else {
    // debug: socket send - transporting: type "%s" | data "%s", type, data
    this.transport.send(packet);
  }
};

/**
 * Closes the connection.
 *
 * @api private
 */

Socket.prototype.close = function () {
  if ('opening' == this.readyState || 'open' == this.readyState) {
    this.onClose('forced close');
    // debug: socket closing - telling transport to close
    this.transport.close();
  }

  return this;
};

/**
 * Called upon transport error
 *
 * @api private
 */

Socket.prototype.onError = function (err) {
  this.emit('error', err);
  this.onClose('transport error', err);
};

/**
 * Called upon transport close.
 *
 * @api private
 */

Socket.prototype.onClose = function (reason, desc) {
  if ('closed' != this.readyState) {
    // debug: socket close
    this.readyState = 'closed';
    this.emit('close', reason, desc);
    this.onclose && this.onclose.call(this);
  }
};

/**
 * Generates a random uid.
 *
 * @api private
 */

function rnd () {
  return String(Math.random()).substr(5) + String(Math.random()).substr(5);
}

});require.register("parser.js", function(module, exports, require){

/**
 * Packet types.
 */

var packets = exports.packets = {
    open:     0    // non-ws
  , close:    1    // non-ws
  , ping:     2
  , pong:     3
  , message:  4
  , error:    5
  , noop:     6
};

var packetslist = Object.keys(packets);

/**
 * Premade error packet.
 */

var err = { type: 'error', data: 'parser error' }

/**
 * Encodes a packet.
 *
 *     <packet type id> [ `:` <data> ]
 *
 * Example:
 *
 *     5:hello world
 *     3
 *     4
 *
 * @api private
 */

exports.encodePacket = function (packet) {
  var encoded = packets[packet.type]

  // data fragment is optional
  if (undefined !== packet.data) {
    encoded += ':' + packet.data;
  }

  return '' + encoded;
};

/**
 * Decodes a packet.
 *
 * @return {Object} with `type` and `data` (if any)
 * @api private
 */

exports.decodePacket = function (data) {
  if (':' === data[1]) {
    var pieces = data.match(/([0-9]+):(.*)?/)

    if (!pieces) {
      // parser error - ignoring packet
      return err;
    }

    var type = pieces[1]
      , data = pieces[2]

    if (!packetslist[type]) {
      // parser error - ignoring packet
      return err;
    }

    return { type: packetslist[type], data: undefined === data ? '' : data };
  } else {
    if (Number(data) != data || !packetslist[data]) return err;
    return { type: packetslist[data] };
  }
};

/**
 * Encodes multiple messages (payload).
 * 
 *     <length>:data
 *
 * Example:
 *
 *     11:hello world2:hi
 *
 * @param {Array} packets
 * @api private
 */

exports.encodePayload = function (packets) {
  if (!packets.length) {
    return '0:';
  }

  var encoded = ''
    , message

  for (var i = 0, l = packets.length; i < l; i++) {
    message = exports.encodePacket(packets[i]);
    encoded += message.length + ':' + message;
  }

  return encoded;
};

/*
 * Decodes data when a payload is maybe expected.
 *
 * @param {String} data
 * @return {Array} packets
 * @api public
 */

exports.decodePayload = function (data) {
  if (data == '') {
    // parser error - ignoring payload
    return [err];
  }

  var packets = []
    , length = ''
    , n, msg, packet

  for (var i = 0, l = data.length; i < l; i++) {
    var chr = data[i]

    if (':' != chr) {
      length += chr;
    } else {
      if ('' == length || (length != (n = Number(length)))) {
        // parser error - ignoring payload
        return [err];
      }

      msg = data.substr(i + 1, n);

      if (length != msg.length) {
        // parser error - ignoring payload
        return [err];
      }

      if (msg.length) {
        packet = exports.decodePacket(msg);

        if (err.type == packet.type && err.data == packet.data) {
          // parser error in individual packet - ignoring payload
          return [err];
        }

        packets.push(packet);
      }

      // advance cursor
      i += n;
      length = ''
    }
  }

  if (length != '') {
    // parser error - ignoring payload
    return [err];
  }

  return packets;
};

});require.register("util.js", function(module, exports, require){

/**
 * Reference to global object.
 */

var global = this;

/**
 * Status of page load.
 */

var pageLoaded = false;

/**
 * Inheritance.
 *
 * @param {Function} ctor a
 * @param {Function} ctor b
 * @api private
 */

exports.inherits = function inherits (a, b) {
  function c () { }
  c.prototype = b.prototype;
  a.prototype = new c;
};

/**
 * Adds an event.
 *
 * @api private
 */

exports.on = function (element, event, fn, capture) {
  if (element.attachEvent) {
    element.attachEvent('on' + event, fn);
  } else if (element.addEventListener) {
    element.addEventListener(event, fn, capture);
  }
};

/**
 * Load utility.
 *
 * @api private
 */

exports.load = function (fn) {
  if (global.document && document.readyState === 'complete' || pageLoaded) {
    return fn();
  }

  exports.on(global, 'load', fn, false);
};

/**
 * Change the internal pageLoaded value.
 */

if ('undefined' != typeof window) {
  exports.load(function () {
    pageLoaded = true;
  });
}

/**
 * Defers a function to ensure a spinner is not displayed by the browser.
 *
 * @param {Function} fn
 * @api private
 */

exports.defer = function (fn) {
  if (!exports.ua.webkit || 'undefined' != typeof importScripts) {
    return fn();
  }

  exports.load(function () {
    setTimeout(fn, 100);
  });
};

/**
 * JSON parse.
 *
 * @see Based on jQuery#parseJSON (MIT) and JSON2
 * @api private
 */

var rvalidchars = /^[\],:{}\s]*$/
  , rvalidescape = /\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g
  , rvalidtokens = /"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g
  , rvalidbraces = /(?:^|:|,)(?:\s*\[)+/g
  , rtrimLeft = /^\s+/
  , rtrimRight = /\s+$/

exports.parseJSON = function (data) {
  if ('string' != typeof data || !data) {
    return null;
  }

  data = data.replace(rtrimLeft, '').replace(rtrimRight, '');

  // Attempt to parse using the native JSON parser first
  if (global.JSON && JSON.parse) {
    return JSON.parse(data);
  }

  if (rvalidchars.test(data.replace(rvalidescape, '@')
      .replace(rvalidtokens, ']')
      .replace(rvalidbraces, ''))) {
    return (new Function('return ' + data))();
  }
};

/**
 * UA / engines detection namespace.
 *
 * @namespace
 */

exports.ua = {};

/**
 * Whether the UA supports CORS for XHR.
 *
 * @api private
 */

exports.ua.hasCORS = 'undefined' != typeof XMLHttpRequest && (function () {
  try {
    var a = new XMLHttpRequest();
  } catch (e) {
    return false;
  }

  return a.withCredentials != undefined;
})();

/**
 * Detect webkit.
 *
 * @api private
 */

exports.ua.webkit = 'undefined' != typeof navigator &&
  /webkit/i.test(navigator.userAgent);

/**
 * Detect gecko.
 *
 * @api private
 */

exports.ua.gecko = 'undefined' != typeof navigator && 
  /gecko/i.test(navigator.userAgent);

/**
 * XHR request helper.
 *
 * @param {Boolean} whether we need xdomain
 * @api private
 */

exports.request = function request (xdomain) {





  if (xdomain && 'undefined' != typeof XDomainRequest) {
    return new XDomainRequest();
  }

  // XMLHttpRequest can be disabled on IE
  try {
    if ('undefined' != typeof XMLHttpRequest && (!xdomain || exports.ua.hasCORS)) {
      return new XMLHttpRequest();
    }
  } catch (e) { }

  if (!xdomain) {
    try {
      return new ActiveXObject('Microsoft.XMLHTTP');
    } catch(e) { }
  }
};

/**
 * Parses an URI
 *
 * @author Steven Levithan <stevenlevithan.com> (MIT license)
 * @api private
 */

var re = /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/;

var parts = [
    'source', 'protocol', 'authority', 'userInfo', 'user', 'password', 'host'
  , 'port', 'relative', 'path', 'directory', 'file', 'query', 'anchor'
];

exports.parseUri = function (str) {
  var m = re.exec(str || '')
    , uri = {}
    , i = 14;

  while (i--) {
    uri[parts[i]] = m[i] || '';
  }

  return uri;
};

/**
 * Compiles a querystring
 *
 * @param {Object} 
 * @api private
 */

exports.qs = function (obj) {
  var str = '';

  for (var i in obj) {
    if (obj.hasOwnProperty(i)) {
      if (str.length) str += '&';
      str += i + '=' + encodeURIComponent(obj[i]);
    }
  }

  return str;
};

});eio = require('engine.io-client');
})();