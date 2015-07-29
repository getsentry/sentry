from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase


class ProjectRuleDetailsTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        team = self.create_team()
        project1 = self.create_project(team=team, name='foo')
        project2 = self.create_project(team=team, name='bar')

        rule = project1.rule_set.all()[0]

        url = reverse('sentry-api-0-project-rule-details', kwargs={
            'organization_slug': project1.organization.slug,
            'project_slug': project1.slug,
            'rule_id': rule.id,
        })
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['id'] == str(rule.id)
