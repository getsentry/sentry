from unittest import mock
from unittest.mock import patch
from urllib.parse import urlencode

import orjson
import pytest
from django.utils.functional import cached_property

from sentry import options
from sentry.integrations.slack.requests.action import SlackActionRequest
from sentry.integrations.slack.requests.base import SlackRequest, SlackRequestError
from sentry.integrations.slack.requests.event import SlackEventRequest
from sentry.integrations.slack.utils.auth import set_signing_secret
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import override_options
from sentry.testutils.silo import control_silo_test


@control_silo_test
class SlackRequestTest(TestCase):
    def setUp(self):
        super().setUp()

        self.request = mock.Mock()
        self.request.data = {
            "type": "foo",
            "team_id": "T001",
            "channel": {"id": "1"},
            "user": {"id": "2"},
            "api_app_id": "S1",
        }
        self.request.body = urlencode(self.request.data).encode("utf-8")
        self.request.META = set_signing_secret(
            options.get("slack.signing-secret"), self.request.body
        )

    @cached_property
    def slack_request(self):
        return SlackRequest(self.request)

    @patch("slack_sdk.signature.SignatureVerifier.is_valid")
    def test_validate_using_sdk(self, mock_verify):
        self.create_integration(
            organization=self.organization, external_id="T001", provider="slack"
        )
        self.slack_request.validate()

        mock_verify.assert_called()

    def test_exposes_data(self):
        assert self.slack_request.data["type"] == "foo"

    def test_exposes_team_id(self):
        assert self.slack_request.team_id == "T001"

    def test_collects_logging_data(self):
        assert self.slack_request.logging_data == {
            "slack_team_id": "T001",
            "slack_channel_id": "1",
            "slack_user_id": "2",
            "slack_api_app_id": "S1",
        }

    def test_disregards_None_logging_values(self):
        self.request.data["api_app_id"] = None

        assert self.slack_request.logging_data == {
            "slack_team_id": "T001",
            "slack_channel_id": "1",
            "slack_user_id": "2",
        }

    @pytest.mark.xfail(strict=True, reason="crashes in _log_request before validation can occur")
    def test_returns_400_on_invalid_data(self):
        type(self.request).data = mock.PropertyMock(side_effect=ValueError())

        with pytest.raises(SlackRequestError) as e:
            self.slack_request.validate()
        assert e.value.status == 400

    @override_options({"slack.signing-secret": None})  # force token-auth
    def test_returns_401_on_invalid_token(self):
        self.request.data["token"] = "notthetoken"

        with pytest.raises(SlackRequestError) as e:
            self.slack_request.validate()
        assert e.value.status == 401

    def test_validates_existence_of_integration(self):
        with pytest.raises(SlackRequestError) as e:
            self.slack_request.validate()
        assert e.value.status == 403

    def test_none_in_data(self):
        request = mock.Mock()
        request.data = {
            "type": "foo",
            "team": None,
            "channel": {"id": "1"},
            "user": {"id": "2"},
            "api_app_id": "S1",
        }
        request.body = urlencode(self.request.data).encode("utf-8")
        request.META = (options.get("slack.signing-secret"), self.request.body)

        slack_request = SlackRequest(request)
        assert slack_request.team_id is None
        assert slack_request.logging_data == {
            "slack_channel_id": "1",
            "slack_user_id": "2",
            "slack_api_app_id": "S1",
        }


class SlackEventRequestTest(TestCase):
    def setUp(self):
        super().setUp()

        self.request = mock.Mock()
        self.request.data = {
            "type": "foo",
            "team_id": "T001",
            "event_id": "E1",
            "event": {"type": "bar"},
            "channel": {"id": "1"},
            "user": {"id": "2"},
            "api_app_id": "S1",
        }
        self.request.body = urlencode(self.request.data).encode("utf-8")
        self.request.META = set_signing_secret(
            options.get("slack.signing-secret"), self.request.body
        )

    @cached_property
    def slack_request(self):
        return SlackEventRequest(self.request)

    def test_ignores_event_validation_on_challenge_request(self):
        self.request.data = {
            "token": options.get("slack.verification-token"),
            "challenge": "abc123",
            "type": "url_verification",
        }

        # It would raise if it didn't skip event validation and didn't find
        # the `event` key.
        self.slack_request.validate()

    def test_is_challenge(self):
        self.request.data = {
            "token": options.get("slack.verification-token"),
            "challenge": "abc123",
            "type": "url_verification",
        }

        assert self.slack_request.is_challenge()

    def test_validate_missing_event(self):
        self.request.data.pop("event")

        with pytest.raises(SlackRequestError):
            self.slack_request.validate()

    def test_validate_missing_event_type(self):
        self.request.data["event"] = {}

        with pytest.raises(SlackRequestError):
            self.slack_request.validate()

    def test_type(self):
        assert self.slack_request.type == "bar"

    def test_signing_secret_bad(self):
        self.request.data = {
            "token": options.get("slack.verification-token"),
            "challenge": "abc123",
            "type": "url_verification",
        }
        self.request.body = urlencode(self.request.data).encode("utf-8")

        self.request.META = set_signing_secret("bad_key", self.request.body)
        with pytest.raises(SlackRequestError) as e:
            self.slack_request.validate()
        assert e.value.status == 401

    def test_use_verification_token(self):
        with override_options({"slack.signing-secret": None}):
            self.request.data = {
                "token": options.get("slack.verification-token"),
                "challenge": "abc123",
                "type": "url_verification",
            }
            self.request.body = orjson.dumps(self.request.data)

            self.slack_request.validate()


class SlackActionRequestTest(TestCase):
    def setUp(self):
        super().setUp()

        self.request = mock.Mock()
        self.request.data = {
            "payload": orjson.dumps(
                {
                    "type": "foo",
                    "team": {"id": "T001"},
                    "channel": {"id": "1"},
                    "user": {"id": "2"},
                    "token": options.get("slack.verification-token"),
                    "callback_id": '{"issue":"I1"}',
                }
            ).decode()
        }
        self.request.body = urlencode(self.request.data).encode()
        self.request.META = set_signing_secret(
            options.get("slack.signing-secret"), self.request.body
        )

    @cached_property
    def slack_request(self):
        return SlackActionRequest(self.request)

    def test_type(self):
        assert self.slack_request.type == "foo"

    def test_callback_data(self):
        assert self.slack_request.callback_data == {"issue": "I1"}

    def test_validates_existence_of_payload(self):
        self.request.data.pop("payload")

        with pytest.raises(SlackRequestError):
            self.slack_request.validate()

    def test_validates_payload_json(self):
        self.request.data["payload"] = "notjson"

        with pytest.raises(SlackRequestError):
            self.slack_request.validate()
