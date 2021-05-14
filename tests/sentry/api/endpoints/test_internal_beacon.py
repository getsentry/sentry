from sentry.testutils import APITestCase
from sentry.utils.compat.mock import patch


class InternalBeaconTest(APITestCase):
    @patch("sentry.tasks.beacon.send_beacon_metric")
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

        mock_send_beacon_metric.delay.assert_called_once_with(
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
