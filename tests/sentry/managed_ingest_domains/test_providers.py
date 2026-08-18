import orjson
import responses
from django.test import override_settings

from sentry.managed_ingest_domains.providers import (
    CloudflareManagedIngestProvider,
    EdgeConfig,
    FakeManagedIngestProvider,
    get_managed_ingest_provider,
    is_managed_ingest_available,
)
from sentry.testutils.cases import TestCase


class ManagedIngestProviderTest(TestCase):
    @override_settings(
        SENTRY_MANAGED_INGEST={
            "provider": "fake",
            "cname_target": "ingest.dsntry.com",
        }
    )
    def test_fake_provider(self) -> None:
        assert is_managed_ingest_available()

        provider = get_managed_ingest_provider()
        assert isinstance(provider, FakeManagedIngestProvider)
        assert provider.cname_target == "ingest.dsntry.com"

        created = provider.create_hostname("errors.example.com")
        assert created.status == "pending"
        assert created.certificate_status == "pending_validation"

        active = provider.get_hostname(created.id)
        assert active.hostname == "errors.example.com"
        assert active.status == "active"
        assert active.certificate_status == "active"

    @responses.activate
    @override_settings(
        SENTRY_MANAGED_INGEST={
            "provider": "cloudflare",
            "api_token": "api-token",
            "account_id": "account-id",
            "zone_id": "zone-id",
            "kv_namespace_id": "namespace-id",
            "cname_target": "ingest.dsntry.com",
        }
    )
    def test_cloudflare_create_and_edge_config(self) -> None:
        responses.post(
            "https://api.cloudflare.com/client/v4/zones/zone-id/custom_hostnames",
            json={
                "success": True,
                "result": {
                    "id": "hostname-id",
                    "hostname": "errors.example.com",
                    "status": "pending",
                    "ssl": {"status": "pending_validation"},
                    "verification_errors": [],
                },
            },
        )
        responses.put(
            "https://api.cloudflare.com/client/v4/accounts/account-id/storage/kv/"
            "namespaces/namespace-id/values/host%3Aerrors.example.com",
            json={"success": True, "result": {}},
        )

        provider = get_managed_ingest_provider()
        assert isinstance(provider, CloudflareManagedIngestProvider)

        hostname = provider.create_hostname("errors.example.com")
        assert hostname.id == "hostname-id"
        assert hostname.certificate_status == "pending_validation"

        config: EdgeConfig = {
            "v": 1,
            "enabled": True,
            "organization_id": "123",
            "region": "us",
            "projects": {"456": ["public-key"]},
            "updated_at": "2026-08-17T23:00:00Z",
        }
        provider.put_edge_config("errors.example.com", config)

        assert responses.calls[0].request.headers["Authorization"] == "Bearer api-token"
        assert orjson.loads(responses.calls[0].request.body)["ssl"]["method"] == "http"
        assert orjson.loads(responses.calls[1].request.body) == config
