from typing import Any

from sentry.runner.commands.presenters.consolepresenter import ConsolePresenter
from sentry.runner.commands.presenters.optionspresenter import OptionsPresenter
from sentry.runner.commands.presenters.slackpresenter import SlackPresenter


class PresenterDelegator(OptionsPresenter):
    def __init__(self) -> None:
        self.consolepresenter = ConsolePresenter()
        self.slackpresenter = SlackPresenter()

    def __getattr__(self, name, *args):
        getattr(self.slackpresenter, name)(*args)
        getattr(self.consolepresenter, name)(*args)

    def check_slack_webhook_config(self):
        return True

    def flush(self):
        self.__getattr__("flush")

    def set(self, key: str, value: Any):
        self.__getattr__("set", key, value)

    def unset(self, key: str):
        self.__getattr__("unset", key)

    def update(self, key: str, db_value: Any, value: Any):
        self.__getattr__("update", key, db_value, value)

    def channel_update(self, key: str):
        self.__getattr__("channel_update", key)

    def drift(self, key: str, db_value: Any):
        self.__getattr__("drift", key, db_value)

    def error(self, key: str, not_writable_reason: str):
        self.__getattr__("error", key, not_writable_reason)
