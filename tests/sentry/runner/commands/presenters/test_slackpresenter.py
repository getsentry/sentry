from unittest.mock import patch

import pytest
from requests_mock.mocker import Mocker

from sentry.runner.commands.presenters.slackpresenter import SlackPresenter


class TestSlackPresenter:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.slackPresenter = SlackPresenter()
        self.TEST_SLACK_WEBHOOK_URL = "https://test/"

    @patch("sentry.runner.commands.presenters.slackpresenter.SLACK_WEBHOOK_URL", "https://test/")
    def test_is_slack_enabled(self, requests_mock: Mocker):
        requests_mock.post(self.TEST_SLACK_WEBHOOK_URL)
        self.slackPresenter.set("option1", "value1")
        self.slackPresenter.set("option2", "value2")

        self.slackPresenter.unset("option3")
        self.slackPresenter.unset("option4")

        self.slackPresenter.update("option5", "db_value5", "value5")
        self.slackPresenter.update("option6", "db_value6", "value6")

        self.slackPresenter.channel_update("option7")
        self.slackPresenter.channel_update("option8")

        self.slackPresenter.drift("option9", "db_value9")
        self.slackPresenter.drift("option10", "db_value10")

        self.slackPresenter.error("option11", "error_reason11")
        self.slackPresenter.error("option12", "error_reason12")

        self.slackPresenter.unregistered("option13")
        self.slackPresenter.unregistered("option14")

        self.slackPresenter.invalid_type("option15", "got_type15", "expected_type15")
        self.slackPresenter.invalid_type("option16", "got_type16", "expected_type16")

        # Call flush to send the data to the webhook (for this specific test, we don't need to send an HTTP request)
        self.slackPresenter.flush()

        # Assertions
        expected_json_data = {
            "set_options": [
                {"option_name": "option1", "option_value": "value1"},
                {"option_name": "option2", "option_value": "value2"},
            ],
            "unset_options": ["option3", "option4"],
            "updated_options": [
                {"option_name": "option5", "db_value": "db_value5", "value": "value5"},
                {"option_name": "option6", "db_value": "db_value6", "value": "value6"},
            ],
            "channel_updated_options": ["option7", "option8"],
            "drifted_options": [
                {"option_name": "option9", "option_value": "db_value9..."},
                {"option_name": "option10", "option_value": "db_value10..."},
            ],
            "error_options": [
                {"option_name": "option11", "error_msg": "error_reason11"},
                {"option_name": "option12", "error_msg": "error_reason12"},
            ],
            "unregistered_options": ["option13", "option14"],
            "invalid_type_options": [
                {
                    "option_name": "option15",
                    "got_type": "got_type15",
                    "expected_type": "expected_type15",
                },
                {
                    "option_name": "option16",
                    "got_type": "got_type16",
                    "expected_type": "expected_type16",
                },
            ],
        }

        assert len(requests_mock.request_history) == 1
        assert requests_mock.request_history[0].method == "POST"
        assert requests_mock.request_history[0].url == self.TEST_SLACK_WEBHOOK_URL
        assert expected_json_data == requests_mock.request_history[0].json()
