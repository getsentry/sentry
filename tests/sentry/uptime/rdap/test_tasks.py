from unittest import mock

from sentry.testutils.cases import UptimeTestCase
from sentry.uptime.rdap.query import DomainAddressDetails
from sentry.uptime.rdap.tasks import fetch_subscription_rdap_info


class RDAPTasksTest(UptimeTestCase):
    @mock.patch(
        "sentry.uptime.rdap.tasks.resolve_rdap_network_details",
    )
    def test(self, mock_fetch_subscription_rdap_info):
        test_info: DomainAddressDetails = {
            "handle": "TEST-HANDLE",
            "owner_name": "Rick Sanchez",
        }
        mock_fetch_subscription_rdap_info.return_value = test_info

        uptime_subscription = self.create_uptime_subscription(
            url="https://some.example.com/health",
        )
        fetch_subscription_rdap_info(uptime_subscription.id)
        uptime_subscription.refresh_from_db()

        mock_fetch_subscription_rdap_info.assert_called_with("some.example.com")
        assert uptime_subscription.host_provider_id == "TEST-HANDLE"
        assert uptime_subscription.host_provider_name == "Rick Sanchez"
