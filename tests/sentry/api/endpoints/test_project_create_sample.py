from __future__ import absolute_import

from django.core.urlresolvers import reverse
import json

from sentry.testutils import APITestCase


class ProjectCreateSampleTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)
        team = self.create_team()
        project = self.create_project(team=team, name='foo')

        url = reverse(
            'sentry-api-0-project-create-sample',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
            }
        )
        response = self.client.post(url, format='json')

        assert response.status_code == 200, response.content
        assert 'groupID' in json.loads(response.content)

    def test_project_platform(self):
        self.login_as(user=self.user)
        team = self.create_team()
        project = self.create_project(team=team, name='foo', platform='javascript-react')

        url = reverse(
            'sentry-api-0-project-create-sample',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
            }
        )
        response = self.client.post(url, format='json')

        assert response.status_code == 200, response.content
        assert 'groupID' in json.loads(response.content)
