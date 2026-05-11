from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from logging import Logger, getLogger

from sentry.integrations.repository.base import (
    BaseNewNotificationMessage,
    BaseNotificationMessage,
)
from sentry.notifications.models.notificationmessage import NotificationMessage

_default_logger: Logger = getLogger(__name__)


@dataclass(frozen=True)
class IssueAlertNotificationMessage(BaseNotificationMessage):
    rule_action_uuid: str | None = None
    open_period_start: datetime | None = None

    @classmethod
    def from_model(cls, instance: NotificationMessage) -> IssueAlertNotificationMessage:
        return IssueAlertNotificationMessage(
            id=instance.id,
            error_code=instance.error_code,
            error_details=instance.error_details,
            message_identifier=instance.message_identifier,
            parent_notification_message_id=(
                instance.parent_notification_message.id
                if instance.parent_notification_message
                else None
            ),
            rule_action_uuid=instance.rule_action_uuid,
            open_period_start=instance.open_period_start,
            date_added=instance.date_added,
        )


@dataclass
class NewIssueAlertNotificationMessage(BaseNewNotificationMessage):
    rule_action_uuid: str | None = None
    open_period_start: datetime | None = None


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

    def create_notification_message(
        self, data: NewIssueAlertNotificationMessage
    ) -> IssueAlertNotificationMessage:
        if (error := data.get_validation_error()) is not None:
            raise error

        try:
            new_instance = self._model.objects.create(
                error_details=data.error_details,
                error_code=data.error_code,
                message_identifier=data.message_identifier,
                parent_notification_message_id=data.parent_notification_message_id,
                rule_action_uuid=data.rule_action_uuid,
                open_period_start=data.open_period_start,
            )
            return IssueAlertNotificationMessage.from_model(instance=new_instance)
        except Exception as e:
            self._logger.warning(
                "failed to create new issue alert notification alert",
                exc_info=e,
                extra=data.__dict__,
            )
            raise
