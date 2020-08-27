# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.grouping.fingerprinting import FingerprintingRules

from tests.sentry.grouping import with_fingerprint_input


def test_basic_parsing(insta_snapshot):
    rules = FingerprintingRules.from_config_string(
        """
# This is a config
type:DatabaseUnavailable                        -> DatabaseUnavailable
function:assertion_failed module:foo            -> AssertionFailed, foo
app:true                                        -> aha
app:true                                        -> {{ default }}
"""
    )
    assert rules._to_config_structure() == {
        "rules": [
            {"matchers": [["type", "DatabaseUnavailable"]], "fingerprint": ["DatabaseUnavailable"]},
            {
                "matchers": [["function", "assertion_failed"], ["module", "foo"]],
                "fingerprint": ["AssertionFailed", "foo"],
            },
            {"matchers": [["app", "true"]], "fingerprint": ["aha"]},
            {"matchers": [["app", "true"]], "fingerprint": ["{{ default }}"]},
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
            "variants": {k: dump_variant(v) for (k, v) in evt.get_grouping_variants().items()},
        }
    )
