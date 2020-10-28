# -*- coding: utf-8 -*-

from __future__ import absolute_import

import pytest

from sentry import eventstore
from sentry.event_manager import EventManager, materialize_metadata


@pytest.fixture
def make_expectct_snapshot(insta_snapshot):
    def inner(data):
        mgr = EventManager(
            data={
                "expectct": data,
                "logentry": {"message": "XXX EXPECTCT MESSAGE NOT THROUGH RELAY XXX"},
            }
        )
        mgr.normalize()
        data = mgr.get_data()
        data.update(materialize_metadata(data))
        evt = eventstore.create_event(data=data)

        interface = evt.interfaces.get("expectct")

        insta_snapshot(
            {
                "errors": evt.data.get("errors"),
                "to_json": interface and interface.to_json(),
                "metadata": evt.get_event_metadata(),
                "title": evt.title,
            }
        )

    return inner


interface_json = {
    "date_time": "2014-04-06T13:00:50Z",
    "hostname": "www.example.com",
    "port": 443,
    "effective_expiration_date": "2014-05-01T12:40:50Z",
    "served_certificate_chain": ["-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----"],
    "validated_certificate_chain": ["-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----"],
    "scts": [{"status": "invalid", "source": "embedded", "serialized_sct": "ABCD==", "version": 1}],
}


def test_basic(make_expectct_snapshot):
    make_expectct_snapshot(interface_json)
