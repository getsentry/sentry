from sentry.runner.commands.presenters.consolepresenter import ConsolePresenter
from sentry.runner.commands.presenters.slackpresenter import SlackPresenter


class PresenterDelegator:
    def __init__(self) -> None:
        self._consolepresenter = ConsolePresenter()

        self._slackpresenter = None
        if SlackPresenter.is_slack_enabled():
            self._slackpresenter = SlackPresenter()

    def __getattr__(self, attr: str):
        def wrapper(*args, **kwargs):
            getattr(self._consolepresenter, attr)(*args, **kwargs)
            if self._slackpresenter:
                getattr(self._slackpresenter, attr)(*args, **kwargs)

        return wrapper
