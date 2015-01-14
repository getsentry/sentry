# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock

from django.core.urlresolvers import reverse
from exam import fixture

from sentry.models import OrganizationMember, User
from sentry.testutils import TestCase
from sentry.utils import json


class StoreViewTest(TestCase):
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

    @mock.patch('sentry.web.api.insert_data_to_database')
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
        assert resp.status_code == 200

        call_data = mock_insert_data_to_database.call_args[0][0]
        print call_data
        assert not call_data['sentry.interfaces.User'].get('ip_address')
        assert not call_data['sentry.interfaces.Http']['env'].get('REMOTE_ADDR')


class CrossDomainXmlTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-api-crossdomain-xml', kwargs={'project_id': self.project.id})

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
        assert '<allow-http-request-headers-from domain="*" headers="*" secure="false" />' in resp.content


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


class SearchUsersTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-api-search-users', args=[self.organization.slug])

    def setUp(self):
        super(SearchUsersTest, self).setUp()
        self.login_as(self.user)

    def test_finds_users_from_organization_members(self):
        otheruser = User.objects.create(first_name='Bob Ross', username='bobross', email='bob@example.com')
        OrganizationMember.objects.create(
            organization=self.team.organization,
            user=otheruser,
        )

        resp = self.client.get(self.path, {'query': 'bob'})

        assert resp.status_code == 200
        assert resp['Content-Type'] == 'application/json'
        assert json.loads(resp.content) == {
            'results': [{
                'id': otheruser.id,
                'first_name': otheruser.first_name,
                'username': otheruser.username,
                'email': otheruser.email,
            }],
            'query': 'bob',
        }

    def test_does_not_include_users_who_are_not_members(self):
        User.objects.create(first_name='Bob Ross', username='bobross', email='bob@example.com')

        resp = self.client.get(self.path, {'query': 'bob'})

        assert resp.status_code == 200
        assert resp['Content-Type'] == 'application/json'
        assert json.loads(resp.content) == {
            'results': [],
            'query': 'bob',
        }


class SearchProjectsTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-api-search-projects', args=[self.organization.slug])

    def setUp(self):
        super(SearchProjectsTest, self).setUp()
        self.login_as(self.user)

    def test_finds_projects_from_org(self):
        project = self.create_project(
            organization=self.organization,
            team=self.team,
            name='Sample',
        )
        resp = self.client.get(self.path, {'query': 'sample'})

        assert resp.status_code == 200
        assert resp['Content-Type'] == 'application/json'
        assert json.loads(resp.content) == {
            'results': [{
                'id': project.id,
                'slug': project.slug,
                'name': project.name,
            }],
            'query': 'sample',
        }

    def test_does_not_include_projects_from_other_organizations(self):
        org = self.create_organization(owner=self.user, name='Sample')
        team = self.create_team(organization=org, owner=self.user, name='Sample')
        self.create_project(organization=org, team=team, name='Sample')

        resp = self.client.get(self.path, {'query': 'sample'})

        assert resp.status_code == 200
        assert resp['Content-Type'] == 'application/json'
        assert json.loads(resp.content) == {
            'results': [],
            'query': 'sample',
        }
