from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any
from unittest import mock
from unittest.mock import MagicMock, patch

import pytest

from sentry.grouping.api import get_grouping_config_dict_for_project, load_grouping_config
from sentry.grouping.component import FrameGroupingComponent, StacktraceGroupingComponent
from sentry.grouping.enhancer import (
    ENHANCEMENT_BASES,
    Enhancements,
    _is_valid_profiling_matcher,
    _split_rules,
    is_valid_profiling_action,
    keep_profiling_rules,
)
from sentry.grouping.enhancer.actions import EnhancementAction
from sentry.grouping.enhancer.exceptions import InvalidEnhancerConfig
from sentry.grouping.enhancer.matchers import ReturnValueCache, _cached, create_match_frame
from sentry.grouping.enhancer.parser import parse_enhancements
from sentry.grouping.enhancer.rules import EnhancementRule
from sentry.projectoptions.defaults import DEFAULT_GROUPING_CONFIG
from sentry.testutils.cases import TestCase


def convert_to_dict(obj: object) -> object | dict[str, Any]:
    if not isinstance(getattr(obj, "__dict__", None), dict):
        return obj

    d: dict[str, Any] = {}
    for key, value in obj.__dict__.items():
        if key.startswith("_"):
            continue
        elif key in [
            "rust_enhancements",
            "classifier_rust_enhancements",
            "contributes_rust_enhancements",
            "is_classifier",
            "sets_contributes",
            "has_classifier_actions",
            "has_contributes_actions",
            "run_split_enhancements",
        ]:
            continue
        elif isinstance(value, list):
            d[key] = [convert_to_dict(x) for x in value]
        elif isinstance(value, dict):
            d[key] = {k: convert_to_dict(v) for k, v in value.items()}
        else:
            d[key] = value
    return d


def get_matching_frame_actions(
    rule: EnhancementRule,
    frames: list[dict[str, Any]],
    platform: str,
    exception_data: dict[str, Any] | None = None,
    cache: ReturnValueCache | None = None,
) -> list[tuple[int, EnhancementAction]]:
    cache = cache or {}
    exception_data = exception_data or {}

    match_frames = [create_match_frame(frame, platform) for frame in frames]

    return rule.get_matching_frame_actions(match_frames, exception_data, cache)


def get_matching_frame_indices(
    rule: EnhancementRule,
    frames: list[dict[str, Any]],
    platform: str,
    exception_data: dict[str, Any] | None = None,
    cache: ReturnValueCache | None = None,
) -> list[int]:
    matching_frame_actions = get_matching_frame_actions(
        rule, frames, platform, exception_data, cache
    )
    matching_frame_indices = sorted(mfa[0] for mfa in matching_frame_actions)
    return matching_frame_indices


def assert_matching_frame_found(
    rule: EnhancementRule,
    frames: list[dict[str, Any]],
    platform: str,
    exception_data: dict[str, Any] | None = None,
    cache: ReturnValueCache | None = None,
) -> None:
    assert bool(get_matching_frame_actions(rule, frames, platform, exception_data, cache))


def assert_no_matching_frame_found(
    rule: EnhancementRule,
    frames: list[dict[str, Any]],
    platform: str,
    exception_data: dict[str, Any] | None = None,
    cache: ReturnValueCache | None = None,
) -> None:
    assert not bool(get_matching_frame_actions(rule, frames, platform, exception_data, cache))


