# -*- coding: utf-8 -*-

from __future__ import absolute_import

from exam import fixture

from sentry.interfaces.base import InterfaceValidationError
from sentry.interfaces.csp import Csp
from sentry.testutils import TestCase


class CspTest(TestCase):
    @fixture
    def interface(self):
        return Csp.to_python(dict(
            document_uri='http://example.com',
            violated_directive='style-src cdn.example.com',
            blocked_uri='http://example.com/lol.css',
            effective_directive='style-src',
        ))

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

    def test_to_python_validation_errors(self):
        with self.assertRaises(InterfaceValidationError):
            Csp.to_python(dict(blocked_uri='about'))

        with self.assertRaises(InterfaceValidationError):
            Csp.to_python(dict(effective_directive='lol'))

    def test_coerce_blocked_uri_if_missing(self):
        result = Csp.to_python(dict(
            effective_directive='script-src'
        ))
        assert result.blocked_uri == 'self'

    def test_get_culprit(self):
        result = Csp.to_python(dict(
            document_uri='http://example.com/foo',
            violated_directive='style-src http://cdn.example.com',
            effective_directive='style-src',
        ))
        assert result.get_culprit() == 'style-src http://cdn.example.com'

        result = Csp.to_python(dict(
            document_uri='http://example.com/foo',
            violated_directive='style-src cdn.example.com',
            effective_directive='style-src',
        ))
        assert result.get_culprit() == 'style-src cdn.example.com'

        result = Csp.to_python(dict(
            document_uri='https://example.com/foo',
            violated_directive='style-src cdn.example.com',
            effective_directive='style-src',
        ))
        assert result.get_culprit() == 'style-src cdn.example.com'

        result = Csp.to_python(dict(
            document_uri='http://example.com/foo',
            violated_directive='style-src https://cdn.example.com',
            effective_directive='style-src',
        ))
        assert result.get_culprit() == 'style-src https://cdn.example.com'

        result = Csp.to_python(dict(
            document_uri='http://example.com/foo',
            violated_directive='style-src http://example.com',
            effective_directive='style-src',
        ))
        assert result.get_culprit() == "style-src 'self'"

        result = Csp.to_python(dict(
            document_uri='http://example.com/foo',
            violated_directive='style-src http://example2.com example.com',
            effective_directive='style-src',
        ))
        assert result.get_culprit() == "style-src http://example2.com 'self'"

    def test_get_hash(self):
        result = Csp.to_python(dict(
            document_uri='http://example.com/foo',
            effective_directive='script-src',
            blocked_uri='',
        ))
        assert result.get_hash() == ['script-src', "'self'"]

        result = Csp.to_python(dict(
            document_uri='http://example.com/foo',
            effective_directive='script-src',
            blocked_uri='self',
        ))
        assert result.get_hash() == ['script-src', "'self'"]

        result = Csp.to_python(dict(
            document_uri='http://example.com/foo',
            effective_directive='script-src',
            blocked_uri='http://example.com/lol.js',
        ))
        assert result.get_hash() == ['script-src', 'example.com']

        result = Csp.to_python(dict(
            document_uri='http://example.com/foo',
            effective_directive='img-src',
            blocked_uri='data:foo',
        ))
        assert result.get_hash() == ['img-src', 'data:']

        result = Csp.to_python(dict(
            document_uri='http://example.com/foo',
            effective_directive='img-src',
            blocked_uri='ftp://example.com/foo',
        ))
        assert result.get_hash() == ['img-src', 'ftp://example.com']

    def test_get_message(self):
        result = Csp.to_python(dict(
            document_uri='http://example.com/foo',
            effective_directive='img-src',
            blocked_uri='http://google.com/foo',
        ))
        assert result.get_message() == "CSP Violation: blocked 'image' from 'google.com'"

        result = Csp.to_python(dict(
            document_uri='http://example.com/foo',
            effective_directive='style-src',
            blocked_uri='',
        ))
        assert result.get_message() == "CSP Violation: blocked inline 'style'"

        result = Csp.to_python(dict(
            document_uri='http://example.com/foo',
            effective_directive='script-src',
            blocked_uri='',
            violated_directive="script-src 'unsafe-inline'",
        ))
        assert result.get_message() == "CSP Violation: blocked unsafe eval() 'script'"

        result = Csp.to_python(dict(
            document_uri='http://example.com/foo',
            effective_directive='script-src',
            blocked_uri='',
            violated_directive="script-src 'unsafe-eval'",
        ))
        assert result.get_message() == "CSP Violation: blocked unsafe inline 'script'"

        result = Csp.to_python(dict(
            document_uri='http://example.com/foo',
            effective_directive='script-src',
            blocked_uri='',
            violated_directive="script-src example.com",
        ))
        assert result.get_message() == "CSP Violation: blocked unsafe 'script'"
