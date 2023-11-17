from sentry.runner.commands.presenters.consolepresenter import ConsolePresenter
from sentry.runner.commands.presenters.webhookpresenter import WebhookPresenter


class PresenterDelegator:
    def __init__(self, source: str) -> None:
        self._consolepresenter = ConsolePresenter()

        self._slackpresenter = None
        if WebhookPresenter.is_webhook_enabled():
            self._slackpresenter = WebhookPresenter(source)

    def __getattr__(self, attr: str):
        def wrapper(*args, **kwargs):
            getattr(self._consolepresenter, attr)(*args, **kwargs)
            if self._slackpresenter:
                getattr(self._slackpresenter, attr)(*args, **kwargs)

        return wrapper
