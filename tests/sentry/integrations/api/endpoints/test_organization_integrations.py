from unittest.mock import patch

from sentry.constants import ObjectStatus
from sentry.hybridcloud.rpc.service import RpcRemoteException
from sentry.integrations.api.endpoints.organization_integrations_index import (
    OrganizationIntegrationsEndpoint,
)
from sentry.organizations.services.organization import organization_service
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class OrganizationIntegrationsListTest(APITestCase):
    endpoint = "sentry-api-0-organization-integrations"

    def setUp(self) -> None:
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

    def test_simple(self) -> None:
        response = self.get_success_response(self.organization.slug)

        assert len(response.data) == 4
        assert response.data[0]["id"] == str(self.integration.id)
        assert "configOrganization" in response.data[0]

    def test_no_config(self) -> None:
        with patch.object(organization_service, "get", wraps=organization_service.get) as get_org:
            response = self.get_success_response(
                self.organization.slug, qs_params={"includeConfig": 0}
            )

        assert "configOrganization" not in response.data[0]
        get_org.assert_not_called()

    def test_organization_prefetch_failure_preserves_unaffected_integrations(self) -> None:
        expected = self.get_success_response(self.organization.slug).data
        self.create_integration(
            organization=self.organization,
            provider="github",
            name="GitHub",
            external_id="github:1",
        )

        with patch.object(
            organization_service,
            "get",
            side_effect=RpcRemoteException("organization", "get_organization_by_id", "Unavailable"),
        ):
            response = self.get_success_response(self.organization.slug)

        assert response.data == expected

    def test_config_shares_full_organization_for_github(self) -> None:
        for number in range(30):
            self.create_integration(
                organization=self.organization,
                provider="github",
                name=f"GitHub {number}",
                external_id=f"github:{number}",
            )

        with patch.object(organization_service, "get", wraps=organization_service.get) as get_org:
            response = self.get_success_response(
                self.organization.slug, qs_params={"provider_key": "github"}
            )

        assert len(response.data) == 30
        assert all(item["configOrganization"] for item in response.data)
        get_org.assert_called_once_with(id=self.organization.id)

    def test_vercel_shares_full_organization_for_config_and_display(self) -> None:
        last_project = self.create_project(organization=self.organization, slug="z-project")
        first_project = self.create_project(organization=self.organization, slug="a-project")
        self.create_project(
            organization=self.organization, slug="disabled-project", status=ObjectStatus.DISABLED
        )
        for number in range(3):
            self.create_integration(
                organization=self.organization,
                provider="vercel",
                name=f"Vercel {number}",
                external_id=f"vercel:{number}",
                metadata={"installation_type": "user"},
            )

        with (
            patch.object(organization_service, "get", wraps=organization_service.get) as get_org,
            patch("sentry.integrations.vercel.integration.VercelIntegration.get_client") as client,
        ):
            client.return_value.get_user.return_value = {"username": "example"}
            client.return_value.get_projects.return_value = []
            response = self.get_success_response(
                self.organization.slug,
                qs_params={"provider_key": "vercel", "includeConfig": "1"},
            )

        assert len(response.data) == 3
        for item in response.data:
            projects = item["configOrganization"][0]["sentryProjects"]
            assert [project["id"] for project in projects] == [first_project.id, last_project.id]
            instructions = item["dynamicDisplayInformation"]["configure_integration"][
                "instructions"
            ]
            assert f"/settings/{self.organization.slug}/integrations/" in instructions[0]
        get_org.assert_called_once_with(id=self.organization.id)

    def test_vercel_display_without_config(self) -> None:
        self.create_integration(
            organization=self.organization,
            provider="vercel",
            name="Vercel",
            external_id="vercel:1",
        )

        with patch.object(organization_service, "get", wraps=organization_service.get) as get_org:
            response = self.get_success_response(
                self.organization.slug,
                qs_params={"provider_key": "vercel", "includeConfig": "0"},
            )

        assert len(response.data) == 1
        assert "configOrganization" not in response.data[0]
        assert response.data[0]["configData"] is None
        instructions = response.data[0]["dynamicDisplayInformation"]["configure_integration"][
            "instructions"
        ]
        assert f"/settings/{self.organization.slug}/integrations/" in instructions[0]
        # The display hook still lazily fetches its organization; there is no eager fetch.
        get_org.assert_called_once_with(id=self.organization.id)

    def test_opts_out_of_organization_projects_and_teams(self) -> None:
        # This endpoint only needs the organization id, so it skips serializing every
        # project and team into the cross silo RPC payload.
        assert OrganizationIntegrationsEndpoint.include_organization_projects is False
        assert OrganizationIntegrationsEndpoint.include_organization_teams is False

    def test_feature_filters(self) -> None:
        response = self.get_success_response(
            self.organization.slug, qs_params={"features": "issue_basic"}
        )
        assert response.data[0]["id"] == str(self.integration.id)
        response = self.get_success_response(
            self.organization.slug, qs_params={"features": "codeowners"}
        )
        assert response.data == []

    def test_provider_key(self) -> None:
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

    def test_integration_type(self) -> None:
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

    def test_provider_key_and_integration_type(self) -> None:
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
