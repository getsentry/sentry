from sentry.models.servicehook import ServiceHook
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class ProjectServiceHookDetailsTest(APITestCase):
    def test_simple(self):
        project = self.create_project()
        hook = ServiceHook.objects.get_or_create(
            project_id=project.id, actor_id=self.user.id, url="http://example.com"
        )[0]
        self.login_as(user=self.user)
        path = f"/api/0/projects/{project.organization.slug}/{project.slug}/hooks/{hook.guid}/"
        response = self.client.get(path)
        assert response.status_code == 200
        assert response.data["id"] == hook.guid


@region_silo_test
class UpdateProjectServiceHookTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.project = self.create_project()
        self.login_as(user=self.user)
        self.hook = ServiceHook.objects.get_or_create(
            project_id=self.project.id, actor_id=self.user.id, url="http://example.com"
        )[0]
        self.path = f"/api/0/projects/{self.project.organization.slug}/{self.project.slug}/hooks/{self.hook.guid}/"

    def test_simple(self):
        resp = self.client.put(
            self.path,
            data={"url": "http://example.com/foo", "events": ["event.alert", "event.created"]},
        )
        assert resp.status_code == 200, resp.content
        hook = ServiceHook.objects.get(id=self.hook.id)
        assert hook.url == "http://example.com/foo"
        assert hook.events == ["event.alert", "event.created"]


@region_silo_test
class DeleteProjectServiceHookTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.project = self.create_project()
        self.login_as(user=self.user)
        self.hook = ServiceHook.objects.get_or_create(
            project_id=self.project.id, actor_id=self.user.id, url="http://example.com"
        )[0]
        self.path = f"/api/0/projects/{self.project.organization.slug}/{self.project.slug}/hooks/{self.hook.guid}/"

    def test_simple(self):
        resp = self.client.delete(self.path)
        assert resp.status_code == 204, resp.content

        assert not ServiceHook.objects.filter(id=self.hook.id).exists()
