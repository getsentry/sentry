# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock

from django.core.urlresolvers import reverse
from exam import fixture
from mock import Mock

from sentry.models import ProjectKey
from sentry.signals import event_accepted, event_dropped, event_filtered
from sentry.testutils import (
    assert_mock_called_once_with_partial, TestCase
)
from sentry.utils import json


class CspReportViewTest(TestCase):
    @fixture
    def path(self):
        path = reverse('sentry-api-csp-report', kwargs={'project_id': self.project.id})
        return path + '?sentry_key=%s' % self.projectkey.public_key

    def test_get_response(self):
        resp = self.client.get(self.path)
        assert resp.status_code == 405, resp.content

    def test_invalid_content_type(self):
        resp = self.client.post(self.path, content_type='text/plain')
        assert resp.status_code == 400, resp.content

    def test_missing_csp_report(self):
        resp = self.client.post(self.path,
            content_type='application/csp-report',
            data='{"lol":1}',
            HTTP_USER_AGENT='awesome',
        )
        assert resp.status_code == 400, resp.content

    @mock.patch('sentry.utils.http.get_origins')
    def test_bad_origin(self, get_origins):
        get_origins.return_value = ['example.com']
        resp = self.client.post(self.path,
            content_type='application/csp-report',
            data='{"csp-report":{"document-uri":"http://lolnope.com"}}',
            HTTP_USER_AGENT='awesome',
        )
        assert resp.status_code == 403, resp.content

        get_origins.return_value = ['*']
        resp = self.client.post(self.path,
            content_type='application/csp-report',
            data='{"csp-report":{"document-uri":"about:blank"}}',
            HTTP_USER_AGENT='awesome',
        )
        assert resp.status_code == 403, resp.content

    @mock.patch('sentry.web.api.is_valid_origin', mock.Mock(return_value=True))
    @mock.patch('sentry.web.api.CspReportView.process')
    def test_post_success(self, process):
        process.return_value = 'ok'
        resp = self._postCspWithHeader({
            'document-uri': 'http://example.com',
            'source-file': 'http://example.com',
            'effective-directive': 'style-src',
        })
        assert resp.status_code == 201, resp.content


class StoreViewTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-api-store', kwargs={'project_id': self.project.id})

    @mock.patch('sentry.web.api.StoreView._parse_header')
    def test_options_response(self, parse_header):
        project = self.create_project()
        pk = ProjectKey.objects.get_or_create(project=project)[0]
        parse_header.return_value = {
            'sentry_project': project.id,
            'sentry_key': pk.public_key,
            'sentry_version': '2.0',
        }
        resp = self.client.options(self.path)
        assert resp.status_code == 200, (resp.status_code, resp.content)
        self.assertIn('Allow', resp)
        self.assertEquals(resp['Allow'], 'GET, POST, HEAD, OPTIONS')
        self.assertIn('Content-Length', resp)
        self.assertEquals(resp['Content-Length'], '0')

    @mock.patch('sentry.web.api.is_valid_origin', mock.Mock(return_value=False))
    def test_options_response_with_invalid_origin(self):
        resp = self.client.options(self.path, HTTP_ORIGIN='http://foo.com')
        assert resp.status_code == 403, (resp.status_code, resp.content)
        self.assertIn('Access-Control-Allow-Origin', resp)
        self.assertEquals(resp['Access-Control-Allow-Origin'], '*')
        self.assertIn('X-Sentry-Error', resp)
        assert resp['X-Sentry-Error'] == "Invalid origin: http://foo.com"
        assert json.loads(resp.content)['error'] == resp['X-Sentry-Error']

    @mock.patch('sentry.web.api.is_valid_origin', mock.Mock(return_value=False))
    def test_options_response_with_invalid_referrer(self):
        resp = self.client.options(self.path, HTTP_REFERER='http://foo.com')
        assert resp.status_code == 403, (resp.status_code, resp.content)
        self.assertIn('Access-Control-Allow-Origin', resp)
        self.assertEquals(resp['Access-Control-Allow-Origin'], '*')
        self.assertIn('X-Sentry-Error', resp)
        assert resp['X-Sentry-Error'] == "Invalid origin: http://foo.com"
        assert json.loads(resp.content)['error'] == resp['X-Sentry-Error']

    @mock.patch('sentry.web.api.is_valid_origin', mock.Mock(return_value=True))
    def test_options_response_with_valid_origin(self):
        resp = self.client.options(self.path, HTTP_ORIGIN='http://foo.com')
        assert resp.status_code == 200, (resp.status_code, resp.content)
        self.assertIn('Access-Control-Allow-Origin', resp)
        self.assertEquals(resp['Access-Control-Allow-Origin'], 'http://foo.com')

    @mock.patch('sentry.web.api.is_valid_origin', mock.Mock(return_value=True))
    def test_options_response_with_valid_referrer(self):
        resp = self.client.options(self.path, HTTP_REFERER='http://foo.com')
        assert resp.status_code == 200, (resp.status_code, resp.content)
        self.assertIn('Access-Control-Allow-Origin', resp)
        self.assertEquals(resp['Access-Control-Allow-Origin'], 'http://foo.com')

    @mock.patch('sentry.coreapi.is_valid_ip', mock.Mock(return_value=False))
    def test_request_with_backlisted_ip(self):
        resp = self._postWithHeader({})
        assert resp.status_code == 403, (resp.status_code, resp.content)

    @mock.patch('sentry.coreapi.ClientApiHelper.insert_data_to_database')
    def test_scrubs_ip_address(self, mock_insert_data_to_database):
        self.project.update_option('sentry:scrub_ip_address', True)
        body = {
            "message": "foo bar",
            "sentry.interfaces.User": {"ip_address": "127.0.0.1"},
            "sentry.interfaces.Http": {
                "method": "GET",
                "url": "http://example.com/",
                "env": {"REMOTE_ADDR": "127.0.0.1"}
            },
        }
        resp = self._postWithHeader(body)
        assert resp.status_code == 200, (resp.status_code, resp.content)

        call_data = mock_insert_data_to_database.call_args[0][0]
        assert not call_data['sentry.interfaces.User'].get('ip_address')
        assert not call_data['sentry.interfaces.Http']['env'].get('REMOTE_ADDR')

    @mock.patch('sentry.coreapi.ClientApiHelper.insert_data_to_database')
    def test_scrubs_org_ip_address_override(self, mock_insert_data_to_database):
        self.organization.update_option('sentry:require_scrub_ip_address', True)
        self.project.update_option('sentry:scrub_ip_address', False)
        body = {
            "message": "foo bar",
            "sentry.interfaces.User": {"ip_address": "127.0.0.1"},
            "sentry.interfaces.Http": {
                "method": "GET",
                "url": "http://example.com/",
                "env": {"REMOTE_ADDR": "127.0.0.1"}
            },
        }
        resp = self._postWithHeader(body)
        assert resp.status_code == 200, (resp.status_code, resp.content)

        call_data = mock_insert_data_to_database.call_args[0][0]
        assert not call_data['sentry.interfaces.User'].get('ip_address')
        assert not call_data['sentry.interfaces.Http']['env'].get('REMOTE_ADDR')

    @mock.patch('sentry.coreapi.ClientApiHelper.insert_data_to_database')
    def test_scrub_data_off(self, mock_insert_data_to_database):
        self.project.update_option('sentry:scrub_data', False)
        self.project.update_option('sentry:scrub_defaults', False)
        body = {
            "message": "foo bar",
            "sentry.interfaces.User": {"ip_address": "127.0.0.1"},
            "sentry.interfaces.Http": {
                "method": "GET",
                "url": "http://example.com/",
                "data": "password=lol&foo=1&bar=2&baz=3"
            },
        }
        resp = self._postWithHeader(body)
        assert resp.status_code == 200, (resp.status_code, resp.content)

        call_data = mock_insert_data_to_database.call_args[0][0]
        assert call_data['sentry.interfaces.Http']['data'] == 'password=lol&foo=1&bar=2&baz=3'

    @mock.patch('sentry.coreapi.ClientApiHelper.insert_data_to_database')
    def test_scrub_data_on(self, mock_insert_data_to_database):
        self.project.update_option('sentry:scrub_data', True)
        self.project.update_option('sentry:scrub_defaults', False)
        body = {
            "message": "foo bar",
            "sentry.interfaces.User": {"ip_address": "127.0.0.1"},
            "sentry.interfaces.Http": {
                "method": "GET",
                "url": "http://example.com/",
                "data": "password=lol&foo=1&bar=2&baz=3"
            },
        }
        resp = self._postWithHeader(body)
        assert resp.status_code == 200, (resp.status_code, resp.content)

        call_data = mock_insert_data_to_database.call_args[0][0]
        assert call_data['sentry.interfaces.Http']['data'] == 'password=lol&foo=1&bar=2&baz=3'

    @mock.patch('sentry.coreapi.ClientApiHelper.insert_data_to_database')
    def test_scrub_data_defaults(self, mock_insert_data_to_database):
        self.project.update_option('sentry:scrub_data', True)
        self.project.update_option('sentry:scrub_defaults', True)
        body = {
            "message": "foo bar",
            "sentry.interfaces.User": {"ip_address": "127.0.0.1"},
            "sentry.interfaces.Http": {
                "method": "GET",
                "url": "http://example.com/",
                "data": "password=lol&foo=1&bar=2&baz=3"
            },
        }
        resp = self._postWithHeader(body)
        assert resp.status_code == 200, (resp.status_code, resp.content)

        call_data = mock_insert_data_to_database.call_args[0][0]
        assert call_data['sentry.interfaces.Http']['data'] == 'password=[Filtered]&foo=1&bar=2&baz=3'

    @mock.patch('sentry.coreapi.ClientApiHelper.insert_data_to_database')
    def test_scrub_data_sensitive_fields(self, mock_insert_data_to_database):
        self.project.update_option('sentry:scrub_data', True)
        self.project.update_option('sentry:scrub_defaults', True)
        self.project.update_option('sentry:sensitive_fields', ['foo', 'bar'])
        body = {
            "message": "foo bar",
            "sentry.interfaces.User": {"ip_address": "127.0.0.1"},
            "sentry.interfaces.Http": {
                "method": "GET",
                "url": "http://example.com/",
                "data": "password=lol&foo=1&bar=2&baz=3"
            },
        }
        resp = self._postWithHeader(body)
        assert resp.status_code == 200, (resp.status_code, resp.content)

        call_data = mock_insert_data_to_database.call_args[0][0]
        assert call_data['sentry.interfaces.Http']['data'] == 'password=[Filtered]&foo=[Filtered]&bar=[Filtered]&baz=3'

    @mock.patch('sentry.coreapi.ClientApiHelper.insert_data_to_database')
    def test_scrub_data_org_override(self, mock_insert_data_to_database):
        self.organization.update_option('sentry:require_scrub_data', True)
        self.project.update_option('sentry:scrub_data', False)
        self.organization.update_option('sentry:require_scrub_defaults', True)
        self.project.update_option('sentry:scrub_defaults', False)
        body = {
            "message": "foo bar",
            "sentry.interfaces.User": {"ip_address": "127.0.0.1"},
            "sentry.interfaces.Http": {
                "method": "GET",
                "url": "http://example.com/",
                "data": "password=lol&foo=1&bar=2&baz=3"
            },
        }
        resp = self._postWithHeader(body)
        assert resp.status_code == 200, (resp.status_code, resp.content)

        call_data = mock_insert_data_to_database.call_args[0][0]
        assert call_data['sentry.interfaces.Http']['data'] == 'password=[Filtered]&foo=1&bar=2&baz=3'

    @mock.patch('sentry.coreapi.ClientApiHelper.insert_data_to_database')
    def test_scrub_data_org_override_sensitive_fields(self, mock_insert_data_to_database):
        self.organization.update_option('sentry:require_scrub_data', True)
        self.organization.update_option('sentry:require_scrub_defaults', True)
        self.organization.update_option('sentry:sensitive_fields', ['baz'])
        self.project.update_option('sentry:sensitive_fields', ['foo', 'bar'])
        body = {
            "message": "foo bar",
            "sentry.interfaces.User": {"ip_address": "127.0.0.1"},
            "sentry.interfaces.Http": {
                "method": "GET",
                "url": "http://example.com/",
                "data": "password=lol&foo=1&bar=2&baz=3"
            },
        }
        resp = self._postWithHeader(body)
        assert resp.status_code == 200, (resp.status_code, resp.content)

        call_data = mock_insert_data_to_database.call_args[0][0]
        assert call_data['sentry.interfaces.Http']['data'] == 'password=[Filtered]&foo=[Filtered]&bar=[Filtered]&baz=[Filtered]'

    @mock.patch('sentry.coreapi.ClientApiHelper.insert_data_to_database')
    def test_uses_client_as_sdk(self, mock_insert_data_to_database):
        body = {
            "message": "foo bar",
        }
        resp = self._postWithHeader(body)
        assert resp.status_code == 200, (resp.status_code, resp.content)

        call_data = mock_insert_data_to_database.call_args[0][0]
        assert call_data['sdk'] == {
            'name': '_postWithHeader',
            'version': '0.0.0',
            'client_ip': '127.0.0.1',
        }

    @mock.patch('sentry.coreapi.ClientApiHelper.insert_data_to_database', Mock())
    def test_accepted_signal(self):
        mock_event_accepted = Mock()

        event_accepted.connect(mock_event_accepted)

        resp = self._postWithHeader({'sentry.interfaces.Message': {'message': u'hello'}})

        assert resp.status_code == 200, resp.content

        assert_mock_called_once_with_partial(
            mock_event_accepted,
            ip='127.0.0.1',
            project=self.project,
            signal=event_accepted,
        )

    @mock.patch('sentry.coreapi.ClientApiHelper.insert_data_to_database', Mock())
    @mock.patch('sentry.app.quotas.is_rate_limited')
    def test_dropped_signal(self, mock_is_rate_limited):
        mock_is_rate_limited.is_limited = True

        mock_event_dropped = Mock()

        event_dropped.connect(mock_event_dropped)

        resp = self._postWithHeader({'sentry.interfaces.Message': {'message': u'hello'}})

        assert resp.status_code == 429, resp.content

        assert_mock_called_once_with_partial(
            mock_event_dropped,
            ip='127.0.0.1',
            project=self.project,
            signal=event_dropped,
        )

    @mock.patch('sentry.coreapi.ClientApiHelper.insert_data_to_database', Mock())
    @mock.patch('sentry.coreapi.ClientApiHelper.should_filter')
    def test_filtered_signal(self, mock_should_filter):
        mock_should_filter.return_value = True

        mock_event_filtered = Mock()

        event_filtered.connect(mock_event_filtered)

        resp = self._postWithHeader({'sentry.interfaces.Message': {'message': u'hello'}})

        assert resp.status_code == 403, resp.content

        assert_mock_called_once_with_partial(
            mock_event_filtered,
            ip='127.0.0.1',
            project=self.project,
            signal=event_filtered,
        )


class CrossDomainXmlTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-api-crossdomain-xml', kwargs={'project_id': self.project.id})

    @mock.patch('sentry.web.api.get_origins')
    def test_output_with_global(self, get_origins):
        get_origins.return_value = '*'
        resp = self.client.get(self.path)
        get_origins.assert_called_once_with(self.project)
        assert resp.status_code == 200, resp.content
        self.assertEquals(resp['Content-Type'], 'application/xml')
        self.assertTemplateUsed(resp, 'sentry/crossdomain.xml')
        assert '<allow-access-from domain="*" secure="false" />' in resp.content.decode('utf-8')

    @mock.patch('sentry.web.api.get_origins')
    def test_output_with_whitelist(self, get_origins):
        get_origins.return_value = ['disqus.com', 'www.disqus.com']
        resp = self.client.get(self.path)
        get_origins.assert_called_once_with(self.project)
        self.assertEquals(resp.status_code, 200)
        self.assertEquals(resp['Content-Type'], 'application/xml')
        self.assertTemplateUsed(resp, 'sentry/crossdomain.xml')
        assert '<allow-access-from domain="disqus.com" secure="false" />' in resp.content.decode('utf-8')
        assert '<allow-access-from domain="www.disqus.com" secure="false" />' in resp.content.decode('utf-8')

    @mock.patch('sentry.web.api.get_origins')
    def test_output_with_no_origins(self, get_origins):
        get_origins.return_value = []
        resp = self.client.get(self.path)
        get_origins.assert_called_once_with(self.project)
        self.assertEquals(resp.status_code, 200)
        self.assertEquals(resp['Content-Type'], 'application/xml')
        self.assertTemplateUsed(resp, 'sentry/crossdomain.xml')
        assert '<allow-access-from' not in resp.content.decode('utf-8')

    def test_output_allows_x_sentry_auth(self):
        resp = self.client.get(self.path)
        self.assertEquals(resp.status_code, 200)
        self.assertEquals(resp['Content-Type'], 'application/xml')
        self.assertTemplateUsed(resp, 'sentry/crossdomain.xml')
        assert '<allow-http-request-headers-from domain="*" headers="*" secure="false" />' in resp.content.decode('utf-8')


class CrossDomainXmlIndexTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-api-crossdomain-xml-index')

    def test_permits_policies(self):
        resp = self.client.get(self.path)
        self.assertEquals(resp.status_code, 200)
        self.assertEquals(resp['Content-Type'], 'application/xml')
        self.assertTemplateUsed(resp, 'sentry/crossdomain_index.xml')
        assert '<site-control permitted-cross-domain-policies="all" />' in resp.content.decode('utf-8')


class RobotsTxtTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-api-robots-txt')

    def test_robots(self):
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert resp['Content-Type'] == 'text/plain'
