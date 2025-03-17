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
from sentry.models.group import Group
from sentry.notifications.models.notificationmessage import NotificationMessage
from sentry.workflow_engine.models import Action

_default_logger: Logger = getLogger(__name__)


@dataclass(frozen=True)
class NotificationActionNotificationMessage(BaseNotificationMessage):
    action: Action | None = None
    group: Group | None = None
    open_period_start: datetime | None = None

    @classmethod
    def from_model(cls, instance: NotificationMessage) -> NotificationActionNotificationMessage:
        return NotificationActionNotificationMessage(
            id=instance.id,
            error_code=instance.error_code,
            error_details=instance.error_details,
            message_identifier=instance.message_identifier,
            parent_notification_message_id=(
                instance.parent_notification_message.id
                if instance.parent_notification_message
                else None
            ),
            action=instance.action,
            group=instance.group,
            open_period_start=instance.open_period_start,
            date_added=instance.date_added,
        )


class NotificationActionNotificationMessageValidationError(NotificationMessageValidationError):
    pass


class ActionAndGroupActionValidationError(NotificationActionNotificationMessageValidationError):
    message = "both action and group need to exist together with a reference"


@dataclass
class NewNotificationActionNotificationMessage(BaseNewNotificationMessage):
    action_id: int | None = None
    group_id: int | None = None
    open_period_start: datetime | None = None

    def get_validation_error(self) -> Exception | None:
        error = super().get_validation_error()
        if error is not None:
            return error

        if self.message_identifier is not None:
            # If a message_identifier exists, that means a successful notification happened for a rule action and fire
            # This means that neither of them can be empty
            if self.action_id is None or self.group_id is None:
                return ActionAndGroupActionValidationError()

        # We can create a NotificationMessage if it has both, or neither, of action and group.
        # The following is an XNOR check for action and group
        if (self.action_id is not None) != (self.group_id is not None):
            return ActionAndGroupActionValidationError()

        return None


class NotificationActionNotificationMessageRepository:
    """
    Repository class that is responsible for querying the data store for notification messages in relation to notification actions.
    """

    _model = NotificationMessage

    def __init__(self, logger: Logger) -> None:
        self._logger: Logger = logger

    @classmethod
    def default(cls) -> NotificationActionNotificationMessageRepository:
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
        action: Action,
        group: Group,
        open_period_start: datetime | None = None,
    ) -> NotificationActionNotificationMessage | None:
        """
        Returns the parent notification message if it exists, otherwise returns None.
        Will raise an exception if the query fails and logs the error with associated data.
        """
        try:
            base_filter = self._parent_notification_message_base_filter()
            instance: NotificationMessage = (
                self._model.objects.filter(base_filter)
                .filter(
                    action=action,
                    group=group,
                    open_period_start=open_period_start,
                )
                .latest("date_added")
            )
            return NotificationActionNotificationMessage.from_model(instance=instance)
        except NotificationMessage.DoesNotExist:
            return None
        except Exception as e:
            self._logger.exception(
                "Failed to get parent notification for issue rule",
                exc_info=e,
                extra={
                    "action": action,
                    "group": group,
                },
            )
            raise

    def create_notification_message(
        self, data: NewNotificationActionNotificationMessage
    ) -> NotificationActionNotificationMessage:
        if (error := data.get_validation_error()) is not None:
            raise error

        try:
            instance = self._model.objects.create(
                action_id=data.action_id,
                group_id=data.group_id,
                open_period_start=data.open_period_start,
                error_details=data.error_details,
                error_code=data.error_code,
                message_identifier=data.message_identifier,
                parent_notification_message_id=data.parent_notification_message_id,
            )
            return NotificationActionNotificationMessage.from_model(instance=instance)
        except Exception as e:
            self._logger.exception(
                "failed to create new notification action notification message",
                exc_info=e,
                extra=data.__dict__,
            )
            raise

    def get_all_parent_notification_messages_by_filters(
        self,
        action_ids: list[int] | None = None,
        group_ids: list[int] | None = None,
        open_period_start: datetime | None = None,
    ) -> Generator[NotificationActionNotificationMessage]:
        """
        If no filters are passed, then all parent notification objects are returned.

        Because an unbounded amount of parent notification objects can be returned, this method leverages generator to
        control the usage of memory in the application.
        It is up to the caller to iterate over all the data, or store in memory if they need all objects concurrently.
        """
        action_id_filter = Q(action__id__in=action_ids) if action_ids else Q()
        group_id_filter = Q(group__id__in=group_ids) if group_ids else Q()
        open_period_start_filter = (
            Q(open_period_start=open_period_start) if open_period_start else Q()
        )

        query = self._model.objects.filter(
            action_id_filter & group_id_filter & open_period_start_filter
        ).filter(self._parent_notification_message_base_filter())

        try:
            for instance in query:
                yield NotificationActionNotificationMessage.from_model(instance=instance)
        except Exception as e:
            self._logger.exception(
                "Failed to get parent notifications on filters",
                exc_info=e,
                extra=filter.__dict__,
            )
            raise
