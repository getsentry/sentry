import responses
from django.urls import reverse

from sentry.models.apitoken import ApiToken
from sentry.models.organization import Organization
from sentry.sentry_apps.models.platformexternalissue import PlatformExternalIssue
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode_of, control_silo_test


@control_silo_test
class SentryAppInstallationExternalIssuesEndpointTest(APITestCase):
    def setUp(self) -> None:
        self.superuser = self.create_user(email="a@example.com", is_superuser=True)
        self.user = self.create_user(email="boop@example.com")
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)
        self.group = self.create_group(project=self.project)

        self.sentry_app = self.create_sentry_app(
            name="Testin", organization=self.org, webhook_url="https://example.com"
        )

        self.install = self.create_sentry_app_installation(
            organization=self.org, slug=self.sentry_app.slug, user=self.user
        )

        self.url = reverse(
            "sentry-api-0-sentry-app-installation-external-issue-actions", args=[self.install.uuid]
        )

    @responses.activate
    def test_creates_external_issue(self) -> None:
        self.login_as(user=self.user)
        data = {
            "groupId": self.group.id,
            "action": "create",
            "fields": {"title": "Hello"},
            "uri": "/create-issues",
        }
        responses.add(
            method=responses.POST,
            url="https://example.com/create-issues",
            json={
                "project": "ProjectName",
                "webUrl": "https://example.com/project/issue-id",
                "identifier": "issue-1",
            },
            status=200,
            content_type="application/json",
        )

        response = self.client.post(self.url, data=data, format="json")
        with assume_test_silo_mode_of(PlatformExternalIssue):
            external_issue = PlatformExternalIssue.objects.get()

        assert response.status_code == 200
        assert response.data == {
            "id": str(external_issue.id),
            "issueId": str(self.group.id),
            "serviceType": self.sentry_app.slug,
            "displayName": "ProjectName#issue-1",
            "webUrl": "https://example.com/project/issue-id",
        }

    @responses.activate
    def test_external_issue_doesnt_get_created(self) -> None:
        self.login_as(user=self.user)
        data = {
            "groupId": self.group.id,
            "action": "create",
            "fields": {"title": "Hello"},
            "uri": "/create-issues",
        }
        responses.add(
            method=responses.POST,
            url="https://example.com/create-issues",
            status=500,
            content_type="application/json",
        )

        response = self.client.post(self.url, data=data, format="json")
        assert response.status_code == 500
        assert (
            response.content
            == b'{"detail":"Issue occurred while trying to contact testin to link issue"}'
        )
        with assume_test_silo_mode_of(PlatformExternalIssue):
            assert not PlatformExternalIssue.objects.all()

    def test_rejects_uri_with_userinfo_injection(self) -> None:
        self.login_as(user=self.user)
        response = self.client.post(
            self.url,
            data={
                "groupId": self.group.id,
                "action": "create",
                "fields": {"title": "Hello"},
                "uri": "@attacker.example/path",
            },
            format="json",
        )
        assert response.status_code == 400
        assert "uri" in response.data

    def test_rejects_uri_with_protocol_relative_path(self) -> None:
        self.login_as(user=self.user)
        response = self.client.post(
            self.url,
            data={
                "groupId": self.group.id,
                "action": "create",
                "fields": {"title": "Hello"},
                "uri": "//attacker.example/path",
            },
            format="json",
        )
        assert response.status_code == 400
        assert "uri" in response.data

    def test_rejects_uri_without_leading_slash(self) -> None:
        self.login_as(user=self.user)
        response = self.client.post(
            self.url,
            data={
                "groupId": self.group.id,
                "action": "create",
                "fields": {"title": "Hello"},
                "uri": "https://attacker.example/path",
            },
            format="json",
        )
        assert response.status_code == 400
        assert "uri" in response.data

    def _set_up_token(self, scopes: list[str]) -> tuple[ApiToken, str]:
        scoped_app = self.create_sentry_app(
            name="Scoped", organization=self.org, webhook_url="https://example.com", scopes=scopes
        )
        scoped_install = self.create_sentry_app_installation(
            organization=self.org, slug=scoped_app.slug, user=self.user
        )
        token = self.create_internal_integration_token(install=scoped_install, user=self.user)
        url = reverse(
            "sentry-api-0-sentry-app-installation-external-issue-actions",
            args=[scoped_install.uuid],
        )
        return token, url

    def test_rejects_token_without_event_scope(self) -> None:
        token, url = self._set_up_token(["org:integrations"])
        response = self.client.post(
            url,
            data={
                "groupId": self.group.id,
                "action": "create",
                "fields": {"title": "Hello"},
                "uri": "/create-issues",
            },
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token.token}",
        )
        assert response.status_code == 403
        with assume_test_silo_mode_of(PlatformExternalIssue):
            assert not PlatformExternalIssue.objects.filter(group_id=self.group.id).exists()

    def test_rejects_token_with_only_read_scope(self) -> None:
        token, url = self._set_up_token(["event:read"])
        response = self.client.post(
            url,
            data={
                "groupId": self.group.id,
                "action": "create",
                "fields": {"title": "Hello"},
                "uri": "/create-issues",
            },
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token.token}",
        )
        assert response.status_code == 403
        with assume_test_silo_mode_of(PlatformExternalIssue):
            assert not PlatformExternalIssue.objects.filter(group_id=self.group.id).exists()

    @responses.activate
    def test_creates_external_issue_with_event_scope(self) -> None:
        token, url = self._set_up_token(["event:write"])
        responses.add(
            method=responses.POST,
            url="https://example.com/create-issues",
            json={
                "project": "ProjectName",
                "webUrl": "https://example.com/project/issue-id",
                "identifier": "issue-1",
            },
            status=200,
            content_type="application/json",
        )

        response = self.client.post(
            url,
            data={
                "groupId": self.group.id,
                "action": "create",
                "fields": {"title": "Hello"},
                "uri": "/create-issues",
            },
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token.token}",
        )

        assert response.status_code == 200
        with assume_test_silo_mode_of(PlatformExternalIssue):
            assert PlatformExternalIssue.objects.filter(group_id=self.group.id).exists()

    def test_rejects_group_from_inaccessible_project(self) -> None:
        with assume_test_silo_mode_of(Organization):
            self.org.flags.allow_joinleave = False
            self.org.save()

        user_team = self.create_team(organization=self.org, name="user-team")
        other_team = self.create_team(organization=self.org, name="other-team")
        self.create_project(organization=self.org, teams=[user_team], name="user-proj")
        other_project = self.create_project(
            organization=self.org, teams=[other_team], name="other-proj"
        )
        other_group = self.create_group(project=other_project)

        limited_user = self.create_user()
        self.create_member(
            organization=self.org,
            user=limited_user,
            role="member",
            teams=[user_team],
            teamRole="admin",
        )

        self.login_as(user=limited_user)
        response = self.client.post(
            self.url,
            data={
                "groupId": other_group.id,
                "action": "create",
                "fields": {"title": "Hello"},
                "uri": "/create-issues",
            },
            format="json",
        )

        assert response.status_code == 403
        assert response.data["detail"] == "You do not have permission to link this issue."
        with assume_test_silo_mode_of(PlatformExternalIssue):
            assert not PlatformExternalIssue.objects.filter(group_id=other_group.id).exists()
