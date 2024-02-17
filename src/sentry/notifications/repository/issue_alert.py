from __future__ import annotations

from logging import Logger, getLogger

from sentry.models.notificationmessage import NotificationMessage

_default_logger: Logger = getLogger(__name__)


class IssueAlertNotificationMessageRepository:
    """
    Repository class that is responsible for querying the data store for notification messages in relation to issue
    alerts.
    """

    _model: NotificationMessage = NotificationMessage

    def __init__(self, logger: Logger) -> None:
        self._logger: Logger = logger

    @classmethod
    def default(cls) -> IssueAlertNotificationMessageRepository:
        return cls(logger=_default_logger)

    def get_parent_message_identifier(
        self, group_id: int, rule_id: int, event_id: str, rule_action_uuid: str
    ) -> str | None:
        """
        Returns the message identifier for an alert rule if it exists, otherwise returns None.
        Will raise an exception if the query fails and logs the error with associated data.
        """
        try:
            notification_message = self._model.objects.get(
                rule_fire_history__group__id=group_id,
                rule_fire_history__rule__id=rule_id,
                rule_fire_history__event_id=event_id,
                rule_action_uuid=rule_action_uuid,
                parent_notification_message__isnull=True,
                error_code__isnull=True,
            )
            return notification_message.message_identifier
        except NotificationMessage.DoesNotExist:
            return None
        except Exception as e:
            self._logger.exception(
                "Failed to get parent message identifier for alert rule",
                exc_info=e,
                extra={
                    "group_id": group_id,
                    "rule_id": rule_id,
                    "event_id": event_id,
                    "rule_action_uuid": rule_action_uuid,
                },
            )
