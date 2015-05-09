from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import ProjectKey
from sentry.testutils import APITestCase


class UpdateProjectKeyTest(APITestCase):
    def test_simple(self):
        project = self.create_project()
        key = ProjectKey.objects.get_or_create(project=project)[0]
        self.login_as(user=self.user)
        url = reverse('sentry-api-0-project-key-details', kwargs={
            'organization_slug': project.organization.slug,
            'project_slug': project.slug,
            'key_id': key.public_key,
        })
        response = self.client.put(url, {'name': 'hello world'})
        assert response.status_code == 200
        key = ProjectKey.objects.get(id=key.id)
        assert key.label == 'hello world'


class DeleteProjectKeTest(APITestCase):
    def test_simple(self):
        project = self.create_project()
        self.login_as(user=self.user)
        key = ProjectKey.objects.get_or_create(project=project)[0]
        url = reverse('sentry-api-0-project-key-details', kwargs={
            'organization_slug': project.organization.slug,
            'project_slug': project.slug,
            'key_id': key.public_key,
        })
        resp = self.client.delete(url)
        assert resp.status_code == 204, resp.content
        assert not ProjectKey.objects.filter(id=key.id).exists()
