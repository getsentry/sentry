from typing import Any

from sentry.runner.commands.presenters.consolepresenter import ConsolePresenter
from sentry.runner.commands.presenters.optionspresenter import OptionsPresenter
from sentry.runner.commands.presenters.slackpresenter import SlackPresenter


class PresenterDelegator(OptionsPresenter):
    def __init__(self) -> None:
        self.consolepresenter = ConsolePresenter()
        if self.check_slack_webhook_config():
            self.slackpresenter = SlackPresenter()
        self.slackpresenter = None

    def check_slack_webhook_config(self):
        return True

    def flush(self):
        if self.check_slack_webhook_config:
            # if the http request fails, thoughts on outputting to console?
            self.slackpresenter.flush()
        self.consolepresenter.flush()

    def set(self, key: str, value: Any):
        self.consolepresenter.set(key, value)
        if self.slackpresenter:
            self.slackpresenter.set(key, value)

    def unset(self, key: str):
        self.consolepresenter.unset(key)
        if self.slackpresenter:
            self.slackpresenter.unset(key)

    def update(self, key: str, db_value: Any, value: Any):
        self.consolepresenter.update(key, db_value, value)
        if self.slackpresenter:
            self.slackpresenter.update(key, db_value, value)

    def channel_update(self, key: str):
        self.consolepresenter.channel_update(key)
        if self.slackpresenter:
            self.slackpresenter.channel_update(key)

    def drift(self, key: str):
        self.consolepresenter.drift(key)
        if self.slackpresenter:
            self.slackpresenter.drift(key)

    def error(self):
        if self.check_slack_webhook_config:
            self.slackpresenter.error()
        self.consolepresenter.error()
