# coding: utf-8
from __future__ import absolute_import

import pytest

from sentry.datascrubbing import scrub_data
from sentry.relay.config import ProjectConfig


@pytest.mark.parametrize("field", [u"aaa", u"aää", u"a a", u"a\na", u"a'a"])
def test_scrub_data(field):
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
            "piiConfig": {
                "applications": {
                    "debug_meta.images.*.code_file": ["@userpath:replace"],
                    "debug_meta.images.*.debug_file": ["@userpath:replace"],
                }
            },
        },
    )

    event = {
        "extra": {field: "pls remove"},
        "debug_meta": {
            "images": [
                {"type": "symbolic", "debug_file": "/Users/foo/bar", "code_file": "/Users/foo/bar"}
            ]
        },
    }

    new_event = scrub_data(project_config, event)

    assert new_event == (
        {
            u"_meta": {
                u"debug_meta": {
                    u"images": {
                        u"0": {
                            u"code_file": {
                                u"": {u"len": 10, u"rem": [[u"@userpath:replace", u"s", 7, 13]]}
                            },
                            u"debug_file": {
                                u"": {u"len": 10, u"rem": [[u"@userpath:replace", u"s", 7, 13]]}
                            },
                        }
                    }
                },
                u"extra": {field: {u"": {u"len": 10, u"rem": [[u"strip-fields", u"s", 0, 10]]}}},
            },
            u"debug_meta": {
                u"images": [
                    {
                        u"code_file": u"/Users/[user]/bar",
                        u"debug_file": u"/Users/[user]/bar",
                        u"type": u"symbolic",
                    }
                ]
            },
            u"extra": {field: u"[Filtered]"},
        }
    )
