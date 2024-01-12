from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


@region_silo_test
class GroupIntegrationsTest(APITestCase):
    def test_simple_get(self):
        self.login_as(user=self.user)
        org = self.organization
        group = self.create_group()
        integration = self.create_integration(
            organization=org, external_id="example:1", provider="example", name="Example"
        )
        external_issue = self.create_integration_external_issue(
            group=group,
            integration=integration,
            key="APP-123",
            title="this is an example title",
            description="this is an example description",
        )
        path = f"/api/0/issues/{group.id}/integrations/"

        with self.feature("organizations:integrations-issue-basic"):
            response = self.client.get(path)
            provider = integration.get_provider()
            assert provider.metadata is not None

            assert response.data[0] == {
                "id": str(integration.id),
                "name": integration.name,
                "icon": integration.metadata.get("icon"),
                "domainName": integration.metadata.get("domain_name"),
                "accountType": integration.metadata.get("account_type"),
                "scopes": integration.metadata.get("scopes"),
                "status": integration.get_status_display(),
                "provider": {
                    "key": provider.key,
                    "slug": provider.key,
                    "name": provider.name,
                    "canAdd": provider.can_add,
                    "canDisable": provider.can_disable,
                    "features": sorted(f.value for f in provider.features),
                    "aspects": provider.metadata.aspects,
                },
                "externalIssues": [
                    {
                        "description": "this is an example description",
                        "id": str(external_issue.id),
                        "url": "https://example/issues/APP-123",
                        "key": "APP-123",
                        "title": "this is an example title",
                        "displayName": "display name: APP-123",
                    }
                ],
            }

    def test_feature_disabled(self):
        self.login_as(user=self.user)
        org = self.organization
        group = self.create_group()
        integration = self.create_integration(
            organization=org, external_id="example:1", provider="example", name="Example"
        )
        self.create_integration_external_issue(
            group=group,
            integration=integration,
            key="APP-123",
            title="this is an example title",
            description="this is an example description",
        )

        path = f"/api/0/issues/{group.id}/integrations/"

        with self.feature(
            {
                "organizations:integrations-issue-basic": False,
                "organizations:integrations-issue-sync": False,
            }
        ):
            response = self.client.get(path)
        assert response.data == []
