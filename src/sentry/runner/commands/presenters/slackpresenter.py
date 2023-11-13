from typing import Any, List, Optional, Tuple

import requests
from django.conf import settings
from requests.exceptions import HTTPError, RequestException

from sentry import options
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
        self.drifted_options: List[Tuple[str, Any]] = []
        self.channel_updated_options: List[str] = []
        self.updated_options: List[Tuple[str, Any, Any]] = []
        self.set_options: List[Tuple[str, Any]] = []
        self.unset_options: List[str] = []
        self.not_writable_options: List[Tuple[str, str]] = []
        self.unregistered_options: List[str] = []
        self.invalid_type_options: List[Tuple[str, type, type]] = []
        self.options_changed = False

    @staticmethod
    def is_slack_enabled():
        return (
            options.get("options_automator_slack_webhook_enabled")
            and settings.OPTIONS_AUTOMATOR_SLACK_WEBHOOK_URL
        )

    def flush(self) -> None:
        if not self.options_changed:
            return

        region: Optional[str] = settings.SENTRY_REGION
        if not region:
            region = settings.CUSTOMER_ID

        json_data = {
            "region": region,
            "drifted_options": [
                {"option_name": key, "option_value": self.truncate_value(value)}
                for key, value in self.drifted_options
            ],
            "updated_options": [
                {
                    "option_name": key,
                    "db_value": self.truncate_value(db_value),
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
        value_str = str(value)
        if len(value_str) > self.MAX_OPTION_VALUE_LENGTH:
            return value_str[: self.MAX_OPTION_VALUE_LENGTH] + "..."
        else:
            return value_str

    def set(self, key: str, value: Any) -> None:
        self.set_options.append((key, value))
        self.options_changed = True

    def unset(self, key: str) -> None:
        self.unset_options.append(key)
        self.options_changed = True

    def update(self, key: str, db_value: Any, value: Any) -> None:
        self.updated_options.append((key, db_value, value))
        self.options_changed = True

    def channel_update(self, key: str) -> None:
        self.channel_updated_options.append(key)

    def drift(self, key: str, db_value: Any) -> None:
        self.drifted_options.append((key, db_value))
        self.options_changed = True

    def not_writable(self, key: str, not_writable_reason: str) -> None:
        self.not_writable_options.append((key, not_writable_reason))
        self.options_changed = True

    def unregistered(self, key: str) -> None:
        self.unregistered_options.append(key)
        self.options_changed = True

    def invalid_type(
        self,
        key: str,
        got_type: type,
        expected_type: type,
    ) -> None:
        self.invalid_type_options.append((key, got_type, expected_type))
        self.options_changed = True

    def _send_to_webhook(self, json_data: dict) -> None:
        if settings.OPTIONS_AUTOMATOR_SLACK_WEBHOOK_URL:
            headers = {"Content-Type": "application/json"}
            try:
                response = requests.post(
                    settings.OPTIONS_AUTOMATOR_SLACK_WEBHOOK_URL,
                    data=json.dumps(json_data),
                    headers=headers,
                )
                response.raise_for_status()
            except HTTPError as http_err:
                raise ConnectionError(f"HTTP error occurred: {http_err}") from None
            except RequestException as req_err:
                raise ConnectionError(f"Network-related error occurred: {req_err}") from None
