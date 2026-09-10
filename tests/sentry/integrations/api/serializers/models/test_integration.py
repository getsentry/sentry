from unittest import mock
from unittest.mock import call, patch

from sentry.api.serializers import serialize
from sentry.integrations.api.serializers.models.integration import IntegrationConfigSerializer
from sentry.integrations.utils.github_permissions import GITHUB_APP_REQUIRED_PERMISSIONS
from sentry.organizations.services.organization import organization_service
from sentry.shared_integrations.exceptions import ApiError
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class IntegrationSerializerTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)

    def test_other_provider_has_null_out_of_date(self) -> None:
        integration = self.create_provider_integration(
            provider="opsgenie",
            external_id="opsgenie:1",
            name="Team A",
            metadata={"permissions": {"contents": "read"}},
        )

        result = serialize(integration, self.user)

        assert result["outOfDate"] is None

    @mock.patch.dict(GITHUB_APP_REQUIRED_PERMISSIONS, {"contents": "write"}, clear=True)
    def test_github_out_of_date_when_missing_permissions(self) -> None:
        integration = self.create_provider_integration(
            provider="github",
            external_id="1",
            name="octocat",
            metadata={"permissions": {"contents": "read"}},
        )

        result = serialize(integration, self.user)

        assert result["outOfDate"] is True

    @mock.patch.dict(GITHUB_APP_REQUIRED_PERMISSIONS, {"contents": "write"}, clear=True)
    def test_github_not_out_of_date_when_permissions_satisfied(self) -> None:
        integration = self.create_provider_integration(
            provider="github",
            external_id="2",
            name="octocat",
            metadata={"permissions": {"contents": "write"}},
        )

        result = serialize(integration, self.user)

        assert result["outOfDate"] is False

    def test_full_organizations_are_scoped_to_each_batch(self) -> None:
        other_organization = self.create_organization()
        project = self.create_project(organization=self.organization)
        other_project = self.create_project(organization=other_organization)
        integration = self.create_provider_integration(
            provider="vercel",
            name="Vercel",
            external_id="vercel:1",
            metadata={"installation_type": "user"},
        )
        first = self.create_organization_integration(
            organization_id=self.organization.id, integration_id=integration.id
        )
        second = self.create_organization_integration(
            organization_id=other_organization.id, integration_id=integration.id
        )

        with (
            patch.object(organization_service, "get", wraps=organization_service.get) as get_org,
            patch("sentry.integrations.vercel.integration.VercelIntegration.get_client") as client,
        ):
            client.return_value.get_user.return_value = {"username": "example"}
            client.return_value.get_projects.return_value = []
            result = serialize([first, second], self.user)
            get_org.assert_has_calls(
                [call(id=self.organization.id), call(id=other_organization.id)], any_order=True
            )
            assert get_org.call_count == 2

            # The registered serializer is reused, but organization data must not be.
            get_org.reset_mock()
            repeated = serialize([first, second], self.user)
            assert repeated == result
            assert get_org.call_count == 2

        assert [item["organizationId"] for item in result] == [
            self.organization.id,
            other_organization.id,
        ]
        assert [item["id"] for item in result[0]["configOrganization"][0]["sentryProjects"]] == [
            project.id
        ]
        assert [item["id"] for item in result[1]["configOrganization"][0]["sentryProjects"]] == [
            other_project.id
        ]
        assert (
            f"/settings/{self.organization.slug}/integrations/"
            in result[0]["dynamicDisplayInformation"]["configure_integration"]["instructions"][0]
        )
        assert (
            f"/settings/{other_organization.slug}/integrations/"
            in result[1]["dynamicDisplayInformation"]["configure_integration"]["instructions"][0]
        )

    def test_config_serializer_without_preloaded_organization(self) -> None:
        project = self.create_project(organization=self.organization)
        integration = self.create_integration(
            organization=self.organization,
            provider="vercel",
            name="Vercel",
            external_id="vercel:1",
            metadata={"installation_type": "user"},
        )

        with (
            patch.object(organization_service, "get", wraps=organization_service.get) as get_org,
            patch("sentry.integrations.vercel.integration.VercelIntegration.get_client") as client,
        ):
            client.return_value.get_user.return_value = {"username": "example"}
            client.return_value.get_projects.return_value = []
            result = IntegrationConfigSerializer(self.organization.id).serialize(
                integration, {}, self.user
            )

        get_org.assert_called_once_with(id=self.organization.id)
        assert [item["id"] for item in result["configOrganization"][0]["sentryProjects"]] == [
            project.id
        ]

    def test_config_data_error_disables_integration(self) -> None:
        integration = self.create_provider_integration(
            provider="example", name="Example", external_id="example:1"
        )
        org_integration = self.create_organization_integration(
            organization_id=self.organization.id, integration_id=integration.id
        )

        with patch(
            "sentry.integrations.example.integration.ExampleIntegration.get_config_data",
            side_effect=ApiError("Unable to load configuration"),
        ):
            result = serialize(org_integration, self.user)

        assert result["status"] == "disabled"
        assert result["configData"] is None
        assert result["organizationId"] == self.organization.id

    def test_provider_without_installation(self) -> None:
        integration = self.create_provider_integration(
            provider="example", name="Example", external_id="example:1"
        )
        org_integration = self.create_organization_integration(
            organization_id=self.organization.id,
            integration_id=integration.id,
            config={"setting": "value"},
        )

        with patch(
            "sentry.integrations.example.integration.ExampleIntegrationProvider.integration_cls",
            None,
        ):
            result = serialize(org_integration, self.user)

        assert result["configOrganization"] == []
        assert result["configData"] == {"setting": "value"}
