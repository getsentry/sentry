# -*- coding: utf-8 -*-

from __future__ import absolute_import

import pytest

from sentry import eventstore
from sentry.interfaces.security import ExpectCT
from sentry.event_manager import EventManager


@pytest.fixture
def make_expectct_snapshot(insta_snapshot):
    def inner(data):
        mgr = EventManager(data={"expectct": data})
        mgr.normalize()
        evt = eventstore.create_event(data=mgr.get_data())

        interface = evt.interfaces.get("expectct")

        insta_snapshot(
            {"errors": evt.data.get("errors"), "to_json": interface and interface.to_json()}
        )

    return inner


raw_report = {
    "expect-ct-report": {
        "date-time": "2014-04-06T13:00:50Z",
        "hostname": "www.example.com",
        "port": 443,
        "effective-expiration-date": "2014-05-01T12:40:50Z",
        "served-certificate-chain": ["-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----"],
        "validated-certificate-chain": ["-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----"],
        "scts": [
            {"version": 1, "status": "invalid", "source": "embedded", "serialized_sct": "ABCD=="}
        ],
    }
}
interface_json = {
    "date_time": "2014-04-06T13:00:50Z",
    "hostname": "www.example.com",
    "port": 443,
    "effective_expiration_date": "2014-05-01T12:40:50Z",
    "served_certificate_chain": ["-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----"],
    "validated_certificate_chain": ["-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----"],
    "scts": [{"status": "invalid", "source": "embedded", "serialized_sct": "ABCD==", "version": 1}],
}


def test_from_raw(make_expectct_snapshot):
    make_expectct_snapshot(ExpectCT.from_raw(raw_report).to_json())


def test_basic(make_expectct_snapshot):
    make_expectct_snapshot(interface_json)


def test_invalid_format(make_expectct_snapshot):
    # invalid keys are just removed
    make_expectct_snapshot({"hostname": "www.example.com", "date_time": "Not an RFC3339 datetime"})
