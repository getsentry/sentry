from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import Environment
from sentry.testutils import APITestCase


class OrganizationEnvironmentsTest(APITestCase):
    def test_simple(self):
        project = self.create_project()

        for name in 'production', 'staging':
            Environment.objects.create(
                organization_id=project.organization_id,
                name=name,
            )

        self.login_as(user=self.user)

        url = reverse(
            'sentry-api-0-organization-environments',
            kwargs={
                'organization_slug': project.organization.slug,
            }
        )
        response = self.client.get(url, format='json')
        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert response.data[0]['name'] == 'production'
        assert response.data[1]['name'] == 'staging'
