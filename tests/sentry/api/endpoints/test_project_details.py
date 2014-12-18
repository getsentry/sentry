from __future__ import absolute_import

import mock

from django.core.urlresolvers import reverse

from sentry.models import Project, ProjectStatus
from sentry.testutils import APITestCase


class ProjectDetailsTest(APITestCase):
    def test_simple(self):
        project = self.project  # force creation
        self.login_as(user=self.user)
        url = reverse('sentry-api-0-project-details', kwargs={'project_id': project.id})
        response = self.client.get(url)
        assert response.status_code == 200
        assert response.data['id'] == str(project.id)


class ProjectUpdateTest(APITestCase):
    def test_simple(self):
        project = self.project  # force creation
        self.login_as(user=self.user)
        url = reverse('sentry-api-0-project-details', kwargs={'project_id': project.id})
        resp = self.client.put(url, data={
            'name': 'hello world',
            'slug': 'foobar',
        })
        assert resp.status_code == 200, resp.content
        project = Project.objects.get(id=project.id)
        assert project.name == 'hello world'
        assert project.slug == 'foobar'


class ProjectDeleteTest(APITestCase):
    @mock.patch('sentry.api.endpoints.project_details.delete_project')
    def test_simple(self, mock_delete_project):
        project = self.create_project()

        self.login_as(user=self.user)

        url = reverse('sentry-api-0-project-details', kwargs={'project_id': project.id})

        with self.settings(SENTRY_PROJECT=0):
            response = self.client.delete(url)

        assert response.status_code == 204

        mock_delete_project.delay.assert_called_once_with(
            object_id=project.id)

        assert Project.objects.get(id=project.id).status == ProjectStatus.PENDING_DELETION

    @mock.patch('sentry.api.endpoints.project_details.delete_project')
    def test_internal_project(self, mock_delete_project):
        project = self.create_project()

        self.login_as(user=self.user)

        url = reverse('sentry-api-0-project-details', kwargs={'project_id': project.id})

        with self.settings(SENTRY_PROJECT=project.id):
            response = self.client.delete(url)

        assert not mock_delete_project.delay.mock_calls

        assert response.status_code == 403
