import base64
from unittest.mock import patch

from google.cloud.storage_transfer_v1 import RunTransferJobRequest

from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test
from sentry.utils import json


@control_silo_test
class DataExportNotificationsTestCase(APITestCase):
    endpoint = "sentry-api-0-data-export-notifications"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

    @patch("sentry.replays.endpoints.data_export_notifications.request_run_transfer_job")
    def test_simple(self, do_request) -> None:  # type: ignore[no-untyped-def]
        do_request.return_value = None

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
        self.get_success_response("google-cloud", method="post", **data, status_code=200)
        assert do_request.called
        assert do_request.call_args[0][0] == RunTransferJobRequest(
            job_name="test", project_id="test-project"
        )
