from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase


class ProjectRuleConfigurationTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        team = self.create_team()
        project1 = self.create_project(teams=[team], name='foo')
        self.create_project(teams=[team], name='bar')

        url = reverse(
            'sentry-api-0-project-rules-configuration',
            kwargs={
                'organization_slug': project1.organization.slug,
                'project_slug': project1.slug,
            }
        )
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data['actions']) == 3
        assert len(response.data['conditions']) == 8
