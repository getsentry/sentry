import responses

import sentry
from sentry import options
from sentry.tasks.beacon import BEACON_URL
from sentry.testutils import APITestCase
from sentry.utils import json
from sentry.utils.compat.mock import patch


class InternalBeaconTest(APITestCase):
    @patch("sentry.api.endpoints.internal_beacon.safe_urlopen")
    @patch("sentry.api.endpoints.internal_beacon.safe_urlread")
    @responses.activate
    def test_simple(self, safe_urlread, safe_urlopen):
        self.login_as(self.user, superuser=False)
        url = "/api/0/internal/beacon/"

        install_id = options.get("sentry:install-id")
        assert options.set("system.admin-email", "foo@example.com")
        assert options.set("beacon.anonymous", False)
        safe_urlread.return_value = json.dumps({"notices": []})

        response = self.client.post(
            url,
            data={
                "data": {
                    "description": "SentryApp",
                    "component": "Form",
                },
            },
        )
        safe_urlopen.assert_called_once_with(
            BEACON_URL,
            json={
                "type": "metric",
                "install_id": install_id,
                "version": sentry.get_version(),
                "docker": sentry.is_docker(),
                "data": {
                    "description": "SentryApp",
                    "component": "Form",
                },
                "anonymous": False,
                "admin_email": "foo@example.com",
            },
            timeout=5,
        )
        safe_urlread.assert_called_once_with(safe_urlopen.return_value)

        assert response.status_code == 204
