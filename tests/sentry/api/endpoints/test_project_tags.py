from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry import tagstore
from sentry.testutils import APITestCase


class ProjectTagsTest(APITestCase):
    def test_simple(self):
        project = self.create_project()

        for key in ('foo', 'bar', 'environment'):
            tagstore.create_tag_key(
                project_id=project.id,
                environment_id=None,
                key=key,
            )

        self.login_as(user=self.user)

        url = reverse(
            'sentry-api-0-project-tags',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
            }
        )
        response = self.client.get(url, format='json')
        assert response.status_code == 200, response.content
        data = {v['key']: v for v in response.data}
        assert len(data) == 3

        data['foo']['canDelete'] is True
        data['bar']['canDelete'] is True
        data['environment']['canDelete'] is False
