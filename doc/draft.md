# 文档规划

1. 功能、用途简介
2. 入门教程 1, 2, 3
3. 更多使用实例
4. 文档
   1. 框架设计
   2. 函数


# 功能点

* js 模块的定义、管理 与 加载
* 模块定义 - module()
   * module('modname', factory)
   * factory 前可加入依赖 [] ，写法同 require
   * factory 后可加入模块配置 {} ，暂时支持 embed 配置
   * 可以指定依赖，这样在加载模块的同时，其依赖也一并被加载
   * 可以嵌入文件，在开发时，这些文件作为依赖的一部分会被加载器动态加载，
     同时提供编译工具，可以将模块的嵌入文件合并到模块内。
     一般用于模块相关的模板和样式片段
* 模块加载 - require('modname', cb)
  加载任意数量的模块(异步)
* 模块引用 - require('modname')
  如果有多个参数，会返回 module []
  模块加载后就可以任意使用了，在任意位置都可以通过模块名来得到模块
* 模块加载配置 @
  可以在 模块加载 和 模块定义依赖 的时候使用，用于控制模块加载行为
  通常是设定模块对应的 js 文件路径，这样可以多源同时使用
  * require('a@lib', 'b', cb) - 可以设定每个模块的加载配置
  * require.at('newat')('a', 'b', cb) - 设定默认使用的加载配置(当前 require 有效)
* 模块清除 - require.clear('modname', level)
  可以对加载的模块进行清除，使得模块可以重新加载或初始化
  一般用于调试或开发，尚未完善


# module

* miniajax
* yui.get
* yui.ua

# function

* require
* module
* require.config
* require.at

# tool

* embed.js -> node 脚本，支持将 module 定义中的 embed 文件嵌入 module
    node embed.js {path/to/module.js}

