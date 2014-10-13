from __future__ import absolute_import

from django.core.urlresolvers import reverse
from mock import patch

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
    @patch('sentry.api.endpoints.project_details.delete_project')
    def test_simple(self, delete_project):
        project = self.create_project()

        self.login_as(user=self.user)

        url = reverse('sentry-api-0-project-details', kwargs={'project_id': project.id})

        with self.settings(SENTRY_PROJECT=0):
            response = self.client.delete(url)

        assert response.status_code == 204

        project = Project.objects.get(id=project.id)

        assert project.status == ProjectStatus.PENDING_DELETION

        assert response.status_code == 204
        delete_project.delay.assert_called_once_with(
            object_id=project.id,
            countdown=60 * 5,
        )

    def test_internal_project(self):
        project = self.create_project()

        self.login_as(user=self.user)

        url = reverse('sentry-api-0-project-details', kwargs={'project_id': project.id})

        with self.settings(SENTRY_PROJECT=project.id):
            response = self.client.delete(url)

        assert response.status_code == 403
