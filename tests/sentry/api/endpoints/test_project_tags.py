from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import TagKey
from sentry.testutils import APITestCase


class ProjectTagsTest(APITestCase):
    def test_simple(self):
        project = self.create_project()

        for key in ('foo', 'bar'):
            TagKey.objects.create(
                project=project,
                key=key,
            )

        self.login_as(user=self.user)

        url = reverse('sentry-api-0-project-tags', kwargs={
            'organization_slug': project.organization.slug,
            'project_slug': project.slug,
        })
        response = self.client.get(url, format='json')
        assert response.status_code == 200, response.content
        assert len(response.data) == 2
