from sentry.sentry_apps.models.servicehook import ServiceHook
from sentry.testutils.cases import APITestCase


class ProjectServiceHookDetailsTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.hook = self.create_service_hook(project=self.project)
        self.path = (
            f"/api/0/projects/{self.organization.slug}/{self.project.slug}/hooks/{self.hook.guid}/"
        )

    def test_simple(self) -> None:
        self.login_as(user=self.user)
        response = self.client.get(self.path)
        assert response.status_code == 200
        assert response.data["id"] == self.hook.guid
        assert response.data["secret"] == ""

    def test_member_cannot_read_secret_with_feature_disabled(self) -> None:
        member = self.create_user()
        self.create_member(
            user=member, organization=self.organization, teams=[self.team], role="member"
        )
        self.login_as(user=member)
        with self.feature({"projects:servicehooks": False}):
            response = self.client.get(self.path)
        assert response.status_code == 200
        assert response.data["id"] == self.hook.guid
        assert response.data["secret"] == ""


class UpdateProjectServiceHookTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.project = self.create_project()
        self.login_as(user=self.user)
        self.hook = ServiceHook.objects.get_or_create(
            project_id=self.project.id, actor_id=self.user.id, url="http://example.com"
        )[0]
        self.path = f"/api/0/projects/{self.project.organization.slug}/{self.project.slug}/hooks/{self.hook.guid}/"

    def test_simple(self) -> None:
        resp = self.client.put(
            self.path,
            data={"url": "http://example.com/foo", "events": ["event.alert", "event.created"]},
        )
        assert resp.status_code == 200, resp.content
        assert resp.data["secret"] == ""
        hook = ServiceHook.objects.get(id=self.hook.id)
        assert hook.url == "http://example.com/foo"
        assert hook.events == ["event.alert", "event.created"]


class DeleteProjectServiceHookTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.project = self.create_project()
        self.login_as(user=self.user)
        self.hook = ServiceHook.objects.get_or_create(
            project_id=self.project.id, actor_id=self.user.id, url="http://example.com"
        )[0]
        self.path = f"/api/0/projects/{self.project.organization.slug}/{self.project.slug}/hooks/{self.hook.guid}/"

    def test_simple(self) -> None:
        resp = self.client.delete(self.path)
        assert resp.status_code == 204, resp.content

        assert not ServiceHook.objects.filter(id=self.hook.id).exists()
