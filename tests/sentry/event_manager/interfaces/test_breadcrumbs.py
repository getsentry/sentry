from __future__ import absolute_import

import pytest

from sentry import eventstore
from sentry.event_manager import EventManager


@pytest.fixture
def make_breadcrumbs_snapshot(insta_snapshot):
    def inner(data):
        mgr = EventManager(data={"breadcrumbs": data})
        mgr.normalize()
        evt = eventstore.create_event(data=mgr.get_data())
        breadcrumbs = evt.interfaces.get("breadcrumbs")

        insta_snapshot(
            {"errors": evt.data.get("errors"), "to_json": breadcrumbs and breadcrumbs.to_json()}
        )

    return inner


def test_simple(make_breadcrumbs_snapshot):
    make_breadcrumbs_snapshot(
        dict(
            values=[
                {
                    "type": "message",
                    "timestamp": 1458857193.973275,
                    "data": {"message": "Whats up dawg?"},
                }
            ]
        )
    )


@pytest.mark.parametrize(
    "input",
    [
        {},
        {"values": []},
        # TODO(markus): The following cases should eventually generate {"values": [None]}
        {"values": [{}]},
        {"values": [{"type": None}]},
        {"values": [None]},
    ],
)
def test_null_values(make_breadcrumbs_snapshot, input):
    make_breadcrumbs_snapshot(input)


def test_non_string_keys(make_breadcrumbs_snapshot):
    make_breadcrumbs_snapshot(
        dict(
            values=[
                {
                    "type": "message",
                    "timestamp": 1458857193.973275,
                    "data": {"extra": {"foo": "bar"}},
                }
            ]
        )
    )


def test_string_data(make_breadcrumbs_snapshot):
    make_breadcrumbs_snapshot(
        dict(
            values=[
                {"type": "message", "timestamp": 1458857193.973275, "data": "must be a mapping"}
            ]
        )
    )
