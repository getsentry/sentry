# -*- coding: utf-8 -*-

from __future__ import absolute_import

from exam import fixture

from sentry.interfaces.security import Csp, ExpectCT, ExpectStaple
from sentry.testutils import TestCase


class CspTest(TestCase):
    @fixture
    def interface(self):
        return Csp.to_python(
            dict(
                document_uri='http://example.com',
                violated_directive='style-src cdn.example.com',
                blocked_uri='http://example.com/lol.css',
                effective_directive='style-src',
            )
        )

    def test_path(self):
        assert self.interface.get_path() == 'sentry.interfaces.Csp'

    def test_serialize_unserialize_behavior(self):
        result = type(self.interface).to_python(self.interface.to_json())
        assert result.to_json() == self.interface.to_json()

    def test_basic(self):
        result = self.interface
        assert result.document_uri == 'http://example.com'
        assert result.violated_directive == 'style-src cdn.example.com'
        assert result.blocked_uri == 'http://example.com/lol.css'

    def test_coerce_blocked_uri_if_missing(self):
        result = Csp.to_python(
            dict(
                document_uri='http://example.com',
                effective_directive='script-src',
            )
        )
        assert result.blocked_uri == 'self'

    def test_get_culprit(self):
        result = Csp.to_python(
            dict(
                document_uri='http://example.com/foo',
                violated_directive='style-src http://cdn.example.com',
                effective_directive='style-src',
            )
        )
        assert result.get_culprit() == 'style-src http://cdn.example.com'

        result = Csp.to_python(
            dict(
                document_uri='http://example.com/foo',
                violated_directive='style-src cdn.example.com',
                effective_directive='style-src',
            )
        )
        assert result.get_culprit() == 'style-src cdn.example.com'

        result = Csp.to_python(
            dict(
                document_uri='https://example.com/foo',
                violated_directive='style-src cdn.example.com',
                effective_directive='style-src',
            )
        )
        assert result.get_culprit() == 'style-src cdn.example.com'

        result = Csp.to_python(
            dict(
                document_uri='http://example.com/foo',
                violated_directive='style-src https://cdn.example.com',
                effective_directive='style-src',
            )
        )
        assert result.get_culprit() == 'style-src https://cdn.example.com'

        result = Csp.to_python(
            dict(
                document_uri='http://example.com/foo',
                violated_directive='style-src http://example.com',
                effective_directive='style-src',
            )
        )
        assert result.get_culprit() == "style-src 'self'"

        result = Csp.to_python(
            dict(
                document_uri='http://example.com/foo',
                violated_directive='style-src http://example2.com example.com',
                effective_directive='style-src',
            )
        )
        assert result.get_culprit() == "style-src http://example2.com 'self'"

    def test_get_hash(self):
        result = Csp.to_python(
            dict(
                document_uri='http://example.com/foo',
                effective_directive='script-src',
                blocked_uri='',
            )
        )
        assert result.get_hash() == ['script-src', "'self'"]

        result = Csp.to_python(
            dict(
                document_uri='http://example.com/foo',
                effective_directive='script-src',
                blocked_uri='self',
            )
        )
        assert result.get_hash() == ['script-src', "'self'"]

        result = Csp.to_python(
            dict(
                document_uri='http://example.com/foo',
                effective_directive='script-src',
                blocked_uri='http://example.com/lol.js',
            )
        )
        assert result.get_hash() == ['script-src', 'example.com']

        result = Csp.to_python(
            dict(
                document_uri='http://example.com/foo',
                effective_directive='img-src',
                blocked_uri='data:foo',
            )
        )
        assert result.get_hash() == ['img-src', 'data:']

        result = Csp.to_python(
            dict(
                document_uri='http://example.com/foo',
                effective_directive='img-src',
                blocked_uri='ftp://example.com/foo',
            )
        )
        assert result.get_hash() == ['img-src', 'ftp://example.com']

    def test_get_tags(self):
        assert self.interface.get_tags() == [
            ('effective-directive', 'style-src'), ('blocked-uri', 'http://example.com/lol.css'),
        ]

    def test_get_tags_stripe(self):
        result = Csp.to_python(
            dict(
                blocked_uri='https://api.stripe.com/v1/tokens?card[number]=xxx',
                effective_directive='script-src',
            )
        )
        assert result.get_tags() == [
            ('effective-directive', 'script-src'),
            ('blocked-uri', 'https://api.stripe.com/v1/tokens'),
        ]

    def test_get_message(self):
        result = Csp.to_python(
            dict(
                document_uri='http://example.com/foo',
                effective_directive='img-src',
                blocked_uri='http://google.com/foo',
            )
        )
        assert result.get_message() == "Blocked 'image' from 'google.com'"

        result = Csp.to_python(
            dict(
                document_uri='http://example.com/foo',
                effective_directive='style-src',
                blocked_uri='',
            )
        )
        assert result.get_message() == "Blocked inline 'style'"

        result = Csp.to_python(
            dict(
                document_uri='http://example.com/foo',
                effective_directive='script-src',
                blocked_uri='',
                violated_directive="script-src 'unsafe-inline'",
            )
        )
        assert result.get_message() == "Blocked unsafe inline 'script'"

        result = Csp.to_python(
            dict(
                document_uri='http://example.com/foo',
                effective_directive='script-src',
                blocked_uri='',
                violated_directive="script-src 'unsafe-eval'",
            )
        )
        assert result.get_message() == "Blocked unsafe eval() 'script'"

        result = Csp.to_python(
            dict(
                document_uri='http://example.com/foo',
                effective_directive='script-src',
                blocked_uri='',
                violated_directive="script-src example.com",
            )
        )
        assert result.get_message() == "Blocked unsafe (eval() or inline) 'script'"

        result = Csp.to_python(
            dict(
                document_uri='http://example.com/foo',
                effective_directive='script-src',
                blocked_uri='data:text/plain;base64,SGVsbG8sIFdvcmxkIQ%3D%3D',
            )
        )
        assert result.get_message() == "Blocked 'script' from 'data:'"

        result = Csp.to_python(
            dict(
                document_uri='http://example.com/foo',
                effective_directive='script-src',
                blocked_uri='data',
            )
        )
        assert result.get_message() == "Blocked 'script' from 'data:'"


