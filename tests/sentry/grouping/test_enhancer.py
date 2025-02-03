from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any
from unittest import mock

import pytest

from sentry.grouping.component import FrameGroupingComponent, StacktraceGroupingComponent
from sentry.grouping.enhancer import (
    Enhancements,
    is_valid_profiling_action,
    is_valid_profiling_matcher,
    keep_profiling_rules,
)
from sentry.grouping.enhancer.exceptions import InvalidEnhancerConfig
from sentry.grouping.enhancer.matchers import _cached, create_match_frame
from sentry.testutils.cases import TestCase


def dump_obj(obj):
    if not isinstance(getattr(obj, "__dict__", None), dict):
        return obj
    rv: dict[str, Any] = {}
    for key, value in obj.__dict__.items():
        if key.startswith("_"):
            continue
        elif key == "rust_enhancements":
            continue
        elif isinstance(value, list):
            rv[key] = [dump_obj(x) for x in value]
        elif isinstance(value, dict):
            rv[key] = {k: dump_obj(v) for k, v in value.items()}
        else:
            rv[key] = value
    return rv


@pytest.mark.parametrize("version", [2])
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

error.value:"*something*"                       max-frames=12
""",
        bases=["common:v1"],
    )
    enhancement.version = version

    insta_snapshot(dump_obj(enhancement))

    dumped = enhancement.dumps()
    assert Enhancements.loads(dumped).dumps() == dumped
    assert Enhancements.loads(dumped)._to_config_structure() == enhancement._to_config_structure()
    assert isinstance(dumped, str)


def test_parse_empty_with_base():
    enhancement = Enhancements.from_config_string(
        "",
        bases=["newstyle:2023-01-11"],
    )
    assert enhancement


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


def test_flipflop_inapp():
    enhancement = Enhancements.from_config_string(
        """
        family:all +app
        family:all -app
    """
    )

    frames: list[dict[str, Any]] = [{}]
    enhancement.apply_category_and_updated_in_app_to_frames(frames, "javascript", {})

    assert frames[0]["data"]["orig_in_app"] == -1  # == None
    assert frames[0]["in_app"] is False

    frames = [{"in_app": False}]
    enhancement.apply_category_and_updated_in_app_to_frames(frames, "javascript", {})

    assert "data" not in frames[0]  # no changes were made
    assert frames[0]["in_app"] is False

    frames = [{"in_app": True}]
    enhancement.apply_category_and_updated_in_app_to_frames(frames, "javascript", {})

    assert frames[0]["data"]["orig_in_app"] == 1  # == True
    assert frames[0]["in_app"] is False


def _get_matching_frame_actions(rule, frames, platform, exception_data=None, cache=None):
    """Convenience function for rule tests"""
    if cache is None:
        cache = {}

    match_frames = [create_match_frame(frame, platform) for frame in frames]

    return rule.get_matching_frame_actions(match_frames, exception_data, cache)


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


def test_invalid_app_matcher():
    enhancements = Enhancements.from_config_string("app://../../src/some-file.ts -app")
    (rule,) = enhancements.rules

    assert not bool(_get_matching_frame_actions(rule, [{}], "javascript"))
    assert not bool(_get_matching_frame_actions(rule, [{"in_app": True}], "javascript"))
    assert not bool(_get_matching_frame_actions(rule, [{"in_app": False}], "javascript"))


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
    assert matcher.matches_frame([], None, exception_data, {})


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


@pytest.mark.parametrize(
    "frame",
    [
        {"function": "foo"},
        {"function": "foo", "in_app": False},
    ],
)
def test_app_no_matches(frame):
    enhancements = Enhancements.from_config_string("app:no +app")
    enhancements.apply_category_and_updated_in_app_to_frames([frame], "native", {})
    assert frame.get("in_app")


def test_cached_with_kwargs():
    """Order of kwargs should not matter"""

    foo = mock.Mock()

    cache: dict[object, object] = {}
    _cached(cache, foo, kw1=1, kw2=2)
    assert foo.call_count == 1

    # Call with different kwargs order - call_count is still one:
    _cached(cache, foo, kw2=2, kw1=1)
    assert foo.call_count == 1


@pytest.mark.parametrize(
    "test_input,expected",
    [
        (["stack.abs_path:**/project/**.c"], True),
        (["stack.module:test_module"], True),
        (["stack.function:myproject_*"], True),
        (["stack.package:**/libcurl.dylib"], True),
        (["family:javascript,native"], False),
        (["app:yes"], False),
        (["category:telemetry"], False),
        (
            ["stack.module:test_module", "|", "[", "stack.package:**/libcurl.dylib", "]"],
            False,
        ),  # we don't allow siblings matchers
    ],
)
def test_valid_profiling_matchers(test_input, expected):
    assert is_valid_profiling_matcher(test_input) == expected


@pytest.mark.parametrize(
    "test_input,expected",
    [
        ("+app", True),
        ("-app", True),
        ("+group", False),
        ("-group", False),
        ("^app", False),
        ("vapp", False),
    ],
)
def test_valid_profiling_action(test_input, expected):
    assert is_valid_profiling_action(test_input) == expected


@pytest.mark.parametrize(
    "test_input,expected",
    [
        (
            """
