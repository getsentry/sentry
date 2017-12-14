from __future__ import absolute_import

import mock
import six

from django.core.urlresolvers import reverse

from sentry.models import Project, ProjectBookmark, ProjectStatus, UserOption, DeletedProject
from sentry.testutils import APITestCase


class ProjectDetailsTest(APITestCase):
    def test_simple(self):
        project = self.project  # force creation
        self.login_as(user=self.user)
        url = reverse(
            'sentry-api-0-project-details',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
            }
        )
        response = self.client.get(url)
        assert response.status_code == 200
        assert response.data['id'] == six.text_type(project.id)

    def test_numeric_org_slug(self):
        # Regression test for https://github.com/getsentry/sentry/issues/2236
        self.login_as(user=self.user)
        org = self.create_organization(
            name='baz',
            slug='1',
            owner=self.user,
        )
        team = self.create_team(
            organization=org,
            name='foo',
            slug='foo',
        )
        project = self.create_project(
            name='Bar',
            slug='bar',
            teams=[team],
        )
        # We want to make sure we don't hit the LegacyProjectRedirect view at all.
        url = '/api/0/projects/%s/%s/' % (org.slug, project.slug)
        response = self.client.get(url)
        assert response.status_code == 200
        assert response.data['id'] == six.text_type(project.id)

    def test_with_stats(self):
        project = self.create_project()
        self.create_group(project=project)
        self.login_as(user=self.user)
        url = reverse(
            'sentry-api-0-project-details',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
            }
        )
        response = self.client.get(url + '?include=stats')
        assert response.status_code == 200
        assert response.data['stats']['unresolved'] == 1


