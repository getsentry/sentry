from __future__ import absolute_import

import mock
import six

from django.core.urlresolvers import reverse

from sentry.models import Project, ProjectBookmark, ProjectStatus, UserOption
from sentry.testutils import APITestCase


class ProjectDetailsTest(APITestCase):
    def test_simple(self):
        project = self.project  # force creation
        self.login_as(user=self.user)
        url = reverse('sentry-api-0-project-details', kwargs={
            'organization_slug': project.organization.slug,
            'project_slug': project.slug,
        })
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
            team=team,
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
        url = reverse('sentry-api-0-project-details', kwargs={
            'organization_slug': project.organization.slug,
            'project_slug': project.slug,
        })
        response = self.client.get(url + '?include=stats')
        assert response.status_code == 200
        assert response.data['stats']['unresolved'] == 1


class ProjectUpdateTest(APITestCase):
    def test_simple(self):
        project = self.project  # force creation
        self.login_as(user=self.user)
        url = reverse('sentry-api-0-project-details', kwargs={
            'organization_slug': project.organization.slug,
            'project_slug': project.slug,
        })
        resp = self.client.put(url, data={
            'name': 'hello world',
            'slug': 'foobar',
        })
        assert resp.status_code == 200, resp.content
        project = Project.objects.get(id=project.id)
        assert project.name == 'hello world'
        assert project.slug == 'foobar'

    def test_member_changes(self):
        project = self.create_project()
        user = self.create_user('bar@example.com')
        self.create_member(
            user=user,
            organization=project.organization,
            teams=[project.team],
            role='member',
        )
        self.login_as(user=user)
        url = reverse('sentry-api-0-project-details', kwargs={
            'organization_slug': project.organization.slug,
            'project_slug': project.slug,
        })
        response = self.client.put(url, data={
            'slug': 'zzz',
            'isBookmarked': 'true',
        })
        assert response.status_code == 200
        assert response.data['slug'] != 'zzz'

        assert ProjectBookmark.objects.filter(
            user=user,
            project_id=project.id,
        ).exists()

    def test_options(self):
        project = self.project  # force creation
        self.login_as(user=self.user)
        url = reverse('sentry-api-0-project-details', kwargs={
            'organization_slug': project.organization.slug,
            'project_slug': project.slug,
        })
        options = {
            'sentry:origins': 'foo\nbar',
            'sentry:resolve_age': 1,
            'sentry:scrub_data': False,
            'sentry:scrub_defaults': False,
            'sentry:sensitive_fields': ['foo', 'bar'],
            'sentry:safe_fields': ['token'],
            'sentry:csp_ignored_sources_defaults': False,
            'sentry:csp_ignored_sources': 'foo\nbar',
        }
        resp = self.client.put(url, data={
            'options': options
        })
        assert resp.status_code == 200, resp.content
        project = Project.objects.get(id=project.id)
        assert project.get_option('sentry:origins', []) == options['sentry:origins'].split('\n')
        assert project.get_option('sentry:resolve_age', 0) == options['sentry:resolve_age']
        assert project.get_option('sentry:scrub_data', True) == options['sentry:scrub_data']
        assert project.get_option('sentry:scrub_defaults', True) == options['sentry:scrub_defaults']
        assert project.get_option('sentry:sensitive_fields', []) == options['sentry:sensitive_fields']
        assert project.get_option('sentry:safe_fields', []) == options['sentry:safe_fields']
        assert project.get_option('sentry:csp_ignored_sources_defaults', True) == options['sentry:csp_ignored_sources_defaults']
        assert project.get_option('sentry:csp_ignored_sources', []) == options['sentry:csp_ignored_sources'].split('\n')

    def test_bookmarks(self):
        project = self.project  # force creation
        self.login_as(user=self.user)
        url = reverse('sentry-api-0-project-details', kwargs={
            'organization_slug': project.organization.slug,
            'project_slug': project.slug,
        })
        resp = self.client.put(url, data={
            'isBookmarked': 'true',
        })
        assert resp.status_code == 200, resp.content
        assert ProjectBookmark.objects.filter(
            project_id=project.id,
            user=self.user,
        ).exists()

        resp = self.client.put(url, data={
            'isBookmarked': 'false',
        })
        assert resp.status_code == 200, resp.content
        assert not ProjectBookmark.objects.filter(
            project_id=project.id,
            user=self.user,
        ).exists()

    def test_subscription(self):
        project = self.project  # force creation
        self.login_as(user=self.user)
        url = reverse('sentry-api-0-project-details', kwargs={
            'organization_slug': project.organization.slug,
            'project_slug': project.slug,
        })
        resp = self.client.put(url, data={
            'isSubscribed': 'true',
        })
        assert resp.status_code == 200, resp.content
        assert UserOption.objects.get(
            user=self.user,
            project=project,
        ).value == 1

        resp = self.client.put(url, data={
            'isSubscribed': 'false',
        })
        assert resp.status_code == 200, resp.content
        assert UserOption.objects.get(
            user=self.user,
            project=project,
        ).value == 0


class ProjectDeleteTest(APITestCase):
    @mock.patch('sentry.api.endpoints.project_details.uuid4')
    @mock.patch('sentry.api.endpoints.project_details.delete_project')
    def test_simple(self, mock_delete_project, mock_uuid4):
        class uuid(object):
            hex = 'abc123'

        mock_uuid4.return_value = uuid
        project = self.create_project()

        self.login_as(user=self.user)

        url = reverse('sentry-api-0-project-details', kwargs={
            'organization_slug': project.organization.slug,
            'project_slug': project.slug,
        })

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

    @mock.patch('sentry.api.endpoints.project_details.delete_project')
    def test_internal_project(self, mock_delete_project):
        project = self.create_project()

        self.login_as(user=self.user)

        url = reverse('sentry-api-0-project-details', kwargs={
            'organization_slug': project.organization.slug,
            'project_slug': project.slug,
        })

        with self.settings(SENTRY_PROJECT=project.id):
            response = self.client.delete(url)

        assert not mock_delete_project.delay.mock_calls

        assert response.status_code == 403
