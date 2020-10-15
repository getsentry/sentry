# -*- coding: utf-8 -*-

from __future__ import absolute_import

import pytest

from sentry import eventstore
from sentry.event_manager import EventManager, materialize_metadata


@pytest.fixture
def make_csp_snapshot(insta_snapshot):
    def inner(data):
        mgr = EventManager(
            data={
                "expectstaple": data,
                "logentry": {"message": "XXX EXPECTSTAPLE MESSAGE NOT THROUGH RELAY XXX"},
            }
        )
        mgr.normalize()
        data = mgr.get_data()
        data.update(materialize_metadata(data))
        evt = eventstore.create_event(data=data)
        insta_snapshot(
            {
                "errors": evt.data.get("errors"),
                "to_json": evt.interfaces.get("expectstaple").to_json(),
                "metadata": evt.get_event_metadata(),
                "title": evt.title,
            }
        )

    return inner


interface_json = {
    "date_time": "2014-04-06T13:00:50Z",
    "hostname": "www.example.com",
    "port": 443,
    "response_status": "ERROR_RESPONSE",
    "cert_status": "REVOKED",
    "effective_expiration_date": "2014-05-01T12:40:50Z",
    "served_certificate_chain": ["-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----"],
    "validated_certificate_chain": ["-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----"],
}


def test_basic(make_csp_snapshot):
    make_csp_snapshot(interface_json)
