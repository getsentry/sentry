import responses

from sentry.tasks.integrations.sync_metadata import sync_metadata
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class SyncMetadataTest(TestCase):
    @responses.activate
    def test_no_sync_with_no_org(self):
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
    def test_success(self):
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
