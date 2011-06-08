# loader

基于浏览器的 js 代码管理加载器


# API

## module(modName, [, dependenceList], init(mod)[, modConfig])

### 描述

模块定义

### 参数描述

*   modName - 模块名以`.`分隔，因为需要和路径映射，通常符合文件命名规则即可
*   dependenceList - 依赖模块列表，指定模块名即可，支持指定`@`，可选  
        当模块被加载时，其依赖会作为模块的一部分被加载，  
        如果需要异步的加载其他模块，可以使用 `require(modList, cb())`  
        此处默认 ns 跟当前模块所在 ns 相同
*   init - 模块初始化函数，在引用模块(`require`)的时候被调用，以初始化模块  
        此时，模块及模块的全部依赖都加载完毕
*   modConfig - 模块配置
    {
        autoinit: true/false - 当模块及所有依赖加载完成后，立即初始化，  
                                而不等待被引用
        embed: []            - 嵌入资源文件，用法见下面的例子，  
                                资源文件会在模块初始化之前，跟随模块一起被加载
        privide: []          - 提供额外的 modName ，接口尚不稳定
    }

### 用法

#### 1
    // file a/b.js
    module("a.b", function (mod) {
        mod.init = function () {
            // do some thing
        };

        return {
            foo: function () {
                alert("i'm " + mod._NAME);
            }
        };
    });

通常每个模块存放到独立的 js 文件中，像上面一样  
模块的初始化函数接收参数 mod ，这就是 require("a.b") 返回的结果啦(通常是这样，有例外)  
模块可以对外提供属性和方法，添加的方式有2种：

*   设置 mod.prop = abc
*   在 init 函数内返回 { prop: abc } 这样的属性、方法列表

模块内置了以下属性和方法：

*   `_NAME` - 模块名
*   `embed()` - 获取模块嵌入资源，这里接受的资源名和模块配置相同
*   `_getCfg()` - 获取模块内部定义，慎用

#### 2
    // file a/c.js
    module("a.c", ["a.b"] function (mod) {
        var b = require("a.b");

        return {
            foo: function () {
                alert("embed got " + mod.embed("embed/c.jst"));
                // 这里可以得到 c.jst 的文件内容，配合模版引擎就可以用了
            }
        };
    }, {embed: ["embed/c.jst"]);

    // file a/embed/c.jst
    <% ctx.a %>
    "some"
    'text'

`mod.embed()` 可以得到嵌入资源内容 没有参数返回全部资源对象，key 是文件名  
如果传入一个文件名，返回对应的文件内容 如果传入多个文件名，返回 资源列表

embed 文件的查找规则是 获取当前模块的加载路径，去掉文件名，拼上资源文件名，获取  
资源文件是通过 ajax 获取的，所以，通常用于同域名开发阶段(跨域也可以，需要服务器支持  
详情见 tool/embed.ngx 文件)

模块文件可以通过 tool/embed.js 来编译，这样 embed 资源都会被内嵌到模块文件内  
(依赖 nodejs 和 uglify-js)


## require(modAname, [, modBname], onAllLoad(modA ..))

### 描述

模块加载

### 参数描述

*   modAname - 需要加载的模块列表，可指定多个模块，每个模块支持指定独立的 ns
*   onAllLoad - 模块加载完成后的回调函数

### 返回值

如果待加载的模块全部可用(已加载)，这里返回 true 否则返回 false

`require` 会并行加载全部模块，  
模块加载后，会继续加载各模块的依赖，  
所有模块及其依赖加载完毕后，会加载所有模块的资源文件(embed)  
资源文件加载完毕后，开始调用 onAllLoad，  
如果函数有参数，会主动初始化 `require` 的各个模块，并传递给 onAllLoad  
(这里依赖 onAllLoad.length，所以函数内部使用 arguments 也许不是你想要)

### 用法

#### 1
    // file t.html
    require("a.c", function (c) {
        c.foo();
        require("a.b", function (b) {
            b.foo();
        }) || alert("loading a.b");
    });


## require(modAname, [, modBname])

### 描述

模块引用  
**没有回调函数的 `require` 是引用，有回调函数的是加载**

### 参数描述

*   modAname - 需要引用的模块列表，一般只指定1个，支持多个

### 返回值

返回模块，需要模块已加载，无论是显式加载或者被模块依赖进来  
如果给定多个参数，返回 模块数组  
如果待引用的模块未正确加载，则抛异常

### 用法

#### 1
    // file t.html
    require("a.c", function () {
        require("a.c").foo();

        require("a.b", function () {
            require("a.b").foo();
        }) || alert("loading a.b");
    });


## require.config([ns, ]config)

### 描述

配置 ns  
ns 一般作用于模块加载和指定模块依赖的时候，因为这些地方需要计算模块对应的加载地址  
指定 ns 的方式是在模块名后加 `@lib` ，其中 `@` 是关键字，`lib` 是 ns 的名字  
每个 ns 有自己独立的配置  
loader 内部是根据每个 ns 的 path 设置来计算模块名到加载路径映射的

### 参数描述

*   ns - 指定配置哪个 ns，不指定就配置默认的那个
*   config - 具体的配置
    {
        path: "" - 形式如 `/js/m/?.js`  
            loader 得到需要加载的模块后，会解析模块名和 ns ，  
            得到对应 ns 下面的 path  
            同时对模块名做替换，把 . 替换为 / ，然后替换 path 内的 ? 符号  
            就得到了最终的加载路径
        pkg: { "pkgname": ["modA", "modB"] } -  
            计算模块加载路径的时候，会预先判断是否有某个 pkg 提供了此模块，  
            如果有，就直接使用 pkg 代替当前模块去计算加载路径了 :)
    }

### 用法

#### 1
    // file http://a.ux/lib/jquery.js
    module("jquery", function () {
        // jquery
    });

    // file http://a.ux/lib/jquery/tmpl.js
    module("jquery.tmpl", ["jquery"], function () {
        // jquery.tmpl
    });

    // js/main.js
    module("main", ["jquery.tmpl@lib"], function (mod) {
        var tmpl = require("jquery.tmpl").tmpl,
            $ = require("jquery").jquery;

        mod.init = function (sel) {
            $(sel).html(tmpl(mod.embed("main.jst"), {}));
        };
    }, {embed: ["main.jst"]});

    // app.html
    require.config("lib", { path: "http://a.ux/?.js" });
    require.config({ path: "js/?.js" });

    require("main", "jquery@lib", function (main, $) {
        main.init($(document.body));
    });


## require.at(ns)

### 描述

当需要从某个 ns 加载大量模块的时候，可以使用此函数，  
免去给每个模块都添加 `@ns` 的麻烦

require("a@lib", "b@lib", cb) 定价于  
require.at("lib")("a", "b", cb)


## module._genDepsDot()

### 描述

获取当前页面所有已加载模块的依赖图(dot 格式)  
不复杂的 dot 可以在线解析( http://ashitani.jp/gv/ )  
或者自己安装 http://www.graphviz.org/ 使用

