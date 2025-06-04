from unittest.mock import patch

from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class InternalBeaconTest(APITestCase):
    @patch("sentry.tasks.beacon.send_beacon_metric.delay")
    def test_simple(self, mock_send_beacon_metric):
        self.login_as(self.user, superuser=False)
        url = "/api/0/internal/beacon/"

        response = self.client.post(
            url,
            data={
                "batch_data": [
                    {
                        "description": "SentryApp",
                        "component": "Foo",
                    },
                    {
                        "description": "SentryApp",
                        "component": "Bar",
                    },
                ]
            },
        )

        mock_send_beacon_metric.assert_called_once_with(
            metrics=[
                {
                    "description": "SentryApp",
                    "component": "Foo",
                },
                {
                    "description": "SentryApp",
                    "component": "Bar",
                },
            ]
        )

        assert response.status_code == 204

    @patch("sentry.tasks.beacon.send_beacon_metric.delay")
    def test_payload_validation(self, mock_send_beacon_metric):
        self.login_as(self.user, superuser=False)
        url = "/api/0/internal/beacon/"

        # test large number of metrics
        metric = {
            "description": "SentryApp",
            "component": "Foo",
        }
        response = self.client.post(
            url,
            data={"batch_data": [metric for i in range(25)]},
        )
        assert response.status_code == 400

        # Test a single metric with a large dict
        metric_invalid = {i: i for i in range(25)}
        response = self.client.post(url, data={"batch_data": [metric_invalid]})
        assert response.status_code == 400