class ExpectCTTest(TestCase):

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
        interface = ExpectCT.to_python(self.interface_json)
        assert interface.hostname == 'www.example.com'
        assert interface.date_time == '2014-04-06T13:00:50Z'
        assert interface.port == 443
        assert len(interface.served_certificate_chain) == 1

    def test_serialize_unserialize_behavior(self):
        assert ExpectCT.to_python(self.interface_json).to_json() == self.interface_json

    def test_invalid_format(self):
        interface = ExpectCT.to_python({
            'hostname': 'www.example.com',
            'date_time': 'Not an RFC3339 datetime'
        })
        # invalid keys are just removed
        assert interface.to_json() == {'hostname': 'www.example.com'}


class ExpectStapleTest(TestCase):

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

    def test_from_raw(self):
        interface = ExpectStaple.from_raw(self.raw_report)
        assert interface.hostname == 'www.example.com'
        assert interface.date_time == '2014-04-06T13:00:50Z'
        assert interface.port == 443
        assert len(interface.served_certificate_chain) == 1

    def test_to_python(self):
        interface = ExpectStaple.to_python(self.interface_json)
        assert interface.hostname == 'www.example.com'
        assert interface.date_time == '2014-04-06T13:00:50Z'
        assert interface.port == 443
        assert len(interface.served_certificate_chain) == 1

    def test_serialize_unserialize_behavior(self):
        assert ExpectStaple.to_python(self.interface_json).to_json() == self.interface_json
