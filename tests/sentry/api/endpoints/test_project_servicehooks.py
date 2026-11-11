import hmac
from hashlib import sha256

from sentry.api.serializers import serialize
from sentry.constants import ObjectStatus
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

    def test_read_only_token_cannot_read_secret(self) -> None:
        token = self.create_user_auth_token(user=self.user, scope_list=["project:read"])
        with self.feature("projects:servicehooks"):
            response = self.client.get(self.path, HTTP_AUTHORIZATION=f"Bearer {token.token}")
        assert response.status_code == 200
        assert len(response.data) == 1
        assert "secret" not in response.data[0]

    def test_disabled_hook_omits_secret(self) -> None:
        self.hook.update(status=ObjectStatus.DISABLED)
        self.login_as(user=self.user)
        with self.feature("projects:servicehooks"):
            response = self.client.get(self.path, data={"status": "disabled"})
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["status"] == "disabled"
        assert "secret" not in response.data[0]

    def test_default_serializer_omits_secret(self) -> None:
        data = serialize(self.hook)
        assert data["id"] == self.hook.guid
        assert "secret" not in data


class CreateProjectServiceHookTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.project = self.create_project(organization=self.organization, teams=[self.team])
        self.path = f"/api/0/projects/{self.project.organization.slug}/{self.project.slug}/hooks/"

    def test_simple(self) -> None:
        self.login_as(user=self.user)
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
        body = '{"event": "synthetic"}'
        signature = hmac.new(resp.data["secret"].encode(), body.encode(), sha256).hexdigest()
        assert signature == hook.build_signature(body)

        with self.feature("projects:servicehooks"):
            listing = self.client.get(self.path)
        detail = self.client.get(f"{self.path}{hook.guid}/")
        assert listing.status_code == detail.status_code == 200
        assert "secret" not in listing.data[0]
        assert "secret" not in detail.data

        hook_project = ServiceHookProject.objects.get(project_id=self.project.id)
        assert hook_project.service_hook_id == hook.id

    def test_member_cannot_create_hook(self) -> None:
        member = self.create_user()
        self.create_member(
            user=member, organization=self.organization, teams=[self.team], role="member"
        )
        self.login_as(user=member)
        with self.feature("projects:servicehooks"):
            response = self.client.post(self.path, data={"url": "https://example.com/hook"})
        assert response.status_code == 403
        assert not ServiceHook.objects.filter(project_id=self.project.id).exists()

    def test_read_only_token_cannot_create_hook(self) -> None:
        token = self.create_user_auth_token(user=self.user, scope_list=["project:read"])
        with self.feature("projects:servicehooks"):
            response = self.client.post(
                self.path,
                data={"url": "https://example.com/hook"},
                HTTP_AUTHORIZATION=f"Bearer {token.token}",
            )
        assert response.status_code == 403
        assert not ServiceHook.objects.filter(project_id=self.project.id).exists()
