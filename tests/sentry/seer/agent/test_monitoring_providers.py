from unittest.mock import MagicMock, patch

from cryptography.fernet import Fernet
from django.test import override_settings

from sentry.constants import ObjectStatus
from sentry.hybridcloud.rpc.service import RpcException
from sentry.seer.agent.monitoring_providers import get_monitoring_provider_connections
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import with_feature

TEST_FERNET_KEY = Fernet.generate_key().decode("utf-8")


@override_settings(SEER_GHE_ENCRYPT_KEY=TEST_FERNET_KEY)
@with_feature("organizations:seer-infra-telemetry")
class TestGetMonitoringProviderConnections(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)

    def test_returns_empty_when_no_identities(self) -> None:
        assert get_monitoring_provider_connections(self.organization, self.user.id) == []

    def test_returns_connection(self) -> None:
        idp = self.create_identity_provider(type="datadog", external_id="org-uuid-1")
        identity = self.create_identity(
            user=self.user,
            identity_provider=idp,
            external_id="dd-user-1",
            data={
                "access_token": "access-token",
                "refresh_token": "refresh-token",
                "client_id": "dd-client-id",
                "client_secret": "dd-client-secret",
                "site": "datadoghq.com",
            },
        )
        self.create_organization_identity(
            organization=self.organization,
            identity=identity,
        )

        result = get_monitoring_provider_connections(self.organization, self.user.id)

        assert result is not None
        assert len(result) == 1
        connection = result[0]
        assert connection["provider_key"] == "datadog"
        assert connection["url"] == "https://mcp.datadoghq.com/api/unstable/mcp-server/mcp"
        assert connection["identity_id"] == identity.id
        assert connection["auth_method"] == "oauth"
        fernet = Fernet(TEST_FERNET_KEY.encode("utf-8"))
        auth_header = fernet.decrypt(
            connection["encrypted_auth_headers"]["Authorization"].encode("utf-8")
        ).decode("utf-8")
        assert auth_header == "Bearer access-token"

    def test_returns_multiple_connections(self) -> None:
        for site, ext_id in [("datadoghq.com", "org-1"), ("datadoghq.eu", "org-2")]:
            idp = self.create_identity_provider(type="datadog", external_id=ext_id)
            identity = self.create_identity(
                user=self.user,
                identity_provider=idp,
                external_id=f"user-{ext_id}",
                data={"access_token": "access-token", "site": site},
            )
            self.create_organization_identity(
                organization=self.organization,
                identity=identity,
            )

        result = get_monitoring_provider_connections(self.organization, self.user.id)

        assert result is not None
        assert len(result) == 2
        urls = {c["url"] for c in result}
        assert "https://mcp.datadoghq.com/api/unstable/mcp-server/mcp" in urls
        assert "https://mcp.datadoghq.eu/api/unstable/mcp-server/mcp" in urls

    def test_cross_org_isolation(self) -> None:
        org2 = self.create_organization(name="other-org", owner=self.user)

        idp = self.create_identity_provider(type="datadog", external_id="org-1")
        identity = self.create_identity(
            user=self.user,
            identity_provider=idp,
            external_id="dd-user-1",
            data={"access_token": "access-token", "site": "datadoghq.com"},
        )
        self.create_organization_identity(
            organization=self.organization,
            identity=identity,
        )

        result_org1 = get_monitoring_provider_connections(self.organization, self.user.id)
        assert len(result_org1) == 1
        assert result_org1[0]["provider_key"] == "datadog"

        result_org2 = get_monitoring_provider_connections(org2, self.user.id)
        assert result_org2 == []

    def test_skips_identity_missing_access_token(self) -> None:
        idp = self.create_identity_provider(type="datadog", external_id="org-1")
        identity = self.create_identity(
            user=self.user,
            identity_provider=idp,
            external_id="dd-user-1",
            data={"site": "datadoghq.com"},
        )
        self.create_organization_identity(
            organization=self.organization,
            identity=identity,
        )

        assert get_monitoring_provider_connections(self.organization, self.user.id) == []

    def test_skips_identity_missing_site(self) -> None:
        idp = self.create_identity_provider(type="datadog", external_id="org-1")
        identity = self.create_identity(
            user=self.user,
            identity_provider=idp,
            external_id="dd-user-1",
            data={"access_token": "access-token"},
        )
        self.create_organization_identity(
            organization=self.organization,
            identity=identity,
        )

        assert get_monitoring_provider_connections(self.organization, self.user.id) == []

    def test_ignores_non_monitoring_provider_identities(self) -> None:
        idp = self.create_identity_provider(type="slack", external_id="slack-team")
        self.create_identity(
            user=self.user,
            identity_provider=idp,
            external_id="slack-user-1",
            data={"access_token": "access-token"},
        )

        assert get_monitoring_provider_connections(self.organization, self.user.id) == []

    @override_settings(SEER_GHE_ENCRYPT_KEY=None)
    def test_skips_identity_when_encryption_fails(self) -> None:
        idp = self.create_identity_provider(type="datadog", external_id="org-1")
        identity = self.create_identity(
            user=self.user,
            identity_provider=idp,
            external_id="dd-user-1",
            data={"access_token": "access-token", "site": "datadoghq.com"},
        )
        self.create_organization_identity(
            organization=self.organization,
            identity=identity,
        )

        assert get_monitoring_provider_connections(self.organization, self.user.id) == []

    @with_feature({"organizations:seer-infra-telemetry": False})
    def test_returns_empty_when_feature_disabled(self) -> None:
        idp = self.create_identity_provider(type="datadog", external_id="org-1")
        identity = self.create_identity(
            user=self.user,
            identity_provider=idp,
            external_id="dd-user-1",
            data={"access_token": "access-token", "site": "datadoghq.com"},
        )
        self.create_organization_identity(
            organization=self.organization,
            identity=identity,
        )

        assert get_monitoring_provider_connections(self.organization, self.user.id) == []

    @patch(
        "sentry.seer.agent.monitoring_providers.identity_service.get_org_user_identities_by_provider_type",
        side_effect=RpcException("identity", "get_org_user_identities_by_provider_type", "boom"),
    )
    def test_degrades_when_identity_service_errors(self, mock_get: MagicMock) -> None:
        # A control-silo RPC failure must not propagate (it would stall the outbox shard).
        assert get_monitoring_provider_connections(self.organization, self.user.id) == []

    def test_returns_gcp_connections(self) -> None:
        idp = self.create_identity_provider(type="gcp", external_id="")
        identity = self.create_identity(
            user=self.user,
            identity_provider=idp,
            external_id="gcp-user-1",
            data={
                "access_token": "gcp-access-token",
                "refresh_token": "gcp-refresh-token",
            },
        )
        self.create_organization_identity(
            organization=self.organization,
            identity=identity,
        )

        result = get_monitoring_provider_connections(self.organization, self.user.id)

        assert len(result) == 3
        urls = {c["url"] for c in result}
        assert urls == {
            "https://logging.googleapis.com/mcp",
            "https://monitoring.googleapis.com/mcp",
            "https://cloudtrace.googleapis.com/mcp",
        }
        for connection in result:
            assert connection["provider_key"] == "gcp"
            assert connection["identity_id"] == identity.id
            assert connection["auth_method"] == "oauth"
            fernet = Fernet(TEST_FERNET_KEY.encode("utf-8"))
            auth_header = fernet.decrypt(
                connection["encrypted_auth_headers"]["Authorization"].encode("utf-8")
            ).decode("utf-8")
            assert auth_header == "Bearer gcp-access-token"

    def test_gcp_and_datadog_connections_together(self) -> None:
        gcp_idp = self.create_identity_provider(type="gcp", external_id="")
        gcp_identity = self.create_identity(
            user=self.user,
            identity_provider=gcp_idp,
            external_id="gcp-user-1",
            data={"access_token": "gcp-token"},
        )
        self.create_organization_identity(
            organization=self.organization,
            identity=gcp_identity,
        )

        dd_idp = self.create_identity_provider(type="datadog", external_id="dd-org-1")
        dd_identity = self.create_identity(
            user=self.user,
            identity_provider=dd_idp,
            external_id="dd-user-1",
            data={"access_token": "dd-token", "site": "datadoghq.com"},
        )
        self.create_organization_identity(
            organization=self.organization,
            identity=dd_identity,
        )

        result = get_monitoring_provider_connections(self.organization, self.user.id)

        assert len(result) == 4
        gcp_connections = [c for c in result if c["provider_key"] == "gcp"]
        dd_connections = [c for c in result if c["provider_key"] == "datadog"]
        assert len(gcp_connections) == 3
        assert len(dd_connections) == 1

    def test_gcp_skips_identity_missing_access_token(self) -> None:
        idp = self.create_identity_provider(type="gcp", external_id="")
        identity = self.create_identity(
            user=self.user,
            identity_provider=idp,
            external_id="gcp-user-1",
            data={"refresh_token": "refresh-only"},
        )
        self.create_organization_identity(
            organization=self.organization,
            identity=identity,
        )

        assert get_monitoring_provider_connections(self.organization, self.user.id) == []

    @patch("sentry.seer.agent.monitoring_providers.encrypt_access_token_for_seer")
    def test_gcp_token_encrypted_once(self, mock_encrypt: MagicMock) -> None:
        mock_encrypt.return_value = "encrypted-token"

        idp = self.create_identity_provider(type="gcp", external_id="")
        identity = self.create_identity(
            user=self.user,
            identity_provider=idp,
            external_id="gcp-user-1",
            data={"access_token": "gcp-token"},
        )
        self.create_organization_identity(
            organization=self.organization,
            identity=identity,
        )

        result = get_monitoring_provider_connections(self.organization, self.user.id)

        assert len(result) == 3
        mock_encrypt.assert_called_once_with("Bearer gcp-token")

    def _create_org_datadog_integration(self, site: str = "datadoghq.com") -> None:
        self.create_integration(
            organization=self.organization,
            provider="datadog",
            external_id="dd-org-uuid",
            name=f"Datadog ({site})",
            metadata={"api_key": "org-api-key", "app_key": "org-app-key", "site": site},
        )

    def test_org_datadog_connection_when_user_has_no_personal(self) -> None:
        self._create_org_datadog_integration()

        result = get_monitoring_provider_connections(self.organization, self.user.id)

        assert len(result) == 1
        conn = result[0]
        assert conn["provider_key"] == "datadog"
        assert conn["url"] == "https://mcp.datadoghq.com/api/unstable/mcp-server/mcp"
        assert conn["identity_id"] is None
        assert conn["auth_method"] == "api_key"
        assert conn["refreshable"] is False

        fernet = Fernet(TEST_FERNET_KEY.encode("utf-8"))
        headers = conn["encrypted_auth_headers"]
        assert fernet.decrypt(headers["DD-API-KEY"].encode()).decode() == "org-api-key"
        assert fernet.decrypt(headers["DD-APPLICATION-KEY"].encode()).decode() == "org-app-key"

    def test_personal_datadog_overrides_org(self) -> None:
        self._create_org_datadog_integration()
        idp = self.create_identity_provider(type="datadog", external_id="org-1")
        identity = self.create_identity(
            user=self.user,
            identity_provider=idp,
            external_id="dd-user-1",
            data={"access_token": "personal-token", "site": "datadoghq.com"},
        )
        self.create_organization_identity(organization=self.organization, identity=identity)

        result = get_monitoring_provider_connections(self.organization, self.user.id)

        assert len(result) == 1
        conn = result[0]
        assert conn["identity_id"] == identity.id
        assert conn["auth_method"] == "oauth"
        assert conn["refreshable"] is True
        fernet = Fernet(TEST_FERNET_KEY.encode("utf-8"))
        headers = conn["encrypted_auth_headers"]
        assert fernet.decrypt(headers["Authorization"].encode()).decode() == "Bearer personal-token"

    def test_personal_datadog_pat_overrides_org(self) -> None:
        self._create_org_datadog_integration()
        idp = self.create_identity_provider(type="datadog_pat", external_id="org-1")
        identity = self.create_identity(
            user=self.user,
            identity_provider=idp,
            external_id="dd-pat-user-1",
            data={"access_token": "personal-pat-token", "site": "datadoghq.com"},
        )
        self.create_organization_identity(organization=self.organization, identity=identity)

        result = get_monitoring_provider_connections(self.organization, self.user.id)

        assert len(result) == 1
        conn = result[0]
        assert conn["identity_id"] == identity.id
        assert conn["auth_method"] == "pat"
        assert conn["refreshable"] is False
        fernet = Fernet(TEST_FERNET_KEY.encode("utf-8"))
        headers = conn["encrypted_auth_headers"]
        assert (
            fernet.decrypt(headers["Authorization"].encode()).decode()
            == "Bearer personal-pat-token"
        )

    def test_org_datadog_kept_when_personal_is_different_family(self) -> None:
        self._create_org_datadog_integration()
        gcp_idp = self.create_identity_provider(type="gcp", external_id="")
        gcp_identity = self.create_identity(
            user=self.user,
            identity_provider=gcp_idp,
            external_id="gcp-user-1",
            data={"access_token": "gcp-token"},
        )
        self.create_organization_identity(organization=self.organization, identity=gcp_identity)

        result = get_monitoring_provider_connections(self.organization, self.user.id)

        assert {c["provider_key"] for c in result} == {"gcp", "datadog"}
        dd_connections = [c for c in result if c["provider_key"] == "datadog"]
        assert len(dd_connections) == 1
        assert dd_connections[0]["identity_id"] is None

    def test_org_datadog_connection_ignores_non_active_integration(self) -> None:
        self.create_integration(
            organization=self.organization,
            provider="datadog",
            external_id="dd-org-uuid",
            name="Datadog",
            metadata={"api_key": "org-api-key", "app_key": "org-app-key", "site": "datadoghq.com"},
            status=ObjectStatus.DISABLED,
        )

        assert get_monitoring_provider_connections(self.organization, None) == []

    def test_org_datadog_connection_ignores_uninstalled_org_integration(self) -> None:
        # On uninstall the OrganizationIntegration goes PENDING_DELETION while the Integration can
        # stay ACTIVE until async deletion runs -- creds must not leak during that window.
        self.create_integration(
            organization=self.organization,
            provider="datadog",
            external_id="dd-org-uuid",
            name="Datadog",
            metadata={"api_key": "org-api-key", "app_key": "org-app-key", "site": "datadoghq.com"},
            oi_params={"status": ObjectStatus.PENDING_DELETION},
        )

        assert get_monitoring_provider_connections(self.organization, None) == []

    def test_org_datadog_connection_for_no_user_run(self) -> None:
        self._create_org_datadog_integration()

        result = get_monitoring_provider_connections(self.organization, None)

        assert len(result) == 1
        assert result[0]["provider_key"] == "datadog"
        assert result[0]["identity_id"] is None
        assert result[0]["refreshable"] is False

    @patch(
        "sentry.integrations.datadog.integration.integration_service.organization_context",
        side_effect=RpcException("integration", "organization_context", "boom"),
    )
    def test_degrades_when_org_integration_rpc_errors(self, mock_ctx: MagicMock) -> None:
        assert get_monitoring_provider_connections(self.organization, None) == []

    def test_no_connections_for_no_user_run_without_org_integration(self) -> None:
        assert get_monitoring_provider_connections(self.organization, None) == []

    def test_org_integration_with_corrupt_metadata_is_skipped_and_logged(self) -> None:
        self.create_integration(
            organization=self.organization,
            provider="datadog",
            external_id="dd-org-uuid",
            name="Datadog",
            metadata={"api_key": "org-api-key", "site": "datadoghq.com"},
        )

        with self.assertLogs("sentry.integrations.datadog.integration", level="ERROR") as logs:
            result = get_monitoring_provider_connections(self.organization, self.user.id)

        assert result == []
        assert any("datadog_integration_invalid" in line for line in logs.output)

    def _create_org_gcp_integration(
        self, projects: list[str] | None = None, **kwargs: object
    ) -> None:
        self.create_integration(
            organization=self.organization,
            provider="gcp",
            external_id=str(self.organization.id),
            name="Google Cloud Platform",
            metadata={},
            oi_params={
                "config": {
                    "sentry_sa_email": "sentry-org-1@sentry-connectors.iam.gserviceaccount.com",
                    "customer_sa_email": "gcp-sentry@my-project.iam.gserviceaccount.com",
                    "projects": projects if projects is not None else ["my-project-prod"],
                }
            },
            **kwargs,
        )

    def test_org_gcp_connection_returns_three_mcp_endpoints(self) -> None:
        self._create_org_gcp_integration(projects=["my-project-prod", "my-project-staging"])

        result = get_monitoring_provider_connections(self.organization, self.user.id)

        assert len(result) == 3
        assert all(c["provider_key"] == "gcp" for c in result)
        urls = {c["url"] for c in result}
        assert urls == {
            "https://logging.googleapis.com/mcp",
            "https://monitoring.googleapis.com/mcp",
            "https://cloudtrace.googleapis.com/mcp",
        }
        for conn in result:
            assert conn["auth_method"] == "gcp_adc"
            assert conn["refreshable"] is False
            assert conn["gcp_project_ids"] == ["my-project-prod", "my-project-staging"]
            assert conn["identity_id"] is None
            assert conn["encrypted_auth_headers"] is None

    def test_org_gcp_connection_ignores_non_active_integration(self) -> None:
        self._create_org_gcp_integration(status=ObjectStatus.DISABLED)
        assert get_monitoring_provider_connections(self.organization, None) == []

    def test_org_gcp_connection_ignores_uninstalled_org_integration(self) -> None:
        self.create_integration(
            organization=self.organization,
            provider="gcp",
            external_id=str(self.organization.id),
            name="Google Cloud Platform",
            metadata={},
            oi_params={
                "status": ObjectStatus.PENDING_DELETION,
                "config": {
                    "sentry_sa_email": "sentry-org-1@sentry-connectors.iam.gserviceaccount.com",
                    "customer_sa_email": "gcp-sentry@my-project.iam.gserviceaccount.com",
                    "projects": ["my-project-prod"],
                },
            },
        )
        assert get_monitoring_provider_connections(self.organization, None) == []

    def test_org_gcp_connection_skips_empty_projects(self) -> None:
        self._create_org_gcp_integration(projects=[])
        result = get_monitoring_provider_connections(self.organization, self.user.id)
        assert result == []

    def test_org_gcp_connection_for_no_user_run(self) -> None:
        self._create_org_gcp_integration()
        result = get_monitoring_provider_connections(self.organization, None)
        assert len(result) == 3
        assert all(c["auth_method"] == "gcp_adc" for c in result)

    def test_org_gcp_and_datadog_together(self) -> None:
        self._create_org_gcp_integration()
        self._create_org_datadog_integration()

        result = get_monitoring_provider_connections(self.organization, self.user.id)

        assert len(result) == 4
        gcp_conns = [c for c in result if c["provider_key"] == "gcp"]
        dd_conns = [c for c in result if c["provider_key"] == "datadog"]
        assert len(gcp_conns) == 3
        assert len(dd_conns) == 1
