from typing import Any
from unittest.mock import patch

import pytest

from sentry.conf.server import FALL_2025_GROUPING_CONFIG, WINTER_2023_GROUPING_CONFIG
from sentry.grouping.api import (
    _apply_custom_title_if_needed,
    get_default_grouping_config_dict,
    get_grouping_variants_for_event,
    load_grouping_config,
)
from sentry.grouping.context import GroupingContext
from sentry.grouping.fingerprinting import FingerprintingConfig
from sentry.grouping.fingerprinting.exceptions import InvalidFingerprintingConfig
from sentry.grouping.fingerprinting.utils import resolve_fingerprint_values
from sentry.grouping.strategies.base import StrategyConfiguration
from sentry.grouping.variants import BaseVariant
from sentry.services.eventstore.models import Event
from sentry.testutils.pytest.fixtures import InstaSnapshotter, django_db_all
from tests.sentry.grouping import FingerprintInput, with_fingerprint_input

GROUPING_CONFIG = get_default_grouping_config_dict()


def test_basic_parsing() -> None:
    rules = FingerprintingConfig.from_config_string(
        """
# This is a config
type:DatabaseUnavailable                        -> DatabaseUnavailable
function:assertion_failed module:foo            -> AssertionFailed, foo
app:true                                        -> aha
app:true                                        -> {{default}}
app:true                                        -> {{ default }}
app:true                                        -> {{  default }}
app:true                                        -> {{default}}, stuff
app:true                                        -> {{ default }}, stuff
app:true                                        -> {{  default }}, stuff
app:true                                        -> "default stuff"
!path:**/foo/**                                 -> everything
!"path":**/foo/**                               -> everything
logger:sentry.*                                 -> logger-, {{ logger }}
message:"\\x\\xff"                              -> stuff
logger:sentry.*                                 -> logger-{{ logger }}, title="Message from {{ logger }}"
logger:sentry.*                                 -> logger-{{ logger }} title="Message from {{ logger }}"
"""
    )
    assert rules._to_config_structure() == {
        "rules": [
            {
                "text": 'type:"DatabaseUnavailable" -> "DatabaseUnavailable"',
                "matchers": [["type", "DatabaseUnavailable"]],
                "fingerprint": ["DatabaseUnavailable"],
                "attributes": {},
            },
            {
                "text": 'function:"assertion_failed" module:"foo" -> "AssertionFailedfoo"',
                "matchers": [["function", "assertion_failed"], ["module", "foo"]],
                "fingerprint": ["AssertionFailed", "foo"],
                "attributes": {},
            },
            {
                "text": 'app:"true" -> "aha"',
                "matchers": [["app", "true"]],
                "fingerprint": ["aha"],
                "attributes": {},
            },
            {
                "text": 'app:"true" -> "{{ default }}"',
                "matchers": [["app", "true"]],
                "fingerprint": ["{{ default }}"],
                "attributes": {},
            },
            {
                "text": 'app:"true" -> "{{ default }}"',
                "matchers": [["app", "true"]],
                "fingerprint": ["{{ default }}"],
                "attributes": {},
            },
            {
                "text": 'app:"true" -> "{{ default }}"',
                "matchers": [["app", "true"]],
                "fingerprint": ["{{ default }}"],
                "attributes": {},
            },
            {
                "text": 'app:"true" -> "{{ default }}stuff"',
                "matchers": [["app", "true"]],
                "fingerprint": ["{{ default }}", "stuff"],
                "attributes": {},
            },
            {
                "text": 'app:"true" -> "{{ default }}stuff"',
                "matchers": [["app", "true"]],
                "fingerprint": ["{{ default }}", "stuff"],
                "attributes": {},
            },
            {
                "text": 'app:"true" -> "{{ default }}stuff"',
                "matchers": [["app", "true"]],
                "fingerprint": ["{{ default }}", "stuff"],
                "attributes": {},
            },
            {
                "text": 'app:"true" -> "default stuff"',
                "matchers": [["app", "true"]],
                "fingerprint": ["default stuff"],
                "attributes": {},
            },
            {
                "text": '!path:"**/foo/**" -> "everything"',
                "matchers": [["!path", "**/foo/**"]],
                "fingerprint": ["everything"],
                "attributes": {},
            },
            {
                "text": '!path:"**/foo/**" -> "everything"',
                "matchers": [["!path", "**/foo/**"]],
                "fingerprint": ["everything"],
                "attributes": {},
            },
            {
                "text": 'logger:"sentry.*" -> "logger-{{ logger }}"',
                "matchers": [["logger", "sentry.*"]],
                "fingerprint": ["logger-", "{{ logger }}"],
                "attributes": {},
            },
            {
                "text": 'message:"\\xÿ" -> "stuff"',
                "matchers": [["message", "\\x\xff"]],
                "fingerprint": ["stuff"],
                "attributes": {},
            },
            {
                "text": 'logger:"sentry.*" -> "logger-{{ logger }}" title="Message from {{ logger }}"',
                "matchers": [["logger", "sentry.*"]],
                "fingerprint": ["logger-", "{{ logger }}"],
                "attributes": {"title": "Message from {{ logger }}"},
            },
            {
                "text": 'logger:"sentry.*" -> "logger-{{ logger }}" title="Message from {{ logger }}"',
                "matchers": [["logger", "sentry.*"]],
                "fingerprint": ["logger-", "{{ logger }}"],
                "attributes": {"title": "Message from {{ logger }}"},
            },
        ],
        "version": 1,
    }

    assert (
        FingerprintingConfig._from_config_structure(
            rules._to_config_structure()
        )._to_config_structure()
        == rules._to_config_structure()
    )


