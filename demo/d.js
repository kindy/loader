module('d', ['c'], function (mod) {
    var res = mod.embed('p1.css');

    return {
        a: 'd'
    };
}, {embed: ['p1.css', 'p2.less']});

--to->

module('d', ['c'], function (mod) {
    var res = mod.embed('p1.css');

    return {
        a: 'd'
    };
}, {_embed: {'p1.css': 'ssdsf\n\'\n"', 'p2.less': null, 'p3.tmpl': null}});
