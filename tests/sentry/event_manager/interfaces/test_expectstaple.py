# -*- coding: utf-8 -*-

from __future__ import absolute_import

import pytest

from sentry import eventstore
from sentry.interfaces.security import ExpectStaple
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


raw_report = {
    "expect-staple-report": {
        "date-time": "2014-04-06T13:00:50Z",
        "hostname": "www.example.com",
        "port": 443,
        "response-status": "ERROR_RESPONSE",
        "cert-status": "REVOKED",
        "effective-expiration-date": "2014-05-01T12:40:50Z",
        "served-certificate-chain": ["-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----"],
        "validated-certificate-chain": ["-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----"],
    }
}
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


def test_from_raw(make_csp_snapshot):
    make_csp_snapshot(ExpectStaple.from_raw(raw_report).to_json())
