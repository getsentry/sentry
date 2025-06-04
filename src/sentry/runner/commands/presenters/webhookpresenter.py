import hashlib
import hmac
from typing import Any

import requests
from django.conf import settings

from sentry import options
from sentry.runner.commands.presenters.optionspresenter import OptionsPresenter
from sentry.utils import json


class WebhookPresenter(OptionsPresenter):
    """
    Sends changes of runtime options made via sentry configoptions
    to a webhook url in a truncated json format. The webhook url can
    be configured to your liking.
    """

    MAX_OPTION_VALUE_LENGTH = 30

    def __init__(self, source: str) -> None:
        self.source = source
        self.drifted_options: list[tuple[str, Any]] = []
        self.channel_updated_options: list[str] = []
        self.updated_options: list[tuple[str, Any, Any]] = []
        self.set_options: list[tuple[str, Any]] = []
        self.unset_options: list[str] = []
        self.not_writable_options: list[tuple[str, str]] = []
        self.unregistered_options: list[str] = []
        self.invalid_type_options: list[tuple[str, type, type]] = []

    @staticmethod
    def is_webhook_enabled() -> bool:
        return bool(
            options.get("options_automator_slack_webhook_enabled")
            and settings.OPTIONS_AUTOMATOR_SLACK_WEBHOOK_URL
        )

    def flush(self) -> None:
        if (
            not self.drifted_options
            and not self.channel_updated_options
            and not self.updated_options
            and not self.set_options
            and not self.unset_options
            and not self.not_writable_options
            and not self.unregistered_options
            and not self.invalid_type_options
        ):
            return

        region: str | None = (
            settings.SENTRY_REGION
            if settings.SENTRY_REGION
            else settings.CUSTOMER_ID if settings.CUSTOMER_ID else settings.SILO_MODE
        )

        json_data = {
            "region": region,
            "source": self.source,
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

    def unset(self, key: str) -> None:
        self.unset_options.append(key)

    def update(self, key: str, db_value: Any, value: Any) -> None:
        self.updated_options.append((key, db_value, value))

    def channel_update(self, key: str) -> None:
        self.channel_updated_options.append(key)

    def drift(self, key: str, db_value: Any) -> None:
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

    def _send_to_webhook(self, json_data: dict[str, Any]) -> None:
        if settings.OPTIONS_AUTOMATOR_SLACK_WEBHOOK_URL:
            headers = {
                "Content-Type": "application/json",
            }
            payload = json.dumps(json_data).encode("utf-8")
            webhook_secret = settings.OPTIONS_AUTOMATOR_HMAC_SECRET
            # If the webhook secret is set, we need to sign the payload
            if webhook_secret is not None:
                signature = hmac.new(
                    webhook_secret.encode("utf-8"), payload, hashlib.sha256
                ).hexdigest()
                headers["x-sentry-options-signature"] = signature

            requests.post(
                settings.OPTIONS_AUTOMATOR_SLACK_WEBHOOK_URL,
                data=payload,
                headers=headers,
            ).raise_for_status()
