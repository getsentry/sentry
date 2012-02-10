# -*- coding: utf-8 -*-

from __future__ import absolute_import

from django.http import HttpResponse

from sentry.utils.http import is_same_domain, apply_access_control_headers

from tests.base import TestCase


class SameDomainTestCase(TestCase):
    def test_is_same_domain(self):
        url1 = 'http://example.com/foo/bar'
        url2 = 'http://example.com/biz/baz'

        self.assertTrue(is_same_domain(url1, url2))

    def test_is_same_domain_diff_scheme(self):
        url1 = 'https://example.com/foo/bar'
        url2 = 'http://example.com/biz/baz'

        self.assertTrue(is_same_domain(url1, url2))

    def test_is_same_domain_diff_port(self):
        url1 = 'http://example.com:80/foo/bar'
        url2 = 'http://example.com:13/biz/baz'

        self.assertFalse(is_same_domain(url1, url2))


class AccessControlTestCase(TestCase):
    
    def test_allow_origin_none(self):
        """If ALLOW_ORIGIN is None, the headers should not be added"""
        with self.Settings(SENTRY_ALLOW_ORIGIN=None):
            response = apply_access_control_headers(HttpResponse())
            self.assertEqual(response.get('Access-Control-Allow-Origin', None),
                             None)
            self.assertEqual(response.get('Access-Control-Allow-Headers', None),
                             None)
            self.assertEqual(response.get('Access-Control-Allow-Methods', None),
                             None)
    
    def test_allow_origin(self):
        with self.Settings(SENTRY_ALLOW_ORIGIN="http://foo.example"):
            response = apply_access_control_headers(HttpResponse())
            self.assertEqual(response.get('Access-Control-Allow-Origin', None),
                             "http://foo.example")
            self.assertEqual(response.get('Access-Control-Allow-Headers', None),
                             "X-Sentry-Auth")
            self.assertEqual(response.get('Access-Control-Allow-Methods', None),
                             "POST")
