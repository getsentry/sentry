from __future__ import absolute_import

import responses
from six.moves.urllib.parse import urlencode

from sentry.testutils import APITestCase

from .test_utils import EXAMPLE_MEMBER_ADDED


webhook_url = "/extensions/msteams/webhook/"
team_id = "19:8d46058cda57449380517cc374727f2a@thread.tacv2"


class MsTeamsWebhookTest(APITestCase):
    def setUp(self):
        super(MsTeamsWebhookTest, self).setUp()

        access_json = {"expires_in": 86399, "access_token": "my_token"}
        responses.add(
            responses.POST,
            u"https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token",
            json=access_json,
        )
        responses.add(
            responses.POST,
            u"https://smba.trafficmanager.net/amer/v3/conversations/%s/activities" % team_id,
            json={},
        )

    @responses.activate
    def test_member_added(self):
        self.client.post(
            path=webhook_url, data=EXAMPLE_MEMBER_ADDED, format="json",
        )

        body = responses.calls[0].request.body
        assert body == urlencode(
            {
                "client_id": "msteams-client-id",
                "client_secret": "msteams-client-secret",
                "grant_type": "client_credentials",
                "scope": "https://api.botframework.com/.default",
            }
        )

        assert (
            responses.calls[1].request.url
            == "https://smba.trafficmanager.net/amer/v3/conversations/%s/activities" % team_id
        )