def test_rule_export() -> None:
    rules = FingerprintingConfig.from_config_string(
        """
logger:sentry.*                                 -> logger, {{ logger }}, title="Message from {{ logger }}"
"""
    )
    assert rules.rules[0].to_json() == {
        "attributes": {"title": "Message from {{ logger }}"},
        "fingerprint": ["logger", "{{ logger }}"],
        "matchers": [["logger", "sentry.*"]],
        "text": 'logger:"sentry.*" -> "logger{{ logger }}" title="Message from {{ logger }}"',
    }


def test_parsing_errors() -> None:
    with pytest.raises(InvalidFingerprintingConfig):
        FingerprintingConfig.from_config_string("invalid.message:foo -> bar")


def test_automatic_argument_splitting() -> None:
    rules = FingerprintingConfig.from_config_string(
        """
logger:test -> logger-{{ logger }}
logger:test -> logger-, {{ logger }}
logger:test2 -> logger-{{ logger }}-{{ level }}
logger:test2 -> logger-, {{ logger }}, -, {{ level }}
"""
    )
    assert rules._to_config_structure() == {
        "rules": [
            {
                "text": 'logger:"test" -> "logger-{{ logger }}"',
                "matchers": [["logger", "test"]],
                "fingerprint": ["logger-", "{{ logger }}"],
                "attributes": {},
            },
            {
                "text": 'logger:"test" -> "logger-{{ logger }}"',
                "matchers": [["logger", "test"]],
                "fingerprint": ["logger-", "{{ logger }}"],
                "attributes": {},
            },
            {
                "text": 'logger:"test2" -> "logger-{{ logger }}-{{ level }}"',
                "matchers": [["logger", "test2"]],
                "fingerprint": ["logger-", "{{ logger }}", "-", "{{ level }}"],
                "attributes": {},
            },
            {
                "text": 'logger:"test2" -> "logger-{{ logger }}-{{ level }}"',
                "matchers": [["logger", "test2"]],
                "fingerprint": ["logger-", "{{ logger }}", "-", "{{ level }}"],
                "attributes": {},
            },
        ],
        "version": 1,
    }


