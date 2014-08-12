from django.core.urlresolvers import reverse
from sentry.models import AccessGroup
from sentry.testutils import APITestCase


class ProjectMemberIndexTest(APITestCase):
    def test_simple(self):
        user_1 = self.create_user('foo@localhost', username='foo')
        user_2 = self.create_user('bar@localhost', username='bar')
        user_3 = self.create_user('baz@localhost', username='baz')
        team = self.create_team(slug='baz', owner=user_1)
        project_1 = self.create_project(team=team, slug='foo')
        project_2 = self.create_project(team=team, slug='bar')
        ag = AccessGroup.objects.create(team=team, name='foo')
        ag.projects.add(project_1)
        ag.members.add(user_2)

        self.login_as(user=user_1)

        url = reverse('sentry-api-0-project-member-index', kwargs={
            'project_id': project_1.id,
        })
        response = self.client.get(url)
        assert response.status_code == 200
        assert len(response.data) == 2
        assert response.data[0]['email'] == 'bar@localhost'
        assert response.data[1]['email'] == 'foo@localhost'
