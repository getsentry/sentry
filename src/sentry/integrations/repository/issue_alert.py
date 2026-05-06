from __future__ import annotations

from collections.abc import Generator
from dataclasses import dataclass
from datetime import datetime
from logging import Logger, getLogger

from django.db.models import Q

from sentry.integrations.repository.base import (
    BaseNewNotificationMessage,
    BaseNotificationMessage,
    NotificationMessageValidationError,
)
from sentry.notifications.models.notificationmessage import NotificationMessage

_default_logger: Logger = getLogger(__name__)


@dataclass(frozen=True)
class IssueAlertNotificationMessage(BaseNotificationMessage):
    # TODO: https://github.com/getsentry/sentry/issues/66751
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


class NewIssueAlertNotificationMessageValidationError(NotificationMessageValidationError):
    pass


class RuleActionUuidValidationError(NewIssueAlertNotificationMessageValidationError):
    message = "rule action uuid is required when a message identifier is set"


@dataclass
class NewIssueAlertNotificationMessage(BaseNewNotificationMessage):
    rule_action_uuid: str | None = None
    open_period_start: datetime | None = None

    def get_validation_error(self) -> Exception | None:
        error = super().get_validation_error()
        if error is not None:
            return error

        if self.message_identifier is not None and self.rule_action_uuid is None:
            return RuleActionUuidValidationError()

        return None


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

    @classmethod
    def _parent_notification_message_base_filter(cls) -> Q:
        """
        Returns the query used to filter the notification messages for parent notification messages.
        Parent notification messages are notification message instances without a parent notification message itself,
        and where the error code is null.
        """
        return Q(parent_notification_message__isnull=True, error_code__isnull=True)

    def get_parent_notification_message(
        self,
        rule_action_uuid: str,
        open_period_start: datetime | None = None,
    ) -> IssueAlertNotificationMessage | None:
        """
        Returns the parent notification message for a metric rule if it exists, otherwise returns None.
        Will raise an exception if the query fails and logs the error with associated data.
        """
        try:
            base_filter = self._parent_notification_message_base_filter()
            instance: NotificationMessage = (
                self._model.objects.filter(base_filter)
                .filter(
                    rule_action_uuid=rule_action_uuid,
                    open_period_start=open_period_start,
                )
                .latest("date_added")
            )
            return IssueAlertNotificationMessage.from_model(instance=instance)
        except NotificationMessage.DoesNotExist:
            return None
        except Exception as e:
            self._logger.warning(
                "Failed to get parent notification for issue rule",
                exc_info=e,
                extra={
                    "rule_action_uuid": rule_action_uuid,
                },
            )
            raise

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

    def get_all_parent_notification_messages_by_filters(
        self,
        open_period_start: datetime | None = None,
    ) -> Generator[IssueAlertNotificationMessage]:
        """
        If no filters are passed, then all parent notification objects are returned.

        Because an unbounded amount of parent notification objects can be returned, this method leverages generator to
        control the usage of memory in the application.
        It is up to the caller to iterate over all the data, or store in memory if they need all objects concurrently.
        """
        open_period_start_filter = (
            Q(open_period_start=open_period_start) if open_period_start else Q()
        )

        query = self._model.objects.filter(open_period_start_filter).filter(
            self._parent_notification_message_base_filter()
        )

        try:
            for instance in query:
                yield IssueAlertNotificationMessage.from_model(instance=instance)
        except Exception as e:
            self._logger.warning(
                "Failed to get parent notifications on filters",
                exc_info=e,
                extra=filter.__dict__,
            )
            raise
