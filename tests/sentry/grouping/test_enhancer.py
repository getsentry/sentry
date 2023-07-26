from __future__ import annotations

from typing import Any

import pytest

from sentry.grouping.component import GroupingComponent
from sentry.grouping.enhancer import Enhancements
from sentry.grouping.enhancer.exceptions import InvalidEnhancerConfig
from sentry.grouping.enhancer.matchers import create_match_frame


def dump_obj(obj):
    if not isinstance(getattr(obj, "__dict__", None), dict):
        return obj
    rv: dict[str, Any] = {}
    for (key, value) in obj.__dict__.items():
        if key.startswith("_"):
            continue
        elif isinstance(value, list):
            rv[key] = [dump_obj(x) for x in value]
        elif isinstance(value, dict):
            rv[key] = {k: dump_obj(v) for k, v in value.items()}
        else:
            rv[key] = value
    return rv


@pytest.mark.parametrize("version", [1, 2])
def test_basic_parsing(insta_snapshot, version):
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
    enhancement.version = version

    dumped = enhancement.dumps()
    insta_snapshot(dump_obj(enhancement))
    assert Enhancements.loads(dumped).dumps() == dumped
    assert Enhancements.loads(dumped)._to_config_structure() == enhancement._to_config_structure()
    assert isinstance(dumped, str)


def test_parsing_errors():
    with pytest.raises(InvalidEnhancerConfig):
        Enhancements.from_config_string("invalid.message:foo -> bar")


def test_caller_recursion():
    # Remove this test when CallerMatch can be applied recursively
    with pytest.raises(InvalidEnhancerConfig):
        Enhancements.from_config_string("[ category:foo ] | [ category:bar ] | category:baz +app")


def test_callee_recursion():
    # Remove this test when CalleeMatch can be applied recursively
    with pytest.raises(InvalidEnhancerConfig):
        Enhancements.from_config_string(" category:foo | [ category:bar ] | [ category:baz ] +app")


def _get_matching_frame_actions(rule, frames, platform, exception_data=None, cache=None):
    """Convenience function for rule tests"""
    if cache is None:
        cache = {}

    match_frames = [create_match_frame(frame, platform) for frame in frames]

    return rule.get_matching_frame_actions(match_frames, platform, exception_data, cache)


