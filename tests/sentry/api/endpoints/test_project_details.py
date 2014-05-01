from django.core.urlresolvers import reverse
from sentry.models import Project
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
    def test_simple(self):
        project = self.create_project()

        self.login_as(user=self.user)

        url = reverse('sentry-api-0-project-details', kwargs={'project_id': project.id})

        with self.settings(SENTRY_PROJECT=0):
            response = self.client.delete(url)

        assert response.status_code == 204
        assert not Project.objects.filter(id=project.id).exists()

    def test_internal_project(self):
        project = self.create_project()

        self.login_as(user=self.user)

        url = reverse('sentry-api-0-project-details', kwargs={'project_id': project.id})

        with self.settings(SENTRY_PROJECT=project.id):
            response = self.client.delete(url)

        assert response.status_code == 403
