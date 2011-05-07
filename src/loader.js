function _log () {
    try {
        console.log.apply(console, arguments);
    } catch (ex) {}
}

/*
 * loader
 */

var require, module;
(function () {
if (require || module) return;

/*
{
name: 'a.b.c',
url: 'xx',
config: 'app',
factory: function () {},
module: function () {},
_getm: function () {}
}
*/
var _mods = {},
    _reqs = [];

var now = Date.now || (function() {
        return new Date().getTime();
    }),
    slice = Array.prototype.slice,
    head = document.getElementsByTagName('head')[0];

var _config = {
        '_': {
            path: '/js/?.js'
        }
    },

    EMPTY = 1,
    LOADING = 2,
    LOADED = 3,
    INIT = 4,

    re_mod_name = /^(.+)(?:@(.+))?$/;


function _merge (r, s) {
    if (!s || !r) {
        return r || s;
    }

    for (var i in s) {
        if (s.hasOwnProperty(i)) {
            r[i] = s[i];
        }
    }

    return r;
}

function _get_module () {
    var mod = this;

    if (mod.module) {
        return mod.module;
    }

    if (mod.status < LOADED || check_deps(mod) !== true) {
        throw 'module [' + mod.name + '] not ok for get';
    }

    function m () {
        if (m.__call) {
            return m.__call.apply(m, arguments);
        }

        throw 'module ' + mod.name + ' can not be call';
    }

    _merge(m, mod.init());

    mod.module = m;

    return m;
}

function check_deps (mod) {
            mod.deps[i] = get_or_init_m(args[i]).name;
    var m;
}

function _load (mods, cb) {
    _log(mods, cb);
}

function get_or_init_m (n) {
    var r = re_mod_name.match(n);
    if (! r) throw 'module name [' + n + '] not valid';
    n = r[0];

    if (n in _mods) return _mods[n];

    return (_mods[n] = {
        name: n,
        config: (r[1] || '_'),
        status: EMPTY,
        _getm: _get_module
    });
}

/*
 * module object
 * {
 *  name: "a",
 *  config: "_",
 *  status: EMPTY|LOADING|LOADED|INIT,
 *  deps: ["b", "c"],
 *  init: fn,
 *  module: fn with all exports(when status = INIT),
 * }
 * module('a', init)
 * module('a', 'b', 'c', init)
 */
module = function () {
    var args = slice.call(arguments, 0),
        fn = args.pop(),
        n = args.shift();

    if (! (fn && fn.call)) throw 'module() must have a factory function';
    if (! n) throw 'module() must have a name';

    var mod = get_or_init_m(n);
    if (mod.init) {
        _log('warn: module [' + mod.name + '] load duplicate');
    }

    mod.status = LOADED;
    mod.init = fn;

    if (args.length) {
        mod.deps = [];
        for (var i = 0, iM = args.length; i < iM; ++i) {
            mod.deps[i] = get_or_init_m(args[i]).name;
        }
    }
};


/*
 * require('a', cb) -> true/false
 * require('a', 'b', cb) -> true/false
 * require('a') -> return module a
 * require('a', 'b') -> return [a, b]
 * require('lib.jquery@app', 'b') -> return [jquery, b]
 */
require = function () {
    var args = slice.call(arguments, 0),
        cb = args[args.length - 1],
        ret = [];

    if (cb && cb.call) {
        args.pop();
    } else {
        cb = null;
    }

    var i = 0,
        iM = args.length,
        missing = [],
        mod,
        dep;

    if (! iM) throw 'require() need mod name';

    for (; i < iM; ++i) {
        dep = 0;
        mod = get_or_init_m(args[i]);
        ret[i] = mod;

        if (mod.status < LOADED) {
            missing.push(mod.name);
        } else if ((dep = check_deps(mod)) !== true) {
            if (dep && dep.length && dep.concat) {
                missing.push.apply(missing, dep);
            }
        }
    }

    // 进入返回模式
    if (! cb) {
        if (missing.length) {
            throw ('modules [' + missing.join(', ') + '] not loaded');
        }

        for (i = 0; i < iM; ++i) {
            ret[i] = ret[i]._getm();
        }

        return iM == 1 ? ret[0] : ret;
    }

    if (! missing.length) {
        // 自动加载 require 的所有模块 ?
        // cb.apply(null, mods);
        cb();
        return true;
    }

    _load(missing, cb);
    return false;
};


module('yui.ua', function() {
    return (function(subUA) {
        var numberify = function(s) {
                var c = 0;
                return parseFloat(s.replace(/\./g, function() {
                    return (c++ == 1) ? '' : '.';
                }));
            },

            win = window,

            nav = win && win.navigator,

            o = {

            /**
             * Internet Explorer version number or 0.  Example: 6
             * @property ie
             * @type float
             * @static
             */
            ie: 0,

            /**
             * Opera version number or 0.  Example: 9.2
             * @property opera
             * @type float
             * @static
             */
            opera: 0,

            /**
             * Gecko engine revision number.  Will evaluate to 1 if Gecko
             * is detected but the revision could not be found. Other browsers
             * will be 0.  Example: 1.8
             * <pre>
             * Firefox 1.0.0.4: 1.7.8   <-- Reports 1.7
             * Firefox 1.5.0.9: 1.8.0.9 <-- 1.8
             * Firefox 2.0.0.3: 1.8.1.3 <-- 1.81
             * Firefox 3.0   <-- 1.9
             * Firefox 3.5   <-- 1.91
             * </pre>
             * @property gecko
             * @type float
             * @static
             */
            gecko: 0,

            /**
             * AppleWebKit version.  KHTML browsers that are not WebKit browsers
             * will evaluate to 1, other browsers 0.  Example: 418.9
             * <pre>
             * Safari 1.3.2 (312.6): 312.8.1 <-- Reports 312.8 -- currently the
             *                                   latest available for Mac OSX 10.3.
             * Safari 2.0.2:         416     <-- hasOwnProperty introduced
             * Safari 2.0.4:         418     <-- preventDefault fixed
             * Safari 2.0.4 (419.3): 418.9.1 <-- One version of Safari may run
             *                                   different versions of webkit
             * Safari 2.0.4 (419.3): 419     <-- Tiger installations that have been
             *                                   updated, but not updated
             *                                   to the latest patch.
             * Webkit 212 nightly:   522+    <-- Safari 3.0 precursor (with native
             * SVG and many major issues fixed).
             * Safari 3.0.4 (523.12) 523.12  <-- First Tiger release - automatic
             * update from 2.x via the 10.4.11 OS patch.
             * Webkit nightly 1/2008:525+    <-- Supports DOMContentLoaded event.
             *                                   yahoo.com user agent hack removed.
             * </pre>
             * http://en.wikipedia.org/wiki/Safari_version_history
             * @property webkit
             * @type float
             * @static
             */
            webkit: 0,

            /**
             * Chrome will be detected as webkit, but this property will also
             * be populated with the Chrome version number
             * @property chrome
             * @type float
             * @static
             */
            chrome: 0,

            /**
             * The mobile property will be set to a string containing any relevant
             * user agent information when a modern mobile browser is detected.
             * Currently limited to Safari on the iPhone/iPod Touch, Nokia N-series
             * devices with the WebKit-based browser, and Opera Mini.
             * @property mobile
             * @type string
             * @static
             */
            mobile: null,

            /**
             * Adobe AIR version number or 0.  Only populated if webkit is detected.
             * Example: 1.0
             * @property air
             * @type float
             */
            air: 0,
            /**
             * Detects Apple iPad's OS version
             * @property ipad
             * @type float
             * @static
             */
            ipad: 0,
            /**
             * Detects Apple iPhone's OS version
             * @property iphone
             * @type float
             * @static
             */
            iphone: 0,
            /**
             * Detects Apples iPod's OS version
             * @property ipod
             * @type float
             * @static
             */
            ipod: 0,
            /**
             * General truthy check for iPad, iPhone or iPod
             * @property ios
             * @type float
             * @static
             */
            ios: null,
            /**
             * Detects Googles Android OS version
             * @property android
             * @type float
             * @static
             */
            android: 0,
            /**
             * Detects Palms WebOS version
             * @property webos
             * @type float
             * @static
             */
            webos: 0,

            /**
             * Google Caja version number or 0.
             * @property caja
             * @type float
             */
            caja: nav && nav.cajaVersion,

            /**
             * Set to true if the page appears to be in SSL
             * @property secure
             * @type boolean
             * @static
             */
            secure: false,

            /**
             * The operating system.  Currently only detecting windows or macintosh
             * @property os
             * @type string
             * @static
             */
            os: null

        },

        ua = subUA || nav && nav.userAgent,

        loc = win && win.location,

        href = loc && loc.href,

        m;

        o.secure = href && (href.toLowerCase().indexOf('https') === 0);

        if (ua) {

            if ((/windows|win32/i).test(ua)) {
                o.os = 'windows';
            } else if ((/macintosh/i).test(ua)) {
                o.os = 'macintosh';
            } else if ((/rhino/i).test(ua)) {
                o.os = 'rhino';
            }

            // Modern KHTML browsers should qualify as Safari X-Grade
            if ((/KHTML/).test(ua)) {
                o.webkit = 1;
            }
            // Modern WebKit browsers are at least X-Grade
            m = ua.match(/AppleWebKit\/([^\s]*)/);
            if (m && m[1]) {
                o.webkit = numberify(m[1]);

                // Mobile browser check
                if (/ Mobile\//.test(ua)) {
                    o.mobile = 'Apple'; // iPhone or iPod Touch

                    m = ua.match(/OS ([^\s]*)/);
                    if (m && m[1]) {
                        m = numberify(m[1].replace('_', '.'));
                    }
                    o.ios = m;
                    o.ipad = o.ipod = o.iphone = 0;

                    m = ua.match(/iPad|iPod|iPhone/);
                    if (m && m[0]) {
                        o[m[0].toLowerCase()] = o.ios;
                    }
                } else {
                    m = ua.match(/NokiaN[^\/]*|Android \d\.\d|webOS\/\d\.\d/);
                    if (m) {
                        // Nokia N-series, Android, webOS, ex: NokiaN95
                        o.mobile = m[0];
                    }
                    if (/webOS/.test(ua)) {
                        o.mobile = 'WebOS';
                        m = ua.match(/webOS\/([^\s]*);/);
                        if (m && m[1]) {
                            o.webos = numberify(m[1]);
                        }
                    }
                    if (/ Android/.test(ua)) {
                        o.mobile = 'Android';
                        m = ua.match(/Android ([^\s]*);/);
                        if (m && m[1]) {
                            o.android = numberify(m[1]);
                        }

                    }
                }

                m = ua.match(/Chrome\/([^\s]*)/);
                if (m && m[1]) {
                    o.chrome = numberify(m[1]); // Chrome
                } else {
                    m = ua.match(/AdobeAIR\/([^\s]*)/);
                    if (m) {
                        o.air = m[0]; // Adobe AIR 1.0 or better
                    }
                }
            }

            if (!o.webkit) { // not webkit
    // @todo check Opera/8.01 (J2ME/MIDP; Opera Mini/2.0.4509/1316; fi; U; ssr)
                m = ua.match(/Opera[\s\/]([^\s]*)/);
                if (m && m[1]) {
                    o.opera = numberify(m[1]);
                    m = ua.match(/Opera Mini[^;]*/);
                    if (m) {
                        o.mobile = m[0]; // ex: Opera Mini/2.0.4509/1316
                    }
                } else { // not opera or webkit
                    m = ua.match(/MSIE\s([^;]*)/);
                    if (m && m[1]) {
                        o.ie = numberify(m[1]);
                    } else { // not opera, webkit, or ie
                        m = ua.match(/Gecko\/([^\s]*)/);
                        if (m) {
                            o.gecko = 1; // Gecko detected, look for revision
                            m = ua.match(/rv:([^\s\)]*)/);
                            if (m && m[1]) {
                                o.gecko = numberify(m[1]);
                            }
                        }
                    }
                }
            }
        }

        return o;
    })();
});

module('yui.get', function() {
/**
 * Provides a mechanism to fetch remote resources and
 * insert them into a document.
 * @module yui
 * @submodule get
 */

var STRING = 'string',
    ua = require('yui.ua'),
    L = {
        isString: function (o) {
            return typeof o === STRING;
        }
    },
    TYPE_JS = 'text/javascript',
    TYPE_CSS = 'text/css',
    STYLESHEET = 'stylesheet';

var _idx = 0;
function _guid () {
    return ++idx;
}
/**
 * Fetches and inserts one or more script or link nodes into the document
 * @class Get
 * @static
 */
return (function() {

    /**
     * hash of queues to manage multiple requests
     * @property queues
     * @private
     */
    var _get, _purge, _track,

    queues = {},

    /**
     * queue index used to generate transaction ids
     * @property qidx
     * @type int
     * @private
     */
    qidx = 0,

    /**
     * interal property used to prevent multiple simultaneous purge
     * processes
     * @property purging
     * @type boolean
     * @private
     */
    purging,


    /**
     * Generates an HTML element, this is not appended to a document
     * @method _node
     * @param {string} type the type of element.
     * @param {string} attr the attributes.
     * @param {Window} win optional window to create the element in.
     * @return {HTMLElement} the generated node.
     * @private
     */
    _node = function(type, attr, win) {
        var w = win || window,
            d = w.document,
            n = d.createElement(type),
            i;

        for (i in attr) {
            if (attr[i] && attr.hasOwnProperty(i)) {
                n.setAttribute(i, attr[i]);
            }
        }

        return n;
    },

    /**
     * Generates a link node
     * @method _linkNode
     * @param {string} url the url for the css file.
     * @param {Window} win optional window to create the node in.
     * @param {object} attributes optional attributes collection to apply to the
     * new node.
     * @return {HTMLElement} the generated node.
     * @private
     */
    _linkNode = function(url, win, attributes) {
        var o = {
            id: _guid(),
            type: TYPE_CSS,
            rel: STYLESHEET,
            href: url
        };
        if (attributes) {
            _merge(o, attributes);
        }
        return _node('link', o, win);
    },

    /**
     * Generates a script node
     * @method _scriptNode
     * @param {string} url the url for the script file.
     * @param {Window} win optional window to create the node in.
     * @param {object} attributes optional attributes collection to apply to the
     * new node.
     * @return {HTMLElement} the generated node.
     * @private
     */
    _scriptNode = function(url, win, attributes) {
        var o = {
            id: _guid(),
            type: TYPE_JS
        };

        if (attributes) {
            _merge(o, attributes);
        }

        o.src = url;

        return _node('script', o, win);
    },

    /**
     * Returns the data payload for callback functions.
     * @method _returnData
     * @param {object} q the queue.
     * @param {string} msg the result message.
     * @param {string} result the status message from the request.
     * @return {object} the state data from the request.
     * @private
     */
    _returnData = function(q, msg, result) {
        return {
                tId: q.tId,
                win: q.win,
                data: q.data,
                nodes: q.nodes,
                msg: msg,
                statusText: result,
                purge: function() {
                    _purge(this.tId);
                }
            };
    },

    /**
     * The transaction is finished
     * @method _end
     * @param {string} id the id of the request.
     * @param {string} msg the result message.
     * @param {string} result the status message from the request.
     * @private
     */
    _end = function(id, msg, result) {
        var q = queues[id], sc;
        if (q && q.onEnd) {
            sc = q.context || q;
            q.onEnd.call(sc, _returnData(q, msg, result));
        }
    },

    /*
     * The request failed, execute fail handler with whatever
     * was accomplished.  There isn't a failure case at the
     * moment unless you count aborted transactions
     * @method _fail
     * @param {string} id the id of the request
     * @private
     */
    _fail = function(id, msg) {

        var q = queues[id], sc;
        if (q.timer) {
            // q.timer.cancel();
            clearTimeout(q.timer);
        }

        // execute failure callback
        if (q.onFailure) {
            sc = q.context || q;
            q.onFailure.call(sc, _returnData(q, msg));
        }

        _end(id, msg, 'failure');
    },

    /**
     * The request is complete, so executing the requester's callback
     * @method _finish
     * @param {string} id the id of the request.
     * @private
     */
    _finish = function(id) {
        var q = queues[id], msg, sc;
        if (q.timer) {
            // q.timer.cancel();
            clearTimeout(q.timer);
        }
        q.finished = true;

        if (q.aborted) {
            msg = 'transaction ' + id + ' was aborted';
            _fail(id, msg);
            return;
        }

        // execute success callback
        if (q.onSuccess) {
            sc = q.context || q;
            q.onSuccess.call(sc, _returnData(q));
        }

        _end(id, msg, 'OK');
    },

    /**
     * Timeout detected
     * @method _timeout
     * @param {string} id the id of the request.
     * @private
     */
    _timeout = function(id) {
        var q = queues[id], sc;
        if (q.onTimeout) {
            sc = q.context || q;
            q.onTimeout.call(sc, _returnData(q));
        }

        _end(id, 'timeout', 'timeout');
    },


    /**
     * Loads the next item for a given request
     * @method _next
     * @param {string} id the id of the request.
     * @param {string} loaded the url that was just loaded, if any.
     * @return {string} the result.
     * @private
     */
    _next = function(id, loaded) {
        var q = queues[id], msg, w, d, h, n, url, s,
            insertBefore;

        if (q.timer) {
            // q.timer.cancel();
            clearTimeout(q.timer);
        }

        if (q.aborted) {
            msg = 'transaction ' + id + ' was aborted';
            _fail(id, msg);
            return;
        }

        if (loaded) {
            q.url.shift();
            if (q.varName) {
                q.varName.shift();
            }
        } else {
            // This is the first pass: make sure the url is an array
            q.url = (L.isString(q.url)) ? [q.url] : q.url;
            if (q.varName) {
                q.varName = (L.isString(q.varName)) ? [q.varName] : q.varName;
            }
        }

        w = q.win;
        d = w.document;
        h = d.getElementsByTagName('head')[0];

        if (q.url.length === 0) {
            _finish(id);
            return;
        }

        url = q.url[0];

        // if the url is undefined, this is probably a trailing comma
        // problem in IE.
        if (!url) {
            q.url.shift();
            return _next(id);
        }


        if (q.timeout) {
            // q.timer = L.later(q.timeout, q, _timeout, id);
            q.timer = setTimeout(function() {
                _timeout(id);
            }, q.timeout);
        }

        if (q.type === 'script') {
            n = _scriptNode(url, w, q.attributes);
        } else {
            n = _linkNode(url, w, q.attributes);
        }

        // track this node's load progress
        _track(q.type, n, id, url, w, q.url.length);

        // add the node to the queue so we can return it to the user supplied
        // callback
        q.nodes.push(n);

        // add it to the head or insert it before 'insertBefore'.  Work around
        // IE bug if there is a base tag.
        insertBefore = q.insertBefore ||
                       d.getElementsByTagName('base')[0];

        if (insertBefore) {
            s = _get(insertBefore, id);
            if (s) {
                s.parentNode.insertBefore(n, s);
            }
        } else {
            h.appendChild(n);
        }


        // FireFox does not support the onload event for link nodes, so
        // there is no way to make the css requests synchronous. This means
        // that the css rules in multiple files could be applied out of order
        // in this browser if a later request returns before an earlier one.
        // Safari too.
        if ((ua.webkit || ua.gecko) && q.type === 'css') {
            _next(id, url);
        }
    },

    /**
     * Removes processed queues and corresponding nodes
     * @method _autoPurge
     * @private
     */
    _autoPurge = function() {
        if (purging) {
            return;
        }
        purging = true;

        var i, q;

        for (i in queues) {
            if (queues.hasOwnProperty(i)) {
                q = queues[i];
                if (q.autopurge && q.finished) {
                    _purge(q.tId);
                    delete queues[i];
                }
            }
        }

        purging = false;
    },

    /**
     * Saves the state for the request and begins loading
     * the requested urls
     * @method queue
     * @param {string} type the type of node to insert.
     * @param {string} url the url to load.
     * @param {object} opts the hash of options for this request.
     * @return {object} transaction object.
     * @private
     */
    _queue = function(type, url, opts) {
        opts = opts || {};

        var id = 'q' + (qidx++), q,
            thresh = opts.purgethreshold || m.PURGE_THRESH;

        if (qidx % thresh === 0) {
            _autoPurge();
        }

        queues[id] = _merge(opts, {
            tId: id,
            type: type,
            url: url,
            finished: false,
            nodes: []
        });

        q = queues[id];
        q.win = q.win || window;
        q.context = q.context || q;
        q.autopurge = ('autopurge' in q) ? q.autopurge :
                      (type === 'script') ? true : false;

        q.attributes = q.attributes || {};
        q.attributes.charset = opts.charset || q.attributes.charset || 'utf-8';

        _next(id);

        return {
            tId: id
        };
    };

    /**
     * Detects when a node has been loaded.  In the case of
     * script nodes, this does not guarantee that contained
     * script is ready to use.
     * @method _track
     * @param {string} type the type of node to track.
     * @param {HTMLElement} n the node to track.
     * @param {string} id the id of the request.
     * @param {string} url the url that is being loaded.
     * @param {Window} win the targeted window.
     * @param {int} qlength the number of remaining items in the queue,
     * including this one.
     * @param {Function} trackfn function to execute when finished
     * the default is _next.
     * @private
     */
    _track = function(type, n, id, url, win, qlength, trackfn) {
        var f = trackfn || _next;

        // IE supports the readystatechange event for script and css nodes
        // Opera only for script nodes.  Opera support onload for script
        // nodes, but this doesn't fire when there is a load failure.
        // The onreadystatechange appears to be a better way to respond
        // to both success and failure.
        if (ua.ie) {
            n.onreadystatechange = function() {
                var rs = this.readyState;
                if ('loaded' === rs || 'complete' === rs) {
                    n.onreadystatechange = null;
                    f(id, url);
                }
            };

        // webkit prior to 3.x is no longer supported
        } else if (ua.webkit) {
            if (type === 'script') {
                // Safari 3.x supports the load event for script nodes (DOM2)
                n.addEventListener('load', function() {
                    f(id, url);
                });
            }

        // FireFox and Opera support onload (but not DOM2 in FF) handlers for
        // script nodes.  Opera, but not FF, supports the onload event for link
        // nodes.
        } else {
            n.onload = function() {
                f(id, url);
            };

            n.onerror = function(e) {
                _fail(id, e + ': ' + url);
            };
        }
    };

    _get = function(nId, tId) {
        var q = queues[tId],
            n = (L.isString(nId)) ? q.win.document.getElementById(nId) : nId;
        if (!n) {
            _fail(tId, 'target node not found: ' + nId);
        }

        return n;
    };

    /**
     * Removes the nodes for the specified queue
     * @method _purge
     * @param {string} tId the transaction id.
     * @private
     */
    _purge = function(tId) {
        var n, l, d, h, s, i, node, attr, insertBefore,
            q = queues[tId];

        if (q) {
            n = q.nodes;
            l = n.length;
            d = q.win.document;
            h = d.getElementsByTagName('head')[0];

            insertBefore = q.insertBefore ||
                           d.getElementsByTagName('base')[0];

            if (insertBefore) {
                s = _get(insertBefore, tId);
                if (s) {
                    h = s.parentNode;
                }
            }

            for (i = 0; i < l; i = i + 1) {
                node = n[i];
                if (node.clearAttributes) {
                    node.clearAttributes();
                } else {
                    for (attr in node) {
                        if (node.hasOwnProperty(attr)) {
                            delete node[attr];
                        }
                    }
                }

                h.removeChild(node);
            }
        }
        q.nodes = [];
    };

    var m = {

        /**
         * The number of request required before an automatic purge.
         * Can be configured via the 'purgethreshold' config
         * property PURGE_THRESH
         * @static
         * @type int
         * @default 20
         * @private
         */
        PURGE_THRESH: 20,

        /**
         * Called by the the helper for detecting script load in Safari
         * @method _finalize
         * @static
         * @param {string} id the transaction id.
         * @private
         */
        _finalize: function(id) {
            setTimeout(function() {
                _finish(id);
            }, 0);
        },

        /**
         * Abort a transaction
         * @method abort
         * @static
         * @param {string|object} o Either the tId or the object returned from
         * script() or css().
         */
        abort: function(o) {
            var id = (L.isString(o)) ? o : o.tId,
                q = queues[id];
            if (q) {
                q.aborted = true;
            }
        },

        script: function(url, opts) {
            return _queue('script', url, opts);
        },

        css: function(url, opts) {
            return _queue('css', url, opts);
        }
    };

    return m;
})();

});
})();
