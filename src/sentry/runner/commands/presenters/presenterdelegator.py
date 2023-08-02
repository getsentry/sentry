from sentry.runner.commands.presenters.consolepresenter import ConsolePresenter
from sentry.runner.commands.presenters.slackpresenter import SlackPresenter


class PresenterDelegator:
    def __init__(self) -> None:
        self.consolepresenter = ConsolePresenter()
        if SlackPresenter.is_slack_enabled():
            self.slackpresenter = SlackPresenter()
        else:
            self.slackpresenter = None

    def __getattr__(self, attr: str):
        def wrapper(*args, **kwargs):
            getattr(self.consolepresenter, attr)(*args, **kwargs)
            if self.slackpresenter:
                getattr(self.slackpresenter, attr)(*args, **kwargs)

        return wrapper
