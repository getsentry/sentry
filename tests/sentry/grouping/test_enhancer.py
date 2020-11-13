# -*- coding: utf-8 -*-

from __future__ import absolute_import, print_function

import six
import pytest

from sentry.grouping.enhancer import Enhancements, InvalidEnhancerConfig


def dump_obj(obj):
    if not isinstance(getattr(obj, "__dict__", None), dict):
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
    enhancement = Enhancements.from_config_string(
        """
# This is a config
path:*/code/game/whatever/*                     +app
function:panic_handler                          ^-group -group
function:ThreadStartWin32                       v-group
function:ThreadStartLinux                       v-group
function:ThreadStartMac                         v-group
family:native module:std::*                     -app
module:core::*                                  -app
family:javascript path:*/test.js                -app
family:javascript app:1 path:*/test.js          -app
family:native                                   max-frames=3
""",
        bases=["common:v1"],
    )

    dumped = enhancement.dumps()
    insta_snapshot(dump_obj(enhancement))
    assert Enhancements.loads(dumped).dumps() == dumped
    assert Enhancements.loads(dumped)._to_config_structure() == enhancement._to_config_structure()
    assert isinstance(dumped, six.string_types)


def test_parsing_errors():
    with pytest.raises(InvalidEnhancerConfig):
        Enhancements.from_config_string("invalid.message:foo -> bar")


def test_basic_path_matching():
    enhancement = Enhancements.from_config_string(
        """
        path:**/test.js              +app
    """
    )
    js_rule = enhancement.rules[0]

    assert bool(
        js_rule.get_matching_frame_actions(
            {"abs_path": "http://example.com/foo/test.js", "filename": "/foo/test.js"}, "javascript"
        )
    )

    assert not bool(
        js_rule.get_matching_frame_actions(
            {"abs_path": "http://example.com/foo/bar.js", "filename": "/foo/bar.js"}, "javascript"
        )
    )

    assert bool(
        js_rule.get_matching_frame_actions(
            {"abs_path": "http://example.com/foo/test.js"}, "javascript"
        )
    )

    assert not bool(js_rule.get_matching_frame_actions({"filename": "/foo/bar.js"}, "javascript"))

    assert bool(
        js_rule.get_matching_frame_actions(
            {"abs_path": "http://example.com/foo/TEST.js"}, "javascript"
        )
    )

    assert not bool(
        js_rule.get_matching_frame_actions(
            {"abs_path": "http://example.com/foo/bar.js"}, "javascript"
        )
    )


def test_family_matching():
    enhancement = Enhancements.from_config_string(
        """
        family:javascript path:**/test.js              +app
        family:native function:std::*                  -app
    """
    )
    js_rule, native_rule = enhancement.rules

    assert bool(
        js_rule.get_matching_frame_actions(
            {"abs_path": "http://example.com/foo/TEST.js"}, "javascript"
        )
    )

    assert not bool(
        js_rule.get_matching_frame_actions({"abs_path": "http://example.com/foo/TEST.js"}, "native")
    )

    assert not bool(
        native_rule.get_matching_frame_actions(
            {"abs_path": "http://example.com/foo/TEST.js", "function": "std::whatever"},
            "javascript",
        )
    )

    assert bool(native_rule.get_matching_frame_actions({"function": "std::whatever"}, "native"))


def test_app_matching():
    enhancement = Enhancements.from_config_string(
        """
        family:javascript path:**/test.js app:yes       +app
        family:native path:**/test.c app:no            -group
    """
    )
    app_yes_rule, app_no_rule = enhancement.rules

    assert bool(
        app_yes_rule.get_matching_frame_actions(
            {"abs_path": "http://example.com/foo/TEST.js", "in_app": True}, "javascript"
        )
    )
    assert not bool(
        app_yes_rule.get_matching_frame_actions(
            {"abs_path": "http://example.com/foo/TEST.js", "in_app": False}, "javascript"
        )
    )

    assert bool(
        app_no_rule.get_matching_frame_actions({"abs_path": "/test.c", "in_app": False}, "native")
    )
    assert not bool(
        app_no_rule.get_matching_frame_actions({"abs_path": "/test.c", "in_app": True}, "native")
    )


def test_package_matching():
    # This tests a bunch of different rules from the default in-app logic that
    # was ported from the former native plugin.
    enhancement = Enhancements.from_config_string(
        """
        family:native package:/var/**/Frameworks/**                  -app
        family:native package:**/*.app/Contents/**                   +app
        family:native package:linux-gate.so                          -app
        family:native package:?:/Windows/**                          -app
    """
    )

    bundled_rule, macos_rule, linux_rule, windows_rule = enhancement.rules

    assert bool(
        bundled_rule.get_matching_frame_actions(
            {"package": "/var/containers/MyApp/Frameworks/libsomething"}, "native"
        )
    )

    assert bool(
        macos_rule.get_matching_frame_actions(
            {"package": "/Applications/MyStuff.app/Contents/MacOS/MyStuff"}, "native"
        )
    )

    assert bool(linux_rule.get_matching_frame_actions({"package": "linux-gate.so"}, "native"))

    assert bool(
        windows_rule.get_matching_frame_actions(
            {"package": "D:\\Windows\\System32\\kernel32.dll"}, "native"
        )
    )

    assert bool(
        windows_rule.get_matching_frame_actions(
            {"package": "d:\\windows\\System32\\kernel32.dll"}, "native"
        )
    )

    assert not bool(
        bundled_rule.get_matching_frame_actions(
            {"package": "/var2/containers/MyApp/Frameworks/libsomething"}, "native"
        )
    )

    assert not bool(
        bundled_rule.get_matching_frame_actions(
            {"package": "/var/containers/MyApp/MacOs/MyApp"}, "native"
        )
    )

    assert not bool(
        bundled_rule.get_matching_frame_actions({"package": "/usr/lib/linux-gate.so"}, "native")
    )
