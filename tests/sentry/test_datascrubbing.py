# coding: utf-8
from __future__ import absolute_import

import pytest

from sentry.datascrubbing import _path_selectors_from_diff, scrub_data
from sentry.relay.config import ProjectConfig


def test_path_selectors_from_diff():
    def f(old_event, event):
        return list(_path_selectors_from_diff(old_event, event))

    assert f({}, {"foo": {"bar": ["baz"]}}) == ["foo", "foo.**"]
    assert f({"foo": {"bar": ["baz"]}}, {}) == []
    assert f({"foo": {"bar": ["bam"]}}, {"foo": {"bar": ["baz"]}}) == ["foo.bar.0"]
    assert f(42, {}) == [None, "**"]
    assert f({"foo": {"bar": []}}, {"foo": {"bar": [42]}}) == ["foo.bar.0", "foo.bar.0.**"]
    assert f({"foo": {"bar": [42]}}, {"foo": {"bar": []}}) == []


@pytest.mark.parametrize(
    "field",
    [
        u"aaa",
        pytest.param(u"aää", marks=pytest.mark.xfail),
        pytest.param(u"a a", marks=pytest.mark.xfail),
        pytest.param(u"a\na", marks=pytest.mark.xfail),
    ],
)
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
