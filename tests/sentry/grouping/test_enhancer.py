# -*- coding: utf-8 -*-

from __future__ import absolute_import, print_function

import six

from sentry.grouping.enhancer import Enhancements


def dump_obj(obj):
    if not isinstance(getattr(obj, '__dict__', None), dict):
        return obj
    rv = {}
    for (key, value) in six.iteritems(obj.__dict__):
        if isinstance(value, list):
            rv[key] = [dump_obj(x) for x in value]
        elif isinstance(value, dict):
            rv[key] = {k: dump_obj(v) for k, v in six.iteritems(value)}
        else:
            rv[key] = value
    return rv


def test_basic_parsing(insta_snapshot):
    enhancement = Enhancements.from_config_string('''
# This is a config
path:*/code/game/whatever/*                     +app
function:panic_handler                          ^-store -store
function:ThreadStartWin32                       v-store
function:ThreadStartLinux                       v-store
function:ThreadStartMac                         v-store
family:native module:std::*                     -app
module:core::*                                  -app
family:javascript path:*/test.js                -app
''', bases=['common:v1'])

    dumped = enhancement.dumps()
    insta_snapshot(dump_obj(enhancement))
    assert Enhancements.loads(dumped).dumps() == dumped
    assert isinstance(dumped, six.string_types)


def test_basic_path_matching():
    enhancement = Enhancements.from_config_string('''
        path:**/test.js              +app
    ''')
    js_rule = enhancement.rules[0]

    assert bool(js_rule.get_matching_frame_actions({
        'abs_path': 'http://example.com/foo/test.js',
        'filename': '/foo/test.js',
    }, 'javascript'))

    assert not bool(js_rule.get_matching_frame_actions({
        'abs_path': 'http://example.com/foo/bar.js',
        'filename': '/foo/bar.js',
    }, 'javascript'))

    assert bool(js_rule.get_matching_frame_actions({
        'abs_path': 'http://example.com/foo/test.js',
    }, 'javascript'))

    assert not bool(js_rule.get_matching_frame_actions({
        'filename': '/foo/bar.js',
    }, 'javascript'))

    assert bool(js_rule.get_matching_frame_actions({
        'abs_path': 'http://example.com/foo/TEST.js',
    }, 'javascript'))

    assert not bool(js_rule.get_matching_frame_actions({
        'abs_path': 'http://example.com/foo/bar.js',
    }, 'javascript'))


def test_family_matching():
    enhancement = Enhancements.from_config_string('''
        family:javascript path:**/test.js              +app
        family:native function:std::*                  -app
    ''')
    js_rule, native_rule = enhancement.rules

    assert bool(js_rule.get_matching_frame_actions({
        'abs_path': 'http://example.com/foo/TEST.js',
    }, 'javascript'))

    assert not bool(js_rule.get_matching_frame_actions({
        'abs_path': 'http://example.com/foo/TEST.js',
    }, 'native'))

    assert not bool(native_rule.get_matching_frame_actions({
        'abs_path': 'http://example.com/foo/TEST.js',
        'function': 'std::whatever',
    }, 'javascript'))

    assert bool(native_rule.get_matching_frame_actions({
        'function': 'std::whatever',
    }, 'native'))