def test_discover_field_parsing() -> None:
    rules = FingerprintingConfig.from_config_string(
        """
# This is a config
error.type:DatabaseUnavailable                        -> DatabaseUnavailable
stack.function:assertion_failed stack.module:foo      -> AssertionFailed, foo
app:true                                        -> aha
app:true                                        -> {{ default }}
release:foo                                     -> release-foo
"""
    )
    assert rules._to_config_structure() == {
        "rules": [
            {
                "text": 'type:"DatabaseUnavailable" -> "DatabaseUnavailable"',
                "matchers": [["type", "DatabaseUnavailable"]],
                "fingerprint": ["DatabaseUnavailable"],
                "attributes": {},
            },
            {
                "text": 'function:"assertion_failed" module:"foo" -> "AssertionFailedfoo"',
                "matchers": [["function", "assertion_failed"], ["module", "foo"]],
                "fingerprint": ["AssertionFailed", "foo"],
                "attributes": {},
            },
            {
                "text": 'app:"true" -> "aha"',
                "matchers": [["app", "true"]],
                "fingerprint": ["aha"],
                "attributes": {},
            },
            {
                "text": 'app:"true" -> "{{ default }}"',
                "matchers": [["app", "true"]],
                "fingerprint": ["{{ default }}"],
                "attributes": {},
            },
            {
                "text": 'release:"foo" -> "release-foo"',
                "matchers": [["release", "foo"]],
                "fingerprint": ["release-foo"],
                "attributes": {},
            },
        ],
        "version": 1,
    }

    assert (
        FingerprintingConfig._from_config_structure(
            rules._to_config_structure()
        )._to_config_structure()
        == rules._to_config_structure()
    )


@django_db_all  # Because initializing context checks options
def test_variable_resolution() -> None:
    # TODO: This should be fleshed out to test way more cases, at which point we'll need to add some
    # actual data here
    event = Event(project_id=908415, event_id="11211231", data={})
    context = GroupingContext(StrategyConfiguration(), event)

    for fingerprint_entry, expected_resolved_value in [
        ("{{ default }}", "{{ default }}"),
        ("{{default}}", "{{ default }}"),
        ("{{  default }}", "{{ default }}"),
        ("{{ dog }}", "<unrecognized-variable-dog>"),
    ]:
        assert resolve_fingerprint_values([fingerprint_entry], event, context) == [
            expected_resolved_value
        ], f"Entry {fingerprint_entry} resolved incorrectly"


# TODO: Once we have fully transitioned off of the `newstyle:2023-01-11` grouping config, we can
# remove this test entirely, as the new behavior is also tested in `test_variable_resolution` above
@django_db_all
def test_resolves_unknown_variables_correctly_given_config_value() -> None:
    fingerprint = ["{{ dog }}"]
    event_data = {"message": "Dogs are great!", "fingerprint": fingerprint}
    event = Event(event_id="11212012123120120415201309082013", project_id=908415, data=event_data)
    winter_2023_config = load_grouping_config(
        get_default_grouping_config_dict(WINTER_2023_GROUPING_CONFIG)
    )
    fall_2025_config = load_grouping_config(
        get_default_grouping_config_dict(FALL_2025_GROUPING_CONFIG)
    )

    # Under the current config, we ask for legacy behavior, and as a result the unknown fingerprint
    # variable is returned as is
    with (
        patch(
            "sentry.grouping.api.resolve_fingerprint_values", wraps=resolve_fingerprint_values
        ) as mock_resolve_fingerprint_values,
        patch(
            "sentry.grouping.api._apply_custom_title_if_needed", wraps=_apply_custom_title_if_needed
        ) as mock_apply_custom_title_if_needed,
    ):
        get_grouping_variants_for_event(event, winter_2023_config)

        context = mock_resolve_fingerprint_values.call_args.args[2]
        assert isinstance(context, GroupingContext)

        assert mock_resolve_fingerprint_values.call_count == 1
        assert mock_apply_custom_title_if_needed.call_count == 1
        assert (
            mock_resolve_fingerprint_values.call_args.kwargs["use_legacy_unknown_variable_handling"]
            is True
        )
        assert (
            mock_apply_custom_title_if_needed.call_args.kwargs[
                "use_legacy_unknown_variable_handling"
            ]
            is True
        )
        assert resolve_fingerprint_values(
            fingerprint, event, context, use_legacy_unknown_variable_handling=True
        ) == ["{{ dog }}"]

    # Under the new config, we ask for non-legacy behavior, and as a result the unknown fingerprint
    # variable is replaced by a string flagging the problem
    with (
        patch(
            "sentry.grouping.api.resolve_fingerprint_values", wraps=resolve_fingerprint_values
        ) as mock_resolve_fingerprint_values,
        patch(
            "sentry.grouping.api._apply_custom_title_if_needed", wraps=_apply_custom_title_if_needed
        ) as mock_apply_custom_title_if_needed,
    ):
        get_grouping_variants_for_event(event, fall_2025_config)

        context = mock_resolve_fingerprint_values.call_args.args[2]
        assert isinstance(context, GroupingContext)

        assert mock_resolve_fingerprint_values.call_count == 1
        assert mock_apply_custom_title_if_needed.call_count == 1
        assert (
            mock_resolve_fingerprint_values.call_args.kwargs["use_legacy_unknown_variable_handling"]
            is False
        )
        assert (
            mock_apply_custom_title_if_needed.call_args.kwargs[
                "use_legacy_unknown_variable_handling"
            ]
            is False
        )
        assert resolve_fingerprint_values(
            fingerprint, event, context, use_legacy_unknown_variable_handling=False
        ) == ["<unrecognized-variable-dog>"]


