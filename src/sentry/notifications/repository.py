from logging import Logger

from sentry.models.notificationmessage import NotificationMessage


class NotificationMessageRepository:
    """
    A repository class is responsible for the interactions with the data store for the NotificationMessage data model.
    The class helps separate the query interface with the actual data store for the NotificationMessage data model.

    If we scale quickly, the current NotificationMessage data model will have to shift from django postgres to
    snuba clickhouse, and this class will help keep the changes consolidated to here.
    What we query from an interface level won't change, simply how we query will change, and this class should be the
    only thing that needs to change after we make the migration.
    """

    _model: NotificationMessage = NotificationMessage

    def __init__(self, logger: Logger) -> None:
        self._logger: Logger = logger

    def get_parent_message_identifier_for_issue_alert(
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

    def get_parent_message_identifier_for_metric_alert(
        self, alert_rule_id: int, incident_id: int, trigger_action_id: int
    ) -> str | None:
        """
        Returns the message identifier for a metric rule if it exists, otherwise returns None.
        Will raise an exception if the query fails and logs the error with associated data.
        """
        try:
            notification_message = self._model.objects.get(
                incident__alert_rule__id=alert_rule_id,
                incident__id=incident_id,
                trigger_action__id=trigger_action_id,
                parent_notification_message__isnull=True,
                error_code__isnull=True,
            )
            return notification_message.message_identifier
        except NotificationMessage.DoesNotExist:
            return None
        except Exception as e:
            self._logger.exception(
                "Failed to get parent message identifier for metric rule",
                exc_info=e,
                extra={
                    "incident_id": incident_id,
                    "alert_rule_id": alert_rule_id,
                    "trigger_action_id": trigger_action_id,
                },
            )