def test_basic_path_matching():
    enhancement = Enhancements.from_config_string(
        """
        path:**/test.js              +app
    """
    )
    js_rule = enhancement.rules[0]

    assert bool(
        _get_matching_frame_actions(
            js_rule,
            [{"abs_path": "http://example.com/foo/test.js", "filename": "/foo/test.js"}],
            "javascript",
        )
    )

    assert not bool(
        _get_matching_frame_actions(
            js_rule,
            [{"abs_path": "http://example.com/foo/bar.js", "filename": "/foo/bar.js"}],
            "javascript",
        )
    )

    assert bool(
        _get_matching_frame_actions(
            js_rule, [{"abs_path": "http://example.com/foo/test.js"}], "javascript"
        )
    )

    assert not bool(
        _get_matching_frame_actions(js_rule, [{"filename": "/foo/bar.js"}], "javascript")
    )

    assert bool(
        _get_matching_frame_actions(
            js_rule, [{"abs_path": "http://example.com/foo/TEST.js"}], "javascript"
        )
    )

    assert not bool(
        _get_matching_frame_actions(
            js_rule, [{"abs_path": "http://example.com/foo/bar.js"}], "javascript"
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
        _get_matching_frame_actions(
            js_rule, [{"abs_path": "http://example.com/foo/TEST.js"}], "javascript"
        )
    )

    assert not bool(
        _get_matching_frame_actions(
            js_rule, [{"abs_path": "http://example.com/foo/TEST.js"}], "native"
        )
    )

    assert not bool(
        _get_matching_frame_actions(
            native_rule,
            [{"abs_path": "http://example.com/foo/TEST.js", "function": "std::whatever"}],
            "javascript",
        )
    )

    assert bool(_get_matching_frame_actions(native_rule, [{"function": "std::whatever"}], "native"))


def test_app_matching():
    enhancement = Enhancements.from_config_string(
        """
        family:javascript path:**/test.js app:yes       +app
        family:native path:**/test.c app:no            -group
    """
    )
    app_yes_rule, app_no_rule = enhancement.rules

    assert bool(
        _get_matching_frame_actions(
            app_yes_rule,
            [{"abs_path": "http://example.com/foo/TEST.js", "in_app": True}],
            "javascript",
        )
    )
    assert not bool(
        _get_matching_frame_actions(
            app_yes_rule,
            [{"abs_path": "http://example.com/foo/TEST.js", "in_app": False}],
            "javascript",
        )
    )

    assert bool(
        _get_matching_frame_actions(
            app_no_rule, [{"abs_path": "/test.c", "in_app": False}], "native"
        )
    )
    assert not bool(
        _get_matching_frame_actions(
            app_no_rule, [{"abs_path": "/test.c", "in_app": True}], "native"
        )
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
        _get_matching_frame_actions(
            bundled_rule, [{"package": "/var/containers/MyApp/Frameworks/libsomething"}], "native"
        )
    )

    assert bool(
        _get_matching_frame_actions(
            macos_rule, [{"package": "/Applications/MyStuff.app/Contents/MacOS/MyStuff"}], "native"
        )
    )

    assert bool(_get_matching_frame_actions(linux_rule, [{"package": "linux-gate.so"}], "native"))

    assert bool(
        _get_matching_frame_actions(
            windows_rule, [{"package": "D:\\Windows\\System32\\kernel32.dll"}], "native"
        )
    )

    assert bool(
        _get_matching_frame_actions(
            windows_rule, [{"package": "d:\\windows\\System32\\kernel32.dll"}], "native"
        )
    )

    assert not bool(
        _get_matching_frame_actions(
            bundled_rule, [{"package": "/var2/containers/MyApp/Frameworks/libsomething"}], "native"
        )
    )

    assert not bool(
        _get_matching_frame_actions(
            bundled_rule, [{"package": "/var/containers/MyApp/MacOs/MyApp"}], "native"
        )
    )

    assert not bool(
        _get_matching_frame_actions(bundled_rule, [{"package": "/usr/lib/linux-gate.so"}], "native")
    )


def test_type_matching():
    enhancement = Enhancements.from_config_string(
        """
        family:other error.type:ZeroDivisionError -app
        family:other error.type:*Error -app
    """
    )

    zero_rule, error_rule = enhancement.rules

    assert not _get_matching_frame_actions(zero_rule, [{"function": "foo"}], "python")
    assert not _get_matching_frame_actions(zero_rule, [{"function": "foo"}], "python", None)
    assert not _get_matching_frame_actions(error_rule, [{"function": "foo"}], "python")
    assert not _get_matching_frame_actions(error_rule, [{"function": "foo"}], "python", None)

    assert _get_matching_frame_actions(
        zero_rule, [{"function": "foo"}], "python", {"type": "ZeroDivisionError"}
    )

    assert not _get_matching_frame_actions(
        zero_rule, [{"function": "foo"}], "native", {"type": "FooError"}
    )

    assert _get_matching_frame_actions(
        error_rule, [{"function": "foo"}], "python", {"type": "ZeroDivisionError"}
    )

    assert _get_matching_frame_actions(
        error_rule, [{"function": "foo"}], "python", {"type": "FooError"}
    )


def test_value_matching():
    enhancement = Enhancements.from_config_string(
        """
        family:other error.value:foo -app
        family:other error.value:Failed* -app
    """
    )

    foo_rule, failed_rule = enhancement.rules

    assert not _get_matching_frame_actions(foo_rule, [{"function": "foo"}], "python")
    assert not _get_matching_frame_actions(foo_rule, [{"function": "foo"}], "python", None)
    assert not _get_matching_frame_actions(failed_rule, [{"function": "foo"}], "python")
    assert not _get_matching_frame_actions(failed_rule, [{"function": "foo"}], "python", None)

    assert _get_matching_frame_actions(foo_rule, [{"function": "foo"}], "python", {"value": "foo"})

    assert not _get_matching_frame_actions(
        foo_rule, [{"function": "foo"}], "native", {"value": "Failed to download"}
    )

    assert not _get_matching_frame_actions(
        failed_rule, [{"function": "foo"}], "python", {"value": "foo"}
    )

    assert _get_matching_frame_actions(
        failed_rule, [{"function": "foo"}], "python", {"value": "Failed to download"}
    )


def test_mechanism_matching():
    enhancement = Enhancements.from_config_string(
        """
        family:other error.mechanism:NSError -app
    """
    )

    (rule,) = enhancement.rules

    assert not _get_matching_frame_actions(rule, [{"function": "foo"}], "python")
    assert not _get_matching_frame_actions(rule, [{"function": "foo"}], "python", None)

    assert _get_matching_frame_actions(
        rule, [{"function": "foo"}], "python", {"mechanism": {"type": "NSError"}}
    )

    assert not _get_matching_frame_actions(
        rule, [{"function": "foo"}], "native", {"mechanism": {"type": "NSError"}}
    )

    assert not _get_matching_frame_actions(
        rule, [{"function": "foo"}], "python", {"mechanism": {"type": "fooerror"}}
    )


def test_mechanism_matching_no_frames():
    enhancement = Enhancements.from_config_string(
        """
        error.mechanism:NSError -app
    """
    )
    (rule,) = enhancement.rules
    exception_data = {"mechanism": {"type": "NSError"}}

    # Does not crash:
    assert [] == _get_matching_frame_actions(rule, [], "python", exception_data)

    # Matcher matches:
    (matcher,) = rule._exception_matchers
    assert matcher.matches_frame([], None, "python", exception_data, {})


def test_range_matching():
    enhancement = Enhancements.from_config_string(
        """
        [ function:foo ] | function:* | [ function:baz ] category=bar
    """
    )

    (rule,) = enhancement.rules

    assert sorted(
        dict(
            _get_matching_frame_actions(
                rule,
                [
                    {"function": "main"},
                    {"function": "foo"},
                    {"function": "bar"},
                    {"function": "baz"},
                    {"function": "abort"},
                ],
                "python",
            )
        )
    ) == [2]


def test_range_matching_direct():
    enhancement = Enhancements.from_config_string(
        """
        function:bar | [ function:baz ] -group
    """
    )

    (rule,) = enhancement.rules

    assert sorted(
        dict(
            _get_matching_frame_actions(
                rule,
                [
                    {"function": "main"},
                    {"function": "foo"},
                    {"function": "bar"},
                    {"function": "baz"},
                    {"function": "abort"},
                ],
                "python",
            )
        )
    ) == [2]

    assert not _get_matching_frame_actions(
        rule,
        [
            {"function": "main"},
            {"function": "foo"},
            {"function": "bar"},
            {"function": "abort"},
            {"function": "baz"},
        ],
        "python",
    )


@pytest.mark.parametrize("action", ["+", "-"])
@pytest.mark.parametrize("type", ["prefix", "sentinel"])
def test_sentinel_and_prefix(action, type):
    rule = Enhancements.from_config_string(f"function:foo {action}{type}").rules[0]

    frames = [{"function": "foo"}]
    actions = _get_matching_frame_actions(rule, frames, "whatever")
    assert len(actions) == 1

    component = GroupingComponent(id=None)
    assert not getattr(component, f"is_{type}_frame")

    actions[0][1].update_frame_components_contributions([component], frames, 0)
    expected = action == "+"
    assert getattr(component, f"is_{type}_frame") is expected


@pytest.mark.parametrize(
    "frame",
    [
        {"function": "foo"},
        {"function": "foo", "in_app": False},
    ],
)
def test_app_no_matches(frame):
    enhancements = Enhancements.from_config_string("app:no +app")
    enhancements.apply_modifications_to_frame([frame], "native", None)
    assert frame.get("in_app")
