# loader
    基于浏览器的 js 代码管理加载器


# API

## module(modName, [, dependenceList], init(mod)[, modConfig])

### 描述
    模块定义

### 参数描述
*   modName - 模块名以`.`分隔，因为需要和路径映射，通常符合文件命名规则即可
*   dependenceList - 依赖模块列表，指定文件名即可，支持指定`@`，可选
                    当模块被加载时，其依赖会作为模块的一部分被加载，
                    如果需要异步的加载其他模块，可以使用 `require(modList, cb())`
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
模块内置了：
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
*   modAname - 需要加载的模块列表，支持多个
*   dependenceList - 依赖模块列表，指定文件名即可，支持指定`@`，可选

`require` 会并行加载全部模块，
模块加载后，会继续加载各模块的依赖，
所有模块及其依赖加载完毕后，会加载所有模块的资源文件(embed)
资源文件加载完毕后，开始调用 onAllLoad，
如果函数有参数，会主动初始化 `require` 的各个模块，并传递给 onAllLoad
(这里依赖 onAllLoad.length，所以函数内部使用 arguments 也许不是你想要)
