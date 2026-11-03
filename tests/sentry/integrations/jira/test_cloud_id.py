import responses

from sentry.constants import ObjectStatus
from sentry.integrations.jira.cloud_id import CloudIdLookup, CloudIdStatus, audit_cloud_ids
from sentry.integrations.models.integration import Integration
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class AuditCloudIdsTest(TestCase):
    def _integration(self, external_id: str, base_url: str, **kwargs: int) -> Integration:
        return self.create_provider_integration(
            provider="jira", external_id=external_id, metadata={"base_url": base_url}, **kwargs
        )

    @responses.activate
    def test_audit(self) -> None:
        live = self._integration("key-1", "https://live.atlassian.net")
        # A disabled row still holds its external_id, so it can still collide.
        renamed = self._integration(
            "key-2", "https://old-name.atlassian.net", status=ObjectStatus.DISABLED
        )
        deleted = self._integration("key-3", "https://deleted.atlassian.net")
        internal = self._integration("key-4", "https://10.0.0.1")
        self.create_provider_integration(provider="github", external_id="not-jira")

        responses.add(
            responses.GET,
            "https://live.atlassian.net/_edge/tenant_info",
            json={"cloudId": "cloud-a"},
        )
        responses.add(
            responses.GET,
            "https://old-name.atlassian.net/_edge/tenant_info",
            status=301,
            headers={"Location": "https://new-name.atlassian.net/_edge/tenant_info"},
        )
        responses.add(
            responses.GET,
            "https://new-name.atlassian.net/_edge/tenant_info",
            json={"cloudId": "cloud-a"},
        )
        responses.add(responses.GET, "https://deleted.atlassian.net/_edge/tenant_info", status=404)

        audit = audit_cloud_ids()

        lookups = {result.integration_id: result.lookup for result in audit.results}
        assert lookups == {
            live.id: CloudIdLookup(CloudIdStatus.FOUND, cloud_id="cloud-a"),
            renamed.id: CloudIdLookup(
                CloudIdStatus.FOUND, cloud_id="cloud-a", moved_to="new-name.atlassian.net"
            ),
            deleted.id: CloudIdLookup(CloudIdStatus.NOT_FOUND, detail="404"),
            internal.id: CloudIdLookup(CloudIdStatus.UNEXPECTED_HOST),
        }
        assert audit.duplicates() == {"cloud-a": [live.id, renamed.id]}
        # The internal address was never requested.
        assert len(responses.calls) == 4
