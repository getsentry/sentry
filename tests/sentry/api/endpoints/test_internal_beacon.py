import responses

import sentry
from sentry import options
from sentry.tasks.beacon import BEACON_URL
from sentry.testutils import APITestCase
from sentry.utils.compat.mock import patch


class InternalBeaconTest(APITestCase):
    @patch("sentry.api.endpoints.internal_beacon.safe_urlopen")
    @responses.activate
    def test_simple(self, safe_urlopen):
        self.login_as(self.user, superuser=False)
        url = "/api/0/internal/beacon/"

        install_id = options.get("sentry:install-id")
        assert options.set("system.admin-email", "foo@example.com")
        assert options.set("beacon.anonymous", False)

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
        safe_urlopen.assert_any_call(
            BEACON_URL,
            json={
                "type": "metric",
                "install_id": install_id,
                "version": sentry.get_version(),
                "data": {
                    "description": "SentryApp",
                    "component": "Foo",
                },
            },
            timeout=5,
        )
        safe_urlopen.assert_any_call(
            BEACON_URL,
            json={
                "type": "metric",
                "install_id": install_id,
                "version": sentry.get_version(),
                "data": {
                    "description": "SentryApp",
                    "component": "Bar",
                },
            },
            timeout=5,
        )

        assert safe_urlopen.call_count == 2
        assert response.status_code == 204
