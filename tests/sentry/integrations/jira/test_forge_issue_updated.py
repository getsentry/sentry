from __future__ import annotations

from collections.abc import Mapping
from dataclasses import replace
from typing import Any
from unittest.mock import MagicMock, patch

from django.test import override_settings
from django.urls import reverse

from sentry.integrations.jira.forge.invocation_token import ForgeInvocation
from sentry.integrations.services.integration.serial import serialize_integration
from sentry.integrations.utils.external_issue_key import PROVIDER_ISSUE_ID_KEY
from sentry.shared_integrations.exceptions import ApiError
from sentry.silo.util import WEBHOOK_DELIVERY_SIGNATURE_HEADER, encode_webhook_delivery_signature
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import cell_silo_test, no_silo_test
from sentry.utils import json, jwt

CLOUD_ID = "11111111-2222-3333-4444-555555555555"
INSTALLATION_ID = "ari:cloud:ecosystem::installation/test"
MODULE = "sentry.integrations.jira.webhooks.forge_issue_updated"

# The shape Forge sends for `avi:jira:updated:issue` when an issue moves projects.
MOVED_EVENT = {
    "eventType": "avi:jira:updated:issue",
    "issue": {"id": "101", "key": "PLATFORM-45", "fields": {}},
    "changelog": {
        "id": "10026",
        "items": [
            {"field": "project", "fieldtype": "jira", "fieldId": "project"},
            {
                "field": "Key",
                "fieldtype": "jira",
                "fromString": "APP-123",
                "toString": "PLATFORM-45",
            },
        ],
    },
}


class ForgeIssueUpdatedTestMixin(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.url = reverse("sentry-extensions-jira-forge-issue-updated")
        integration, _ = self.create_provider_integration_for(
            organization=self.organization,
            user=self.user,
            provider="jira",
            external_id=CLOUD_ID,
            metadata={
                "base_url": "https://example.atlassian.net",
                "forge": {"installation_id": INSTALLATION_ID},
            },
        )
        self.rpc_integration = serialize_integration(integration)
        # Expired by the time it's delivered, which is fine: control already verified it.
        token = jwt.encode(
            {
                "app": {
                    "apiBaseUrl": f"https://api.atlassian.com/ex/jira/{CLOUD_ID}",
                    "installationId": INSTALLATION_ID,
                },
                "exp": 1,
            },
            "unused",
        )
        self.authorization = f"Bearer {token}"

    def deliver(self, event: Mapping[str, Any], signed: bool = True) -> int:
        body = json.dumps(event).encode()
        headers = {"Authorization": self.authorization}
        if signed:
            signature = encode_webhook_delivery_signature(self.url, self.authorization, body)
            assert signature
            headers[WEBHOOK_DELIVERY_SIGNATURE_HEADER] = signature
        response = self.client.post(
            self.url, data=body, content_type="application/json", headers=headers
        )
        return response.status_code


@cell_silo_test
@override_settings(SENTRY_SUBNET_SECRET="secret")
class JiraForgeIssueUpdatedWebhookTest(ForgeIssueUpdatedTestMixin):
    def test_rejects_unsigned_delivery(self) -> None:
        assert self.deliver(MOVED_EVENT, signed=False) == 401

    def test_applies_issue_move(self) -> None:
        external_issue = self.create_integration_external_issue(
            group=self.create_group(), integration=self.rpc_integration, key="APP-123"
        )

        assert self.deliver(MOVED_EVENT) == 202

        external_issue.refresh_from_db()
        assert external_issue.key == "PLATFORM-45"
        assert external_issue.metadata[PROVIDER_ISSUE_ID_KEY] == "101"

    @patch(f"{MODULE}.handle_assignee_change")
    @patch(f"{MODULE}.handle_status_change")
    def test_retries_only_temporary_failures(
        self, mock_status: MagicMock, mock_assignee: MagicMock
    ) -> None:
        mock_status.__name__ = "handle_status_change"
        mock_assignee.__name__ = "handle_assignee_change"

        # A permanent failure skips that change and still applies the rest.
        mock_status.side_effect = ApiError("gone", code=404)
        assert self.deliver(MOVED_EVENT) == 202
        assert mock_assignee.call_count == 1

        mock_status.side_effect = ApiError("unavailable", code=502)
        assert self.deliver(MOVED_EVENT) == 503
        assert mock_assignee.call_count == 1


@no_silo_test
@patch("sentry.integrations.jira.forge.invocation_token.verify_forge_invocation_token")
class JiraForgeIssueUpdatedMonolithTest(ForgeIssueUpdatedTestMixin):
    def test_verifies_forge_token_directly(self, mock_verify: MagicMock) -> None:
        external_issue = self.create_integration_external_issue(
            group=self.create_group(), integration=self.rpc_integration, key="APP-123"
        )
        invocation = ForgeInvocation(
            app_id="ari:cloud:ecosystem::app/test",
            installation_id=INSTALLATION_ID,
            api_base_url=f"https://api.atlassian.com/ex/jira/{CLOUD_ID}",
            cloud_id=CLOUD_ID,
            environment_type="DEVELOPMENT",
            module_key="issue-panel",
            principal="account-id",
        )
        mock_verify.return_value = invocation
        assert self.deliver(MOVED_EVENT, signed=False) == 403

        mock_verify.return_value = replace(invocation, module_key="issue-updated", principal=None)
        assert self.deliver(MOVED_EVENT, signed=False) == 202
        external_issue.refresh_from_db()
        assert external_issue.key == "PLATFORM-45"
