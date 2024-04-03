from unittest.mock import patch

from sentry.models.apiapplication import ApiApplication
from sentry.models.integrations.integration import Integration
from sentry.receivers.outbox.control import (
    process_api_application_updates,
    process_integration_updates,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.types.region import Region, RegionCategory

_TEST_REGION = Region("eu", 1, "http://eu.testserver", RegionCategory.MULTI_TENANT)


@control_silo_test(regions=[_TEST_REGION])
class ProcessControlOutboxTest(TestCase):
    identifier = 1

    @patch("sentry.receivers.outbox.control.maybe_process_tombstone")
    def test_process_integration_updatess(self, mock_maybe_process):
        process_integration_updates(
            object_identifier=self.identifier, region_name=_TEST_REGION.name
        )
        mock_maybe_process.assert_called_with(
            Integration, self.identifier, region_name=_TEST_REGION.name
        )

    @patch("sentry.receivers.outbox.control.maybe_process_tombstone")
    def test_process_api_application_updates(self, mock_maybe_process):
        process_api_application_updates(
            object_identifier=self.identifier, region_name=_TEST_REGION.name
        )
        mock_maybe_process.assert_called_with(
            ApiApplication, self.identifier, region_name=_TEST_REGION.name
        )
