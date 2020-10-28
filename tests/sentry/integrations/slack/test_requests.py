from __future__ import absolute_import

import hmac
import time
import six
from datetime import datetime
from hashlib import sha256
from six.moves.urllib.parse import urlencode

from sentry import options
from sentry.utils import json
from sentry.utils.compat import mock
from sentry.utils.cache import memoize
from sentry.testutils import TestCase
from sentry.testutils.helpers import override_options
from sentry.integrations.slack.requests import (
    SlackRequest,
    SlackEventRequest,
    SlackActionRequest,
    SlackRequestError,
)


class SlackRequestTest(TestCase):
    def setUp(self):
        super(SlackRequestTest, self).setUp()

        self.request = mock.Mock()
        self.request.data = {
            "type": "foo",
            "team_id": "T001",
            "channel": {"id": "1"},
            "user": {"id": "2"},
            "api_app_id": "S1",
        }

    @memoize
    def slack_request(self):
        return SlackRequest(self.request)

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

    def test_validate_existence_of_data(self):
        type(self.request).DATA = mock.PropertyMock(side_effect=ValueError())

        with self.assertRaises(SlackRequestError):
            self.slack_request.validate()

    def test_returns_400_on_invalid_data(self):
        type(self.request).DATA = mock.PropertyMock(side_effect=ValueError())

        with self.assertRaises(SlackRequestError) as e:
            self.slack_request.validate()
            assert e.status == 400

    def test_validates_token(self):
        self.request.data["token"] = "notthetoken"

        with self.assertRaises(SlackRequestError):
            self.slack_request.validate()

    def test_returns_401_on_invalid_token(self):
        self.request.data["token"] = "notthetoken"

        with self.assertRaises(SlackRequestError) as e:
            self.slack_request.validate()
            assert e.status == 401

    def test_validates_existence_of_integration(self):
        with self.assertRaises(SlackRequestError) as e:
            self.slack_request.validate()
            assert e.status == 403


class SlackEventRequestTest(TestCase):
    def setUp(self):
        super(SlackEventRequestTest, self).setUp()

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
        self.request.META = {}

    def set_signature(self, secret, data):
        timestamp = six.text_type(int(time.mktime(datetime.utcnow().timetuple())))
        req = b"v0:%s:%s" % (timestamp.encode("utf-8"), data)

        signature = "v0=" + hmac.new(secret.encode("utf-8"), req, sha256).hexdigest()
        self.request.META["HTTP_X_SLACK_REQUEST_TIMESTAMP"] = timestamp
        self.request.META["HTTP_X_SLACK_SIGNATURE"] = signature

    @memoize
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

        with self.assertRaises(SlackRequestError):
            self.slack_request.validate()

    def test_validate_missing_event_type(self):
        self.request.data["event"] = {}

        with self.assertRaises(SlackRequestError):
            self.slack_request.validate()

    def test_type(self):
        assert self.slack_request.type == "bar"

    def test_signing_secret(self):
        with override_options({"slack.signing-secret": "secret"}):
            self.request.data = {"challenge": "abc123", "type": "url_verification"}

            # we get a url encoded body with Slack
            self.request.body = urlencode(self.request.data).encode("utf-8")

            self.set_signature(options.get("slack.signing-secret"), self.request.body)
            self.slack_request.validate()

    def test_signing_secret_v2(self):
        with override_options({"slack-v2.signing-secret": "secret-v2"}):
            self.request.data = {"challenge": "abc123", "type": "url_verification"}

            # we get a url encoded body with Slack
            self.request.body = urlencode(self.request.data).encode("utf-8")

            self.set_signature(options.get("slack-v2.signing-secret"), self.request.body)
            self.slack_request.validate()

    def test_signing_secret_bad(self):
        with override_options({"slack.signing-secret": "secret"}):
            # even though we provide the token, should still fail
            self.request.data = {
                "token": options.get("slack.verification-token"),
                "challenge": "abc123",
                "type": "url_verification",
            }
            self.request.body = urlencode(self.request.data).encode("utf-8")

            self.set_signature("bad_key", self.request.body)
            with self.assertRaises(SlackRequestError) as e:
                self.slack_request.validate()
                assert e.status == 401

    def test_signing_secret_use_verification_token(self):
        self.request.data = {
            "token": options.get("slack.verification-token"),
            "challenge": "abc123",
            "type": "url_verification",
        }
        self.request.body = json.dumps(self.request.data).encode("utf-8")

        self.slack_request.validate()


class SlackActionRequestTest(TestCase):
    def setUp(self):
        super(SlackActionRequestTest, self).setUp()

        self.request = mock.Mock()
        self.request.data = {
            "payload": json.dumps(
                {
                    "type": "foo",
                    "team": {"id": "T001"},
                    "channel": {"id": "1"},
                    "user": {"id": "2"},
                    "token": options.get("slack.verification-token"),
                    "callback_id": '{"issue":"I1"}',
                }
            )
        }

    @memoize
    def slack_request(self):
        return SlackActionRequest(self.request)

    def test_type(self):
        assert self.slack_request.type == "foo"

    def test_callback_data(self):
        assert self.slack_request.callback_data == {"issue": "I1"}

    def test_validates_existence_of_payload(self):
        self.request.data.pop("payload")

        with self.assertRaises(SlackRequestError):
            self.slack_request.validate()

    def test_validates_payload_json(self):
        self.request.data["payload"] = "notjson"

        with self.assertRaises(SlackRequestError):
            self.slack_request.validate()
