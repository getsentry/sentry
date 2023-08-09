from typing import List, Tuple

import requests
from django.conf import settings

from sentry.runner.commands.presenters.optionspresenter import OptionsPresenter
from sentry.utils import json


class SlackPresenter(OptionsPresenter):
    """
    Sends changes of runtime options made via sentry configoptions
    to a webhook url in a truncated json format. The webhook url can
    be configured to your liking, but for this use case it is ideally
    integrated with Slack.
    """

    MAX_OPTION_VALUE_LENGTH = 30

    def __init__(self) -> None:
        self.drifted_options: List[Tuple[str, str]] = []
        self.channel_updated_options: List[str] = []
        self.updated_options: List[Tuple[str, str, str]] = []
        self.set_options: List[Tuple[str, str]] = []
        self.unset_options: List[str] = []
        self.not_writable_options: List[Tuple[str, str]] = []
        self.unregistered_options: List[str] = []
        self.invalid_type_options: List[Tuple[str, type, type]] = []

    @staticmethod
    def is_slack_enabled():

        if not settings.OPTIONS_AUTOMATOR_SLACK_WEBHOOK_URL:
            return False
        try:
            test_payload: dict = {
                "drifted_options": [],
                "updated_options": [],
                "set_options": [],
                "unset_options": [],
                "not_writable_options": [],
                "unregistered_options": [],
                "invalid_type_options": [],
            }

            response = requests.post(
                settings.OPTIONS_AUTOMATOR_SLACK_WEBHOOK_URL, json=test_payload
            )
            if response.status_code == 200:
                return True

            # Retry the call once to ensure reliability
            response = requests.post(
                settings.OPTIONS_AUTOMATOR_SLACK_WEBHOOK_URL, json=test_payload
            )
            if response.status_code == 200:
                return True
            raise ConnectionError(
                f"Slack integration webhook failed. Status code: {response.status_code}"
            )
        except Exception:
            raise

    def flush(self) -> None:
        json_data = {
            "drifted_options": [
                {"option_name": key, "option_value": self.truncate_value(value)}
                for key, value in self.drifted_options
            ],
            "updated_options": [
                {
                    "option_name": key,
                    "db_value": db_value,
                    "value": self.truncate_value(value),
                }
                for key, db_value, value in self.updated_options
            ],
            "set_options": [
                {"option_name": key, "option_value": self.truncate_value(value)}
                for key, value in self.set_options
            ],
            "unset_options": self.unset_options,
            "not_writable_options": [
                {"option_name": key, "error_msg": msg} for key, msg in self.not_writable_options
            ],
            "unregistered_options": [key for key in self.unregistered_options],
            "invalid_type_options": [
                {"option_name": key, "got_type": str(got_type), "expected_type": str(expected_type)}
                for key, got_type, expected_type in self.invalid_type_options
            ],
        }

        self._send_to_webhook(json_data)

    def truncate_value(self, value: str) -> str:
        if len(value) > self.MAX_OPTION_VALUE_LENGTH:
            return value[: self.MAX_OPTION_VALUE_LENGTH] + "..."
        else:
            return value

    def set(self, key: str, value: str) -> None:
        self.set_options.append((key, value))

    def unset(self, key: str) -> None:
        self.unset_options.append(key)

    def update(self, key: str, db_value: str, value: str) -> None:
        self.updated_options.append((key, db_value, value))

    def channel_update(self, key: str) -> None:
        self.channel_updated_options.append(key)

    def drift(self, key: str, db_value: str) -> None:
        self.drifted_options.append((key, db_value))

    def not_writable(self, key: str, not_writable_reason: str) -> None:
        self.not_writable_options.append((key, not_writable_reason))

    def unregistered(self, key: str) -> None:
        self.unregistered_options.append(key)

    def invalid_type(
        self,
        key: str,
        got_type: type,
        expected_type: type,
    ) -> None:
        self.invalid_type_options.append((key, got_type, expected_type))

    def _send_to_webhook(self, json_data: dict) -> None:
        if settings.OPTIONS_AUTOMATOR_SLACK_WEBHOOK_URL:
            headers = {"Content-Type": "application/json"}
            requests.post(
                settings.OPTIONS_AUTOMATOR_SLACK_WEBHOOK_URL,
                data=json.dumps(json_data),
                headers=headers,
            )
