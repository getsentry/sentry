# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock
from django.core.urlresolvers import reverse
from sentry.models import Project
from sentry.testutils import TestCase, fixture


class StoreViewTest(TestCase):
    @fixture
    def project(self):
        return Project.objects.create(name='foo', slug='foo')

    @fixture
    def path(self):
        return reverse('sentry-api-store', kwargs={'project_id': self.project.slug})

    @mock.patch('sentry.web.api.StoreView._parse_header')
    @mock.patch('sentry.web.api.project_from_auth_vars')
    def test_options_response(self, project_from_auth_vars, parse_header):
        parse_header.return_value = {
            'sentry_project': self.project.id,
            'sentry_key': 'a' * 40,
            'sentry_version': '2.0',
        }
        project_from_auth_vars.return_value = (self.project, None)
        resp = self.client.options(self.path)
        self.assertEquals(resp.status_code, 200)
        self.assertIn('Allow', resp)
        self.assertEquals(resp['Allow'], 'GET, POST, HEAD, OPTIONS')
        self.assertIn('Content-Length', resp)
        self.assertEquals(resp['Content-Length'], '0')

    @mock.patch('sentry.web.api.is_valid_origin', mock.Mock(return_value=False))
    def test_options_response_with_invalid_origin(self):
        resp = self.client.options(self.path, HTTP_ORIGIN='http://foo.com')
        self.assertEquals(resp.status_code, 400)
        self.assertIn('Access-Control-Allow-Origin', resp)
        self.assertEquals(resp['Access-Control-Allow-Origin'], '*')
        self.assertIn('X-Sentry-Error', resp)
        self.assertEquals(resp['X-Sentry-Error'], "Invalid origin: 'http://foo.com'")
        self.assertEquals(resp.content, resp['X-Sentry-Error'])

    @mock.patch('sentry.web.api.is_valid_origin', mock.Mock(return_value=False))
    def test_options_response_with_invalid_referrer(self):
        resp = self.client.options(self.path, HTTP_REFERER='http://foo.com')
        self.assertEquals(resp.status_code, 400)
        self.assertIn('Access-Control-Allow-Origin', resp)
        self.assertEquals(resp['Access-Control-Allow-Origin'], '*')
        self.assertIn('X-Sentry-Error', resp)
        self.assertEquals(resp['X-Sentry-Error'], "Invalid origin: 'http://foo.com'")
        self.assertEquals(resp.content, resp['X-Sentry-Error'])

    @mock.patch('sentry.web.api.is_valid_origin', mock.Mock(return_value=True))
    def test_options_response_with_valid_origin(self):
        resp = self.client.options(self.path, HTTP_ORIGIN='http://foo.com')
        self.assertEquals(resp.status_code, 200)
        self.assertIn('Access-Control-Allow-Origin', resp)
        self.assertEquals(resp['Access-Control-Allow-Origin'], 'http://foo.com')

    @mock.patch('sentry.web.api.is_valid_origin', mock.Mock(return_value=True))
    def test_options_response_with_valid_referrer(self):
        resp = self.client.options(self.path, HTTP_REFERER='http://foo.com')
        self.assertEquals(resp.status_code, 200)
        self.assertIn('Access-Control-Allow-Origin', resp)
        self.assertEquals(resp['Access-Control-Allow-Origin'], 'http://foo.com')


class CrossDomainXmlTest(TestCase):
    @fixture
    def project(self):
        return Project.objects.create(name='foo', slug='foo', public=True)

    @fixture
    def path(self):
        return reverse('sentry-api-crossdomain-xml', kwargs={'project_id': self.project.slug})

    @mock.patch('sentry.web.api.get_origins')
    def test_output_with_global(self, get_origins):
        get_origins.return_value = '*'
        resp = self.client.get(self.path)
        get_origins.assert_called_once_with(self.project)
        self.assertEquals(resp.status_code, 200)
        self.assertEquals(resp['Content-Type'], 'application/xml')
        self.assertTemplateUsed(resp, 'sentry/crossdomain.xml')
        assert '<allow-access-from domain="*" secure="false" />' in resp.content

    @mock.patch('sentry.web.api.get_origins')
    def test_output_with_whitelist(self, get_origins):
        get_origins.return_value = ['disqus.com', 'www.disqus.com']
        resp = self.client.get(self.path)
        get_origins.assert_called_once_with(self.project)
        self.assertEquals(resp.status_code, 200)
        self.assertEquals(resp['Content-Type'], 'application/xml')
        self.assertTemplateUsed(resp, 'sentry/crossdomain.xml')
        assert '<allow-access-from domain="disqus.com" secure="false" />' in resp.content
        assert '<allow-access-from domain="www.disqus.com" secure="false" />' in resp.content

    @mock.patch('sentry.web.api.get_origins')
    def test_output_with_no_origins(self, get_origins):
        get_origins.return_value = []
        resp = self.client.get(self.path)
        get_origins.assert_called_once_with(self.project)
        self.assertEquals(resp.status_code, 200)
        self.assertEquals(resp['Content-Type'], 'application/xml')
        self.assertTemplateUsed(resp, 'sentry/crossdomain.xml')
        assert '<allow-access-from' not in resp.content

    def test_output_allows_x_sentry_auth(self):
        resp = self.client.get(self.path)
        self.assertEquals(resp.status_code, 200)
        self.assertEquals(resp['Content-Type'], 'application/xml')
        self.assertTemplateUsed(resp, 'sentry/crossdomain.xml')
        assert '<allow-http-request-headers-from domain="*" headers="X-Sentry-Auth" secure="false" />' in resp.content


class CrossDomainXmlIndexTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-api-crossdomain-xml-index')

    def test_permits_policies(self):
        resp = self.client.get(self.path)
        self.assertEquals(resp.status_code, 200)
        self.assertEquals(resp['Content-Type'], 'application/xml')
        self.assertTemplateUsed(resp, 'sentry/crossdomain_index.xml')
        assert '<site-control permitted-cross-domain-policies="all" />' in resp.content
