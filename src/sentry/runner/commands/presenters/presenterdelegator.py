from typing import Any

from sentry.runner.commands.presenters.consolepresenter import ConsolePresenter
from sentry.runner.commands.presenters.webhookpresenter import WebhookPresenter


class PresenterDelegator:
    def __init__(self, source: str, dry_run: bool) -> None:
        from sentry.runner.commands.presenters.audit_log_presenter import AuditLogPresenter

        self._consolepresenter = ConsolePresenter()

        self._slackpresenter = None
        if WebhookPresenter.is_webhook_enabled():
            self._slackpresenter = WebhookPresenter(source)
        if AuditLogPresenter.is_webhook_enabled():
            self._auditlogpresenter = AuditLogPresenter(source, dry_run)

    def __getattr__(self, attr: str) -> Any:
        def wrapper(*args: Any, **kwargs: Any) -> None:
            getattr(self._consolepresenter, attr)(*args, **kwargs)
            if self._slackpresenter:
                getattr(self._slackpresenter, attr)(*args, **kwargs)
            if self._auditlogpresenter:
                getattr(self._auditlogpresenter, attr)(*args, **kwargs)

        return wrapper