class ProjectUpdateTest(APITestCase):
    def setUp(self):
        super(ProjectUpdateTest, self).setUp()
        self.path = reverse('sentry-api-0-project-details', kwargs={
            'organization_slug': self.project.organization.slug,
            'project_slug': self.project.slug,
        })
        self.login_as(user=self.user)

    def test_team_changes(self):
        project = self.create_project()
        team = self.create_team(members=[self.user])
        self.login_as(user=self.user)
        url = reverse(
            'sentry-api-0-project-details',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
            }
        )
        resp = self.client.put(
            url, data={
                'team': team.slug,
            }
        )
        assert resp.status_code == 200, resp.content
        project = Project.objects.get(id=project.id)
        assert project.team == team
        assert project.teams.first() == team

    def test_team_changes_not_found(self):
        project = self.create_project()
        self.login_as(user=self.user)
        url = reverse(
            'sentry-api-0-project-details',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
            }
        )
        resp = self.client.put(
            url, data={
                'team': 'the-team-that-does-not-exist',
            }
        )
        assert resp.status_code == 400, resp.content
        assert resp.data['detail'][0] == 'The new team is not found.'
        project = Project.objects.get(id=project.id)

        assert project.team == self.team

    def test_simple_member_restriction(self):
        project = self.create_project()
        user = self.create_user('bar@example.com')
        self.create_member(
            user=user,
            organization=project.organization,
            teams=[project.team],
            role='member',
        )
        self.login_as(user)
        resp = self.client.put(self.path, data={
            'slug': 'zzz',
            'isBookmarked': 'true',
        })
        assert resp.status_code == 403
        assert not ProjectBookmark.objects.filter(
            user=user,
            project_id=self.project.id,
        ).exists()

    def test_member_changes_permission_denied(self):
        project = self.create_project()
        user = self.create_user('bar@example.com')
        self.create_member(
            user=user,
            organization=project.organization,
            teams=[project.team],
            role='member',
        )
        self.login_as(user=user)
        url = reverse(
            'sentry-api-0-project-details',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
            }
        )
        response = self.client.put(
            url, data={
                'slug': 'zzz',
                'isBookmarked': 'true',
            }
        )
        assert response.status_code == 403

        assert Project.objects.get(id=project.id).slug != 'zzz'

        assert not ProjectBookmark.objects.filter(
            user=user,
            project_id=project.id,
        ).exists()

    def test_name(self):
        resp = self.client.put(self.path, data={
            'name': 'hello world',
        })
        assert resp.status_code == 200, resp.content
        project = Project.objects.get(id=self.project.id)
        assert project.name == 'hello world'

    def test_slug(self):
        resp = self.client.put(self.path, data={
            'slug': 'foobar',
        })
        assert resp.status_code == 200, resp.content
        project = Project.objects.get(id=self.project.id)
        assert project.slug == 'foobar'

    def test_invalid_slug(self):
        new_project = self.create_project()
        resp = self.client.put(self.path, data={
            'slug': new_project.slug,
        })

        assert resp.status_code == 400
        project = Project.objects.get(id=self.project.id)
        assert project.slug != new_project.slug

    def test_platform(self):
        resp = self.client.put(self.path, data={
            'platform': 'cocoa',
        })
        assert resp.status_code == 200, resp.content
        project = Project.objects.get(id=self.project.id)
        assert project.platform == 'cocoa'

    def test_options(self):
        options = {
            'sentry:origins': 'foo\nbar',
            'sentry:resolve_age': 1,
            'sentry:scrub_data': False,
            'sentry:scrub_defaults': False,
            'sentry:sensitive_fields': ['foo', 'bar'],
            'sentry:safe_fields': ['token'],
            'sentry:csp_ignored_sources_defaults': False,
            'sentry:csp_ignored_sources': 'foo\nbar',
            'filters:blacklisted_ips': '127.0.0.1\n198.51.100.0',
            'filters:releases': '1.*\n2.1.*',
            'filters:error_messages': 'TypeError*\n*: integer division by modulo or zero',
        }
        with self.feature('projects:custom-inbound-filters'):
            resp = self.client.put(self.path, data={'options': options})
        assert resp.status_code == 200, resp.content
        project = Project.objects.get(id=self.project.id)
        assert project.get_option('sentry:origins', []) == options['sentry:origins'].split('\n')
        assert project.get_option('sentry:resolve_age', 0) == options['sentry:resolve_age']
        assert project.get_option('sentry:scrub_data', True) == options['sentry:scrub_data']
        assert project.get_option('sentry:scrub_defaults', True) == options['sentry:scrub_defaults']
        assert project.get_option('sentry:sensitive_fields',
                                  []) == options['sentry:sensitive_fields']
        assert project.get_option('sentry:safe_fields', []) == options['sentry:safe_fields']
        assert project.get_option('sentry:csp_ignored_sources_defaults',
                                  True) == options['sentry:csp_ignored_sources_defaults']
        assert project.get_option('sentry:csp_ignored_sources',
                                  []) == options['sentry:csp_ignored_sources'].split('\n')
        assert project.get_option('sentry:blacklisted_ips') == ['127.0.0.1', '198.51.100.0']
        assert project.get_option('sentry:releases') == ['1.*', '2.1.*']
        assert project.get_option('sentry:error_messages') == [
            'TypeError*', '*: integer division by modulo or zero'
        ]

    def test_bookmarks(self):
        resp = self.client.put(self.path, data={
            'isBookmarked': 'false',
        })
        assert resp.status_code == 200, resp.content
        assert not ProjectBookmark.objects.filter(
            project_id=self.project.id,
            user=self.user,
        ).exists()

    def test_subscription(self):
        resp = self.client.put(self.path, data={
            'isSubscribed': 'true',
        })
        assert resp.status_code == 200, resp.content
        assert UserOption.objects.get(
            user=self.user,
            project=self.project,
        ).value == 1

        resp = self.client.put(self.path, data={
            'isSubscribed': 'false',
        })
        assert resp.status_code == 200, resp.content
        assert UserOption.objects.get(
            user=self.user,
            project=self.project,
        ).value == 0

    def test_security_token(self):
        resp = self.client.put(self.path, data={
            'securityToken': 'fizzbuzz',
        })
        assert resp.status_code == 200, resp.content
        assert self.project.get_security_token() == 'fizzbuzz'
        assert resp.data['securityToken'] == 'fizzbuzz'

        # can delete
        resp = self.client.put(self.path, data={
            'securityToken': '',
        })
        assert resp.status_code == 200, resp.content
        assert self.project.get_security_token() == ''
        assert resp.data['securityToken'] == ''

    def test_security_token_header(self):
        resp = self.client.put(self.path, data={
            'securityTokenHeader': 'X-Hello-World',
        })
        assert resp.status_code == 200, resp.content
        assert self.project.get_option('sentry:token_header') == 'X-Hello-World'
        assert resp.data['securityTokenHeader'] == 'X-Hello-World'

        # can delete
        resp = self.client.put(self.path, data={
            'securityTokenHeader': '',
        })
        assert resp.status_code == 200, resp.content
        assert self.project.get_option('sentry:token_header') == ''
        assert resp.data['securityTokenHeader'] == ''

    def test_verify_ssl(self):
        resp = self.client.put(self.path, data={
            'verifySSL': False,
        })
        assert resp.status_code == 200, resp.content
        assert self.project.get_option('sentry:verify_ssl') is False
        assert resp.data['verifySSL'] is False

    def test_scrub_ip_address(self):
        resp = self.client.put(self.path, data={
            'scrubIPAddresses': True,
        })
        assert resp.status_code == 200, resp.content
        assert self.project.get_option('sentry:scrub_ip_address') is True
        assert resp.data['scrubIPAddresses'] is True

        resp = self.client.put(self.path, data={
            'scrubIPAddresses': False,
        })
        assert resp.status_code == 200, resp.content
        assert self.project.get_option('sentry:scrub_ip_address') is False
        assert resp.data['scrubIPAddresses'] is False

    def test_scrape_javascript(self):
        resp = self.client.put(self.path, data={
            'scrapeJavaScript': False,
        })
        assert resp.status_code == 200, resp.content
        assert self.project.get_option('sentry:scrape_javascript') is False
        assert resp.data['scrapeJavaScript'] is False

    def test_default_environment(self):
        resp = self.client.put(self.path, data={
            'defaultEnvironment': 'dev',
        })
        assert resp.status_code == 200, resp.content
        assert self.project.get_option('sentry:default_environment') == 'dev'
        assert resp.data['defaultEnvironment'] == 'dev'

        resp = self.client.put(self.path, data={
            'defaultEnvironment': '',
        })
        assert resp.status_code == 200, resp.content
        assert self.project.get_option('sentry:default_environment') == ''
        assert resp.data['defaultEnvironment'] == ''

    def test_resolve_age(self):
        resp = self.client.put(self.path, data={
            'resolveAge': 5,
        })
        assert resp.status_code == 200, resp.content
        assert self.project.get_option('sentry:resolve_age') == 5
        assert resp.data['resolveAge'] == 5

        # can set to 0 or delete
        resp = self.client.put(self.path, data={
            'resolveAge': '',
        })
        assert resp.status_code == 200, resp.content
        assert self.project.get_option('sentry:resolve_age') == 0
        assert resp.data['resolveAge'] == 0

    def test_allowed_domains(self):
        resp = self.client.put(self.path, data={
            'allowedDomains': ['foobar.com', 'https://example.com'],
        })
        assert resp.status_code == 200, resp.content
        assert self.project.get_option('sentry:origins') == ['foobar.com', 'https://example.com']
        assert resp.data['allowedDomains'] == ['foobar.com', 'https://example.com']

        # cannot be empty
        resp = self.client.put(self.path, data={
            'allowedDomains': '',
        })
        assert resp.status_code == 400, resp.content
        assert self.project.get_option('sentry:origins') == ['foobar.com', 'https://example.com']
        assert resp.data['allowedDomains'] == [
            'Empty value will block all requests, use * to accept from all domains']

        resp = self.client.put(self.path, data={
            'allowedDomains': ['*', ''],
        })
        assert resp.status_code == 200, resp.content
        assert self.project.get_option('sentry:origins') == ['*']
        assert resp.data['allowedDomains'] == ['*']

    def test_safe_fields(self):
        resp = self.client.put(self.path, data={
            'safeFields': ['foobar.com', 'https://example.com'],
        })
        assert resp.status_code == 200, resp.content
        assert self.project.get_option('sentry:safe_fields') == [
            'foobar.com', 'https://example.com']
        assert resp.data['safeFields'] == ['foobar.com', 'https://example.com']

    def test_sensitive_fields(self):
        resp = self.client.put(self.path, data={
            'sensitiveFields': ['foobar.com', 'https://example.com'],
        })
        assert resp.status_code == 200, resp.content
        assert self.project.get_option('sentry:sensitive_fields') == [
            'foobar.com', 'https://example.com']
        assert resp.data['sensitiveFields'] == ['foobar.com', 'https://example.com']

    def test_data_scrubber(self):
        resp = self.client.put(self.path, data={
            'dataScrubber': False,
        })
        assert resp.status_code == 200, resp.content
        assert self.project.get_option('sentry:scrub_data') is False
        assert resp.data['dataScrubber'] is False

    def test_data_scrubber_defaults(self):
        resp = self.client.put(self.path, data={
            'dataScrubberDefaults': False,
        })
        assert resp.status_code == 200, resp.content
        assert self.project.get_option('sentry:scrub_defaults') is False
        assert resp.data['dataScrubberDefaults'] is False


