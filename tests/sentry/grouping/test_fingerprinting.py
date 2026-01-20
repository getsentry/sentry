from typing import Any
from unittest.mock import patch

import pytest

from sentry.conf.server import FALL_2025_GROUPING_CONFIG, WINTER_2023_GROUPING_CONFIG
from sentry.db.models.fields.node import NodeData
from sentry.grouping.api import (
    _apply_custom_title_if_needed,
    get_default_grouping_config_dict,
    get_grouping_variants_for_event,
    load_grouping_config,
)
from sentry.grouping.fingerprinting import FingerprintingConfig
from sentry.grouping.fingerprinting.exceptions import InvalidFingerprintingConfig
from sentry.grouping.utils import resolve_fingerprint_values
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


def test_variable_resolution() -> None:
    # TODO: This should be fleshed out to test way more cases, at which point we'll need to add some
    # actual data here
    event_data = NodeData(id="11211231")

    for fingerprint_entry, expected_resolved_value in [
        ("{{ default }}", "{{ default }}"),
        ("{{default}}", "{{ default }}"),
        ("{{  default }}", "{{ default }}"),
        ("{{ dog }}", "<unrecognized-variable-dog>"),
    ]:
        assert resolve_fingerprint_values([fingerprint_entry], event_data) == [
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
            fingerprint, NodeData(event_data), use_legacy_unknown_variable_handling=True
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
            fingerprint, NodeData(event_data), use_legacy_unknown_variable_handling=False
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
