# coding: utf-8
from __future__ import absolute_import

import copy
import pytest

from sentry.datascrubbing import _path_selectors_from_diff, scrub_data
from sentry.relay.config import ProjectConfig


def merge_pii_configs(prefixes_and_configs):
    from sentry.datascrubbing import merge_pii_configs as f

    prefixes_and_configs_bak = copy.deepcopy(prefixes_and_configs)
    rv = f(prefixes_and_configs)

    # No accidental mutation
    assert prefixes_and_configs == prefixes_and_configs_bak
    return rv


def test_path_selectors_from_diff():
    def f(old_event, event):
        return list(_path_selectors_from_diff(old_event, event))

    assert f({}, {"foo": {"bar": ["baz"]}}) == ["'foo'", "'foo'.**"]
    assert f({"foo": {"bar": ["baz"]}}, {}) == []
    assert f({"foo": {"bar": ["bam"]}}, {"foo": {"bar": ["baz"]}}) == [
        "'foo'.'bar'.0",
        "'foo'.'bar'.0.**",
    ]
    assert f(42, {}) == [None, "**"]
    assert f({"foo": {"bar": []}}, {"foo": {"bar": [42]}}) == ["'foo'.'bar'.0", "'foo'.'bar'.0.**"]
    assert f({"foo": {"bar": [42]}}, {"foo": {"bar": []}}) == []

    # unicode vs bytes
    assert f({"foo": {"bar": b"baz"}}, {"foo": {"bar": u"baz"}}) == []


@pytest.mark.parametrize("field", [u"aaa", u"aää", u"a a", u"a\na", u"a'a"])
def test_scrub_data_in_processing(field):
    project_config = ProjectConfig(
        None,
        config={
            "datascrubbingSettings": {
                "excludeFields": [],
                "scrubData": True,
                "scrubIpAddresses": False,
                "sensitiveFields": ["a"],
                "scrubDefaults": False,
            },
            "piiConfig": {},
        },
    )

    new_field = u"new_{}".format(field)

    old_event = {"extra": {field: "do not remove"}}
    event = {"extra": {field: "do not remove", new_field: "do remove"}}

    new_event = scrub_data(project_config, event, in_processing=True, old_event=old_event)

    assert new_event == {
        u"_meta": {
            u"extra": {new_field: {u"": {u"len": 9, u"rem": [[u"strip-fields", u"s", 0, 10]]}}}
        },
        u"extra": {field: u"do not remove", new_field: u"[Filtered]"},
    }


def test_merge_pii_configs_simple():
    assert merge_pii_configs([("p:", {}), ("o:", {})]) == {}

    assert merge_pii_configs(
        [("p:", {"applications": {"$string": ["@ip:remove"]}}), ("o:", {})]
    ) == {"applications": {"$string": ["@ip:remove"]}}


def test_merge_pii_configs_rule_references():
    my_rules = {
        "remove_ips_alias": {
            "type": "alias",
            "rule": "@ip",
            "hide_rule": False,
            "redaction": {"method": "remove"},
        },
        "remove_ips_and_macs": {
            "type": "multiple",
            "rules": ["remove_ips_alias", "@mac"],
            "hide_rule": False,
            "redaction": {"method": "remove"},
        },
    }

    assert merge_pii_configs(
        [
            ("o:", {"rules": my_rules, "applications": {"$string": ["remove_ips_and_macs"]}}),
            ("p:", {"rules": my_rules, "applications": {"$string": ["remove_ips_alias"]}}),
        ]
    ) == {
        "applications": {"$string": ["o:remove_ips_and_macs", "p:remove_ips_alias"]},
        "rules": {
            "o:remove_ips_and_macs": {
                "hide_rule": False,
                "redaction": {"method": "remove"},
                "rules": ["o:remove_ips_alias", "@mac"],
                "type": "multiple",
            },
            "o:remove_ips_alias": {
                "hide_rule": False,
                "redaction": {"method": "remove"},
                "rule": "@ip",
                "type": "alias",
            },
            "p:remove_ips_and_macs": {
                "hide_rule": False,
                "redaction": {"method": "remove"},
                "rules": ["p:remove_ips_alias", "@mac"],
                "type": "multiple",
            },
            "p:remove_ips_alias": {
                "hide_rule": False,
                "redaction": {"method": "remove"},
                "rule": "@ip",
                "type": "alias",
            },
        },
    }
