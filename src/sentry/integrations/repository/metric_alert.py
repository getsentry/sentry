from __future__ import annotations

from dataclasses import dataclass
from logging import Logger, getLogger

from sentry.incidents.models.alert_rule import AlertRuleTriggerAction
from sentry.incidents.models.incident import Incident
from sentry.integrations.repository.base import (
    BaseNewNotificationMessage,
    BaseNotificationMessage,
    NotificationMessageValidationError,
)
from sentry.notifications.models.notificationmessage import NotificationMessage

_default_logger: Logger = getLogger(__name__)


@dataclass(frozen=True)
class MetricAlertNotificationMessage(BaseNotificationMessage):
    # TODO: https://github.com/getsentry/sentry/issues/66751
    incident: Incident | None = None
    # TODO: https://github.com/getsentry/sentry/issues/66751
    trigger_action: AlertRuleTriggerAction | None = None

    @classmethod
    def from_model(cls, instance: NotificationMessage) -> MetricAlertNotificationMessage:
        return MetricAlertNotificationMessage(
            id=instance.id,
            error_code=instance.error_code,
            error_details=instance.error_details,
            message_identifier=instance.message_identifier,
            parent_notification_message_id=(
                instance.parent_notification_message.id
                if instance.parent_notification_message
                else None
            ),
            incident=instance.incident,
            trigger_action=instance.trigger_action,
            date_added=instance.date_added,
        )


class NewMetricAlertNotificationMessageValidationError(NotificationMessageValidationError):
    pass


class IncidentAndTriggerActionValidationError(NewMetricAlertNotificationMessageValidationError):
    message = "both incident and trigger action need to exist together with a reference"


@dataclass
class NewMetricAlertNotificationMessage(BaseNewNotificationMessage):
    incident_id: int | None = None
    trigger_action_id: int | None = None

    def get_validation_error(self) -> Exception | None:
        error = super().get_validation_error()
        if error is not None:
            return error

        if self.message_identifier is not None:
            # If a message_identifier exists, that means a successful notification happened for an incident and trigger
            # This means that neither of them can be empty
            if self.incident_id is None or self.trigger_action_id is None:
                return IncidentAndTriggerActionValidationError()

        # We can create a NotificationMessage if it has both, or neither, of incident and trigger.
        # The following is an XNOR check for incident and trigger
        if (self.incident_id is not None) != (self.trigger_action_id is not None):
            return IncidentAndTriggerActionValidationError()

        return None


class MetricAlertNotificationMessageRepository:
    """
    Repository class that is responsible for querying the data store for notification messages in relation to metric
    alerts.
    """

    _model = NotificationMessage

    def __init__(self, logger: Logger) -> None:
        self._logger: Logger = logger

    @classmethod
    def default(cls) -> MetricAlertNotificationMessageRepository:
        return cls(logger=_default_logger)

    def get_parent_notification_message(
        self, alert_rule_id: int, incident_id: int, trigger_action_id: int
    ) -> MetricAlertNotificationMessage | None:
        """
        Returns the parent notification message for a metric rule if it exists, otherwise returns None.
        Will raise an exception if the query fails and logs the error with associated data.
        """
        try:
            instance: NotificationMessage = self._model.objects.get(
                incident__alert_rule__id=alert_rule_id,
                incident__id=incident_id,
                trigger_action__id=trigger_action_id,
                parent_notification_message__isnull=True,
                error_code__isnull=True,
            )
            return MetricAlertNotificationMessage.from_model(instance=instance)
        except NotificationMessage.DoesNotExist:
            return None
        except Exception as e:
            self._logger.exception(
                "Failed to get parent notification for metric rule",
                exc_info=e,
                extra={
                    "incident_id": incident_id,
                    "alert_rule_id": alert_rule_id,
                    "trigger_action_id": trigger_action_id,
                },
            )
            raise

    def create_notification_message(
        self, data: NewMetricAlertNotificationMessage
    ) -> MetricAlertNotificationMessage:
        if (error := data.get_validation_error()) is not None:
            raise error

        try:
            new_instance = self._model.objects.create(
                error_details=data.error_details,
                error_code=data.error_code,
                message_identifier=data.message_identifier,
                parent_notification_message_id=data.parent_notification_message_id,
                incident_id=data.incident_id,
                trigger_action_id=data.trigger_action_id,
            )
            return MetricAlertNotificationMessage.from_model(instance=new_instance)
        except Exception as e:
            self._logger.exception(
                "failed to create new metric alert notification alert",
                exc_info=e,
                extra=data.__dict__,
            )
            raise
