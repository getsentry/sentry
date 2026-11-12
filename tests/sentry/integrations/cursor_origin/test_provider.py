from __future__ import annotations

from unittest import mock
from urllib.parse import parse_qs, urlparse

import jwt as pyjwt
import pytest
import responses
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from sentry.integrations.base import (
    INTEGRATION_TYPE_TO_PROVIDER,
    IntegrationDomain,
    IntegrationFeatures,
    is_provider_enabled,
)
from sentry.integrations.cursor_origin.constants import (
    CURSOR_ORIGIN_API_BASE_URL,
    CURSOR_ORIGIN_SCOPES,
)
from sentry.integrations.cursor_origin.integration import (
    CursorOriginIntegration,
    CursorOriginIntegrationProvider,
    build_install_url,
)
from sentry.integrations.manager import default_manager
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.organization import Organization
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.organizations.services.organization.serial import serialize_rpc_organization
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import control_silo_test

INSTALLATION_ID = "i_01example"
APP_ID = "app_01example"
CLIENT = "sentry.integrations.cursor_origin.integration.CursorOriginSetupApiClient"
PRIVATE_KEY_PEM = (
    Ed25519PrivateKey.generate()
    .private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    .decode()
)
# Applied per test: as a class decorator this context manager replaces the class with a
# function, and pytest then collects nothing from it.
APP_OPTIONS = override_options(
    {"cursor-origin-app.id": APP_ID, "cursor-origin-app.private-key": PRIVATE_KEY_PEM}
)
SYNC_TASK = "sentry.integrations.cursor_origin.integration.sync_repos_for_org"


@control_silo_test
class CursorOriginProviderRegistrationTest(TestCase):
    def test_provider_is_registered(self) -> None:
        provider = default_manager.get(IntegrationProviderSlug.CURSOR_ORIGIN.value)

        assert provider.name == "Cursor Origin"
        assert provider.integration_cls is CursorOriginIntegration

    def test_declares_the_features_that_surface_it(self) -> None:
        """COMMITS is what makes isScmProvider pick it up in onboarding."""
        provider = CursorOriginIntegrationProvider()

        assert IntegrationFeatures.COMMITS in provider.features
        assert IntegrationFeatures.STACKTRACE_LINK in provider.features

    def test_listed_as_source_code_management(self) -> None:
        """Without this the integrationType filter hides it from the onboarding picker."""
        scm = INTEGRATION_TYPE_TO_PROVIDER[IntegrationDomain.SOURCE_CODE_MANAGEMENT]

        assert IntegrationProviderSlug.CURSOR_ORIGIN in scm

    def test_hidden_until_the_flag_is_on(self) -> None:
        provider = CursorOriginIntegrationProvider()

        assert provider.requires_feature_flag is True
        assert is_provider_enabled(provider, self.organization) is False
        with self.feature("organizations:integrations-cursor-origin"):
            assert is_provider_enabled(provider, self.organization) is True

    def test_needs_no_separate_identity(self) -> None:
        """Origin's redirect returns the installation, so there is no OAuth leg."""
        assert CursorOriginIntegrationProvider().needs_default_identity is False


