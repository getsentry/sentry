from sentry.runner.commands.presenters.consolepresenter import ConsolePresenter
from sentry.runner.commands.presenters.slackpresenter import SlackPresenter


class PresenterDelegator:
    def __init__(self) -> None:
        self.__consolepresenter = ConsolePresenter()

        self.__slackpresenter = None
        if SlackPresenter.is_slack_enabled():
            self.__slackpresenter = SlackPresenter()

    def __getattr__(self, attr: str):
        def wrapper(*args, **kwargs):
            getattr(self.__consolepresenter, attr)(*args, **kwargs)
            if self.__slackpresenter:
                getattr(self.__slackpresenter, attr)(*args, **kwargs)

        return wrapper
