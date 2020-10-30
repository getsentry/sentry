# -*- coding: utf-8 -*-

from __future__ import absolute_import

import pytest

from sentry import eventstore
from sentry.event_manager import EventManager


@pytest.fixture
def make_user_snapshot(insta_snapshot):
    def inner(data):
        mgr = EventManager(data={"user": data})
        mgr.normalize()
        evt = eventstore.create_event(data=mgr.get_data())

        interface = evt.interfaces.get("user")

        insta_snapshot(
            {"errors": evt.data.get("errors"), "to_json": interface and interface.to_json()}
        )

    return inner


def test_null_values(make_user_snapshot):
    make_user_snapshot({})


def test_serialize_behavior(make_user_snapshot):
    make_user_snapshot(dict(id=1, email="lol@example.com", favorite_color="brown"))


def test_invalid_ip_address(make_user_snapshot):
    make_user_snapshot(dict(ip_address="abc"))


@pytest.mark.parametrize("email", [1, "foo"])
def test_invalid_email_address(make_user_snapshot, email):
    make_user_snapshot(dict(email=email))


def test_extra_keys(make_user_snapshot):
    make_user_snapshot({"extra1": "foo", "data": {"extra2": "bar"}})
