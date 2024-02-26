from __future__ import annotations

from logging import Logger, getLogger

from sentry.models.notificationmessage import NotificationMessage

_default_logger: Logger = getLogger(__name__)


class IssueAlertNotificationMessageRepository:
    """
    Repository class that is responsible for querying the data store for notification messages in relation to issue
    alerts.
    """

    _model = NotificationMessage

    def __init__(self, logger: Logger) -> None:
        self._logger: Logger = logger

    @classmethod
    def default(cls) -> IssueAlertNotificationMessageRepository:
        return cls(logger=_default_logger)
