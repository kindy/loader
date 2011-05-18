module('d', ['c'], function (mod) {
    var res = mod.embed('p1.css');

    return {
        a: 'd'
    };
}, {embed: ['d_p1.css', 'd_p2.less'], _embed: {'a': '', 'b': null}})

module('d.a', ['c'], function (mod) {
    var res = mod.embed('p1.css');

    return {
        a: 'd'
    };
}, {embed: ['a_x.txt']})
