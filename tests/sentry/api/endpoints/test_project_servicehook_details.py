from __future__ import absolute_import

from sentry.models import ServiceHook
from sentry.testutils import APITestCase


class ProjectServiceHookDetailsTest(APITestCase):
    def test_simple(self):
        project = self.create_project()
        hook = ServiceHook.objects.get_or_create(
            project_id=project.id, actor_id=self.user.id, url="http://example.com"
        )[0]
        self.login_as(user=self.user)
        path = u"/api/0/projects/{}/{}/hooks/{}/".format(
            project.organization.slug, project.slug, hook.guid
        )
        response = self.client.get(path)
        assert response.status_code == 200
        assert response.data["id"] == hook.guid


class UpdateProjectServiceHookTest(APITestCase):
    def setUp(self):
        super(UpdateProjectServiceHookTest, self).setUp()
        self.project = self.create_project()
        self.login_as(user=self.user)
        self.hook = ServiceHook.objects.get_or_create(
            project_id=self.project.id, actor_id=self.user.id, url="http://example.com"
        )[0]
        self.path = u"/api/0/projects/{}/{}/hooks/{}/".format(
            self.project.organization.slug, self.project.slug, self.hook.guid
        )

    def test_simple(self):
        resp = self.client.put(
            self.path,
            data={"url": "http://example.com/foo", "events": ["event.alert", "event.created"]},
        )
        assert resp.status_code == 200, resp.content
        hook = ServiceHook.objects.get(id=self.hook.id)
        assert hook.url == "http://example.com/foo"
        assert hook.events == ["event.alert", "event.created"]


class DeleteProjectServiceHookTest(APITestCase):
    def setUp(self):
        super(DeleteProjectServiceHookTest, self).setUp()
        self.project = self.create_project()
        self.login_as(user=self.user)
        self.hook = ServiceHook.objects.get_or_create(
            project_id=self.project.id, actor_id=self.user.id, url="http://example.com"
        )[0]
        self.path = u"/api/0/projects/{}/{}/hooks/{}/".format(
            self.project.organization.slug, self.project.slug, self.hook.guid
        )

    def test_simple(self):
        resp = self.client.delete(self.path)
        assert resp.status_code == 204, resp.content

        assert not ServiceHook.objects.filter(id=self.hook.id).exists()
