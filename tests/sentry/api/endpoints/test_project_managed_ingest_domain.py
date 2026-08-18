from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from django.test import override_settings
from django.urls import reverse

from sentry.models.managed_ingest_domain import ManagedIngestDomain
from sentry.testutils.cases import APITestCase

_domain_connect_private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
_domain_connect_private_key_pem = _domain_connect_private_key.private_bytes(
    serialization.Encoding.PEM,
    serialization.PrivateFormat.PKCS8,
    serialization.NoEncryption(),
).decode()


@override_settings(
    SENTRY_MANAGED_INGEST={
        "provider": "fake",
        "cname_target": "ingest.dsntry.com",
        "cloudflare_domain_connect": {
            "sync_url": "https://dash.cloudflare.com/domain-connect",
            "provider_id": "sentry.io",
            "service_id": "managed-ingest",
            "public_key_id": "_dcpubkeyv1",
            "private_key_pem": _domain_connect_private_key_pem,
        },
    }
)
class ProjectManagedIngestDomainEndpointTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.url = reverse(
            "sentry-api-0-project-managed-ingest-domain",
            args=[self.organization.slug, self.project.slug],
        )
        self.refresh_url = reverse(
            "sentry-api-0-project-managed-ingest-domain-refresh",
            args=[self.organization.slug, self.project.slug],
        )
        self.domain_connect_url = reverse(
            "sentry-api-0-project-managed-ingest-domain-domain-connect",
            args=[self.organization.slug, self.project.slug],
        )

    def test_lifecycle(self) -> None:
        response = self.client.get(self.url)
        assert response.status_code == 200
        assert response.data == {"domain": None}

        response = self.client.delete(self.url)
        assert response.status_code == 200
        assert response.data == {"domain": None}

        response = self.client.post(
            self.url,
            {"hostname": "Errors.Example.COM."},
            format="json",
        )
        assert response.status_code == 202
        assert response.data["domain"]["hostname"] == "errors.example.com"
        assert response.data["domain"]["status"] == ManagedIngestDomain.Status.CREATING
        assert response.data["domain"]["provider"] == ManagedIngestDomain.Provider.FAKE

        response = self.client.post(
            self.url,
            {"hostname": "errors.example.com"},
            format="json",
        )
        assert response.status_code == 200

        response = self.client.post(
            self.url,
            {"hostname": "other.example.com"},
            format="json",
        )
        assert response.status_code == 409

        response = self.client.post(self.refresh_url)
        assert response.status_code == 202
        assert response.data["domain"]["hostname"] == "errors.example.com"

        response = self.client.delete(self.url)
        assert response.status_code == 202
        assert response.data["domain"]["status"] == ManagedIngestDomain.Status.DELETING

    @override_settings(SENTRY_MANAGED_INGEST=None)
    def test_unavailable_without_provider_configuration(self) -> None:
        response = self.client.get(self.url)
        assert response.status_code == 404

    def test_rejects_incompatible_relay_configuration(self) -> None:
        self.organization.update_option(
            "sentry:relay_dsn_endpoint",
            "https://relay.example.com",
        )
        response = self.client.post(
            self.url,
            {"hostname": "errors.example.com"},
            format="json",
        )
        assert response.status_code == 409

        self.organization.delete_option("sentry:relay_dsn_endpoint")
        self.organization.update_option(
            "sentry:ingest-through-trusted-relays-only",
            "enabled",
        )
        response = self.client.post(
            self.url,
            {"hostname": "errors.example.com"},
            format="json",
        )
        assert response.status_code == 409

    def test_active_domain_diagnostics(self) -> None:
        self.create_managed_ingest_domain(
            status=ManagedIngestDomain.Status.ACTIVE,
            provider_hostname_id="hostname-id",
            cname_target="ingest.dsntry.com",
            provider_status="active",
            certificate_status="active",
        )

        response = self.client.get(self.url)

        assert response.status_code == 200
        checks = response.data["domain"]["diagnostics"]["checks"]
        assert [(check["slug"], check["status"]) for check in checks] == [
            ("provider_hostname", "passed"),
            ("dns_cname", "passed"),
            ("certificate", "passed"),
            ("edge_routing", "passed"),
        ]
        assert checks[1]["expected"] == "errors.example.com CNAME ingest.dsntry.com"

    def test_pending_dns_diagnostics_are_waiting(self) -> None:
        self.create_managed_ingest_domain(
            status=ManagedIngestDomain.Status.PENDING_DNS,
            provider_hostname_id="hostname-id",
            cname_target="ingest.dsntry.com",
            provider_status="pending",
            certificate_status="pending_validation",
        )

        response = self.client.get(self.url)

        assert response.status_code == 200
        checks = response.data["domain"]["diagnostics"]["checks"]
        assert [(check["slug"], check["status"]) for check in checks] == [
            ("provider_hostname", "passed"),
            ("dns_cname", "waiting"),
            ("certificate", "waiting"),
            ("edge_routing", "waiting"),
        ]

    @patch(
        "sentry.api.endpoints.project_managed_ingest_domain.get_detected_dns_provider",
        return_value="cloudflare",
    )
    def test_cloudflare_domain_connect_url(self, _get_detected_dns_provider) -> None:
        self.create_managed_ingest_domain(
            status=ManagedIngestDomain.Status.PENDING_DNS,
            provider_hostname_id="hostname-id",
            cname_target="ingest.dsntry.com",
        )

        response = self.client.get(self.domain_connect_url)

        assert response.status_code == 200
        assert response.data["provider"] == "cloudflare"
        query = parse_qs(urlsplit(response.data["url"]).query)
        assert query["domain"] == ["example.com"]
        assert query["host"] == ["errors"]
        assert query["target"] == ["ingest.dsntry.com"]

    def test_domain_connect_unavailable_for_other_dns_providers(self) -> None:
        self.create_managed_ingest_domain(
            status=ManagedIngestDomain.Status.PENDING_DNS,
            provider_hostname_id="hostname-id",
            cname_target="ingest.dsntry.com",
        )

        response = self.client.get(self.domain_connect_url)

        assert response.status_code == 404