@with_fingerprint_input("input")
@django_db_all  # because of `options` usage
def test_event_hash_variant(insta_snapshot: InstaSnapshotter, input: FingerprintInput) -> None:
    config, event = input.create_event()

    def dump_variant(variant: BaseVariant) -> dict[str, Any]:
        rv = variant.as_dict()

        for key in "hash", "description", "config":
            rv.pop(key, None)

        if "component" in rv:
            for key in "id", "name", "values":
                rv["component"].pop(key, None)

        return rv

    insta_snapshot(
        {
            "config": config.to_json(),
            "fingerprint": event.data["fingerprint"],
            "title": event.data["title"],
            "variants": {
                variant_name: dump_variant(variant)
                for (variant_name, variant) in event.get_grouping_variants(
                    force_config=GROUPING_CONFIG
                ).items()
            },
        }
    )


def test_thread_matchers_parsing() -> None:
    """Test that thread matchers are parsed correctly"""
    rules = FingerprintingConfig.from_config_string(
        """
# Thread-based fingerprinting rules
thread.name:MainThread type:RuntimeError        -> main-thread-error
thread.id:123 function:process                  -> thread-123-process
thread.crashed:true                             -> crashed-thread
thread.current:true thread.name:Worker*         -> current-worker-thread
thread.state:RUNNABLE                           -> runnable-thread
"""
    )
    assert rules._to_config_structure() == {
        "rules": [
            {
                "text": 'thread_name:"MainThread" type:"RuntimeError" -> "main-thread-error"',
                "matchers": [["thread_name", "MainThread"], ["type", "RuntimeError"]],
                "fingerprint": ["main-thread-error"],
                "attributes": {},
            },
            {
                "text": 'thread_id:"123" function:"process" -> "thread-123-process"',
                "matchers": [["thread_id", "123"], ["function", "process"]],
                "fingerprint": ["thread-123-process"],
                "attributes": {},
            },
            {
                "text": 'thread_crashed:"true" -> "crashed-thread"',
                "matchers": [["thread_crashed", "true"]],
                "fingerprint": ["crashed-thread"],
                "attributes": {},
            },
            {
                "text": 'thread_current:"true" thread_name:"Worker*" -> "current-worker-thread"',
                "matchers": [["thread_current", "true"], ["thread_name", "Worker*"]],
                "fingerprint": ["current-worker-thread"],
                "attributes": {},
            },
            {
                "text": 'thread_state:"RUNNABLE" -> "runnable-thread"',
                "matchers": [["thread_state", "RUNNABLE"]],
                "fingerprint": ["runnable-thread"],
                "attributes": {},
            },
        ],
        "version": 1,
    }


def test_thread_matchers_matching() -> None:
    """Test that thread matchers correctly match event data"""
    rules = FingerprintingConfig.from_config_string(
        """
thread.name:MainThread -> main-thread
thread.crashed:true -> crashed
thread.current:true -> current
"""
    )

    # Event with MainThread that crashed
    event_with_main_thread = {
        "threads": {
            "values": [
                {
                    "id": "1",
                    "name": "MainThread",
                    "crashed": True,
                    "current": False,
                    "state": "RUNNABLE",
                }
            ]
        }
    }

    match = rules.get_fingerprint_values_for_event(event_with_main_thread)
    assert match is not None
    assert match.fingerprint == ["main-thread"]

    # Event with crashed thread (not MainThread)
    event_with_crashed = {
        "threads": {
            "values": [
                {
                    "id": "2",
                    "name": "WorkerThread",
                    "crashed": True,
                    "current": False,
                    "state": "BLOCKED",
                }
            ]
        }
    }

    match = rules.get_fingerprint_values_for_event(event_with_crashed)
    assert match is not None
    assert match.fingerprint == ["crashed"]

    # Event with current thread
    event_with_current = {
        "threads": {
            "values": [
                {
                    "id": "3",
                    "name": "BackgroundThread",
                    "crashed": False,
                    "current": True,
                    "state": "WAITING",
                }
            ]
        }
    }

    match = rules.get_fingerprint_values_for_event(event_with_current)
    assert match is not None
    assert match.fingerprint == ["current"]


