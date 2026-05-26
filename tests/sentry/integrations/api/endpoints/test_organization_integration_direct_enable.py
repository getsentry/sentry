from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class OrganizationIntegrationDirectEnableTest(APITestCase):
    endpoint = "sentry-api-0-organization-integration-direct-enable"
    method = "post"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    def test_enables_github_copilot(self):
        with self.feature("organizations:integrations-github-copilot-agent"):
            response = self.get_success_response(self.organization.slug, "github_copilot")

        integration = Integration.objects.get(provider="github_copilot")
        assert OrganizationIntegration.objects.filter(
            organization_id=self.organization.id,
            integration_id=integration.id,
        ).exists()
        assert response.data["provider"]["key"] == "github_copilot"
        assert response.data["id"] == str(integration.id)
        assert response.data["organizationId"] == self.organization.id

    def test_returns_404_for_unknown_provider(self):
        self.get_error_response(self.organization.slug, "nonexistent_provider", status_code=404)

    def test_returns_400_for_provider_without_direct_enable(self):
        # cursor has no directEnable aspect
        self.get_error_response(self.organization.slug, "cursor", status_code=400)

    def test_prevents_duplicate_installation(self):
        with self.feature("organizations:integrations-github-copilot-agent"):
            self.get_success_response(self.organization.slug, "github_copilot")
            self.get_error_response(self.organization.slug, "github_copilot", status_code=400)

        assert Integration.objects.filter(provider="github_copilot").count() == 1

    def test_returns_404_when_feature_flag_disabled(self):
        self.get_error_response(self.organization.slug, "github_copilot", status_code=404)

    def test_requires_org_write_permission(self):
        member = self.create_user()
        self.create_member(organization=self.organization, user=member, role="member")
        self.login_as(member)

        self.get_error_response(self.organization.slug, "github_copilot", status_code=403)
