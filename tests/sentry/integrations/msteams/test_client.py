from unittest.mock import patch
from urllib.parse import urlencode

import responses

from sentry.integrations.msteams.client import MsTeamsClient
from sentry.models import Integration
from sentry.testutils import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test(stable=True)
class MsTeamsClientTest(TestCase):
    def setUp(self):
        self.expires_at = 1594768808
        self.integration = Integration.objects.create(
            provider="msteams",
            name="my_team",
            metadata={"access_token": "my_token", "expires_at": self.expires_at},
        )

        # token mock
        access_json = {"expires_in": 86399, "access_token": "my_new_token"}
        responses.add(
            responses.POST,
            "https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token",
            json=access_json,
        )

        self.client = MsTeamsClient(self.integration)

    @responses.activate
    def test_token_refreshes(self):
        with patch("time.time") as mock_time:
            mock_time.return_value = self.expires_at
            # accessing the property should refresh the token
            self.client.access_token
            body = responses.calls[0].request.body
            assert body == urlencode(
                {
                    "client_id": "msteams-client-id",
                    "client_secret": "msteams-client-secret",
                    "grant_type": "client_credentials",
                    "scope": "https://api.botframework.com/.default",
                }
            )

            integration = Integration.objects.get(provider="msteams")
            assert integration.metadata == {
                "access_token": "my_new_token",
                "expires_at": self.expires_at + 86399 - 60 * 5,
            }

    @responses.activate
    def test_no_token_refresh(self):
        with patch("time.time") as mock_time:
            mock_time.return_value = self.expires_at - 100
            # accessing the property should refresh the token
            self.client.access_token
            assert not responses.calls

            integration = Integration.objects.get(provider="msteams")
            assert integration.metadata == {
                "access_token": "my_token",
                "expires_at": self.expires_at,
            }
