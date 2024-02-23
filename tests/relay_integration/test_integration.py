from unittest import mock

from sentry.tasks.relay import invalidate_project_config
from sentry.testutils.cases import TransactionTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.relay import RelayStoreHelper
from sentry.testutils.silo import region_silo_test
from sentry.testutils.skips import requires_kafka

pytestmark = [requires_kafka]


@region_silo_test
class SentryRemoteTest(RelayStoreHelper, TransactionTestCase):
    def test_project_config_compression(self):
        # Populate redis cache with compressed config:
        with self.tasks():
            invalidate_project_config(public_key=self.projectkey, trigger="test")

        # Disable project config endpoint, to make sure Relay gets its data
        # from redis:
        with mock.patch(
            "sentry.api.endpoints.relay.project_configs.RelayProjectConfigsEndpoint.post"
        ):
            event_data = {"message": "hello", "timestamp": iso_format(before_now(seconds=1))}
            event = self.post_and_retrieve_event(event_data)
            assert event.message == "hello"
