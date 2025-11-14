from typing import int
import base64
from unittest.mock import patch

from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test
from sentry.utils import json


@control_silo_test
class DataExportNotificationsTestCase(APITestCase):
    endpoint = "sentry-api-0-data-export-notifications"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

    @patch("sentry.replays.endpoints.data_export_notifications.retry_transfer_job_run")
    def test_simple(self, retry_transfer_job_run) -> None:  # type: ignore[no-untyped-def]
        retry_transfer_job_run.return_value = None

        data = {
            "data": base64.b64encode(
                json.dumps(
                    {
                        "transferOperation": {
                            "status": "FAILED",
                            "transferJobName": "test",
                            "projectId": "test-project",
                        }
                    }
                ).encode()
            ).decode("utf-8")
        }
        self.get_success_response(method="post", **data, status_code=200)
        assert retry_transfer_job_run.called
