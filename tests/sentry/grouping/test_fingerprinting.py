from typing import Any

import pytest

from sentry.db.models.fields.node import NodeData
from sentry.grouping.api import get_default_grouping_config_dict
from sentry.grouping.fingerprinting import FingerprintingConfig
from sentry.grouping.fingerprinting.exceptions import InvalidFingerprintingConfig
from sentry.grouping.utils import resolve_fingerprint_values
from sentry.grouping.variants import BaseVariant
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


def test_variable_resolution() -> None:
    # TODO: This should be fleshed out to test way more cases, at which point we'll need to add some
    # actual data here
    event_data = NodeData(id="11211231")

    for fingerprint_entry, expected_resolved_value in [
        ("{{ default }}", "{{ default }}"),
        ("{{default}}", "{{ default }}"),
        ("{{  default }}", "{{ default }}"),
    ]:
        assert resolve_fingerprint_values([fingerprint_entry], event_data) == [
            expected_resolved_value
        ], f"Entry {fingerprint_entry} resolved incorrectly"


def test_thread_variable_resolution() -> None:
    """Test that thread.name, thread.id, and thread.state variables resolve correctly."""
    # Event with thread data - crashed thread should be preferred
    event_with_threads = NodeData(
        id="test-event",
        data={
            "threads": {
                "values": [
                    {
                        "id": "1",
                        "name": "MainThread",
                        "state": "RUNNABLE",
                        "crashed": False,
                        "current": False,
                    },
                    {
                        "id": "2",
                        "name": "WorkerThread",
                        "state": "WAITING",
                        "crashed": True,
                        "current": False,
                    },
                    {
                        "id": "3",
                        "name": "BackgroundThread",
                        "state": "BLOCKED",
                        "crashed": False,
                        "current": True,
                    },
                ]
            }
        },
    )

    # Test thread.name resolution - should prefer crashed thread
    assert resolve_fingerprint_values(["{{ thread.name }}"], event_with_threads) == ["WorkerThread"]
    assert resolve_fingerprint_values(["{{ thread_name }}"], event_with_threads) == ["WorkerThread"]

    # Test thread.id resolution - should prefer crashed thread
    assert resolve_fingerprint_values(["{{ thread.id }}"], event_with_threads) == ["2"]
    assert resolve_fingerprint_values(["{{ thread_id }}"], event_with_threads) == ["2"]

    # Test thread.state resolution - should prefer crashed thread
    assert resolve_fingerprint_values(["{{ thread.state }}"], event_with_threads) == ["WAITING"]
    assert resolve_fingerprint_values(["{{ thread_state }}"], event_with_threads) == ["WAITING"]

    # Event with only current thread (no crashed thread)
    event_current_thread = NodeData(
        id="test-event-2",
        data={
            "threads": {
                "values": [
                    {
                        "id": "1",
                        "name": "MainThread",
                        "state": "RUNNABLE",
                        "crashed": False,
                        "current": False,
                    },
                    {
                        "id": "2",
                        "name": "CurrentThread",
                        "state": "RUNNING",
                        "crashed": False,
                        "current": True,
                    },
                ]
            }
        },
    )

    # Should use current thread when no crashed thread
    assert resolve_fingerprint_values(["{{ thread.name }}"], event_current_thread) == [
        "CurrentThread"
    ]
    assert resolve_fingerprint_values(["{{ thread.id }}"], event_current_thread) == ["2"]
    assert resolve_fingerprint_values(["{{ thread.state }}"], event_current_thread) == ["RUNNING"]

    # Event with only regular threads (no crashed or current)
    event_regular_threads = NodeData(
        id="test-event-3",
        data={
            "threads": {
                "values": [
                    {
                        "id": "1",
                        "name": "FirstThread",
                        "state": "RUNNABLE",
                        "crashed": False,
                        "current": False,
                    },
                    {
                        "id": "2",
                        "name": "SecondThread",
                        "state": "WAITING",
                        "crashed": False,
                        "current": False,
                    },
                ]
            }
        },
    )

    # Should use first thread when no crashed or current thread
    assert resolve_fingerprint_values(["{{ thread.name }}"], event_regular_threads) == [
        "FirstThread"
    ]
    assert resolve_fingerprint_values(["{{ thread.id }}"], event_regular_threads) == ["1"]
    assert resolve_fingerprint_values(["{{ thread.state }}"], event_regular_threads) == ["RUNNABLE"]

    # Event with no threads
    event_no_threads = NodeData(id="test-event-4", data={})

    # Should return fallback values when no threads
    assert resolve_fingerprint_values(["{{ thread.name }}"], event_no_threads) == [
        "<no-thread-name>"
    ]
    assert resolve_fingerprint_values(["{{ thread.id }}"], event_no_threads) == ["<no-thread-id>"]
    assert resolve_fingerprint_values(["{{ thread.state }}"], event_no_threads) == [
        "<no-thread-state>"
    ]

    # Event with threads but missing name/id/state
    event_incomplete_threads = NodeData(
        id="test-event-5",
        data={
            "threads": {
                "values": [
                    {"crashed": False, "current": True},  # Missing name, id, state
                ]
            }
        },
    )

    # Should return fallback values when thread data is incomplete
    assert resolve_fingerprint_values(["{{ thread.name }}"], event_incomplete_threads) == [
        "<no-thread-name>"
    ]
    assert resolve_fingerprint_values(["{{ thread.id }}"], event_incomplete_threads) == [
        "<no-thread-id>"
    ]
    assert resolve_fingerprint_values(["{{ thread.state }}"], event_incomplete_threads) == [
        "<no-thread-state>"
    ]

    # Test combination with other variables
    event_with_mixed = NodeData(
        id="test-event-6",
        data={
            "threads": {
                "values": [
                    {
                        "id": "42",
                        "name": "CrashedThread",
                        "state": "BLOCKED",
                        "crashed": True,
                        "current": False,
                    },
                ]
            }
        },
    )

    assert resolve_fingerprint_values(
        ["{{ default }}", "{{ thread.name }}", "custom-value"], event_with_mixed
    ) == ["{{ default }}", "CrashedThread", "custom-value"]


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

    # Event without MainThread but with crashed=True to avoid matching the first rule
    event_not_main = {
        "threads": {
            "values": [
                {
                    "id": "2",
                    "name": "BackgroundThread",
                    "crashed": True,  # Must be crashed to not match first rule
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


def test_sibling_frame_json_roundtrip() -> None:
    """Test that sibling frame matchers can be serialized and deserialized via JSON"""
    rules = FingerprintingConfig.from_config_string(
        """
[ function:caller_func ] | function:target_func -> caller-calls-target
function:target_func | [ function:callee_func ] -> target-calls-callee
[ module:foo ] | function:bar | [ module:baz ] -> foo-bar-baz
"""
    )

    # Serialize to JSON
    config_structure = rules._to_config_structure()

    # Deserialize from JSON
    restored_rules = FingerprintingConfig._from_config_structure(config_structure)

    # Verify the restored rules match the original
    assert restored_rules._to_config_structure() == config_structure

    # Test that restored rules work correctly
    event_with_caller = {
        "exception": {
            "values": [
                {
                    "stacktrace": {
                        "frames": [
                            {"function": "bottom"},
                            {"function": "target_func"},
                            {"function": "caller_func"},
                            {"function": "top"},
                        ]
                    }
                }
            ]
        }
    }

    match = restored_rules.get_fingerprint_values_for_event(event_with_caller)
    assert match is not None
    assert match.fingerprint == ["caller-calls-target"]


def test_thread_matchers_json_roundtrip() -> None:
    """Test that thread matchers can be serialized and deserialized via JSON"""
    rules = FingerprintingConfig.from_config_string(
        """
thread.name:MainThread -> main-thread-error
thread.id:123 -> thread-123
thread.crashed:true -> crashed
thread.current:true -> current
thread.state:RUNNABLE -> runnable
"""
    )

    # Serialize to JSON
    config_structure = rules._to_config_structure()

    # Deserialize from JSON
    restored_rules = FingerprintingConfig._from_config_structure(config_structure)

    # Verify the restored rules match the original
    assert restored_rules._to_config_structure() == config_structure

    # Test that restored rules work correctly
    event_with_threads = {
        "threads": {
            "values": [
                {
                    "id": "123",
                    "name": "MainThread",
                    "crashed": True,
                    "current": False,
                    "state": "RUNNABLE",
                }
            ]
        }
    }

    match = restored_rules.get_fingerprint_values_for_event(event_with_threads)
    assert match is not None
    assert match.fingerprint == ["main-thread-error"]
