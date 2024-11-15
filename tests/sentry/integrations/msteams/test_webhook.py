from copy import deepcopy
from unittest import mock
from unittest.mock import call
from urllib.parse import urlencode

import pytest
import responses
from django.test import override_settings
from django.urls import reverse

from sentry.integrations.models.integration import Integration
from sentry.integrations.msteams.utils import ACTION_TYPE
from sentry.integrations.types import EventLifecycleOutcome
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode
from sentry.users.models.identity import Identity
from sentry.utils import jwt

from .test_helpers import (
    DECODED_TOKEN,
    EXAMPLE_MENTIONED,
    EXAMPLE_PERSONAL_MEMBER_ADDED,
    EXAMPLE_TEAM_MEMBER_ADDED,
    EXAMPLE_TEAM_MEMBER_REMOVED,
    EXAMPLE_UNLINK_COMMAND,
    GENERIC_EVENT,
    OPEN_ID_CONFIG,
    TOKEN,
    WELL_KNOWN_KEYS,
)

webhook_url = reverse("sentry-integration-msteams-webhooks")
team_id = "19:8d46058cda57449380517cc374727f2a@thread.tacv2"
kid = "Su-pdZys9LJGhDVgah3UjfPouuc"


class MsTeamsWebhookTest(APITestCase):
    @pytest.fixture(autouse=True)
    def _setup_metric_patch(self):
        with mock.patch("sentry.shared_integrations.track_response.metrics") as self.metrics:
            yield

    def setUp(self):
        super().setUp()

        responses.add(
            responses.GET,
            "https://login.botframework.com/v1/.well-known/openidconfiguration",
            json=OPEN_ID_CONFIG,
        )
        responses.add(
            responses.GET,
            OPEN_ID_CONFIG["jwks_uri"],
            json=WELL_KNOWN_KEYS,
        )

    @responses.activate
    @mock.patch("sentry.utils.jwt.decode")
    @mock.patch("time.time")
    def test_generic_event(self, mock_time, mock_decode):
        mock_time.return_value = 1594839999 + 60
        mock_decode.return_value = DECODED_TOKEN
        resp = self.client.post(
            path=webhook_url,
            data=GENERIC_EVENT,
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {TOKEN}",
        )

        assert resp.status_code == 204

        mock_decode.assert_called_with(
            TOKEN, mock.ANY, audience="msteams-client-id", algorithms=["RS256"]
        )
        assert (
            responses.calls[0].request.url
            == "https://login.botframework.com/v1/.well-known/openidconfiguration"
        )
        assert (
            responses.calls[1].request.url == "https://login.botframework.com/v1/.well-known/keys"
        )

    @responses.activate
    def test_post_empty_token(self):
        resp = self.client.post(
            path=webhook_url,
            data=EXAMPLE_TEAM_MEMBER_ADDED,
            format="json",
        )

        assert resp.data["detail"] == "Authorization header required"
        assert resp.status_code == 403

    @responses.activate
    @mock.patch("sentry.utils.jwt.decode")
    def test_decode_token_fails(self, mock_decode):
        mock_decode.side_effect = jwt.DecodeError("fail")
        resp = self.client.post(
            path=webhook_url,
            data=EXAMPLE_TEAM_MEMBER_ADDED,
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {TOKEN}",
        )

        assert resp.data["detail"] == "Could not validate JWT. Got fail"
        assert resp.status_code == 403

    @responses.activate
    @mock.patch("sentry.utils.jwt.decode")
    def test_iss_does_not_match(self, mock_decode):
        bad_token = DECODED_TOKEN.copy()
        bad_token["iss"] = "bad"
        mock_decode.return_value = bad_token
        resp = self.client.post(
            path=webhook_url,
            data=EXAMPLE_TEAM_MEMBER_ADDED,
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {TOKEN}",
        )
        assert resp.data["detail"] == "The field iss does not match"
        assert resp.status_code == 403

    @responses.activate
    @mock.patch("sentry.utils.jwt.decode")
    def test_service_url_does_not_match(self, mock_decode):
        bad_token = DECODED_TOKEN.copy()
        bad_token["serviceurl"] = "bad"
        mock_decode.return_value = bad_token
        resp = self.client.post(
            path=webhook_url,
            data=EXAMPLE_TEAM_MEMBER_ADDED,
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {TOKEN}",
        )
        assert resp.data["detail"] == "The field serviceUrl does not match"
        assert resp.status_code == 403

    @responses.activate
    @mock.patch("sentry.utils.jwt.decode")
    @mock.patch("time.time")
    def test_expired_token(self, mock_time, mock_decode):
        mock_time.return_value = 1594839999 + 6 * 60
        mock_decode.return_value = DECODED_TOKEN
        resp = self.client.post(
            path=webhook_url,
            data=EXAMPLE_TEAM_MEMBER_ADDED,
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {TOKEN}",
        )

        assert resp.data["detail"] == "Token is expired"
        assert resp.status_code == 403

    @responses.activate
    @mock.patch("sentry.utils.jwt.decode")
    @mock.patch("time.time")
    def test_member_added(self, mock_time, mock_decode):
        access_json = {"expires_in": 86399, "access_token": "my_token"}
        responses.add(
            responses.POST,
            "https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token",
            json=access_json,
        )
        responses.add(
            responses.POST,
            "https://smba.trafficmanager.net/amer/v3/conversations/%s/activities" % team_id,
            json={},
        )

        mock_time.return_value = 1594839999 + 60
        mock_decode.return_value = DECODED_TOKEN
        resp = self.client.post(
            path=webhook_url,
            data=EXAMPLE_TEAM_MEMBER_ADDED,
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {TOKEN}",
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
        assert "Bearer my_token" in responses.calls[3].request.headers["Authorization"]

    @responses.activate
    @mock.patch("sentry.utils.jwt.decode")
    @mock.patch("time.time")
    def test_different_member_added(self, mock_time, mock_decode):
        access_json = {"expires_in": 86399, "access_token": "my_token"}
        responses.add(
            responses.POST,
            "https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token",
            json=access_json,
        )
        responses.add(
            responses.POST,
            "https://smba.trafficmanager.net/amer/v3/conversations/%s/activities" % team_id,
            json={},
        )

        different_member_added = deepcopy(EXAMPLE_TEAM_MEMBER_ADDED)
        different_member_added["membersAdded"][0]["id"] = "28:another-id"

        mock_time.return_value = 1594839999 + 60
        mock_decode.return_value = DECODED_TOKEN
        resp = self.client.post(
            path=webhook_url,
            data=different_member_added,
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {TOKEN}",
        )

        assert resp.status_code == 204
        assert len(responses.calls) == 2

    @responses.activate
    @mock.patch("sentry.utils.jwt.decode")
    @mock.patch("time.time")
    def test_member_removed(self, mock_time, mock_decode):
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self.create_provider_integration(external_id=team_id, provider="msteams")
        mock_time.return_value = 1594839999 + 60
        mock_decode.return_value = DECODED_TOKEN
        resp = self.client.post(
            path=webhook_url,
            data=EXAMPLE_TEAM_MEMBER_REMOVED,
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {TOKEN}",
        )

        assert resp.status_code == 204
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert not Integration.objects.filter(id=integration.id)

    @responses.activate
    @mock.patch("sentry.utils.jwt.decode")
    @mock.patch("time.time")
    def test_invalid_silo_member_removed(self, mock_time, mock_decode):
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self.create_provider_integration(external_id=team_id, provider="msteams")
        mock_time.return_value = 1594839999 + 60
        mock_decode.return_value = DECODED_TOKEN

        with override_settings(SILO_MODE=SiloMode.CONTROL):
            resp = self.client.post(
                path=webhook_url,
                data=EXAMPLE_TEAM_MEMBER_REMOVED,
                format="json",
                HTTP_AUTHORIZATION=f"Bearer {TOKEN}",
            )
            assert resp.status_code == 400

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert Integration.objects.filter(id=integration.id)

    @responses.activate
    @mock.patch("sentry.utils.jwt.decode")
    @mock.patch("time.time")
    def test_different_member_removed(self, mock_time, mock_decode):
        different_member_removed = deepcopy(EXAMPLE_TEAM_MEMBER_REMOVED)
        different_member_removed["membersRemoved"][0]["id"] = "28:another-id"
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self.create_provider_integration(external_id=team_id, provider="msteams")
        mock_time.return_value = 1594839999 + 60
        mock_decode.return_value = DECODED_TOKEN
        resp = self.client.post(
            path=webhook_url,
            data=different_member_removed,
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {TOKEN}",
        )

        assert resp.status_code == 204
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert Integration.objects.filter(id=integration.id)

    @responses.activate
    @mock.patch("sentry.utils.jwt.decode")
    @mock.patch("time.time")
    def test_personal_member_added(self, mock_time, mock_decode):
        access_json = {"expires_in": 86399, "access_token": "my_token"}
        responses.add(
            responses.POST,
            "https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token",
            json=access_json,
        )
        responses.add(
            responses.POST,
            "https://smba.trafficmanager.net/amer/v3/conversations/%s/activities"
            % EXAMPLE_PERSONAL_MEMBER_ADDED["conversation"]["id"],
            json={},
        )
        mock_time.return_value = 1594839999 + 60
        mock_decode.return_value = DECODED_TOKEN
        resp = self.client.post(
            path=webhook_url,
            data=EXAMPLE_PERSONAL_MEMBER_ADDED,
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {TOKEN}",
        )

        assert resp.status_code == 201
        assert "Personal Installation of Sentry" in responses.calls[3].request.body.decode("utf-8")
        assert "Bearer my_token" in responses.calls[3].request.headers["Authorization"]

    @responses.activate
    @mock.patch("sentry.utils.jwt.decode")
    @mock.patch("time.time")
    def test_mentioned(self, mock_time, mock_decode):
        access_json = {"expires_in": 86399, "access_token": "my_token"}
        responses.add(
            responses.POST,
            "https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token",
            json=access_json,
        )
        responses.add(
            responses.POST,
            "https://smba.trafficmanager.net/amer/v3/conversations/%s/activities"
            % EXAMPLE_PERSONAL_MEMBER_ADDED["conversation"]["id"],
            json={},
        )
        mock_time.return_value = 1594839999 + 60
        mock_decode.return_value = DECODED_TOKEN
        resp = self.client.post(
            path=webhook_url,
            data=EXAMPLE_MENTIONED,
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {TOKEN}",
        )

        assert resp.status_code == 204
        assert "Sentry for Microsoft Teams does not support any commands" in responses.calls[
            3
        ].request.body.decode("utf-8")
        assert "Bearer my_token" in responses.calls[3].request.headers["Authorization"]

    @responses.activate
    @mock.patch("sentry.utils.jwt.decode")
    @mock.patch("time.time")
    def test_different_user_mentioned(self, mock_time, mock_decode):
        mock_time.return_value = 1594839999 + 60
        mock_decode.return_value = DECODED_TOKEN

        different_user_mentioned = deepcopy(EXAMPLE_MENTIONED)
        different_user_mentioned["entities"][0]["mentioned"]["id"] = "28:another-id"

        resp = self.client.post(
            path=webhook_url,
            data=different_user_mentioned,
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {TOKEN}",
        )

        assert resp.status_code == 204
        assert len(responses.calls) == 2

    @responses.activate
    @mock.patch("sentry.utils.jwt.decode")
    @mock.patch("time.time")
    def test_unlink_user(self, mock_time, mock_decode):
        access_json = {"expires_in": 86399, "access_token": "my_token"}
        responses.add(
            responses.POST,
            "https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token",
            json=access_json,
        )
        responses.add(
            responses.POST,
            "https://smba.trafficmanager.net/amer/v3/conversations/%s/activities"
            % EXAMPLE_UNLINK_COMMAND["conversation"]["id"],
            json={},
        )
        mock_time.return_value = 1594839999 + 60
        mock_decode.return_value = DECODED_TOKEN
        resp = self.client.post(
            path=webhook_url,
            data=EXAMPLE_UNLINK_COMMAND,
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {TOKEN}",
        )

        assert resp.status_code == 204
        assert "Click below to unlink your identity" in responses.calls[3].request.body.decode(
            "utf-8"
        )
        assert "Bearer my_token" in responses.calls[3].request.headers["Authorization"]

    @responses.activate
    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @mock.patch("sentry.utils.jwt.decode")
    @mock.patch("time.time")
    def test_help_command(self, mock_time, mock_decode, mock_record):
        other_command = deepcopy(EXAMPLE_UNLINK_COMMAND)
        other_command["text"] = "Help"
        access_json = {"expires_in": 86399, "access_token": "my_token"}
        responses.add(
            responses.POST,
            "https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token",
            json=access_json,
        )
        responses.add(
            responses.POST,
            "https://smba.trafficmanager.net/amer/v3/conversations/%s/activities"
            % other_command["conversation"]["id"],
            json={},
        )
        mock_time.return_value = 1594839999 + 60
        mock_decode.return_value = DECODED_TOKEN
        resp = self.client.post(
            path=webhook_url,
            data=other_command,
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {TOKEN}",
        )

        assert resp.status_code == 204
        assert "Please use one of the following commands for Sentry" in responses.calls[
            3
        ].request.body.decode("utf-8")
        assert "Bearer my_token" in responses.calls[3].request.headers["Authorization"]

        assert len(mock_record.mock_calls) == 2
        start, halt = mock_record.mock_calls
        assert start.args[0] == EventLifecycleOutcome.STARTED
        assert halt.args[0] == EventLifecycleOutcome.HALTED

    @responses.activate
    @mock.patch("sentry.utils.jwt.decode")
    @mock.patch("time.time")
    def test_link_command(self, mock_time, mock_decode):
        other_command = deepcopy(EXAMPLE_UNLINK_COMMAND)
        other_command["text"] = "link"
        access_json = {"expires_in": 86399, "access_token": "my_token"}
        responses.add(
            responses.POST,
            "https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token",
            json=access_json,
        )
        responses.add(
            responses.POST,
            "https://smba.trafficmanager.net/amer/v3/conversations/%s/activities"
            % other_command["conversation"]["id"],
            json={},
        )
        mock_time.return_value = 1594839999 + 60
        mock_decode.return_value = DECODED_TOKEN
        resp = self.client.post(
            path=webhook_url,
            data=other_command,
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {TOKEN}",
        )

        assert resp.status_code == 204
        assert (
            "Your Microsoft Teams identity will be linked to your Sentry account"
            in responses.calls[3].request.body.decode("utf-8")
        )
        assert "Bearer my_token" in responses.calls[3].request.headers["Authorization"]

        # Check if metrics is generated properly
        calls = [
            call(
                "integrations.http_response",
                sample_rate=1.0,
                tags={"integration": "msteams", "status": 200},
            ),
            call(
                "integrations.http_response",
                sample_rate=1.0,
                tags={"integration": "msteams", "status": 200},
            ),
            call(
                "integrations.http_response",
                sample_rate=1.0,
                tags={"integration": "msteams", "status": 200},
            ),
            call(
                "integrations.http_response",
                sample_rate=1.0,
                tags={"integration": "msteams", "status": 200},
            ),
        ]
        assert self.metrics.incr.mock_calls == calls

    @responses.activate
    @mock.patch("sentry.utils.jwt.decode")
    @mock.patch("time.time")
    def test_link_command_already_linked(self, mock_time, mock_decode):
        other_command = deepcopy(EXAMPLE_UNLINK_COMMAND)
        other_command["text"] = "link"
        with assume_test_silo_mode(SiloMode.CONTROL):
            idp = self.create_identity_provider(type="msteams", external_id=team_id)
            Identity.objects.create(
                external_id=other_command["from"]["id"], idp=idp, user=self.user
            )
        access_json = {"expires_in": 86399, "access_token": "my_token"}
        responses.add(
            responses.POST,
            "https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token",
            json=access_json,
        )
        responses.add(
            responses.POST,
            "https://smba.trafficmanager.net/amer/v3/conversations/%s/activities"
            % other_command["conversation"]["id"],
            json={},
        )
        mock_time.return_value = 1594839999 + 60
        mock_decode.return_value = DECODED_TOKEN
        resp = self.client.post(
            path=webhook_url,
            data=other_command,
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {TOKEN}",
        )

        assert resp.status_code == 204
        assert (
            "Your Microsoft Teams identity is already linked to a Sentry account"
            in responses.calls[3].request.body.decode("utf-8")
        )
        assert "Bearer my_token" in responses.calls[3].request.headers["Authorization"]

    @responses.activate
    @mock.patch("sentry.utils.jwt.decode")
    @mock.patch("time.time")
    def test_other_command(self, mock_time, mock_decode):
        other_command = deepcopy(EXAMPLE_UNLINK_COMMAND)
        other_command["text"] = "other"
        access_json = {"expires_in": 86399, "access_token": "my_token"}
        responses.add(
            responses.POST,
            "https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token",
            json=access_json,
        )
        responses.add(
            responses.POST,
            "https://smba.trafficmanager.net/amer/v3/conversations/%s/activities"
            % other_command["conversation"]["id"],
            json={},
        )
        mock_time.return_value = 1594839999 + 60
        mock_decode.return_value = DECODED_TOKEN
        resp = self.client.post(
            path=webhook_url,
            data=other_command,
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {TOKEN}",
        )

        assert resp.status_code == 204
        assert "Sorry, I didn't understand 'other'" in responses.calls[3].request.body.decode(
            "utf-8"
        )
        assert "Bearer my_token" in responses.calls[3].request.headers["Authorization"]

    @responses.activate
    @mock.patch("sentry.utils.jwt.decode")
    @mock.patch("time.time")
    def test_invalid_silo_card_action_payload(self, mock_time, mock_decode):
        mock_time.return_value = 1594839999 + 60
        mock_decode.return_value = DECODED_TOKEN
        with override_settings(SILO_MODE=SiloMode.CONTROL):
            integration = self.create_provider_integration(external_id=team_id, provider="msteams")
            CARD_ACTION_RESPONSE = {
                "type": "message",
                "from": {"id": "user_id"},
                "channelData": {
                    "tenant": {"id": "f5ffd8cf-a1aa-4242-adad-86509faa3be5"},
                    "channel": {"id": "channel_id"},
                },
                "conversation": {"conversationType": "channel", "id": "conversation_id"},
                "value": {
                    "payload": {
                        "groupId": "groupId",
                        "eventId": "eventId",
                        "actionType": ACTION_TYPE.ASSIGN,
                        "rules": [],
                        "integrationId": integration.id,
                    },
                    "assignInput": "me",
                },
                "replyToId": "replyToId",
                "serviceUrl": "https://smba.trafficmanager.net/amer/",
            }
            response = self.client.post(
                path=webhook_url,
                data=CARD_ACTION_RESPONSE,
                format="json",
                HTTP_AUTHORIZATION=f"Bearer {TOKEN}",
            )
            assert response.status_code == 400
