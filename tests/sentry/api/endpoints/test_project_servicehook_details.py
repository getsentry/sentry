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
        assert "secret" not in response.data

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
        assert "secret" not in response.data

    def test_read_only_token_cannot_read_secret(self) -> None:
        token = self.create_user_auth_token(user=self.user, scope_list=["project:read"])
        response = self.client.get(self.path, HTTP_AUTHORIZATION=f"Bearer {token.token}")
        assert response.status_code == 200
        assert response.data["id"] == self.hook.guid
        assert "secret" not in response.data

    def test_hook_is_scoped_to_project(self) -> None:
        other_project = self.create_project(organization=self.organization, teams=[self.team])
        self.login_as(user=self.user)
        response = self.client.get(
            f"/api/0/projects/{self.organization.slug}/{other_project.slug}/hooks/{self.hook.guid}/"
        )
        assert response.status_code == 404

    def test_nonmember_cannot_read_hook(self) -> None:
        self.login_as(user=self.create_user())
        response = self.client.get(self.path)
        assert response.status_code == 403

    def test_anonymous_cannot_read_hook(self) -> None:
        response = self.client.get(self.path)
        assert response.status_code == 401


class UpdateProjectServiceHookTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.project = self.create_project(organization=self.organization, teams=[self.team])
        self.hook = self.create_service_hook(project=self.project, actor=self.user)
        self.path = f"/api/0/projects/{self.project.organization.slug}/{self.project.slug}/hooks/{self.hook.guid}/"

    def test_simple(self) -> None:
        self.login_as(user=self.user)
        resp = self.client.put(
            self.path,
            data={"url": "http://example.com/foo", "events": ["event.alert", "event.created"]},
        )
        assert resp.status_code == 200, resp.content
        assert "secret" not in resp.data
        hook = ServiceHook.objects.get(id=self.hook.id)
        assert hook.url == "http://example.com/foo"
        assert hook.events == ["event.alert", "event.created"]
        assert hook.secret == self.hook.secret

    def test_member_cannot_update_hook(self) -> None:
        member = self.create_user()
        self.create_member(
            user=member, organization=self.organization, teams=[self.team], role="member"
        )
        self.login_as(user=member)
        response = self.client.put(self.path, data={"url": "https://example.com/updated"})
        assert response.status_code == 403

    def test_read_only_token_cannot_update_hook(self) -> None:
        token = self.create_user_auth_token(user=self.user, scope_list=["project:read"])
        response = self.client.put(
            self.path,
            data={"url": "https://example.com/updated"},
            HTTP_AUTHORIZATION=f"Bearer {token.token}",
        )
        assert response.status_code == 403


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
