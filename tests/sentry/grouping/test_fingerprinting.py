# -*- coding: utf-8 -*-

from __future__ import absolute_import

import pytest

from sentry.grouping.fingerprinting import FingerprintingRules, InvalidFingerprintingConfig

from tests.sentry.grouping import with_fingerprint_input


def test_basic_parsing(insta_snapshot):
    rules = FingerprintingRules.from_config_string(
        """
# This is a config
type:DatabaseUnavailable                        -> DatabaseUnavailable
function:assertion_failed module:foo            -> AssertionFailed, foo
app:true                                        -> aha
app:true                                        -> {{ default }}
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
                "matchers": [["type", "DatabaseUnavailable"]],
                "fingerprint": ["DatabaseUnavailable"],
                "attributes": {},
            },
            {
                "matchers": [["function", "assertion_failed"], ["module", "foo"]],
                "fingerprint": ["AssertionFailed", "foo"],
                "attributes": {},
            },
            {"matchers": [["app", "true"]], "fingerprint": ["aha"], "attributes": {}},
            {"matchers": [["app", "true"]], "fingerprint": ["{{ default }}"], "attributes": {}},
            {"matchers": [["!path", "**/foo/**"]], "fingerprint": ["everything"], "attributes": {}},
            {"matchers": [["!path", "**/foo/**"]], "fingerprint": ["everything"], "attributes": {}},
            {
                "matchers": [["logger", "sentry.*"]],
                "fingerprint": ["logger-", "{{ logger }}"],
                "attributes": {},
            },
            {"matchers": [["message", u"\\x\xff"]], "fingerprint": ["stuff"], "attributes": {}},
            {
                "matchers": [["logger", "sentry.*"]],
                "fingerprint": ["logger-", "{{ logger }}"],
                "attributes": {"title": "Message from {{ logger }}"},
            },
            {
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


def test_parsing_errors():
    with pytest.raises(InvalidFingerprintingConfig):
        FingerprintingRules.from_config_string("invalid.message:foo -> bar")


def test_automatic_argument_splitting():
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
                "matchers": [["logger", "test"]],
                "fingerprint": ["logger-", "{{ logger }}"],
                "attributes": {},
            },
            {
                "matchers": [["logger", "test"]],
                "fingerprint": ["logger-", "{{ logger }}"],
                "attributes": {},
            },
            {
                "matchers": [["logger", "test2"]],
                "fingerprint": ["logger-", "{{ logger }}", "-", "{{ level }}"],
                "attributes": {},
            },
            {
                "matchers": [["logger", "test2"]],
                "fingerprint": ["logger-", "{{ logger }}", "-", "{{ level }}"],
                "attributes": {},
            },
        ],
        "version": 1,
    }


def test_discover_field_parsing(insta_snapshot):
    rules = FingerprintingRules.from_config_string(
        """
# This is a config
error.type:DatabaseUnavailable                        -> DatabaseUnavailable
stack.function:assertion_failed stack.module:foo      -> AssertionFailed, foo
app:true                                        -> aha
app:true                                        -> {{ default }}
"""
    )
    assert rules._to_config_structure() == {
        "rules": [
            {
                "matchers": [["type", "DatabaseUnavailable"]],
                "fingerprint": ["DatabaseUnavailable"],
                "attributes": {},
            },
            {
                "matchers": [["function", "assertion_failed"], ["module", "foo"]],
                "fingerprint": ["AssertionFailed", "foo"],
                "attributes": {},
            },
            {"matchers": [["app", "true"]], "fingerprint": ["aha"], "attributes": {}},
            {"matchers": [["app", "true"]], "fingerprint": ["{{ default }}"], "attributes": {}},
        ],
        "version": 1,
    }

    assert (
        FingerprintingRules._from_config_structure(
            rules._to_config_structure()
        )._to_config_structure()
        == rules._to_config_structure()
    )


@with_fingerprint_input("input")
def test_event_hash_variant(insta_snapshot, input):
    config, evt = input.create_event()

    def dump_variant(v):
        rv = v.as_dict()

        for key in "hash", "description", "config":
            rv.pop(key, None)

        if "component" in rv:
            for key in "id", "name", "values":
                rv["component"].pop(key, None)

        return rv

    insta_snapshot(
        {
            "config": config.to_json(),
            "fingerprint": evt.data["fingerprint"],
            "title": evt.data["title"],
            "variants": {k: dump_variant(v) for (k, v) in evt.get_grouping_variants().items()},
        }
    )
