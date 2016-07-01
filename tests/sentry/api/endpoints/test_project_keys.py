from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import ProjectKey
from sentry.testutils import APITestCase


class ListProjectKeysTest(APITestCase):
    def test_simple(self):
        project = self.create_project()
        key = ProjectKey.objects.get_or_create(project=project)[0]
        self.login_as(user=self.user)
        url = reverse('sentry-api-0-project-keys', kwargs={
            'organization_slug': project.organization.slug,
            'project_slug': project.slug,
        })
        response = self.client.get(url)
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]['public'] == key.public_key


class CreateProjectKeyTest(APITestCase):
    def test_simple(self):
        project = self.create_project()
        self.login_as(user=self.user)
        url = reverse('sentry-api-0-project-keys', kwargs={
            'organization_slug': project.organization.slug,
            'project_slug': project.slug,
        })
        resp = self.client.post(url, data={
            'name': 'hello world',
        })
        assert resp.status_code == 201, resp.content
        key = ProjectKey.objects.get(public_key=resp.data['public'])
        assert key.label == 'hello world'

    def test_minimal_args(self):
        project = self.create_project()
        self.login_as(user=self.user)
        url = reverse('sentry-api-0-project-keys', kwargs={
            'organization_slug': project.organization.slug,
            'project_slug': project.slug,
        })
        resp = self.client.post(url)
        assert resp.status_code == 201, resp.content
        key = ProjectKey.objects.get(public_key=resp.data['public'])
        assert key.label

    def test_keys(self):
        project = self.create_project()
        self.login_as(user=self.user)
        url = reverse('sentry-api-0-project-keys', kwargs={
            'organization_slug': project.organization.slug,
            'project_slug': project.slug,
        })
        resp = self.client.post(url, data={
            'public': 'a' * 32,
            'secret': 'b' * 32,
        })
        assert resp.status_code == 201, resp.content
        key = ProjectKey.objects.get(public_key=resp.data['public'])
        assert key.public_key == resp.data['public'] == 'a' * 32
        assert key.secret_key == resp.data['secret'] == 'b' * 32
