# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.interfaces.base import InterfaceValidationError
from sentry.interfaces.security import ExpectCT
from sentry.testutils import TestCase
from sentry.event_manager import EventManager
from sentry.models import Event


class ExpectCTTest(TestCase):
    @classmethod
    def to_python(cls, data):
        mgr = EventManager(data={"expectct": data})
        mgr.normalize()
        evt = Event(data=mgr.get_data())
        if evt.data.get('errors'):
            raise InterfaceValidationError(evt.data.get('errors'))

        return evt.interfaces.get('expectct') or ExpectCT.to_python({})

    raw_report = {
        "expect-ct-report": {
            "date-time": "2014-04-06T13:00:50Z",
            "hostname": "www.example.com",
            "port": 443,
            "effective-expiration-date": "2014-05-01T12:40:50Z",
            "served-certificate-chain": ["-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----"],
            "validated-certificate-chain": ["-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----"],
            "scts": [
                {
                    "version": 1,
                    "status": "invalid",
                    "source": "embedded",
                    "serialized_sct": "ABCD=="
                },
            ],
        }
    }
    interface_json = {
        'date_time': '2014-04-06T13:00:50Z',
        'hostname': 'www.example.com',
        'port': 443,
        'effective_expiration_date': '2014-05-01T12:40:50Z',
        'served_certificate_chain': ['-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----'],
        'validated_certificate_chain': ['-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----'],
        'scts': [{
            'status': 'invalid',
            'source': 'embedded',
            'serialized_sct': 'ABCD==',
            'version': 1
        }]
    }

    def test_from_raw(self):
        interface = ExpectCT.from_raw(self.raw_report)
        assert interface.hostname == 'www.example.com'
        assert interface.date_time == '2014-04-06T13:00:50Z'
        assert interface.port == 443
        assert len(interface.served_certificate_chain) == 1

    def test_to_python(self):
        interface = self.to_python(self.interface_json)
        assert interface.hostname == 'www.example.com'
        assert interface.date_time == '2014-04-06T13:00:50Z'
        assert interface.port == 443
        assert len(interface.served_certificate_chain) == 1

    def test_serialize_unserialize_behavior(self):
        assert self.to_python(self.interface_json).to_json() == self.interface_json

    def test_invalid_format(self):
        interface = self.to_python({
            'hostname': 'www.example.com',
            'date_time': 'Not an RFC3339 datetime'
        })
        # invalid keys are just removed
        assert interface.to_json() == {'hostname': 'www.example.com'}
