import time
from unittest.mock import MagicMock, patch
from uuid import uuid4

import responses

from sentry.constants import ObjectStatus
from sentry.integrations.jira.client import JiraCloudClient
from sentry.integrations.jira.tasks import find_stale_forge_tokens, sync_metadata
from sentry.integrations.models.integration import Integration
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class SyncMetadataTest(TestCase):
    @responses.activate
    def test_no_sync_with_no_org(self) -> None:
        integration = self.create_integration(
            organization=self.organization,
            provider="jira",
            external_id="abc123",
            metadata={
                "base_url": "https://acme.atlassian.net",
                "shared_secret": "super-sekret",
            },
        )
        org_integration = integration.organizationintegration_set.first()
        if org_integration:
            org_integration.delete()
        sync_metadata(integration.id)
        assert len(responses.calls) == 0

    @responses.activate
    def test_success(self) -> None:
        responses.add(
            responses.GET,
            "https://acme.atlassian.net/rest/api/2/serverInfo",
            json={
                "serverTitle": "Acme Jira",
            },
        )
        responses.add(
            responses.GET,
            "https://acme.atlassian.net/rest/api/2/project",
            json=[
                {"avatarUrls": {"48x48": "https://example.com/avatar.jpg"}},
            ],
        )
        integration = self.create_integration(
            organization=self.organization,
            provider="jira",
            external_id="abc123",
            metadata={
                "base_url": "https://acme.atlassian.net",
                "shared_secret": "super-sekret",
            },
        )
        sync_metadata(integration.id)

        integration.refresh_from_db()
        assert integration.name == "Acme Jira"
        assert integration.metadata["icon"] == "https://example.com/avatar.jpg"

    @responses.activate
    def test_keeps_metadata_written_during_sync(self) -> None:
        responses.add(
            responses.GET,
            "https://acme.atlassian.net/rest/api/2/serverInfo",
            json={"serverTitle": "Acme Jira"},
        )
        integration = self.create_integration(
            organization=self.organization,
            provider="jira",
            external_id="abc123",
            metadata={
                "base_url": "https://acme.atlassian.net",
                "shared_secret": "super-sekret",
            },
        )

        def write_concurrently(client: JiraCloudClient) -> list[dict[str, object]]:
            # Another writer stores a key between this task's read and its write.
            Integration.objects.filter(id=integration.id).update(
                metadata={**integration.metadata, "forge": {"system_token": "token"}}
            )
            return [{"avatarUrls": {"48x48": "https://example.com/avatar.jpg"}}]

        with patch.object(JiraCloudClient, "get_projects_list", write_concurrently):
            sync_metadata(integration.id)

        integration.refresh_from_db()
        assert integration.name == "Acme Jira"
        assert integration.metadata["icon"] == "https://example.com/avatar.jpg"
        assert integration.metadata["forge"] == {"system_token": "token"}


@control_silo_test
class FindStaleForgeTokensTest(TestCase):
    def jira(self, metadata: dict[str, object], **kwargs: int) -> Integration:
        return self.create_provider_integration(
            provider="jira", external_id=uuid4().hex, metadata=metadata, **kwargs
        )

    @patch("sentry.integrations.jira.tasks.metrics")
    def test_counts_tokens_expired_over_a_day_ago(self, mock_metrics: MagicMock) -> None:
        now = int(time.time())
        stale = {"system_token_expires_at": now - 25 * 3600}
        self.jira({"forge": stale})
        self.jira({"forge": stale, "shared_secret": "secret"})
        # Expired recently, refreshed, never on Forge, or already disabled.
        self.jira({"forge": {"system_token_expires_at": now - 3600}})
        self.jira({"forge": {"system_token_expires_at": now + 3600}})
        self.jira({"shared_secret": "secret"})
        self.jira({"forge": stale}, status=ObjectStatus.DISABLED)

        find_stale_forge_tokens()

        assert sorted(call.kwargs["tags"]["kind"] for call in mock_metrics.incr.call_args_list) == [
            "connect",
            "forge",
        ]
