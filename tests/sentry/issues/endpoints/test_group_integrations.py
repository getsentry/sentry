from sentry.testutils.cases import APITestCase
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


class GroupIntegrationsTest(APITestCase):
    def test_simple_get(self) -> None:
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
        path = f"/api/0/organizations/{org.slug}/issues/{group.id}/integrations/"

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
                "outOfDate": None,
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

    def test_get_linked_github_issue_without_domain_name(self) -> None:
        self.login_as(user=self.user)
        group = self.create_group()
        integration = self.create_integration(
            organization=self.organization,
            external_id="123",
            provider="github",
            name="example-org",
            metadata={},
        )
        self.create_integration_external_issue(
            group=group,
            integration=integration,
            key="example-org/example-repo#321",
            title="Example issue",
        )
        path = f"/api/0/organizations/{self.organization.slug}/issues/{group.id}/integrations/"

        with self.feature("organizations:integrations-issue-basic"):
            response = self.client.get(path)

        assert response.status_code == 200
        assert (
            response.data[0]["externalIssues"][0]["url"]
            == "https://github.com/example-org/example-repo/issues/321"
        )

    def test_feature_disabled(self) -> None:
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

        path = f"/api/0/organizations/{org.slug}/issues/{group.id}/integrations/"

        with self.feature(
            {
                "organizations:integrations-issue-basic": False,
                "organizations:integrations-issue-sync": False,
            }
        ):
            response = self.client.get(path)
        assert response.data == []
