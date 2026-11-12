from sentry.sentry_apps.models.servicehook import ServiceHook, ServiceHookProject
from sentry.testutils.cases import APITestCase


class ListProjectServiceHooksTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.hook = self.create_service_hook(project=self.project)
        self.path = f"/api/0/projects/{self.organization.slug}/{self.project.slug}/hooks/"

    def test_simple(self) -> None:
        self.login_as(user=self.user)
        with self.feature("projects:servicehooks"):
            response = self.client.get(self.path)
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["id"] == self.hook.guid
        assert "secret" not in response.data[0]

    def test_member_cannot_read_secret(self) -> None:
        member = self.create_user()
        self.create_member(
            user=member, organization=self.organization, teams=[self.team], role="member"
        )
        self.login_as(user=member)
        with self.feature("projects:servicehooks"):
            response = self.client.get(self.path)
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["id"] == self.hook.guid
        assert "secret" not in response.data[0]


class CreateProjectServiceHookTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.project = self.create_project()
        self.login_as(user=self.user)
        self.path = f"/api/0/projects/{self.project.organization.slug}/{self.project.slug}/hooks/"

    def test_simple(self) -> None:
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
        assert resp.data["secret"] == hook.secret

        hook_project = ServiceHookProject.objects.get(project_id=self.project.id)
        assert hook_project.service_hook_id == hook.id
