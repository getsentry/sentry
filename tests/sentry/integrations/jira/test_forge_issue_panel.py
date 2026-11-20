from __future__ import annotations

from unittest.mock import MagicMock, patch

from django.urls import reverse

from sentry.constants import ObjectStatus
from sentry.integrations.jira.forge.invocation_token import (
    ForgeInvocation,
    ForgeInvocationTokenError,
)
from sentry.integrations.models.integration import Integration
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode_of, control_silo_test

CLOUD_ID = "11111111-2222-3333-4444-555555555555"
INSTALLATION_ID = "ari:cloud:ecosystem::installation/test"


def _invocation(**overrides: str | None) -> ForgeInvocation:
    fields: dict[str, str | None] = {
        "app_id": "ari:cloud:ecosystem::app/test",
        "installation_id": INSTALLATION_ID,
        "api_base_url": f"https://api.atlassian.com/ex/jira/{CLOUD_ID}",
        "cloud_id": CLOUD_ID,
        "environment_type": "DEVELOPMENT",
        "module_key": "sentry-issue-panel",
        "principal": "viewer-account-id",
        "issue_key": "APP-1",
    }
    fields.update(overrides)
    return ForgeInvocation(**fields)  # type: ignore[arg-type]


@control_silo_test
@patch("sentry.integrations.jira.forge.invocation_token.verify_forge_invocation_token")
class JiraForgeIssuePanelWebhookTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.url = reverse("sentry-extensions-jira-forge-issue-panel")
        self.headers = {"Authorization": "Bearer fit"}
        self.integration = self.create_integration(
            organization=self.organization,
            provider="jira",
            external_id=CLOUD_ID,
            metadata={"forge": {"installation_id": INSTALLATION_ID}},
        )
        self.group = self.create_group(project=self.project, message="Linked error")
        self.create_integration_external_issue(
            group=self.group, integration=self.integration, key="APP-1"
        )
        other_group = self.create_group(project=self.project, message="Other error")
        self.create_integration_external_issue(
            group=other_group, integration=self.integration, key="APP-2"
        )

    def test_returns_issues_linked_to_the_viewed_issue(self, mock_verify: MagicMock) -> None:
        mock_verify.return_value = _invocation()

        response = self.client.post(self.url, headers=self.headers)

        assert response.status_code == 200
        assert [group["title"] for group in response.data["groups"]] == [self.group.title]
        assert response.data["groups"][0]["url"] == self.group.get_absolute_url(
            params={"referrer": "sentry-issues-glance"}
        )

    def test_rejects_other_callers(self, mock_verify: MagicMock) -> None:
        mock_verify.side_effect = ForgeInvocationTokenError("bad")
        assert self.client.post(self.url, headers=self.headers).status_code == 401
        mock_verify.side_effect = None

        # Another module of the app, an invocation with no user, or no issue in context.
        for invocation in (
            _invocation(module_key="sentry-configure"),
            _invocation(principal=None),
            _invocation(issue_key=None),
        ):
            mock_verify.return_value = invocation
            assert self.client.post(self.url, headers=self.headers).status_code == 403

        # Another installation on the same site, or a disabled integration.
        mock_verify.return_value = _invocation(
            installation_id="ari:cloud:ecosystem::installation/other"
        )
        assert self.client.post(self.url, headers=self.headers).status_code == 404
        with assume_test_silo_mode_of(Integration):
            self.integration.update(status=ObjectStatus.DISABLED)
        mock_verify.return_value = _invocation()
        assert self.client.post(self.url, headers=self.headers).status_code == 404
