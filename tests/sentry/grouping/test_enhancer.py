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
function:panic_handler                          ^-keep -keep
function:ThreadStartWin32                       v-keep
function:ThreadStartLinux                       v-keep
function:ThreadStartMac                         v-keep
module:std::*                                   -app
module:core::*                                  -app
''', bases=['common:v1'])

    dumped = enhancement.dumps()
    insta_snapshot(dump_obj(enhancement))
    assert Enhancements.loads(dumped).dumps() == dumped
    assert isinstance(dumped, six.string_types)
