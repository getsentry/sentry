# -*- coding: utf-8 -*-

from __future__ import absolute_import

import pytest

from sentry import eventstore
from sentry.event_manager import EventManager


@pytest.fixture
def make_sdk_snapshot(insta_snapshot):
    def inner(data):
        mgr = EventManager(data={"sdk": data})
        mgr.normalize()
        evt = eventstore.create_event(data=mgr.get_data())
        insta_snapshot(
            {"errors": evt.data.get("errors"), "to_json": evt.interfaces.get("sdk").to_json()}
        )

    return inner


def test_serialize_behavior(make_sdk_snapshot):
    make_sdk_snapshot(
        {
            "name": "sentry-java",
            "version": "1.0",
            "integrations": ["log4j"],
            "packages": [{"name": "maven:io.sentry.sentry", "version": "1.7.10"}],
        }
    )


def test_missing_name(make_sdk_snapshot):
    make_sdk_snapshot({"version": "1.0"})


def test_missing_version(make_sdk_snapshot):
    make_sdk_snapshot({"name": "sentry-unity"})
