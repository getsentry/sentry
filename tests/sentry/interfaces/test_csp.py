# -*- coding: utf-8 -*-

from __future__ import absolute_import

from mock import patch
from exam import fixture

from sentry.interfaces.csp import Csp
from sentry.testutils import TestCase


class CspTest(TestCase):
    @fixture
    def interface(self):
        return Csp.to_python(dict(
            document_uri='http://example.com',
            violated_directive='style-src cdn.example.com',
            blocked_uri='http://example.com/lol.css',
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

    def test_coerce_blocked_uri_if_script_src(self):
        result = Csp.to_python(dict(
            effective_directive='script-src'
        ))
        assert result.blocked_uri == 'self'

    def test_violated_directive(self):
        result = Csp.to_python(dict(
            document_uri='http://example.com/foo',
            violated_directive='style-src http://cdn.example.com',
        ))
        assert result.get_violated_directive() == ('violated-directive', 'style-src http://cdn.example.com')

        result = Csp.to_python(dict(
            document_uri='http://example.com/foo',
            violated_directive='style-src cdn.example.com',
        ))
        assert result.get_violated_directive() == ('violated-directive', 'style-src http://cdn.example.com')

        result = Csp.to_python(dict(
            document_uri='https://example.com/foo',
            violated_directive='style-src cdn.example.com',
        ))
        assert result.get_violated_directive() == ('violated-directive', 'style-src https://cdn.example.com')

        result = Csp.to_python(dict(
            document_uri='http://example.com/foo',
            violated_directive='style-src https://cdn.example.com',
        ))
        assert result.get_violated_directive() == ('violated-directive', 'style-src https://cdn.example.com')

        result = Csp.to_python(dict(
            document_uri='blob:example.com/foo',
            violated_directive='style-src cdn.example.com',
        ))
        assert result.get_violated_directive() == ('violated-directive', 'style-src blob:cdn.example.com')

    def test_get_culprit_directive(self):
        result = Csp.to_python(dict(
            document_uri='http://example.com/foo',
            blocked_uri='http://example.com/lol.css',
            effective_directive='style-src'
        ))
        assert result.get_culprit_directive() == ('blocked-uri', 'http://example.com/lol.css')

        result = Csp.to_python(dict(
            document_uri='http://example.com/foo',
            blocked_uri='',
            effective_directive='style-src',
        ))
        assert result.get_culprit_directive() == ('effective-directive', 'style-src')

        result = Csp.to_python(dict(
            document_uri='http://example.com/foo',
            effective_directive='script-src',
            blocked_uri='',
        ))
        assert result.get_culprit_directive() == ('blocked-uri', 'self')

    @patch('sentry.interfaces.csp.Csp.get_culprit_directive')
    @patch('sentry.interfaces.csp.Csp.get_violated_directive')
    def test_get_hash(self, get_culprit, get_violated):
        get_culprit.return_value = ('a', 'b')
        get_violated.return_value = ('c', 'd')
        assert self.interface.get_hash() == ['a:b', 'c:d']
