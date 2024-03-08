from __future__ import annotations

from dataclasses import dataclass
from logging import Logger, getLogger

from sentry.integrations.repository.base import BaseNotificationMessage
from sentry.models.notificationmessage import NotificationMessage
from sentry.models.rulefirehistory import RuleFireHistory

_default_logger: Logger = getLogger(__name__)


@dataclass(frozen=True)
class IssueAlertNotificationMessage(BaseNotificationMessage):
    # TODO(Yash): do we really need this entire model, or can we whittle it down to what we need?
    rule_fire_history: RuleFireHistory | None = None
    rule_action_uuid: str | None = None

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
            rule_fire_history=instance.rule_fire_history,
            rule_action_uuid=instance.rule_action_uuid,
            date_added=instance.date_added,
        )


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

    def get_parent_notification_message(
        self, rule_id: int, group_id: int, rule_action_uuid: str
    ) -> IssueAlertNotificationMessage | None:
        """
        Returns the parent notification message for a metric rule if it exists, otherwise returns None.
        Will raise an exception if the query fails and logs the error with associated data.
        """
        try:
            instance: NotificationMessage = self._model.objects.get(
                rule_fire_history__rule__id=rule_id,
                rule_fire_history__group__id=group_id,
                rule_action_uuid=rule_action_uuid,
                parent_notification_message__isnull=True,
                error_code__isnull=True,
            )
            return IssueAlertNotificationMessage.from_model(instance=instance)
        except NotificationMessage.DoesNotExist:
            return None
        except Exception as e:
            self._logger.exception(
                "Failed to get parent notification for issue rule",
                exc_info=e,
                extra={
                    "rule_id": rule_id,
                    "group_id": group_id,
                    "rule_action_uuid": rule_action_uuid,
                },
            )
            raise
