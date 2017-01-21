from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import Environment
from sentry.testutils import APITestCase


class ProjectEnvironmentsTest(APITestCase):
    def test_simple(self):
        project = self.create_project()

        Environment.objects.create(
            project_id=project.id,
            name='production',
        )

        Environment.objects.create(
            project_id=project.id,
            name='staging',
        )

        self.login_as(user=self.user)

        url = reverse('sentry-api-0-project-environments', kwargs={
            'organization_slug': project.organization.slug,
            'project_slug': project.slug,
        })
        response = self.client.get(url, format='json')
        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert response.data[0]['name'] == 'production'
        assert response.data[1]['name'] == 'staging'
