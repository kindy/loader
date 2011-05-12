function _log (a, b, c, d, e, f) {
    try {
    console.log(a || '', b || '', c || '', d || '', e || '', f || '');
    } catch (ex) {}
}
function _warn (a, b, c, d, e, f) {
    try {
    console.warn(a || '', b || '', c || '', d || '', e || '', f || '');
    } catch (ex) {}
}

/*
 * loader
 */

var require, module;
(function () {
if (require || module) return;

/*
 * module config object
 * {
 *  name: "a",                  - 模块名称
 *  ns: "_",                    - 模块使用的配置，影响加载行为
 *  status: EMPTY|LOADING|LOADED|INIT,  - 状态
 *  deps: ["b", "c"],           - 依赖列表
 *  init: fn,                   - 初始化函数，此函数非传给 module 的函数，被包了
 *  getm: function () {}        - (初始化并)获取模块
 *  geturl: function () {}      - 获取加载地址
 *  byother: true|false         - 是否通过独立的 js 加载的
 *                                通常独立加载的才能动态读取embed
 *  embed:
 *  _embed:
 * }
 *
 * module fn
 * {
 *  _M: module object
 *  _NAME: "a"
 *  _getCfg: function () {}
 *  embed: function () {}
 *
 *  ...... by defined
 * }
 */
var _mods = {},
    _modlist = [],
    _embds2load = [];

var now = Date.now || (function() {
        return new Date().getTime();
    }),
    slice = Array.prototype.slice,
    head = document.getElementsByTagName('head')[0];

var _dftns = '_',
    _dftnscfg = {
            path: '?.js'
        },
    _modns = {
        _: _merge({}, _dftnscfg)
    },

    EMPTY = 1,
    LOADING = 2,
    LOADED = 3,
    INIT = 4,

    re_mod_name = /^([^@]+)(?:@(.+))?$/;

function _merge (f, r, s) {
    if (typeof f !== 'boolean') {
        s = r;
        r = f;
        f = true;
    }

    if (!s || !r) {
        return r || s;
    }

    for (var i in s) {
        if (s.hasOwnProperty(i) && (f || !(i in r))) {
            r[i] = s[i];
        }
    }

    return r;
}

function ModuleDef (name) {
    function m () {
        if (m.__call) {
            return m.__call.apply(this, arguments);
        }

        throw 'module ' + m._NAME + ' can not be call';
    }

    m._NAME = name;
    m._M = m;

    _merge(m, ModuleDef.prototype);

    return m;
}
_merge(ModuleDef.prototype, {
    toString: function () {
        var ns = this._getCfg().ns;
        return 'module [' + this._NAME + (ns === _dftns ? '' : ('@' + ns)) + ']';
    },
    _getCfg: function () {
        return _mods[this._NAME];
    },
    embed: function (p) {
        var embed = this._getCfg()._embed,
            n = arguments.length;

        if (n === 0) return embed;
        if (n === 1) return embed[p];

        var ret = [];
        for (var i = 0; i < n; ++i) {
            ret.push(embed[arguments[i]]);
        }
        return ret;
    }
});

function ModuleCfg (cfg) {
    _merge(this, cfg);
}
_merge(ModuleCfg.prototype, {
    init: function () {
        if (this.status >= INIT) throw 'can not init module [' + this.name + '] inited';

        return this._init.apply(this, arguments);
    },
    geturl: function (rload) {
        var path = _modns[this.ns].path;
        var url = path.replace(/\?/, this.name.replace(/\./g, '/'));

        if (this.nocache) {
            url += (url.indexOf('?') === -1 ? '?' : '&') + '_t=' + new Date().getTime();
            if (rload) {
                delete this.nocache;
            }
        }

        if (rload) {
            this.lasturl = url;
        }
        _log(url);

        return url;
    },
    clear: function (level) {
        if (level >= 1) {
            delete this.exports;

            if (this.module.__clear) {
                this.module.__clear();
            }

            delete this.module;
            this.status = LOADED;
        }

        if (level >= 2) {
            delete this.init;
            delete this.byother;
            delete this.deps;
            this.status = EMPTY;
        }

        if (level >= 3) {
            this.nocache = true;
        }

        return this;
    },
    getm: function () {
        var mod = this;

        if (mod.module) {
            return mod.module;
        }

        if (mod.status < LOADED || check_deps(mod) !== true) {
            throw 'module [' + mod.name + '] not ok for get';
        }

        var m = new ModuleDef(mod.name),
            exp = mod.init(m);
        mod.exports = exp;

        // require 的返回值受 module 调用中的 init 控制，如果 init 返回函数或者
        // 返回对象的 __only 为 true，那么直接用 init 的返回值作为 require 结果
        // 无论如何，ModuleDef 里的各种方法都会 append 到 mod 里
        if (exp && (exp.call || exp.__only)) {
            _merge(false, exp, m);
            m = exp;
        } else {
            _merge(m, exp);
        }

        mod.status = INIT;
        mod.module = m;

        return m;
    }
});

function check_deps (mod, alldeps) {
    //_log('check_deps', mod.name, JSON.stringify(alldeps));

    var modname = mod.name;

    var deps;
    var ret = [];
    //TODO: 用于循环引用判定
    alldeps = alldeps || {};
    if ('__c' in alldeps) {
        alldeps.__c++;
    } else {
        alldeps.__c = 1;
    }
    if (alldeps.__c >= 300) throw 'too much check deps';

    if (modname in alldeps) return true;
    alldeps[modname] = 1;

    deps = mod.deps;
    if (!deps || !deps.length) return true;

    for (var i = 0, iM = deps.length; i < iM; ++i) {
        var dep = deps[i],
            depmod = _mods[dep];

        if (dep in alldeps) return true;
        alldeps[dep] = 1;

        if (depmod.status >= INIT) {
            continue;
        } else if (depmod.status < LOADED) {
            ret.push(dep);
        } else if ((dep = check_deps(depmod, alldeps)) !== true) {
            ret.push.apply(ret, dep);
        }
    }

    return ret.length ? ret : true;
}

function _load (mods, cb) {
    var get = require('yui.get');

    function grep () {
        var ret = [],
            _h = {},
            dep;

        for (var i = 0, iM = mods.length; i < iM; ++i) {
            var modname = mods[i],
                mod;
            if (modname in _h) continue;
            _h[modname] = 1;

            mod = _mods[modname];
            if (mod.status < LOADING) {
                ret.push(modname);
            } else if (mod.status >= LOADED &&
                    ((dep = check_deps(mod)) !== true)) {
                for (var j = 0, jM = dep.length; j < jM; ++j) {
                    modname = dep[j];
                    if (modname in _h) continue;
                    _h[modname] = 1;

                    ret.push(modname);
                }
            }
        }

        mods = ret.slice(0);
        _h = mod = dep = ret = null;
    }
    _log('need load', mods.slice(0), cb);

    var _dyn_embed_checked = false;
    var ajax = require('miniajax');
    function _check_dyn_embed () {
        if (_dyn_embed_checked) throw 'do not call _check_dyn_embed more than 1';

        _dyn_embed_checked = true;

        if (! _embds2load.length) {
            return cb();
        } else {
            //TODO load all embed and then cb()
            // 'url1': [name, _embed]
            var urls = {},
                mname,
                mod,
                embed,
                _embed,
                mloaded = {},
                lasturl;
            //_log('_check_dyn_embed _embds2load ->', JSON.stringify(_embds2load));
            while (mname = _embds2load.shift()) {
                if (!(mname in mloaded) && (mod = _mods[mname]) &&
                        (lasturl = mod.lasturl) &&
                        (_embed = mod._embed) &&
                        (embed = mod.embed) && embed.length) {
                    mloaded[mname] = true;
                    for (var i = 0, iM = embed.length, iC; i < iM; ++i) {
                        iC = embed[i];
                        _embed[iC] = null;
                        urls[lasturl.replace(/\.js\b/, '_' + iC)] =
                            [iC, _embed];
                        //_log('xxx', mod, i, iM, iC, JSON.stringify(urls));
                    }
                }
            }

            //_log('_check_dyn_embed urls ->', JSON.stringify(urls));
            // 读取 embed 内容计数
            var n = 0,
                url2get = [];
            for (var url in urls) {
                ++n;
                url2get.push([url, (function (url, cfg) {
                    //cfg -> [embed-name, _embed to insert]
                    return function (c, xhr) {
                        --n;
                        _log('fetch url done->', url, 'n->', n);
                        if (xhr.status == 200) {
                            cfg[1][cfg[0]] = c;
                        }
                        if (n <= 0) {
                            cb();
                        }
                    };
                })(url, urls[url])]);
            }
            // ie 的 ajax 请求发送的太快，直接就 返回了，所以xxx
            for (var i = 0, iM = n; i < iM; ++i) {
                _log('fetch url ->', url2get[i]);
                ajax.get(url2get[i][0], url2get[i][1]);
            }
        }
    }

    // 对于 inline <script ， setTimeout 是必要的，
    // 可以让 require 后续的 module 定义加载进来
    setTimeout(function _in_load () {
        grep();
        _log('first time in _load', mods.slice(0));

        var modname = mods.shift();
        if (! modname) return _check_dyn_embed();

        var mod = _mods[modname];

        //_log('grep in _load', mods.slice(0));

        mod.status = LOADING;
        get.script(mod.geturl(true), {
            onEnd: function () {
                _log('load in onEnd', arguments);

                return _check_dyn_embed();
            },
            onNext: function () {
                grep();
                _log('load in onNext', mods.slice(0), mod);
                //_log('_mods', JSON.stringify(_mods));

                if (mod) {
                    mod.status = LOADED;
                }

                if (mods.length) {
                    mod = _mods[mods.shift()];
                    mod.status = LOADING;
                    this.url.push(mod.geturl(true));
                }
            }
        });
    }, 0);
}

function get_or_init_m (oname, ns) {
    var m = oname.match(re_mod_name);
    _log('get_or_init_m match', m);
    if (! m) throw 'module name [' + oname + '] not valid';
    var name = m[1];

    // 如果给定 ns 是否替换模块当前 ns ？
    // 假如 status === EMPTY 呢
    if (name in _mods) return _mods[name];

    _modlist.push(name);
    return (_mods[name] = new ModuleCfg({
        name: name,
        ns: (m[2] || ns || _dftns),
        status: EMPTY
    }));
}

/*
 * module('a', init)
 * module('a', init, {})
 * module('a', ['b'], init)
 * module('a', ['b'], init, {})
 *
 * config -> {
 *  embed: [file1, file2] -> module-fetch-url.replace(/\.js\b/, '_' + filename)
 * }
 */
module = function () {
    var args = slice.call(arguments, 0),
        cfg,
        deps,
        fn,
        name;

    if (args.length < 2) throw 'module() require 2+ args';

    fn = args.pop();
    if (! (fn && fn.call)) {
        cfg = fn;
        fn = args.pop();
    }

    name = args.shift()

    if (! (fn && fn.call)) throw 'module() must have a factory function';
    if (! name) throw 'module() must have a name';

    if (args.length) {
        deps = args.pop();
    }

    var mod = get_or_init_m(name);
    cfg && _merge(mod, cfg);

    //TODO 重复加载 模块 ，如何处理
    if (mod.status >= LOADED) {
        _log('warn: module [' + mod.name + '] load duplicate');
    }

    if (mod.status !== LOADING) mod.byother = true;
    mod.status = LOADED;
    mod._init = fn;

    if (deps) {
        mod.deps = [];
        for (var i = 0, iM = deps.length; i < iM; ++i) {
            mod.deps[i] = get_or_init_m(deps[i]).name;
        }
    }

    if (mod.embed && mod.embed.length) {
        if (! mod._embed) {
            mod._embed = {};
        }
        _embds2load.push(name);
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
        ret = [],
        ns,
        cb;

    // 内部 magic 参数: 如果第1个参数是个数组，
    // 那么数组的第1个值作为默认 ns 使用
    if (args[0] && args[0].sort && args[0][0]) {
        ns = args.shift()[0];
    }

    cb = args[args.length - 1];

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
        mod = get_or_init_m(args[i], ns);
        ret[i] = mod;

        //_log(JSON.stringify(mod));
        if (mod.status < LOADED) {
            missing.push(mod.name);
        } else if (mod.status < INIT && (dep = check_deps(mod)) !== true) {
            missing.push.apply(missing, dep);
        }
    }

    // 进入返回模式
    if (! cb) {
        if (missing.length) {
            throw ('modules [' + missing.join(', ') + '] not loaded');
        }

        for (i = 0; i < iM; ++i) {
            ret[i] = ret[i].getm();
        }

        return iM == 1 ? ret[0] : ret;
    }

    if (! missing.length) {
        // 自动加载 require 的所有模块 ?
        // cb.apply(null, mods);
        cb();
        return true;
    }

    _load(missing, function () {
        _warn(args, missing);
        cb();
    });
    return false;
};

/*
 * require.config   - 配置 ns 参数，可以创建新的 ns
 */
require.config = function (ns, cfg) {
    switch (arguments.length) {
    case 2:
        break;
    case 1:
        cfg = ns;
        ns = _dftns;
        break;
    default:
        throw 'require.config require 1-2 args';
    }

    if (cfg === null) cfg = _dftnscfg;

    if (! (ns in _modns)) _modns[ns] = {};

    _merge(_modns[ns], cfg);

    return ns === _dftns ? require : require.at(ns);
};

/*
 * require.at  - 创建1个以 ns 作为默认 ns 的 require
 *
 * require('a', 'b@x') 调用中，模块 a 的 ns 是 _ ，模块 b 的 ns 是 x
 * require.at('c')('a', 'b@x') 调用中，模块 a 的 ns 是 c ，模块 b 的 ns 是 x
 */
require.at = function (ns) {
    if (ns === _dftns) return require;

    return function () {
        var args = slice.call(arguments, 0);
        args.unshift([ns]);

        return require.apply(null, args);
    };
};

require.clear = function (name, level) {
    switch (arguments.length) {
    case 2:
        break;
    case 1:
        level = 1;
        break;
    default:
        throw 'require.config require 1-2 args';
    }

    return _mods[name].clear(level);
};

module('miniajax', function (mod) {
/*
name: miniajax
homepage: http://code.google.com/p/miniajax/

modified
*/

    var ajax={};
    ajax.x=function(){try{return new ActiveXObject('Msxml2.XMLHTTP')}catch(e){try{return new ActiveXObject('Microsoft.XMLHTTP')}catch(e){return new XMLHttpRequest()}}};
    ajax.send=function(u,f,m,a){var x=ajax.x();x.open(m,u,true);x.onreadystatechange=function(){if(x.readyState==4)f(x.responseText, x)};if(m=='POST')x.setRequestHeader('Content-type','application/x-www-form-urlencoded');x.send(a)};
    ajax.get=function(url,func){ajax.send(url,func,'GET', null)};
    ajax.syncget=function(url){var x=ajax.x();x.open('GET',url,false);x.send(null);return x.responseText};
    ajax.post=function(url,func,args){ajax.send(url,func,'POST',args)};

    return ajax;
});

module('yui.ua', function () {
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
    return ++_idx;
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

        _log('node in _next', q);

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
            q.onNext && q.onNext();
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
