from sentry.constants import ObjectStatus
from sentry.testutils.cases import APITestCase


class OrganizationConfigIntegrationsTest(APITestCase):
    endpoint = "sentry-api-0-organization-config-integrations"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    def test_simple(self) -> None:
        response = self.get_success_response(self.organization.slug)
        assert len(response.data["providers"]) > 0
        providers = [r for r in response.data["providers"] if r["key"] == "example"]
        assert len(providers) == 1
        provider = providers[0]
        assert provider["name"] == "Example"
        assert provider["setupDialog"]["url"]

    def test_provider_key(self) -> None:
        response = self.get_success_response(
            self.organization.slug, qs_params={"provider_key": "example_server"}
        )
        assert len(response.data["providers"]) == 1
        assert response.data["providers"][0]["name"] == "Example Server"

        response = self.get_success_response(
            self.organization.slug, qs_params={"providerKey": "example_server"}
        )
        assert len(response.data["providers"]) == 1
        assert response.data["providers"][0]["name"] == "Example Server"

    def test_allow_multiple_false_can_add_true_when_no_installation(self) -> None:
        """Coding agent providers with allow_multiple=False show canAdd=True when not yet installed."""
        with self.feature("organizations:integrations-claude-code"):
            response = self.get_success_response(
                self.organization.slug, qs_params={"provider_key": "claude_code"}
            )
        assert len(response.data["providers"]) == 1
        assert response.data["providers"][0]["canAdd"] is True

    def test_allow_multiple_false_can_add_false_when_installed(self) -> None:
        """Coding agent providers with allow_multiple=False show canAdd=False when already installed."""
        self.create_integration(
            organization=self.organization,
            provider="claude_code",
            external_id="claude-ext-1",
        )
        with self.feature("organizations:integrations-claude-code"):
            response = self.get_success_response(
                self.organization.slug, qs_params={"provider_key": "claude_code"}
            )
        assert len(response.data["providers"]) == 1
        assert response.data["providers"][0]["canAdd"] is False

    def test_allow_multiple_false_can_add_true_when_disabled(self) -> None:
        """Disabled integrations should not block re-adding for allow_multiple=False providers."""
        self.create_integration(
            organization=self.organization,
            provider="claude_code",
            external_id="claude-ext-1",
            status=ObjectStatus.DISABLED,
        )
        with self.feature("organizations:integrations-claude-code"):
            response = self.get_success_response(
                self.organization.slug, qs_params={"provider_key": "claude_code"}
            )
        assert len(response.data["providers"]) == 1
        assert response.data["providers"][0]["canAdd"] is True

    def test_allow_multiple_false_can_add_true_when_pending_deletion(self) -> None:
        """Integrations pending deletion should not block re-adding."""
        self.create_integration(
            organization=self.organization,
            provider="claude_code",
            external_id="claude-ext-1",
            status=ObjectStatus.PENDING_DELETION,
        )
        with self.feature("organizations:integrations-claude-code"):
            response = self.get_success_response(
                self.organization.slug, qs_params={"provider_key": "claude_code"}
            )
        assert len(response.data["providers"]) == 1
        assert response.data["providers"][0]["canAdd"] is True

    def test_allow_multiple_true_can_add_unaffected_by_existing(self) -> None:
        """Regular providers with allow_multiple=True (default) still show canAdd=True even when installed."""
        self.create_integration(
            organization=self.organization,
            provider="example",
            external_id="example-ext-1",
        )
        response = self.get_success_response(
            self.organization.slug, qs_params={"provider_key": "example"}
        )
        assert len(response.data["providers"]) == 1
        assert response.data["providers"][0]["canAdd"] is True
