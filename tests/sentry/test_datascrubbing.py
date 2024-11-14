import copy

import pytest

from sentry.datascrubbing import scrub_data
from sentry.testutils.pytest.fixtures import django_db_all


def merge_pii_configs(prefixes_and_configs):
    from sentry.datascrubbing import _merge_pii_configs as f

    prefixes_and_configs_bak = copy.deepcopy(prefixes_and_configs)
    rv = f(prefixes_and_configs)

    # No accidental mutation
    assert prefixes_and_configs == prefixes_and_configs_bak
    return rv


@django_db_all
@pytest.mark.parametrize("field", ["ooo", "oöö", "o o", "o\no", "o'o"])
def test_scrub_data(field, default_project):
    project = default_project
    organization = project.organization

    organization.update_option(
        "sentry:relay_pii_config",
        """
    {
        "applications": {
            "debug_meta.images.*.code_file": ["@userpath:replace"],
            "debug_meta.images.*.debug_file": ["@userpath:replace"]
        }
    }
    """,
    )
    organization.update_option("sentry:safe_fields", [])
    organization.update_option("sentry:sensitive_fields", ["o"])
    organization.update_option("sentry:scrub_ip_address", False)
    organization.update_option("sentry:require_scrub_data", True)

    event = {
        "extra": {field: "pls remove"},
        "debug_meta": {
            "images": [
                {"type": "symbolic", "debug_file": "/Users/foo/bar", "code_file": "/Users/foo/bar"}
            ]
        },
    }
    new_event = scrub_data(project, event)

    assert new_event == (
        {
            "_meta": {
                "debug_meta": {
                    "images": {
                        "0": {
                            "code_file": {
                                "": {"len": 10, "rem": [["@userpath:replace", "s", 7, 13]]}
                            },
                            "debug_file": {
                                "": {"len": 10, "rem": [["@userpath:replace", "s", 7, 13]]}
                            },
                        }
                    }
                },
                "extra": {field: {"": {"len": 10, "rem": [["strip-fields", "s", 0, 10]]}}},
            },
            "debug_meta": {
                "images": [
                    {
                        "code_file": "/Users/[user]/bar",
                        "debug_file": "/Users/[user]/bar",
                        "type": "symbolic",
                    }
                ]
            },
            "extra": {field: "[Filtered]"},
        }
    )


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
