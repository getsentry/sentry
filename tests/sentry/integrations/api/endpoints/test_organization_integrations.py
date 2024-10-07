from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class OrganizationIntegrationsListTest(APITestCase):
    endpoint = "sentry-api-0-organization-integrations"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.integration = self.create_integration(
            organization=self.organization,
            provider="example",
            name="Example",
            external_id="example:1",
        )
        self.msteams_integration = self.create_integration(
            organization=self.organization,
            provider="msteams",
            name="MS Teams",
            external_id="msteams:1",
        )
        self.opsgenie = self.create_integration(
            organization=self.organization,
            provider="opsgenie",
            name="Opsgenie",
            external_id="opsgenie:1",
        )
        self.slack_integration = self.create_integration(
            organization=self.organization,
            provider="slack",
            name="Slack",
            external_id="slack:1",
        )

    def test_simple(self):
        response = self.get_success_response(self.organization.slug)

        assert len(response.data) == 4
        assert response.data[0]["id"] == str(self.integration.id)
        assert "configOrganization" in response.data[0]

    def test_no_config(self):
        response = self.get_success_response(self.organization.slug, qs_params={"includeConfig": 0})

        assert "configOrganization" not in response.data[0]

    def test_feature_filters(self):
        response = self.get_success_response(
            self.organization.slug, qs_params={"features": "issue_basic"}
        )
        assert response.data[0]["id"] == str(self.integration.id)
        response = self.get_success_response(
            self.organization.slug, qs_params={"features": "codeowners"}
        )
        assert response.data == []

    def test_provider_key(self):
        response = self.get_success_response(
            self.organization.slug, qs_params={"providerKey": "example"}
        )
        assert response.data[0]["id"] == str(self.integration.id)
        response = self.get_success_response(
            self.organization.slug, qs_params={"provider_key": "example"}
        )
        assert response.data[0]["id"] == str(self.integration.id)
        response = self.get_success_response(
            self.organization.slug, qs_params={"provider_key": "vercel"}
        )
        assert response.data == []

    def test_integration_type(self):
        response = self.get_success_response(
            self.organization.slug, qs_params={"integrationType": "messaging"}
        )
        assert len(response.data) == 2
        assert response.data[0]["id"] == str(self.msteams_integration.id)
        assert response.data[1]["id"] == str(self.slack_integration.id)
        response = self.get_success_response(
            self.organization.slug, qs_params={"integrationType": "on_call_scheduling"}
        )
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(self.opsgenie.id)
        response = self.get_error_response(
            self.organization.slug, qs_params={"integrationType": "third_party"}
        )
        assert response.data == {"detail": "Invalid integration type"}
        assert response.status_code == 400

    def test_provider_key_and_integration_type(self):
        response = self.get_success_response(
            self.organization.slug,
            qs_params={"providerKey": "slack", "integrationType": "messaging"},
        )
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(self.slack_integration.id)
        response = self.get_success_response(
            self.organization.slug,
            qs_params={"providerKey": "vercel", "integrationType": "messaging"},
        )
        assert response.data == []
        response = self.get_error_response(
            self.organization.slug,
            qs_params={"providerKey": "slack", "integrationType": "third_party"},
        )
        assert response.data == {"detail": "Invalid integration type"}
        assert response.status_code == 400
