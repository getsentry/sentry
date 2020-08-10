# -*- coding: utf-8 -*-

from __future__ import absolute_import

import os
import pytest

from sentry import eventstore
from sentry.event_manager import EventManager
from sentry.grouping.api import apply_server_fingerprinting
from sentry.grouping.fingerprinting import FingerprintingRules
from sentry.utils import json


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


_fixture_path = os.path.join(os.path.dirname(__file__), "fingerprint_inputs")


def load_configs():
    rv = []
    for filename in os.listdir(_fixture_path):
        if filename.endswith(".json"):
            rv.append(filename[:-5])
    return sorted(rv)


@pytest.mark.parametrize(
    "testcase",
    load_configs(),
    ids=lambda x: x.replace("-", "_"),  # Nicer folder structure for insta_snapshot
)
def test_event_hash_variant(insta_snapshot, testcase):
    with open(os.path.join(_fixture_path, testcase + ".json")) as f:
        input = json.load(f)

    config = FingerprintingRules.from_json(
        {"rules": input.pop("_fingerprinting_rules"), "version": 1}
    )
    mgr = EventManager(data=input)
    mgr.normalize()
    data = mgr.get_data()

    data.setdefault("fingerprint", ["{{ default }}"])
    apply_server_fingerprinting(data, config)

    evt = eventstore.create_event(data=data)

    def dump_variant(v):
        rv = v.as_dict()
        for key in "component", "description", "hash", "config":
            rv.pop(key, None)
        return rv

    insta_snapshot(
        {
            "config": config.to_json(),
            "fingerprint": data["fingerprint"],
            "variants": {k: dump_variant(v) for (k, v) in evt.get_grouping_variants().items()},
        }
    )