def test_thread_matchers_wildcard() -> None:
    """Test that wildcard patterns work with thread matchers"""
    rules = FingerprintingConfig.from_config_string(
        """
thread.name:Worker* -> worker-thread
thread.state:RUN* -> running-thread
"""
    )

    event_with_worker = {
        "threads": {
            "values": [
                {
                    "id": "1",
                    "name": "Worker-1",
                    "crashed": False,
                    "current": False,
                    "state": "RUNNABLE",
                }
            ]
        }
    }

    match = rules.get_fingerprint_values_for_event(event_with_worker)
    assert match is not None
    assert match.fingerprint == ["worker-thread"]

    event_with_runnable = {
        "threads": {
            "values": [
                {
                    "id": "2",
                    "name": "MainThread",
                    "crashed": False,
                    "current": False,
                    "state": "RUNNING",
                }
            ]
        }
    }

    match = rules.get_fingerprint_values_for_event(event_with_runnable)
    assert match is not None
    assert match.fingerprint == ["running-thread"]


def test_thread_matchers_negation() -> None:
    """Test that negated thread matchers work correctly"""
    rules = FingerprintingConfig.from_config_string(
        """
!thread.crashed:true -> not-crashed
!thread.name:MainThread -> not-main-thread
"""
    )

    # Event with non-crashed thread
    event_not_crashed = {
        "threads": {
            "values": [
                {
                    "id": "1",
                    "name": "WorkerThread",
                    "crashed": False,
                    "current": False,
                }
            ]
        }
    }

    match = rules.get_fingerprint_values_for_event(event_not_crashed)
    assert match is not None
    assert match.fingerprint == ["not-crashed"]

    # Event without MainThread
    event_not_main = {
        "threads": {
            "values": [
                {
                    "id": "2",
                    "name": "BackgroundThread",
                    "crashed": False,
                    "current": False,
                }
            ]
        }
    }

    match = rules.get_fingerprint_values_for_event(event_not_main)
    assert match is not None
    assert match.fingerprint == ["not-main-thread"]


def test_sibling_frame_parsing() -> None:
    """Test that sibling frame matchers (caller/callee) are parsed correctly"""
    rules = FingerprintingConfig.from_config_string(
        """
# Sibling frame rules
[ function:caller_func ] | function:target_func -> caller-calls-target
function:target_func | [ function:callee_func ] -> target-calls-callee
[ module:foo ] | function:bar | [ module:baz ] -> foo-bar-baz
"""
    )
    assert len(rules.rules) == 3

    # First rule: caller matcher
    assert (
        rules.rules[0].text
        == '[ function:"caller_func" ] | function:"target_func" -> "caller-calls-target"'
    )

    # Second rule: callee matcher
    assert (
        rules.rules[1].text
        == 'function:"target_func" | [ function:"callee_func" ] -> "target-calls-callee"'
    )

    # Third rule: both caller and callee
    assert (
        rules.rules[2].text
        == '[ module:"foo" ] | function:"bar" | [ module:"baz" ] -> "foo-bar-baz"'
    )


def test_sibling_frame_caller_matching() -> None:
    """Test that caller matchers work correctly"""
    rules = FingerprintingConfig.from_config_string(
        """
[ function:caller ] | function:target -> caller-calls-target
"""
    )

    # Event where caller calls target
    event_with_caller = {
        "exception": {
            "values": [
                {
                    "stacktrace": {
                        "frames": [
                            {"function": "bottom"},
                            {"function": "target"},  # This is the target
                            {"function": "caller"},  # This is above target (caller)
                            {"function": "top"},
                        ]
                    }
                }
            ]
        }
    }

    match = rules.get_fingerprint_values_for_event(event_with_caller)
    assert match is not None
    assert match.fingerprint == ["caller-calls-target"]

    # Event where target exists but not called by caller
    event_without_caller = {
        "exception": {
            "values": [
                {
                    "stacktrace": {
                        "frames": [
                            {"function": "bottom"},
                            {"function": "target"},
                            {"function": "other"},
                        ]
                    }
                }
            ]
        }
    }

    match = rules.get_fingerprint_values_for_event(event_without_caller)
    assert match is None