@control_silo_test
class BuildIntegrationTest(TestCase):
    url = f"{CURSOR_ORIGIN_API_BASE_URL}/app/installations/{INSTALLATION_ID}"

    def _installation(self, **overrides: object) -> dict[str, object]:
        return {
            "target": {"slug": "acme", "id": "ns_1"},
            "scopes": ["repository:contents:read"],
            "repoSelectionMode": "selected",
            **overrides,
        }

    @APP_OPTIONS
    @responses.activate
    def test_names_the_integration_after_the_codebase(self) -> None:
        responses.add(responses.GET, self.url, json=self._installation())

        data = CursorOriginIntegrationProvider().build_integration(
            {"installation_id": INSTALLATION_ID}
        )

        assert data["name"] == "acme"
        assert data["external_id"] == INSTALLATION_ID
        assert data["metadata"]["domain_name"] == "https://cursor.com/codebase/acme"
        assert data["metadata"]["repo_selection_mode"] == "selected"
        token = responses.calls[0].request.headers["Authorization"].removeprefix("Bearer ")
        assert pyjwt.get_unverified_header(token)["kid"] == APP_ID

    @APP_OPTIONS
    @responses.activate
    def test_a_suspended_installation_is_refused(self) -> None:
        """Installing cannot unsuspend, so enabling would claim a health we cannot deliver."""
        responses.add(
            responses.GET,
            self.url,
            json=self._installation(suspendedAt="2026-09-18T00:00:00Z"),
        )

        with pytest.raises(IntegrationError) as excinfo:
            CursorOriginIntegrationProvider().build_integration(
                {"installation_id": INSTALLATION_ID}
            )

        assert "suspended" in str(excinfo.value)

    @APP_OPTIONS
    @responses.activate
    def test_an_unreadable_installation_is_rejected(self) -> None:
        responses.add(responses.GET, self.url, json={"code": 5, "message": "nope"}, status=404)

        with pytest.raises(IntegrationError):
            CursorOriginIntegrationProvider().build_integration(
                {"installation_id": INSTALLATION_ID}
            )


class BuildInstallUrlTest(TestCase):
    def test_carries_the_app_id_scopes_and_state(self) -> None:
        with self.options({"cursor-origin-app.id": APP_ID}):
            url = build_install_url(state="sig", redirect_uri="https://sentry.io/cb")

        query = parse_qs(urlparse(url).query)
        assert query["client_id"] == [APP_ID]
        assert query["state"] == ["sig"]
        assert query["redirect_uri"] == ["https://sentry.io/cb"]
        assert query["scope"] == [" ".join(CURSOR_ORIGIN_SCOPES)]

    def test_keeps_scopes_the_customer_already_granted(self) -> None:
        with self.options({"cursor-origin-app.id": APP_ID}):
            url = build_install_url(state="sig", redirect_uri="https://sentry.io/cb")

        query = parse_qs(urlparse(url).query)
        assert query["include_granted_scopes"] == ["true"]

    def test_scopes_are_space_separated_with_percent_20(self) -> None:
        with self.options({"cursor-origin-app.id": APP_ID}):
            url = build_install_url(state="sig", redirect_uri="https://sentry.io/cb")

        assert "scope=repository%3Acontents%3Aread%20repository" in url
        assert "+" not in urlparse(url).query.split("scope=")[1].split("&")[0]

    def test_metadata_read_is_not_requested(self) -> None:
        assert "repository:metadata:read" not in CURSOR_ORIGIN_SCOPES


def _rpc_org(organization: Organization) -> RpcOrganization:
    return serialize_rpc_organization(organization, include_projects=False, include_teams=False)


@control_silo_test
class PostInstallTest(TestCase):
    def test_syncs_repositories(self) -> None:
        integration = self.create_integration(
            organization=self.organization,
            provider=IntegrationProviderSlug.CURSOR_ORIGIN.value,
            external_id="i_01example",
        )
        org_integration = integration_service.get_organization_integration(
            integration_id=integration.id, organization_id=self.organization.id
        )
        assert org_integration is not None

        with mock.patch(f"{SYNC_TASK}.apply_async") as mock_sync:
            CursorOriginIntegrationProvider().post_install(
                integration, _rpc_org(self.organization), extra={}
            )

        assert mock_sync.call_args.kwargs["kwargs"] == {
            "organization_integration_id": org_integration.id
        }

    def test_an_organization_without_the_integration_is_skipped(self) -> None:
        integration = self.create_integration(
            organization=self.organization,
            provider=IntegrationProviderSlug.CURSOR_ORIGIN.value,
            external_id="i_01example",
        )
        other_org = self.create_organization(owner=self.user)

        with mock.patch(f"{SYNC_TASK}.apply_async") as mock_sync:
            CursorOriginIntegrationProvider().post_install(
                integration, _rpc_org(other_org), extra={}
            )

        assert mock_sync.call_count == 0