@pytest.mark.parametrize("version", [3])
def test_basic_parsing(insta_snapshot, version):
    enhancements = Enhancements.from_rules_text(
        """
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
        version=version,
    )

    insta_snapshot(convert_to_dict(enhancements))

    enhancements_str = enhancements.base64_string
    assert Enhancements.from_base64_string(enhancements_str).base64_string == enhancements_str
    assert Enhancements.from_base64_string(enhancements_str)._get_base64_bytes_from_rules(
        enhancements.rules
    ) == enhancements._get_base64_bytes_from_rules(enhancements.rules)
    assert isinstance(enhancements_str, str)


def test_parse_empty_with_base():
    enhancements = Enhancements.from_rules_text(
        "",
        bases=["newstyle:2023-01-11"],
    )
    assert enhancements


def test_parsing_errors():
    with pytest.raises(InvalidEnhancerConfig):
        Enhancements.from_rules_text("invalid.message:foo -> bar")


def test_caller_recursion():
    # Remove this test when CallerMatch can be applied recursively
    with pytest.raises(InvalidEnhancerConfig):
        Enhancements.from_rules_text("[ category:foo ] | [ category:bar ] | category:baz +app")


def test_callee_recursion():
    # Remove this test when CalleeMatch can be applied recursively
    with pytest.raises(InvalidEnhancerConfig):
        Enhancements.from_rules_text(" category:foo | [ category:bar ] | [ category:baz ] +app")


def test_flipflop_inapp():
    enhancements = Enhancements.from_rules_text(
        """
        family:all +app
        family:all -app
    """
    )

    frames: list[dict[str, Any]] = [{}]
    enhancements.apply_category_and_updated_in_app_to_frames(frames, "javascript", {})

    assert frames[0]["data"]["orig_in_app"] == -1  # == None
    assert frames[0]["in_app"] is False

    frames = [{"in_app": False}]
    enhancements.apply_category_and_updated_in_app_to_frames(frames, "javascript", {})

    assert "data" not in frames[0]  # no changes were made
    assert frames[0]["in_app"] is False

    frames = [{"in_app": True}]
    enhancements.apply_category_and_updated_in_app_to_frames(frames, "javascript", {})

    assert frames[0]["data"]["orig_in_app"] == 1  # == True
    assert frames[0]["in_app"] is False


def test_basic_path_matching():
    js_rule = Enhancements.from_rules_text("path:**/test.js +app").rules[0]

    assert_matching_frame_found(
        js_rule,
        [{"abs_path": "http://example.com/foo/test.js", "filename": "/foo/test.js"}],
        "javascript",
    )

    assert_no_matching_frame_found(
        js_rule,
        [{"abs_path": "http://example.com/foo/bar.js", "filename": "/foo/bar.js"}],
        "javascript",
    )

    assert_matching_frame_found(
        js_rule,
        [{"abs_path": "http://example.com/foo/test.js"}],
        "javascript",
    )

    assert_no_matching_frame_found(
        js_rule,
        [{"filename": "/foo/bar.js"}],
        "javascript",
    )

    assert_matching_frame_found(
        js_rule,
        [{"abs_path": "http://example.com/foo/TEST.js"}],
        "javascript",
    )

    assert_no_matching_frame_found(
        js_rule,
        [{"abs_path": "http://example.com/foo/bar.js"}],
        "javascript",
    )


def test_family_matching():
    js_rule, native_rule = Enhancements.from_rules_text(
        """
        family:javascript path:**/test.js              +app
        family:native function:std::*                  -app
        """
    ).rules

    assert_matching_frame_found(
        js_rule, [{"abs_path": "http://example.com/foo/TEST.js"}], "javascript"
    )

    assert_no_matching_frame_found(
        js_rule, [{"abs_path": "http://example.com/foo/TEST.js"}], "native"
    )

    assert_no_matching_frame_found(
        native_rule,
        [{"abs_path": "http://example.com/foo/TEST.js", "function": "std::whatever"}],
        "javascript",
    )

    assert_matching_frame_found(native_rule, [{"function": "std::whatever"}], "native")


def test_app_matching():
    app_yes_rule, app_no_rule = Enhancements.from_rules_text(
        """
        family:javascript path:**/test.js app:yes       +app
        family:native path:**/test.c app:no            -group
        """
    ).rules

    assert_matching_frame_found(
        app_yes_rule,
        [{"abs_path": "http://example.com/foo/TEST.js", "in_app": True}],
        "javascript",
    )

    assert_no_matching_frame_found(
        app_yes_rule,
        [{"abs_path": "http://example.com/foo/TEST.js", "in_app": False}],
        "javascript",
    )

    assert_matching_frame_found(app_no_rule, [{"abs_path": "/test.c", "in_app": False}], "native")

    assert_no_matching_frame_found(app_no_rule, [{"abs_path": "/test.c", "in_app": True}], "native")


def test_invalid_app_matcher():
    rule = Enhancements.from_rules_text("app://../../src/some-file.ts -app").rules[0]

    assert_no_matching_frame_found(rule, [{}], "javascript")
    assert_no_matching_frame_found(rule, [{"in_app": True}], "javascript")
    assert_no_matching_frame_found(rule, [{"in_app": False}], "javascript")


def test_package_matching():
    # This tests a bunch of different rules from the default in-app logic that
    # was ported from the former native plugin.
    bundled_rule, macos_rule, linux_rule, windows_rule = Enhancements.from_rules_text(
        """
        family:native package:/var/**/Frameworks/**                  -app
        family:native package:**/*.app/Contents/**                   +app
        family:native package:linux-gate.so                          -app
        family:native package:?:/Windows/**                          -app
        """
    ).rules

    assert_matching_frame_found(
        bundled_rule, [{"package": "/var/containers/MyApp/Frameworks/libsomething"}], "native"
    )

    assert_matching_frame_found(
        macos_rule, [{"package": "/Applications/MyStuff.app/Contents/MacOS/MyStuff"}], "native"
    )

    assert_matching_frame_found(linux_rule, [{"package": "linux-gate.so"}], "native")

    assert_matching_frame_found(
        windows_rule, [{"package": "D:\\Windows\\System32\\kernel32.dll"}], "native"
    )

    assert_matching_frame_found(
        windows_rule, [{"package": "d:\\windows\\System32\\kernel32.dll"}], "native"
    )

    assert_no_matching_frame_found(
        bundled_rule, [{"package": "/var2/containers/MyApp/Frameworks/libsomething"}], "native"
    )

    assert_no_matching_frame_found(
        bundled_rule, [{"package": "/var/containers/MyApp/MacOs/MyApp"}], "native"
    )

    assert_no_matching_frame_found(bundled_rule, [{"package": "/usr/lib/linux-gate.so"}], "native")


def test_type_matching():
    zero_rule, error_rule = Enhancements.from_rules_text(
        """
        family:other error.type:ZeroDivisionError -app
        family:other error.type:*Error -app
        """
    ).rules

    assert_no_matching_frame_found(zero_rule, [{"function": "foo"}], "python")
    assert_no_matching_frame_found(error_rule, [{"function": "foo"}], "python")

    assert_matching_frame_found(
        zero_rule, [{"function": "foo"}], "python", {"type": "ZeroDivisionError"}
    )

    assert_no_matching_frame_found(zero_rule, [{"function": "foo"}], "native", {"type": "FooError"})

    assert_matching_frame_found(
        error_rule, [{"function": "foo"}], "python", {"type": "ZeroDivisionError"}
    )

    assert_matching_frame_found(error_rule, [{"function": "foo"}], "python", {"type": "FooError"})


def test_value_matching():
    foo_rule, failed_rule = Enhancements.from_rules_text(
        """
        family:other error.value:foo -app
        family:other error.value:Failed* -app
        """
    ).rules

    assert_no_matching_frame_found(foo_rule, [{"function": "foo"}], "python")
    assert_no_matching_frame_found(failed_rule, [{"function": "foo"}], "python")

    assert_matching_frame_found(foo_rule, [{"function": "foo"}], "python", {"value": "foo"})

    assert_no_matching_frame_found(
        foo_rule, [{"function": "foo"}], "native", {"value": "Failed to download"}
    )

    assert_no_matching_frame_found(failed_rule, [{"function": "foo"}], "python", {"value": "foo"})

    assert_matching_frame_found(
        failed_rule, [{"function": "foo"}], "python", {"value": "Failed to download"}
    )


def test_mechanism_matching():
    rule = Enhancements.from_rules_text("family:other error.mechanism:NSError -app").rules[0]

    assert_no_matching_frame_found(rule, [{"function": "foo"}], "python")

    assert_matching_frame_found(
        rule, [{"function": "foo"}], "python", {"mechanism": {"type": "NSError"}}
    )

    assert_no_matching_frame_found(
        rule, [{"function": "foo"}], "native", {"mechanism": {"type": "NSError"}}
    )

    assert_no_matching_frame_found(
        rule, [{"function": "foo"}], "python", {"mechanism": {"type": "fooerror"}}
    )


def test_mechanism_matching_no_frames():
    rule = Enhancements.from_rules_text("error.mechanism:NSError -app").rules[0]
    exception_data = {"mechanism": {"type": "NSError"}}

    # Does not crash:
    assert [] == get_matching_frame_actions(rule, [], "python", exception_data)

    # Matcher matches:
    matcher = rule._exception_matchers[0]
    assert matcher.matches_frame([], None, exception_data, {})


def test_range_matching():
    rule = Enhancements.from_rules_text(
        "[ function:foo ] | function:* | [ function:baz ] category=bar"
    ).rules[0]

    assert get_matching_frame_indices(
        rule,
        [
            {"function": "main"},
            {"function": "foo"},
            {"function": "bar"},
            {"function": "baz"},
            {"function": "abort"},
        ],
        "python",
    ) == [2]


def test_range_matching_direct():
    rule = Enhancements.from_rules_text("function:bar | [ function:baz ] -group").rules[0]

    assert get_matching_frame_indices(
        rule,
        [
            {"function": "main"},
            {"function": "foo"},
            {"function": "bar"},
            {"function": "baz"},
            {"function": "abort"},
        ],
        "python",
    ) == [2]

    assert_no_matching_frame_found(
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
    enhancements = Enhancements.from_rules_text("app:no +app")
    enhancements.apply_category_and_updated_in_app_to_frames([frame], "native", {})
    assert frame.get("in_app") is True


def test_cached_with_kwargs():
    """Order of kwargs should not matter"""

    foo = mock.Mock()

    cache: ReturnValueCache = {}
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
    assert _is_valid_profiling_matcher(test_input) == expected


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


class EnhancementsTest(TestCase):
    def setUp(self):
        self.rules_text = """
            function:sit              +app                  # should end up in classifiers
            function:roll_over        category=trick        # should end up in classifiers
            function:shake            +group                # should end up in contributes
            function:lie_down         max-frames=11         # should end up in contributes
            function:stay             min-frames=12         # should end up in contributes
            function:kangaroo         -app -group           # should end up in both
            """

    def test_differentiates_between_classifier_and_contributes_rules(self):
        rules = parse_enhancements(self.rules_text)

        expected_results = [
            # (has_classifier_actions, has_contributes_actions, classifier_actions, contributes_actions)
            (True, False, ["+app"], None),
            (True, False, ["category=trick"], None),
            (False, True, None, ["+group"]),
            (False, True, None, ["max-frames=11"]),
            (False, True, None, ["min-frames=12"]),
            (True, True, ["-app"], ["-group"]),
        ]

        for i, expected in enumerate(expected_results):
            (
                expected_has_classifier_actions_value,
                expected_has_contributes_actions_value,
                expected_as_classifier_rule_actions,
                expected_as_contributes_rule_actions,
            ) = expected
            rule = rules[i]

            classifier_rule = rule.as_classifier_rule()
            classifier_rule_actions = (
                [str(action) for action in classifier_rule.actions] if classifier_rule else None
            )
            contributes_rule = rule.as_contributes_rule()
            contributes_rule_actions = (
                [str(action) for action in contributes_rule.actions] if contributes_rule else None
            )

            assert rule.has_classifier_actions == expected_has_classifier_actions_value
            assert rule.has_contributes_actions == expected_has_contributes_actions_value
            assert classifier_rule_actions == expected_as_classifier_rule_actions
            assert contributes_rule_actions == expected_as_contributes_rule_actions

    def test_splits_rules_correctly(self):
        enhancements = Enhancements.from_rules_text(self.rules_text, version=3)
        assert [rule.text for rule in enhancements.classifier_rules] == [
            "function:sit +app",
            "function:roll_over category=trick",
            "function:kangaroo -app",  # Split of `function:kangaroo -app -group`
        ]
        assert [rule.text for rule in enhancements.contributes_rules] == [
            "function:shake +group",
            "function:lie_down max-frames=11",
            "function:stay min-frames=12",
            "function:kangaroo -group",  # Split of `function:kangaroo -app -group`
        ]

    def test_adds_split_rules_to_base_enhancements(self):
        for base in ENHANCEMENT_BASES.values():
            # Make these sets so checking in them is faster
            classifier_rules = set(base.classifier_rules)
            contributes_rules = set(base.contributes_rules)

            for rule in base.rules:
                if rule.has_classifier_actions:
                    assert rule.as_classifier_rule() in classifier_rules
                if rule.has_contributes_actions:
                    assert rule.as_contributes_rule() in contributes_rules

    @patch("sentry.grouping.enhancer.parse_enhancements", wraps=parse_enhancements)
    def test_caches_enhancements(self, parse_enhancements_spy: MagicMock):
        self.project.update_option(
            "sentry:grouping_enhancements", "stack.function:recordMetrics +app -group"
        )
        get_grouping_config_dict_for_project(self.project)
        assert parse_enhancements_spy.call_count == 1

        get_grouping_config_dict_for_project(self.project)
        # We didn't parse again because the result was cached
        assert parse_enhancements_spy.call_count == 1

    @patch("sentry.grouping.enhancer.parse_enhancements", wraps=parse_enhancements)
    def test_caches_split_enhancements(self, parse_enhancements_spy: MagicMock):
        self.project.update_option("sentry:grouping_enhancements", "function:playFetch +app +group")

        # Using version 3 forces the enhancements to be split, and we know a split will happen
        # because the custom rule added above has both an in-app and a contributes action
        with patch("sentry.grouping.api.get_enhancements_version", return_value=3):
            get_grouping_config_dict_for_project(self.project)
            assert parse_enhancements_spy.call_count == 1

            get_grouping_config_dict_for_project(self.project)
            # We didn't parse again because the result was cached
            assert parse_enhancements_spy.call_count == 1

    def test_loads_enhancements_from_base64_string(self):
        enhancements = Enhancements.from_rules_text("function:playFetch +app")
        assert len(enhancements.rules) == 1
        assert str(enhancements.rules[0]) == "<EnhancementRule function:playFetch +app>"
        assert enhancements.id is None

        strategy_config = load_grouping_config(
            {"id": DEFAULT_GROUPING_CONFIG, "enhancements": enhancements.base64_string}
        )
        assert len(strategy_config.enhancements.rules) == 1
        assert str(enhancements.rules[0]) == "<EnhancementRule function:playFetch +app>"
        assert strategy_config.enhancements.id is None

    @patch("sentry.grouping.enhancer._split_rules", wraps=_split_rules)
    def test_loads_split_enhancements_from_base64_string(self, split_rules_spy: MagicMock):
        # Using version 3 forces the enhancements to be split, and we know a split will happen
        # because the rule below has both an in-app and a contributes action
        enhancements = Enhancements.from_rules_text("function:playFetch +app +group", version=3)
        assert len(enhancements.rules) == 1
        assert len(enhancements.classifier_rules) == 1
        assert len(enhancements.contributes_rules) == 1
        assert str(enhancements.rules[0]) == "<EnhancementRule function:playFetch +app +group>"
        assert str(enhancements.classifier_rules[0]) == "<EnhancementRule function:playFetch +app>"
        assert (
            str(enhancements.contributes_rules[0]) == "<EnhancementRule function:playFetch +group>"
        )
        assert enhancements.id is None
        assert split_rules_spy.call_count == 1

        strategy_config = load_grouping_config(
            {"id": DEFAULT_GROUPING_CONFIG, "enhancements": enhancements.base64_string}
        )
        assert len(strategy_config.enhancements.rules) == 1
        assert len(strategy_config.enhancements.classifier_rules) == 1
        assert len(strategy_config.enhancements.contributes_rules) == 1
        assert (
            str(strategy_config.enhancements.rules[0])
            == "<EnhancementRule function:playFetch +app +group>"
        )
        assert (
            str(strategy_config.enhancements.classifier_rules[0])
            == "<EnhancementRule function:playFetch +app>"
        )
        assert (
            str(strategy_config.enhancements.contributes_rules[0])
            == "<EnhancementRule function:playFetch +group>"
        )
        assert strategy_config.enhancements.id is None
        # Rules didn't have to be split again because they were cached in split form
        assert split_rules_spy.call_count == 1

    def test_uses_default_enhancements_when_loading_string_with_invalid_version(self):
        enhancements = Enhancements.from_rules_text("function:playFetch +app")
        assert len(enhancements.rules) == 1
        assert str(enhancements.rules[0]) == "<EnhancementRule function:playFetch +app>"
        assert enhancements.id is None

        # Version 1 no longer exists
        enhancements.version = 1

        strategy_config = load_grouping_config(
            {"id": DEFAULT_GROUPING_CONFIG, "enhancements": enhancements.base64_string}
        )
        assert len(strategy_config.enhancements.rules) > 1
        assert "<EnhancementRule function:playFetch +app>" not in {
            str(rule) for rule in strategy_config.enhancements.rules
        }
        assert strategy_config.enhancements.id == DEFAULT_GROUPING_CONFIG


# Note: This primarily tests `assemble_stacktrace_component`'s handling of `contributes` values, as
# hints are tested separately in `test_hints.py`.
class AssembleStacktraceComponentTest(TestCase):

    @dataclass
    class DummyRustFrame:
        contributes: bool | None
        hint: str | None

    @dataclass
    class DummyRustStacktraceResult:
        contributes: bool | None
        hint: str | None

    DummyRustExceptionData = dict[str, bytes | None]
    DummyMatchFrame = dict[str, Any]

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
            _match_frames: list[AssembleStacktraceComponentTest.DummyMatchFrame],
            _exception_data: AssembleStacktraceComponentTest.DummyRustExceptionData,
            rust_frames: list[AssembleStacktraceComponentTest.DummyRustFrame],
        ) -> AssembleStacktraceComponentTest.DummyRustStacktraceResult:
            # The real (rust) version of this function modifies the RustFrames in `rust_frames` in
            # place, but that's not possible from python, so instead we replace the contents of the
            # list with our own RustFrames
            dummy_rust_frames = [
                AssembleStacktraceComponentTest.DummyRustFrame(contributes, hint)
                for contributes, hint in self.frame_results
            ]
            rust_frames[:] = dummy_rust_frames

            return AssembleStacktraceComponentTest.DummyRustStacktraceResult(
                *self.stacktrace_results
            )

    def in_app_frame(self, contributes: bool, hint: str | None) -> FrameGroupingComponent:
        return FrameGroupingComponent(values=[], in_app=True, contributes=contributes, hint=hint)

    def system_frame(self, contributes: bool, hint: str | None) -> FrameGroupingComponent:
        return FrameGroupingComponent(values=[], in_app=False, contributes=contributes, hint=hint)

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
            ), f"frame {i} has incorrect `contributes` value. Expected {expected_contributes} but got {frame_component.contributes}."

            assert (
                frame_component.hint == expected_hint
            ), f"frame {i} has incorrect `hint` value. Expected '{expected_hint}' but got '{frame_component.hint}'."

    def test_marks_system_frames_non_contributing_in_app_variant(self):
        # For the app variant, out-of-app frames are automatically marked non-contributing when
        # they're created. Thus the only way they could even _try_ to contribute is if they match
        # an un-ignore rule.

        incoming_frames = [{"in_app": False}]

        frame_components = [self.system_frame(contributes=False, hint="non app frame")]

        rust_frame_results = [(True, "un-ignored by stacktrace rule (...)")]

        app_expected_frame_results = [(False, "non app frame")]

        enhancements = Enhancements.from_rules_text("")
        mock_rust_enhancements = self.MockRustEnhancements(
            frame_results=rust_frame_results, stacktrace_results=(False, "some stacktrace hint")
        )

        with mock.patch.object(
            enhancements, "contributes_rust_enhancements", mock_rust_enhancements
        ):
            app_stacktrace_component = enhancements.assemble_stacktrace_component(
                variant_name="app",
                frame_components=frame_components,
                frames=incoming_frames,
                platform="javascript",
                exception_data={},
            )

            self.assert_frame_values_match_expected(
                app_stacktrace_component, expected_frame_results=app_expected_frame_results
            )

    def test_marks_app_stacktrace_non_contributing_if_no_in_app_frames(self):
        """
        Test that if frame special-casing for the app variant results in no contributing frames, the
        stacktrace is marked non-contributing.
        """
        incoming_frames = [
            {"in_app": False},
            {"in_app": True},
            {"in_app": True},
        ]
        frame_components = [
            # All possibilities (all combos of app vs system, contributing vs not) except a
            # contributing system frame, since that will never be passed to
            # `assemble_stacktrace_component` when dealing with the app variant
            self.system_frame(contributes=False, hint="non app frame"),
            self.in_app_frame(contributes=False, hint="ignored due to recursion"),
            self.in_app_frame(contributes=True, hint=None),
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

        enhancements1 = Enhancements.from_rules_text("")
        mock_rust_enhancements1 = self.MockRustEnhancements(
            frame_results=rust_frame_results1, stacktrace_results=(True, None)
        )
        enhancements2 = Enhancements.from_rules_text("")
        mock_rust_enhancements2 = self.MockRustEnhancements(
            frame_results=rust_frame_results2, stacktrace_results=(True, None)
        )

        # In this case, even after we force the system frame not to contribute, we'll still have
        # another contributing frame, so we'll use rust's `contributing: True` for the stacktrace
        # component.
        with mock.patch.object(
            enhancements1, "contributes_rust_enhancements", mock_rust_enhancements1
        ):
            stacktrace_component1 = enhancements1.assemble_stacktrace_component(
                variant_name="app",
                frame_components=frame_components,
                frames=incoming_frames,
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
        with mock.patch.object(
            enhancements2, "contributes_rust_enhancements", mock_rust_enhancements2
        ):
            stacktrace_component2 = enhancements2.assemble_stacktrace_component(
                variant_name="app",
                frame_components=frame_components,
                frames=incoming_frames,
                platform="javascript",
                exception_data={},
            )

            self.assert_frame_values_match_expected(
                stacktrace_component2, expected_frame_results=expected_frame_results2
            )

            assert stacktrace_component2.contributes is False
            assert stacktrace_component2.hint is None
