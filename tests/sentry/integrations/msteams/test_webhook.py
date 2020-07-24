from __future__ import absolute_import

import jwt
import mock
import responses

from copy import deepcopy
from six.moves.urllib.parse import urlencode

from sentry.models import Integration
from sentry.testutils import APITestCase
from sentry.utils.compat.mock import patch

from .test_helpers import (
    GENERIC_EVENT,
    EXAMPLE_MEMBER_ADDED,
    EXAMPLE_MEMBER_REMOVED,
    OPEN_ID_CONFIG,
    WELL_KNOWN_KEYS,
    DECODED_TOKEN,
    TOKEN,
)


webhook_url = "/extensions/msteams/webhook/"
team_id = "19:8d46058cda57449380517cc374727f2a@thread.tacv2"
kid = "Su-pdZys9LJGhDVgah3UjfPouuc"


class MsTeamsWebhookTest(APITestCase):
    def setUp(self):
        super(MsTeamsWebhookTest, self).setUp()

        responses.add(
            responses.GET,
            u"https://login.botframework.com/v1/.well-known/openidconfiguration",
            json=OPEN_ID_CONFIG,
        )
        responses.add(
            responses.GET, OPEN_ID_CONFIG["jwks_uri"], json=WELL_KNOWN_KEYS,
        )

    @responses.activate
    @patch("jwt.decode")
    @patch("time.time")
    def test_generic_event(self, mock_time, mock_decode):
        mock_time.return_value = 1594839999 + 60
        mock_decode.return_value = DECODED_TOKEN
        resp = self.client.post(
            path=webhook_url,
            data=GENERIC_EVENT,
            format="json",
            HTTP_AUTHORIZATION=u"Bearer %s" % TOKEN,
        )

        assert resp.status_code == 204

        mock_decode.assert_called_with(
            TOKEN, mock.ANY, audience="msteams-client-id", algorithms=["RS256"]
        )
        assert (
            responses.calls[0].request.url
            == u"https://login.botframework.com/v1/.well-known/openidconfiguration"
        )
        assert (
            responses.calls[1].request.url == u"https://login.botframework.com/v1/.well-known/keys"
        )

    @responses.activate
    def test_post_empty_token(self):
        resp = self.client.post(path=webhook_url, data=EXAMPLE_MEMBER_ADDED, format="json",)

        assert resp.data["detail"] == "Authorization header required"
        assert resp.status_code == 403

    @responses.activate
    @patch("jwt.decode")
    def test_decode_token_fails(self, mock_decode):
        mock_decode.side_effect = jwt.DecodeError("fail")
        resp = self.client.post(
            path=webhook_url,
            data=EXAMPLE_MEMBER_ADDED,
            format="json",
            HTTP_AUTHORIZATION=u"Bearer %s" % TOKEN,
        )

        assert resp.data["detail"] == "Could not decode JWT token"
        assert resp.status_code == 403

    @responses.activate
    @patch("jwt.decode")
    def test_iss_does_not_match(self, mock_decode):
        bad_token = DECODED_TOKEN.copy()
        bad_token["iss"] = "bad"
        mock_decode.return_value = bad_token
        resp = self.client.post(
            path=webhook_url,
            data=EXAMPLE_MEMBER_ADDED,
            format="json",
            HTTP_AUTHORIZATION=u"Bearer %s" % TOKEN,
        )
        assert resp.data["detail"] == "The field iss does not match"
        assert resp.status_code == 403

    @responses.activate
    @patch("jwt.decode")
    def test_service_url_does_not_match(self, mock_decode):
        bad_token = DECODED_TOKEN.copy()
        bad_token["serviceurl"] = "bad"
        mock_decode.return_value = bad_token
        resp = self.client.post(
            path=webhook_url,
            data=EXAMPLE_MEMBER_ADDED,
            format="json",
            HTTP_AUTHORIZATION=u"Bearer %s" % TOKEN,
        )
        assert resp.data["detail"] == "The field serviceUrl does not match"
        assert resp.status_code == 403

    @responses.activate
    @patch("jwt.decode")
    @patch("time.time")
    def test_expired_token(self, mock_time, mock_decode):
        mock_time.return_value = 1594839999 + 6 * 60
        mock_decode.return_value = DECODED_TOKEN
        resp = self.client.post(
            path=webhook_url,
            data=EXAMPLE_MEMBER_ADDED,
            format="json",
            HTTP_AUTHORIZATION=u"Bearer %s" % TOKEN,
        )

        assert resp.data["detail"] == "Token is expired"
        assert resp.status_code == 403

    @responses.activate
    @patch("jwt.decode")
    @patch("time.time")
    def test_member_added(self, mock_time, mock_decode):
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

        mock_time.return_value = 1594839999 + 60
        mock_decode.return_value = DECODED_TOKEN
        resp = self.client.post(
            path=webhook_url,
            data=EXAMPLE_MEMBER_ADDED,
            format="json",
            HTTP_AUTHORIZATION=u"Bearer %s" % TOKEN,
        )

        assert resp.status_code == 201
        assert responses.calls[2].request.body == urlencode(
            {
                "client_id": "msteams-client-id",
                "client_secret": "msteams-client-secret",
                "grant_type": "client_credentials",
                "scope": "https://api.botframework.com/.default",
            }
        )

        assert (
            responses.calls[3].request.url
            == "https://smba.trafficmanager.net/amer/v3/conversations/%s/activities" % team_id
        )

    @responses.activate
    @patch("jwt.decode")
    @patch("time.time")
    def test_different_member_added(self, mock_time, mock_decode):
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

        different_member_added = deepcopy(EXAMPLE_MEMBER_ADDED)
        different_member_added["membersAdded"][0]["id"] = "28:another-id"

        mock_time.return_value = 1594839999 + 60
        mock_decode.return_value = DECODED_TOKEN
        resp = self.client.post(
            path=webhook_url,
            data=different_member_added,
            format="json",
            HTTP_AUTHORIZATION=u"Bearer %s" % TOKEN,
        )

        assert resp.status_code == 204
        assert len(responses.calls) == 2

    @patch("jwt.decode")
    @patch("time.time")
    def test_member_removed(self, mock_time, mock_decode):
        integration = Integration.objects.create(external_id=team_id, provider="msteams")
        mock_time.return_value = 1594839999 + 60
        mock_decode.return_value = DECODED_TOKEN
        resp = self.client.post(
            path=webhook_url,
            data=EXAMPLE_MEMBER_REMOVED,
            format="json",
            HTTP_AUTHORIZATION=u"Bearer %s" % TOKEN,
        )

        assert resp.status_code == 204
        assert not Integration.objects.filter(id=integration.id)

    @patch("jwt.decode")
    @patch("time.time")
    def test_different_member_removed(self, mock_time, mock_decode):
        different_member_removed = deepcopy(EXAMPLE_MEMBER_REMOVED)
        different_member_removed["membersRemoved"][0]["id"] = "28:another-id"
        integration = Integration.objects.create(external_id=team_id, provider="msteams")
        mock_time.return_value = 1594839999 + 60
        mock_decode.return_value = DECODED_TOKEN
        resp = self.client.post(
            path=webhook_url,
            data=different_member_removed,
            format="json",
            HTTP_AUTHORIZATION=u"Bearer %s" % TOKEN,
        )

        assert resp.status_code == 204
        assert Integration.objects.filter(id=integration.id)