stack.package:**/libcurl.dylib -group
stack.package:**/libcurl.dylib -app
stack.function:myproject_* +app
stack.function:myproject_* ^app
stack.function:myproject_* vapp
""",
            """stack.package:**/libcurl.dylib -app
stack.function:myproject_* +app""",
        ),
        ("", ""),
        (
            """
category:telemetry -group
family:javascript,native -group
[ stack.function:myproject_* ] | stack.function:utils_* -app
""",
            "",
        ),
    ],
)
def test_keep_profiling_rules(test_input, expected):
    assert keep_profiling_rules(test_input) == expected


@dataclass
class DummyRustComponent:
    contributes: bool | None
    hint: str | None


@dataclass
class DummyRustAssembleResult:
    contributes: bool | None
    hint: str | None


DummyRustExceptionData = dict[str, bytes | None]
DummyRustFrame = dict[str, Any]


class MockRustEnhancements:
    def __init__(
        self,
        frame_results: Sequence[tuple[bool, str | None]],
        stacktrace_results: tuple[bool, str | None] = (True, None),
    ):
        self.frame_results = frame_results
        self.stacktrace_results = stacktrace_results

    def assemble_stacktrace_component(
        self,
        _match_frames: list[DummyRustFrame],
        _exception_data: DummyRustExceptionData,
        rust_components: list[DummyRustComponent],
    ) -> DummyRustAssembleResult:
        # The real (rust) version of this function modifies the components in
        # `rust_components` in place, but that's not possible from python, so instead we
        # replace the contents of the list with our own components
        dummy_rust_components = [
            DummyRustComponent(contributes, hint) for contributes, hint in self.frame_results
        ]
        rust_components[:] = dummy_rust_components

        return DummyRustAssembleResult(*self.stacktrace_results)


def in_app_frame(contributes: bool, hint: str | None) -> FrameGroupingComponent:
    return FrameGroupingComponent(values=[], in_app=True, contributes=contributes, hint=hint)


def system_frame(contributes: bool, hint: str | None) -> FrameGroupingComponent:
    return FrameGroupingComponent(values=[], in_app=False, contributes=contributes, hint=hint)


class AssembleStacktraceComponentTest(TestCase):
    def assert_frame_values_match_expected(
        self,
        stacktrace_component: StacktraceGroupingComponent,
        expected_frame_results: Sequence[tuple[bool, str | None]],
    ) -> None:
        num_frames = len(stacktrace_component.values)
        assert len(expected_frame_results) == num_frames

        for i, frame_component, (expected_contributes, expected_hint) in zip(
            range(num_frames),
            stacktrace_component.values,
            expected_frame_results,
        ):
            assert (
                frame_component.contributes is expected_contributes
            ), f"frame {i} has incorrect `contributes` value"

            assert frame_component.hint == expected_hint, f"frame {i} has incorrect `hint` value"

    def test_uses_results_from_rust_enhancers_simple(self):
        """
        Test that the `contributing` and `hint` results from the rust enhancers are used for both
        frame and stacktrace components.
        """
        frame_components = [
            # All four types of frames (all combos of app vs system, contributing vs not), twice
            # each because in each case there are three possible hints rust could send back
            in_app_frame(contributes=True, hint=None),
            in_app_frame(contributes=True, hint=None),
            in_app_frame(contributes=False, hint=None),
            in_app_frame(contributes=False, hint=None),
            system_frame(contributes=True, hint=None),
            system_frame(contributes=True, hint=None),
            system_frame(contributes=False, hint=None),
            system_frame(contributes=False, hint=None),
        ]

        rust_frame_results = [
            # All of these change the `contributes` value of their respective frames, to show that
            # it's the rust value which gets used in the end. Note that in the cases where the hint
            # is about the in-app-ness of the frame, it means that both a `+/-group` rule applied
            # and a `+/-app` rule applied, with the latter second, such that its "marked in/out of
            # app" hint overwrote the "ignored/unignored" hint. Note that egardless of the hint, the
            # first value in each tuple is a `contributes` value, not an `in_app` value.
            (False, "ignored by stacktrace rule (...)"),
            (False, "marked in-app by stacktrace rule (...)"),
            (True, "un-ignored by stacktrace rule (...)"),
            (True, "marked in-app by stacktrace rule (...)"),
            (False, "ignored by stacktrace rule (...)"),
            (False, "marked out of app by stacktrace rule (...)"),
            (True, "un-ignored by stacktrace rule (...)"),
            (True, "marked out of app by stacktrace rule (...)"),
        ]

        enhancements = Enhancements.from_config_string("")
        mock_rust_enhancements = MockRustEnhancements(
            frame_results=rust_frame_results,
            stacktrace_results=(True, "some stacktrace hint"),
        )

        with mock.patch.object(enhancements, "rust_enhancements", mock_rust_enhancements):
            stacktrace_component = enhancements.assemble_stacktrace_component(
                variant_name="system",
                frame_components=frame_components,
                frames=[{}] * 8,
                platform="javascript",
                exception_data={},
            )

            self.assert_frame_values_match_expected(
                stacktrace_component, expected_frame_results=rust_frame_results
            )

            assert stacktrace_component.contributes is True
            assert stacktrace_component.hint == "some stacktrace hint"

    def test_always_marks_app_variant_system_frames_non_contributing(self):
        """
        Test that the rust results are used or ignored as appropriate when handling the app variant,
        and are always used when handling the system variant.
        """
        app_variant_frame_components = [
            system_frame(contributes=False, hint="non app frame"),
            system_frame(contributes=False, hint="non app frame"),
            system_frame(contributes=False, hint="non app frame"),
            system_frame(contributes=False, hint="non app frame"),
            system_frame(contributes=False, hint="non app frame"),
            system_frame(contributes=False, hint="non app frame"),
        ]
        system_variant_frame_components = [
            system_frame(contributes=True, hint=None),
            system_frame(contributes=True, hint=None),
            system_frame(contributes=True, hint=None),
            system_frame(contributes=True, hint=None),
            system_frame(contributes=True, hint=None),
            system_frame(contributes=True, hint=None),
        ]

        rust_frame_results = [
            # All the possible results which could be sent back for system frames (IOW, everything
            # but "marked in-app"). See more detail about possible hints in both the
            # `Enhancements.assemble_stacktrace_component` code and the `test_simple` test above.
            (False, "ignored by stacktrace rule (...)"),
            (False, "marked out of app by stacktrace rule (...)"),
            (False, None),
            (True, "un-ignored by stacktrace rule (...)"),
            (True, "marked out of app by stacktrace rule (...)"),
            (True, None),
        ]

        app_expected_frame_results = [
            # None of the frames contributes, because they're all out of app, and the rust hint is
            # only used when it relates to a `-app` rule.
            (False, "non app frame"),
            (False, "marked out of app by stacktrace rule (...)"),
            (False, "non app frame"),
            (False, "non app frame"),
            (False, "marked out of app by stacktrace rule (...)"),
            (False, "non app frame"),
        ]
        # The system variant just takes its values straight from rust
        system_expected_frame_results = rust_frame_results

        enhancements = Enhancements.from_config_string("")
        mock_rust_enhancements = MockRustEnhancements(frame_results=rust_frame_results)

        with mock.patch.object(enhancements, "rust_enhancements", mock_rust_enhancements):
            app_stacktrace_component = enhancements.assemble_stacktrace_component(
                variant_name="app",
                frame_components=app_variant_frame_components,
                frames=[{}] * 6,
                platform="javascript",
                exception_data={},
            )
            system_stacktrace_component = enhancements.assemble_stacktrace_component(
                variant_name="system",
                frame_components=system_variant_frame_components,
                frames=[{}] * 6,
                platform="javascript",
                exception_data={},
            )

            self.assert_frame_values_match_expected(
                app_stacktrace_component, expected_frame_results=app_expected_frame_results
            )
            self.assert_frame_values_match_expected(
                system_stacktrace_component, expected_frame_results=system_expected_frame_results
            )

    def test_marks_app_stacktrace_non_contributing_if_no_in_app_frames(self):
        """
        Test that if frame special-casing for the app variant results in no contributing frames, the
        stacktrace is marked non-contributing.
        """
        frame_components = [
            # All possibilities (all combos of app vs system, contributing vs not) except a
            # contributing system frame, since that will never be passed to
            # `assemble_stacktrace_component` when dealing with the app variant
            system_frame(contributes=False, hint="non app frame"),
            in_app_frame(contributes=False, hint="ignored due to recursion"),
            in_app_frame(contributes=True, hint=None),
        ]

        # With these results, there will still be a contributing frame in the end
        rust_frame_results1 = [
            (True, "un-ignored by stacktrace rule (...)"),
            (False, None),
            (True, None),
        ]
        # With these results, there won't
        rust_frame_results2 = [
            (True, "un-ignored by stacktrace rule (...)"),
            (False, None),
            (False, "ignored by stacktrace rule (...)"),
        ]

        # In both cases, the first frame doesn't contribute because it's a system frame, even though
        # the rust results say it should
        expected_frame_results1 = [
            (False, "non app frame"),
            (False, "ignored due to recursion"),
            (True, None),
        ]
        expected_frame_results2 = [
            (False, "non app frame"),
            (False, "ignored due to recursion"),
            (False, "ignored by stacktrace rule (...)"),
        ]

        enhancements1 = Enhancements.from_config_string("")
        mock_rust_enhancements1 = MockRustEnhancements(
            frame_results=rust_frame_results1, stacktrace_results=(True, None)
        )
        enhancements2 = Enhancements.from_config_string("")
        mock_rust_enhancements2 = MockRustEnhancements(
            frame_results=rust_frame_results2, stacktrace_results=(True, None)
        )

        # In this case, even after we force the system frame not to contribute, we'll still have
        # another contributing frame, so we'll use rust's `contributing: True` for the stacktrace
        # component.
        with mock.patch.object(enhancements1, "rust_enhancements", mock_rust_enhancements1):
            stacktrace_component1 = enhancements1.assemble_stacktrace_component(
                variant_name="app",
                frame_components=frame_components,
                frames=[{}] * 3,
                platform="javascript",
                exception_data={},
            )

            self.assert_frame_values_match_expected(
                stacktrace_component1, expected_frame_results=expected_frame_results1
            )

            assert stacktrace_component1.contributes is True
            assert stacktrace_component1.hint is None

        # In this case, once we force the system frame not to contribute, we won't have any
        # contributing frames, so we'll force `contributing: False` for the stacktrace component.
        with mock.patch.object(enhancements2, "rust_enhancements", mock_rust_enhancements2):
            stacktrace_component2 = enhancements2.assemble_stacktrace_component(
                variant_name="app",
                frame_components=frame_components,
                frames=[{}] * 3,
                platform="javascript",
                exception_data={},
            )

            self.assert_frame_values_match_expected(
                stacktrace_component2, expected_frame_results=expected_frame_results2
            )

            assert stacktrace_component2.contributes is False
            assert stacktrace_component2.hint is None
