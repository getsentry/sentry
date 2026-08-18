from unittest.mock import MagicMock, patch

import orjson
import responses
from django.test import override_settings

from sentry.models.managed_ingest_domain import ManagedIngestDomain
from sentry.models.projectkey import ProjectKeyStatus
from sentry.tasks.managed_ingest_domains import (
    delete_managed_ingest_domain,
    provision_managed_ingest_domain,
    refresh_managed_ingest_domain,
)
from sentry.testutils.cases import TestCase


@override_settings(
    SENTRY_MANAGED_INGEST={
        "provider": "fake",
        "cname_target": "ingest.dsntry.com",
    }
)
class ManagedIngestDomainTaskTest(TestCase):
    def test_lifecycle(self) -> None:
        self.create_project_key(project=self.project)
        domain = self.create_managed_ingest_domain(project=self.project)

        with self.tasks():
            provision_managed_ingest_domain.delay(domain.id)
        domain.refresh_from_db()
        assert domain.status == ManagedIngestDomain.Status.PENDING_DNS
        assert domain.provider_hostname_id == "fake:errors.example.com"
        assert domain.cname_target == "ingest.dsntry.com"
        assert domain.activated_at is None

        with self.tasks():
            refresh_managed_ingest_domain.delay(domain.id)
        domain.refresh_from_db()
        assert domain.status == ManagedIngestDomain.Status.ACTIVE
        assert domain.activated_at is not None

        domain.transition_to(ManagedIngestDomain.Status.DELETING)
        domain.save()
        with self.tasks():
            delete_managed_ingest_domain.delay(domain.id)
        assert not ManagedIngestDomain.objects.filter(id=domain.id).exists()

    @patch("sentry.tasks.managed_ingest_domains.provision_managed_ingest_domain.apply_async")
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
    def test_pending_cname_error_is_not_shown_as_a_failure(
        self, _provision_managed_ingest_domain: MagicMock
    ) -> None:
        domain = self.create_managed_ingest_domain(
            project=self.project,
            provider=ManagedIngestDomain.Provider.CLOUDFLARE,
            provider_hostname_id="hostname-id",
        )
        responses.patch(
            "https://api.cloudflare.com/client/v4/zones/zone-id/custom_hostnames/hostname-id",
            json={
                "result": {
                    "id": "hostname-id",
                    "hostname": domain.hostname,
                    "status": "pending",
                    "ssl": {"status": "pending_validation"},
                    "verification_errors": ["custom hostname does not CNAME to this zone"],
                }
            },
        )

        with self.tasks():
            refresh_managed_ingest_domain.delay(domain.id)

        domain.refresh_from_db()
        assert domain.status == ManagedIngestDomain.Status.PENDING_DNS
        assert domain.last_error is None
        assert domain.verification_errors == ["custom hostname does not CNAME to this zone"]

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
    def test_project_key_change_reconciles_edge_config(self) -> None:
        key = self.create_project_key(project=self.project)
        self.create_managed_ingest_domain(
            project=self.project,
            provider=ManagedIngestDomain.Provider.CLOUDFLARE,
            status=ManagedIngestDomain.Status.ACTIVE,
        )
        responses.put(
            "https://api.cloudflare.com/client/v4/accounts/account-id/storage/kv/"
            "namespaces/namespace-id/values/host%3Aerrors.example.com",
            json={"success": True, "result": {}},
        )

        with self.tasks(), self.capture_on_commit_callbacks(execute=True):
            key.status = ProjectKeyStatus.INACTIVE
            key.save()

        config = orjson.loads(responses.calls[0].request.body)
        assert config["enabled"] is True
        assert config["projects"] == {str(self.project.id): []}
