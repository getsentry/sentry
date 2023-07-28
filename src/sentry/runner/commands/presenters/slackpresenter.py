from typing import Any

import requests

from sentry.runner.commands.presenters.optionspresenter import OptionsPresenter
from sentry.utils import json


class SlackPresenter(OptionsPresenter):
    def __init__(self, dry_run) -> None:
        self.drifted_options = []
        self.channel_updated_options = []
        self.updated_options = []
        self.set_options = []
        self.unset_options = []
        self.error_options = []
        self.dry_run = dry_run

    def flush(self):
        json_data = {
            # todo: how to grab the region and user responsible.
            # env variables?
            "region": None,
            "user_responsible": None,
            "dry-run": self.dry_run,
            "drifted_options": self.drifted_options,
            "channel_updated_options": self.channel_updated_options,
            "updated_options": self.updated_options,
            "set_options": self.set_options,
            "unset_options": self.unset_options,
            "error_options": self.error_options,
        }

        self.send_to_webhook(json_data)

    def set(self, key: str, value: Any):
        self.set_options.append((key, value))

    def unset(self, key: str):
        self.unset_options.append(key)

    def update(self, key: str, db_value: Any, value: Any):
        self.update_options.append((key, db_value, value))

    def channel_update(self, key: str):
        self.channel_updated_options.append(key)

    def drift(self, key: str):
        self.drifted_options(key)

    def error(self, key: str, not_writable_reason: str):
        self.error_options.append((key, not_writable_reason))

    def send_to_webhook(json_data):
        headers = {"Content-Type": "application/json"}
        # todo: change webhook url (pass in as k8s secret? eng pipes is public)
        # send http post request to engpipes webhook
        # figure out how to add env var k8s secrets?
        # how to pass along which region (as part of secrets)
        requests.post("url", data=json.dumps(json_data), headers=headers)