def test_sibling_frame_callee_matching() -> None:
    """Test that callee matchers work correctly"""
    rules = FingerprintingConfig.from_config_string(
        """
function:target | [ function:callee ] -> target-calls-callee
"""
    )

    # Event where target calls callee
    event_with_callee = {
        "exception": {
            "values": [
                {
                    "stacktrace": {
                        "frames": [
                            {"function": "callee"},  # This is below target (callee)
                            {"function": "target"},  # This is the target
                            {"function": "caller"},
                        ]
                    }
                }
            ]
        }
    }

    match = rules.get_fingerprint_values_for_event(event_with_callee)
    assert match is not None
    assert match.fingerprint == ["target-calls-callee"]

    # Event where target exists but doesn't call callee
    event_without_callee = {
        "exception": {
            "values": [
                {
                    "stacktrace": {
                        "frames": [
                            {"function": "other"},
                            {"function": "target"},
                            {"function": "caller"},
                        ]
                    }
                }
            ]
        }
    }

    match = rules.get_fingerprint_values_for_event(event_without_callee)
    assert match is None


def test_sibling_frame_both_caller_and_callee() -> None:
    """Test rules with both caller and callee matchers"""
    rules = FingerprintingConfig.from_config_string(
        """
[ function:caller ] | function:target | [ function:callee ] -> full-context
"""
    )

    # Event with full context: caller -> target -> callee
    event_full_context = {
        "exception": {
            "values": [
                {
                    "stacktrace": {
                        "frames": [
                            {"function": "callee"},  # callee (below target)
                            {"function": "target"},  # target
                            {"function": "caller"},  # caller (above target)
                            {"function": "top"},
                        ]
                    }
                }
            ]
        }
    }

    match = rules.get_fingerprint_values_for_event(event_full_context)
    assert match is not None
    assert match.fingerprint == ["full-context"]

    # Event missing caller
    event_no_caller = {
        "exception": {
            "values": [
                {
                    "stacktrace": {
                        "frames": [
                            {"function": "callee"},
                            {"function": "target"},
                            {"function": "other"},
                        ]
                    }
                }
            ]
        }
    }

    match = rules.get_fingerprint_values_for_event(event_no_caller)
    assert match is None

    # Event missing callee
    event_no_callee = {
        "exception": {
            "values": [
                {
                    "stacktrace": {
                        "frames": [
                            {"function": "other"},
                            {"function": "target"},
                            {"function": "caller"},
                        ]
                    }
                }
            ]
        }
    }

    match = rules.get_fingerprint_values_for_event(event_no_callee)
    assert match is None


def test_sibling_frame_with_wildcards() -> None:
    """Test that sibling frame matchers work with wildcard patterns"""
    rules = FingerprintingConfig.from_config_string(
        """
[ function:*Handler ] | function:process* -> handler-calls-process
"""
    )

    event = {
        "exception": {
            "values": [
                {
                    "stacktrace": {
                        "frames": [
                            {"function": "processData"},
                            {"function": "RequestHandler"},
                        ]
                    }
                }
            ]
        }
    }

    match = rules.get_fingerprint_values_for_event(event)
    assert match is not None
    assert match.fingerprint == ["handler-calls-process"]


def test_sibling_frame_with_modules() -> None:
    """Test sibling frame matching with module matchers"""
    rules = FingerprintingConfig.from_config_string(
        """
[ module:controllers.* ] | function:handleRequest -> controller-request
"""
    )

    event = {
        "exception": {
            "values": [
                {
                    "stacktrace": {
                        "frames": [
                            {"function": "handleRequest", "module": "app.handlers"},
                            {"function": "dispatch", "module": "controllers.user"},
                        ]
                    }
                }
            ]
        }
    }

    match = rules.get_fingerprint_values_for_event(event)
    assert match is not None
    assert match.fingerprint == ["controller-request"]
