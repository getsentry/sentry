from unittest.mock import patch

import orjson

from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test


class MockOrganizationRoles:
    TEST_ORG_ROLES = [
        {
            "id": "alice",
            "name": "Alice",
            "desc": "In Wonderland",
            "scopes": ["rabbit:follow"],
        },
        {
            "id": "owner",
            "name": "Owner",
            "desc": "Minimal version of Owner",
            "scopes": ["org:admin"],
        },
    ]

    TEST_TEAM_ROLES = [
        {"id": "alice", "name": "Alice", "desc": "In Wonderland"},
    ]

    def __init__(self):
        from sentry.roles.manager import RoleManager

        self.default_manager = RoleManager(self.TEST_ORG_ROLES, self.TEST_TEAM_ROLES)
        self.organization_roles = self.default_manager.organization_roles

    def get(self, x):
        return self.organization_roles.get(x)


@control_silo_test
class UserOrganizationIntegationTest(APITestCase):
    endpoint = "sentry-api-0-user-organization-integrations"
    method = "get"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    def test_simple(self) -> None:
        integration = self.create_provider_integration(provider="github")

        self.create_organization_integration(
            organization_id=self.organization.id, integration_id=integration.id
        )

        response = self.get_success_response(self.user.id)
        assert response.data[0]["organizationId"] == self.organization.id

    def test_billing_users_dont_see_integrations(self) -> None:
        integration = self.create_provider_integration(provider="github")

        self.create_organization_integration(
            organization_id=self.organization.id, integration_id=integration.id
        )

        mock_org_roles = MockOrganizationRoles()
        with patch("sentry.roles.organization_roles.get", mock_org_roles.get):
            alice = self.create_user()
            self.create_member(user=alice, organization=self.organization, role="alice")
            self.login_as(alice)

            response = self.get_success_response(alice.id)
            assert response.status_code == 200
            content = orjson.loads(response.content)
            assert content == []

    def test_serialization_error_filtered_from_response(self) -> None:
        """An exception during serialization should produce an empty list, not null entries."""
        integration = self.create_provider_integration(provider="github")
        self.create_organization_integration(
            organization_id=self.organization.id, integration_id=integration.id
        )

        with patch(
            "sentry.integrations.base.IntegrationInstallation.get_dynamic_display_information",
            side_effect=RuntimeError("boom"),
        ):
            response = self.get_success_response(self.user.id)

        assert response.data == []

    def test_filter_by_single_provider(self) -> None:
        slack = self.create_provider_integration(provider="slack")
        github = self.create_provider_integration(provider="github")

        self.create_organization_integration(
            organization_id=self.organization.id, integration_id=slack.id
        )
        self.create_organization_integration(
            organization_id=self.organization.id, integration_id=github.id
        )

        response = self.get_success_response(self.user.id, provider="slack")
        assert len(response.data) == 1
        assert response.data[0]["provider"]["key"] == "slack"

    def test_filter_by_multiple_providers(self) -> None:
        slack = self.create_provider_integration(provider="slack")
        github = self.create_provider_integration(provider="github")
        jira = self.create_provider_integration(provider="jira")

        self.create_organization_integration(
            organization_id=self.organization.id, integration_id=slack.id
        )
        self.create_organization_integration(
            organization_id=self.organization.id, integration_id=github.id
        )
        self.create_organization_integration(
            organization_id=self.organization.id, integration_id=jira.id
        )

        response = self.get_success_response(self.user.id, provider=["slack", "github"])
        providers = {item["provider"]["key"] for item in response.data}
        assert providers == {"slack", "github"}

    def test_filter_by_provider_is_case_insensitive(self) -> None:
        slack = self.create_provider_integration(provider="slack")
        self.create_organization_integration(
            organization_id=self.organization.id, integration_id=slack.id
        )

        response = self.get_success_response(self.user.id, provider="Slack")
        assert len(response.data) == 1
        assert response.data[0]["provider"]["key"] == "slack"

    def test_no_provider_filter_returns_all(self) -> None:
        slack = self.create_provider_integration(provider="slack")
        github = self.create_provider_integration(provider="github")

        self.create_organization_integration(
            organization_id=self.organization.id, integration_id=slack.id
        )
        self.create_organization_integration(
            organization_id=self.organization.id, integration_id=github.id
        )

        response = self.get_success_response(self.user.id)
        assert len(response.data) == 2
