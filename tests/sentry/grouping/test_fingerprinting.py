from typing import Any

import pytest

from sentry.db.models.fields.node import NodeData
from sentry.grouping.api import get_default_grouping_config_dict
from sentry.grouping.fingerprinting import FingerprintingRules, InvalidFingerprintingConfig
from sentry.grouping.utils import resolve_fingerprint_values
from sentry.grouping.variants import BaseVariant
from sentry.testutils.pytest.fixtures import InstaSnapshotter, django_db_all
from tests.sentry.grouping import FingerprintInput, with_fingerprint_input

GROUPING_CONFIG = get_default_grouping_config_dict()


def test_basic_parsing() -> None:
    rules = FingerprintingRules.from_config_string(
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
        FingerprintingRules._from_config_structure(
            rules._to_config_structure()
        )._to_config_structure()
        == rules._to_config_structure()
    )


def test_rule_export() -> None:
    rules = FingerprintingRules.from_config_string(
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
        FingerprintingRules.from_config_string("invalid.message:foo -> bar")


def test_automatic_argument_splitting() -> None:
    rules = FingerprintingRules.from_config_string(
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
    rules = FingerprintingRules.from_config_string(
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
        FingerprintingRules._from_config_structure(
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
