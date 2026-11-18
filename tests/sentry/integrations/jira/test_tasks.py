from unittest.mock import patch

import responses

from sentry.integrations.jira.client import JiraCloudClient
from sentry.integrations.jira.tasks import sync_metadata
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
