from __future__ import absolute_import

from sentry.models import ServiceHook
from sentry.testutils import APITestCase


class ListProjectServiceHooksTest(APITestCase):
    def test_simple(self):
        project = self.create_project()
        hook = ServiceHook.objects.get_or_create(
            project_id=project.id,
            actor_id=self.user.id,
            url='http://example.com',
        )[0]
        self.login_as(user=self.user)
        url = '/api/0/projects/{}/{}/hooks/'.format(
            project.organization.slug,
            project.slug,
        )
        response = self.client.get(url)
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]['id'] == hook.guid


class CreateProjectServiceHookTest(APITestCase):
    def setUp(self):
        super(CreateProjectServiceHookTest, self).setUp()
        self.project = self.create_project()
        self.login_as(user=self.user)
        self.path = '/api/0/projects/{}/{}/hooks/'.format(
            self.project.organization.slug,
            self.project.slug,
        )

    def test_simple(self):
        resp = self.client.post(
            self.path, data={
                'url': 'http://example.com',
                'events': ['event.alert', 'event.created'],
            }
        )
        assert resp.status_code == 201, resp.content
        hook = ServiceHook.objects.get(guid=resp.data['id'])
        assert hook.url == 'http://example.com'
        assert hook.project_id == self.project.id
        assert hook.actor_id == self.user.id
        assert hook.events == ['event.alert', 'event.created']
        assert hook.version == 0