class ProjectDeleteTest(APITestCase):
    @mock.patch('sentry.api.endpoints.project_details.uuid4')
    @mock.patch('sentry.api.endpoints.project_details.delete_project')
    def test_simple(self, mock_delete_project, mock_uuid4):
        class uuid(object):
            hex = 'abc123'

        mock_uuid4.return_value = uuid
        project = self.create_project()

        self.login_as(user=self.user)

        url = reverse(
            'sentry-api-0-project-details',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
            }
        )

        with self.settings(SENTRY_PROJECT=0):
            response = self.client.delete(url)

        assert response.status_code == 204

        mock_delete_project.apply_async.assert_called_once_with(
            kwargs={
                'object_id': project.id,
                'transaction_id': 'abc123',
            },
            countdown=3600,
        )

        assert Project.objects.get(id=project.id).status == ProjectStatus.PENDING_DELETION
        deleted_project = DeletedProject.objects.get(slug=project.slug)
        self.assert_valid_deleted_log(deleted_project, project)

    @mock.patch('sentry.api.endpoints.project_details.delete_project')
    def test_internal_project(self, mock_delete_project):
        project = self.create_project()

        self.login_as(user=self.user)

        url = reverse(
            'sentry-api-0-project-details',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
            }
        )

        with self.settings(SENTRY_PROJECT=project.id):
            response = self.client.delete(url)

        assert not mock_delete_project.delay.mock_calls

        assert response.status_code == 403
