from sentry.models.servicehook import ServiceHook, ServiceHookProject
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class ListProjectServiceHooksTest(APITestCase):
    def test_simple(self):
        project = self.create_project()
        hook = ServiceHook.objects.get_or_create(
            project_id=project.id, actor_id=self.user.id, url="http://example.com"
        )[0]
        self.login_as(user=self.user)
        url = f"/api/0/projects/{project.organization.slug}/{project.slug}/hooks/"
        with self.feature("projects:servicehooks"):
            response = self.client.get(url)
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["id"] == hook.guid


@region_silo_test
class CreateProjectServiceHookTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.project = self.create_project()
        self.login_as(user=self.user)
        self.path = f"/api/0/projects/{self.project.organization.slug}/{self.project.slug}/hooks/"

    def test_simple(self):
        with self.feature("projects:servicehooks"):
            resp = self.client.post(
                self.path,
                data={"url": "http://example.com", "events": ["event.alert", "event.created"]},
            )
        assert resp.status_code == 201, resp.content
        hook = ServiceHook.objects.get(guid=resp.data["id"])
        assert hook.url == "http://example.com"
        assert hook.project_id == self.project.id
        assert hook.actor_id == self.user.id
        assert sorted(hook.events) == ["event.alert", "event.created"]
        assert hook.version == 0

        hook_project = ServiceHookProject.objects.get(project_id=self.project.id)
        assert hook_project.service_hook_id == hook.id
