from unittest.mock import MagicMock, patch

import responses
from django.urls import reverse

from sentry.api.serializers import serialize
from sentry.models.apitoken import ApiToken
from sentry.models.organization import Organization
from sentry.sentry_apps.models.platformexternalissue import PlatformExternalIssue
from sentry.sentry_apps.tasks.sentry_apps import build_external_issue_webhook
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode, assume_test_silo_mode_of, control_silo_test


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
    @patch("sentry.sentry_apps.tasks.sentry_apps.build_external_issue_webhook.delay")
    def test_notifies_subscribed_sentry_apps_on_link(self, delay: MagicMock) -> None:
        self.login_as(user=self.user)
        subscriber = self.create_sentry_app(
            organization=self.org, events=["issue.external_issue_linked"]
        )
        subscriber_install = self.create_sentry_app_installation(
            organization=self.org, slug=subscriber.slug
        )
        responses.add(
            method=responses.POST,
            url="https://example.com/link-issues",
            json={
                "project": "ProjectName",
                "webUrl": "https://example.com/project/issue-id",
                "identifier": "issue-1",
            },
            status=200,
            content_type="application/json",
        )

        response = self.client.post(
            self.url,
            data={
                "groupId": self.group.id,
                "action": "link",
                "fields": {"title": "Hello"},
                "uri": "/link-issues",
            },
            format="json",
        )
        assert response.status_code == 200

        with assume_test_silo_mode_of(PlatformExternalIssue):
            external_issue = PlatformExternalIssue.objects.get()

        delay.assert_called_once_with(
            installation_id=subscriber_install.id,
            issue_id=self.group.id,
            type="issue.external_issue_linked",
            user_id=self.user.id,
            external_issue=serialize(external_issue),
            external_issue_kind="custom_integration",
            triggered_by=None,
        )

    @responses.activate
    @patch("sentry.sentry_apps.tasks.sentry_apps.build_external_issue_webhook.delay")
    def test_queued_webhook_preserves_a_replaced_external_issue(self, delay: MagicMock) -> None:
        self.login_as(user=self.user)
        subscriber = self.create_sentry_app(
            organization=self.org, events=["issue.external_issue_linked"]
        )
        self.create_sentry_app_installation(organization=self.org, slug=subscriber.slug)
        for identifier in ("issue-1", "issue-2"):
            responses.add(
                method=responses.POST,
                url="https://example.com/link-issues",
                json={
                    "project": "ProjectName",
                    "webUrl": f"https://example.com/project/{identifier}",
                    "identifier": identifier,
                },
                status=200,
                content_type="application/json",
            )

        request_data = {
            "groupId": self.group.id,
            "action": "link",
            "fields": {"title": "Hello"},
            "uri": "/link-issues",
        }
        for _ in range(2):
            response = self.client.post(self.url, data=request_data, format="json")
            assert response.status_code == 200

        with assume_test_silo_mode_of(PlatformExternalIssue):
            external_issue = PlatformExternalIssue.objects.get()
        assert external_issue.web_url == "https://example.com/project/issue-2"
        assert delay.call_count == 2

        first_webhook_kwargs = delay.call_args_list[0].kwargs
        with (
            assume_test_silo_mode(SiloMode.CELL),
            patch("sentry.sentry_apps.tasks.sentry_apps.send_webhooks") as send_webhooks,
        ):
            build_external_issue_webhook(**first_webhook_kwargs)

        send_webhooks.assert_called_once()
        assert send_webhooks.call_args.kwargs["data"]["external_issue"] == {
            "id": str(external_issue.id),
            "issueId": str(self.group.id),
            "serviceType": self.sentry_app.slug,
            "displayName": "ProjectName#issue-1",
            "webUrl": "https://example.com/project/issue-1",
        }

    @responses.activate
    def test_rejects_a_web_url_the_app_returns_with_a_bad_scheme(self) -> None:
        self.login_as(user=self.user)
        responses.add(
            method=responses.POST,
            url="https://example.com/create-issues",
            json={
                "project": "ProjectName",
                "webUrl": "javascript:alert(1)",
                "identifier": "issue-1",
            },
            status=200,
            content_type="application/json",
        )

        response = self.client.post(
            self.url,
            data={
                "groupId": self.group.id,
                "action": "create",
                "fields": {"title": "Hello"},
                "uri": "/create-issues",
            },
            format="json",
        )

        # Treated like any other malformed response from the app.
        assert response.status_code == 500
        with assume_test_silo_mode_of(PlatformExternalIssue):
            assert not PlatformExternalIssue.objects.exists()

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
