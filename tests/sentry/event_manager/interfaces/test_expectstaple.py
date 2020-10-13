# -*- coding: utf-8 -*-

from __future__ import absolute_import

import pytest

from sentry import eventstore
from sentry.event_manager import EventManager


@pytest.fixture
def make_csp_snapshot(insta_snapshot):
    def inner(data):
        mgr = EventManager(data={"expectstaple": data})
        mgr.normalize()
        evt = eventstore.create_event(data=mgr.get_data())
        insta_snapshot(
            {
                "errors": evt.data.get("errors"),
                "to_json": evt.interfaces.get("expectstaple").to_json(),
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
