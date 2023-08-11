import pytest
import responses
from django.conf import settings

from sentry.runner.commands.presenters.slackpresenter import SlackPresenter
from sentry.utils import json


class TestSlackPresenter:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.slackPresenter = SlackPresenter()
        settings.OPTIONS_AUTOMATOR_SLACK_WEBHOOK_URL = "https://test/"
        settings.SENTRY_REGION = "test_region"

    @responses.activate
    def test_is_slack_enabled(self):
        responses.add(responses.POST, "https://test/", status=200)

        assert self.slackPresenter.is_slack_enabled()
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

        self.slackPresenter.not_writable("option11", "error_reason11")
        self.slackPresenter.not_writable("option12", "error_reason12")

        self.slackPresenter.unregistered("option13")
        self.slackPresenter.unregistered("option14")

        self.slackPresenter.invalid_type("option15", str, int)
        self.slackPresenter.invalid_type("option16", float, int)

        self.slackPresenter.flush()

        expected_json_data = {
            "region": "test_region",
            "drifted_options": [
                {"option_name": "option9", "option_value": "db_value9"},
                {"option_name": "option10", "option_value": "db_value10"},
            ],
            "updated_options": [
                {"option_name": "option5", "db_value": "db_value5", "value": "value5"},
                {"option_name": "option6", "db_value": "db_value6", "value": "value6"},
            ],
            "set_options": [
                {"option_name": "option1", "option_value": "value1"},
                {"option_name": "option2", "option_value": "value2"},
            ],
            "unset_options": ["option3", "option4"],
            "not_writable_options": [
                {"option_name": "option11", "error_msg": "error_reason11"},
                {"option_name": "option12", "error_msg": "error_reason12"},
            ],
            "unregistered_options": ["option13", "option14"],
            "invalid_type_options": [
                {
                    "option_name": "option15",
                    "got_type": "<class 'str'>",
                    "expected_type": "<class 'int'>",
                },
                {
                    "option_name": "option16",
                    "got_type": "<class 'float'>",
                    "expected_type": "<class 'int'>",
                },
            ],
        }

        assert responses.calls[1].response.status_code == 200
        assert expected_json_data == json.loads(responses.calls[1].request.body)

    @responses.activate
    def test_slack_presenter_methods_with_different_types(self):
        responses.add(responses.POST, "https://test/", status=200)

        assert self.slackPresenter.is_slack_enabled()

        self.slackPresenter.set("str_option", "string_value")
        self.slackPresenter.set("bool_option", True)
        self.slackPresenter.set("int_option", 123)
        self.slackPresenter.set("float_option", 3.14)
        self.slackPresenter.set("dict_option", {"key": "value"})
        self.slackPresenter.invalid_type("key1", str, int)
        self.slackPresenter.update("updated", 1.0, 0.0)
        self.slackPresenter.drift("drifted", {"key": "value"})

        self.slackPresenter.flush()

        expected_json_data = {
            "region": "test_region",
            "drifted_options": [{"option_name": "drifted", "option_value": "{'key': 'value'}"}],
            "updated_options": [{"option_name": "updated", "db_value": "1.0", "value": "0.0"}],
            "set_options": [
                {"option_name": "str_option", "option_value": "string_value"},
                {"option_name": "bool_option", "option_value": "True"},
                {"option_name": "int_option", "option_value": "123"},
                {"option_name": "float_option", "option_value": "3.14"},
                {"option_name": "dict_option", "option_value": "{'key': 'value'}"},
            ],
            "unset_options": [],
            "not_writable_options": [],
            "unregistered_options": [],
            "invalid_type_options": [
                {
                    "option_name": "key1",
                    "got_type": "<class 'str'>",
                    "expected_type": "<class 'int'>",
                }
            ],
        }

        assert responses.calls[1].response.status_code == 200
        assert expected_json_data == json.loads(responses.calls[1].request.body)
