function _log (a, b, c, d, e, f) {
    return;
    try {
    console.log(a || '', b || '', c || '', d || '', e || '', f || '');
    } catch (ex) {}
}
function _warn (a, b, c, d, e, f) {
    return;
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
    getm: function (safe) {
        var mod = this;

        if (mod.module) {
            return mod.module;
        }

        if (mod.status < LOADED || check_deps(mod) !== true) {
            if (safe) return null;

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
    var get = require('seajs.asset.get').getAsset;

    function grep () {
        var ret = [],
            _h = {},
            dep,
            n = 0;

        for (var i = 0, iM = mods.length; i < iM; ++i) {
            var modname = mods[i],
                mod;
            if (modname in _h) continue;
            _h[modname] = 1;

            mod = _mods[modname];
            if (mod.status < LOADING) {
                ++n;
                ret.push(modname);
            } else if (mod.status >= LOADED &&
                    ((dep = check_deps(mod)) !== true)) {
                for (var j = 0, jM = dep.length; j < jM; ++j) {
                    modname = dep[j];
                    if (modname in _h) continue;
                    _h[modname] = 1;

                    ++n;
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
    var _in_load_count = 0;
    setTimeout(function _in_load () {
        if ((++_in_load_count) >= 10) throw 'too many load for require';

        grep();

        var n = mods.length;

        if (n === 0) {
            return _check_dyn_embed();
        } else {
            var mod;
            for (var i = 0, iM = n; i < iM; ++i) {
                mod = _mods[mods[i]];
                _log('fetch js url ->', mod.geturl());
                //get(url, callback, charset, timeout)
                mod.status = LOADING;
                get(mod.geturl(true), function (m) {
                    --n;
                    _log('js load, m ->', m);
                    m.status = LOADED;
                    if (n <= 0) {
                        // 把当前待加载的全部加载完
                        // 继续看还有没有要加载的
                        cb();
                    }
                }, 0, 0, [mod]);
            }
        }

        function cb () {
            _in_load();
        }
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
 *  provide: ['']
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

    if (mod.provide && mod.provide.length) {
        for (var i = mod.provide.length - 1, _m; i >= 0; --i) {
            _m = mod.provide[i];
            if (_m in _mods) {
                if (_mods[_m].init) {
                    _warn('mod [' + _m + '] has init, maybe you use wrong provide');
                }
                mod.provide[i] = _mods[_m];
            }
            _mods[_m] = mod;
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

    // 加载模式

    // 自动加载 require 的所有模块
    // 允许 null
    function alldone () {
        var i,
            iM = cb.length;
        var cbargs = [];
        for (i = 0; i < iM; ++i) {
            cbargs[i] = ret[i].getm(true);
        }
        return cb.apply(null, cbargs);
        cbargs = null;
    }
    if (! missing.length) {
        alldone();
        return true;
    }

    _load(missing, function () {
        _warn(args, missing);
        return alldone();
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

    ajax.x = function () {
        try {
            return new ActiveXObject('Msxml2.XMLHTTP');
        } catch (e) {
            try {
                return new ActiveXObject('Microsoft.XMLHTTP');
            } catch (e) {
                return new XMLHttpRequest();
            }
        }
    };
    ajax.send = function (u, f, m, a) {
        var x = ajax.x();
        x.open(m, u, true);
        x.onreadystatechange = function () {
            if (x.readyState == 4) {
                f(x.responseText, x);
            }
        };
        if (m == 'POST') {
            x.setRequestHeader('Content-type','application/x-www-form-urlencoded');
        }
        x.send(a);
    };
    ajax.get = function (url, func) {
        ajax.send(url, func, 'GET', null);
    };
    ajax.syncget = function (url) {
        var x = ajax.x();
        x.open('GET', url, false);
        x.send(null);
        return x.responseText;
    };
    ajax.post = function (url, func, args) {
        ajax.send(url, func, 'POST', args);
    };

    return ajax;
});

module('seajs.asset.get', function(util) {
    var head = document.getElementsByTagName('head')[0];
    var isWebKit = navigator.userAgent.indexOf('AppleWebKit') !== -1;

    util.getAsset = function(url, callback, charset, timeout, args) {
        var isCSS = /\.css(?:\?|$)/i.test(url);
        var node = document.createElement(isCSS ? 'link' : 'script');
        if (charset) node.setAttribute('charset', charset);

        assetOnload(node, function() {
            if (callback) callback.call(node, args || []);
            if (isCSS) return;

            // Reduces memory leak.
            try {
                if (node.clearAttributes) {
                    node.clearAttributes();
                } else {
                    for (var p in node) delete node[p];
                }
            } catch (x) {
            }
            head.removeChild(node);
        }, timeout);

        if (isCSS) {
            node.rel = 'stylesheet';
            node.href = url;
            head.appendChild(node); // keep order
        }
        else {
            node.async = true;
            node.src = url;
            head.insertBefore(node, head.firstChild);
        }

        return node;
    };

    function assetOnload(node, callback, timeout) {
        if (node.nodeName === 'SCRIPT') {
            scriptOnload(node, cb);
        } else {
            styleOnload(node, cb);
        }

        var timer;
        if (timeout) {
            timer = setTimeout(function() {
                cb();
            }, timeout);
        }

        function cb() {
            cb.isCalled = true;
            callback();
            timer && clearTimeout(timer);
        }
    }

    function scriptOnload(node, callback) {
        if (node.addEventListener) {
            node.addEventListener('load', callback, false);
            node.addEventListener('error', callback, false);
            // NOTICE: Nothing will happen in Opera when the file status is 404. In
            // this case, the callback will be called when time is out.
        }
        else { // for IE6-8
            node.attachEvent('onreadystatechange', function() {
                var rs = node.readyState;
                if (rs === 'loaded' || rs === 'complete') {
                    callback();
                }
            });
        }
    }

    function styleOnload(node, callback) {
        // for IE6-9 and Opera
        if (node.attachEvent) {
            node.attachEvent('onload', callback);
            // NOTICE:
            // 1. "onload" will be fired in IE6-9 when the file is 404, but in
            // this situation, Opera does nothing, so fallback to timeout.
            // 2. "onerror" doesn't fire in any browsers!
        }
        // polling for Firefox, Chrome, Safari
        else {
            setTimeout(function() {
                poll(node, callback);
            }, 0); // for cache
        }
    }

    function poll(node, callback) {
        if (callback.isCalled) {
            return;
        }

        var isLoaded = false;

        if (isWebKit) {
            if (node['sheet']) {
                isLoaded = true;
            }
        }
        // for Firefox
        else if (node['sheet']) {
            try {
                if (node['sheet'].cssRules) {
                    isLoaded = true;
                }
            } catch (ex) {
                if (ex.name === 'NS_ERROR_DOM_SECURITY_ERR') {
                    isLoaded = true;
                }
            }
        }

        if (isLoaded) {
            // give time to render.
            setTimeout(function() {
                callback();
            }, 1);
        }
        else {
            setTimeout(function() {
                poll(node, callback);
            }, 1);
        }
    }

    util.assetOnload = assetOnload;

    return;
    var interactiveScript = null;

    util.getInteractiveScript = function() {
        if (interactiveScript && interactiveScript.readyState === 'interactive') {
            return interactiveScript;
        }

        var scripts = head.getElementsByTagName('script');

        for (var i = 0; i < scripts.length; i++) {
            var script = scripts[i];
            if (script.readyState === 'interactive') {
                return script;
            }
        }

        return null;
    };


    util.getScriptAbsoluteSrc = function(node) {
        return node.hasAttribute ? // non-IE6/7
                node.src :
                // see http://msdn.microsoft.com/en-us/library/ms536429(VS.85).aspx
                node.getAttribute('src', 4);
    };

});

})();
