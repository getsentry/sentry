from __future__ import absolute_import

import json
import mock

from sentry import options
from sentry.utils.cache import memoize
from sentry.testutils import TestCase
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
        self.request.DATA = {
            'type': 'foo',
            'team_id': 'T001',
            'channel': {'id': '1'},
            'user': {'id': '2'},
            'api_app_id': 'S1',
        }

    @memoize
    def slack_request(self):
        return SlackRequest(self.request)

    def test_exposes_data(self):
        assert self.slack_request.data['type'] == 'foo'

    def test_exposes_team_id(self):
        assert self.slack_request.team_id == 'T001'

    def test_collects_logging_data(self):
        assert self.slack_request.logging_data == {
            'slack_team_id': 'T001',
            'slack_channel_id': '1',
            'slack_user_id': '2',
            'slack_api_app_id': 'S1',
        }

    def test_disregards_None_logging_values(self):
        self.request.DATA['api_app_id'] = None

        assert self.slack_request.logging_data == {
            'slack_team_id': 'T001',
            'slack_channel_id': '1',
            'slack_user_id': '2',
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
        self.request.DATA['token'] = 'notthetoken'

        with self.assertRaises(SlackRequestError):
            self.slack_request.validate()

    def test_returns_401_on_invalid_token(self):
        self.request.DATA['token'] = 'notthetoken'

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
        self.request.DATA = {
            'type': 'foo',
            'team_id': 'T001',
            'event_id': 'E1',
            'event': {'type': 'bar'},
            'channel': {'id': '1'},
            'user': {'id': '2'},
            'api_app_id': 'S1',
        }

    @memoize
    def slack_request(self):
        return SlackEventRequest(self.request)

    def test_ignores_event_validation_on_challenge_request(self):
        self.request.DATA = {
            'token': options.get('slack.verification-token'),
            'challenge': 'abc123',
            'type': 'url_verification',
        }

        # It would raise if it didn't skip event validation and didn't find
        # the `event` key.
        self.slack_request.validate()

    def test_is_challenge(self):
        self.request.DATA = {
            'token': options.get('slack.verification-token'),
            'challenge': 'abc123',
            'type': 'url_verification',
        }

        assert self.slack_request.is_challenge()

    def test_validate_missing_event(self):
        self.request.DATA.pop('event')

        with self.assertRaises(SlackRequestError):
            self.slack_request.validate()

    def test_validate_missing_event_type(self):
        self.request.DATA['event'] = {}

        with self.assertRaises(SlackRequestError):
            self.slack_request.validate()

    def test_type(self):
        assert self.slack_request.type == 'bar'


class SlackActionRequestTest(TestCase):
    def setUp(self):
        super(SlackActionRequestTest, self).setUp()

        self.request = mock.Mock()
        self.request.DATA = {
            'payload': json.dumps({
                'type': 'foo',
                'team': {'id': 'T001'},
                'channel': {'id': '1'},
                'user': {'id': '2'},
                'token': options.get('slack.verification-token'),
                'callback_id': '{"issue":"I1"}',
            })
        }

    @memoize
    def slack_request(self):
        return SlackActionRequest(self.request)

    def test_type(self):
        assert self.slack_request.type == 'foo'

    def test_callback_data(self):
        assert self.slack_request.callback_data == {'issue': 'I1'}

    def test_validates_existence_of_payload(self):
        self.request.DATA.pop('payload')

        with self.assertRaises(SlackRequestError):
            self.slack_request.validate()

    def test_validates_payload_json(self):
        self.request.DATA['payload'] = 'notjson'

        with self.assertRaises(SlackRequestError):
            self.slack_request.validate()
