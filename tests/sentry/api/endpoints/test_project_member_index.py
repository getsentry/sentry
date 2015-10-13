from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase


class ProjectMemberIndexTest(APITestCase):
    def test_simple(self):
        user_1 = self.create_user('foo@localhost', username='foo')
        user_2 = self.create_user('bar@localhost', username='bar')
        user_3 = self.create_user('baz@localhost', username='baz')
        org = self.create_organization(owner=user_1)
        team = self.create_team(organization=org, slug='baz')
        project_1 = self.create_project(team=team, slug='foo')
        self.create_project(team=team, slug='bar')
        self.create_member(organization=org, user=user_2, teams=[project_1.team])
        self.create_member(organization=org, user=user_3, teams=[project_1.team])

        self.login_as(user=user_2)

        url = reverse('sentry-api-0-project-member-index', kwargs={
            'organization_slug': project_1.organization.slug,
            'project_slug': project_1.slug,
        })
        response = self.client.get(url)
        assert response.status_code == 200
        assert len(response.data) == 2
        assert response.data[0]['email'] == user_2.email
        assert response.data[1]['email'] == user_3.email
