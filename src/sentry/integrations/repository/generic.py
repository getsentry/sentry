from __future__ import annotations

from collections.abc import Generator
from dataclasses import dataclass
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
class GenericNotificationMessage(BaseNotificationMessage):
    composite_key: str | None = None
    group_id: int | None = None

    @classmethod
    def from_model(cls, instance: NotificationMessage) -> GenericNotificationMessage:
        return GenericNotificationMessage(
            id=instance.id,
            error_code=instance.error_code,
            error_details=instance.error_details,
            message_identifier=instance.message_identifier,
            parent_notification_message_id=(
                instance.parent_notification_message.id
                if instance.parent_notification_message
                else None
            ),
            composite_key=instance.composite_key,
            group_id=instance.group_id,
            date_added=instance.date_added,
        )


class GenericNotificationMessageValidationError(NotificationMessageValidationError):
    pass


class CompositeKeyValidationError(GenericNotificationMessageValidationError):
    message = "composite key is required and cannot set other FK fields"


@dataclass
class NewGenericNotificationMessage(BaseNewNotificationMessage):
    composite_key: str | None = None
    group_id: int | None = None

    def get_validation_error(self) -> Exception | None:
        error = super().get_validation_error()
        if error is not None:
            return error

        # If a message_identifier exists, that means a successful notification happened for a rule action and fire
        # This means that composite key must exist
        if self.message_identifier is None:
            if self.composite_key is None:
                return CompositeKeyValidationError()

        # Group ID cannot exist without a composite key
        if self.group_id is not None and self.composite_key is None:
            return CompositeKeyValidationError()


class GenericNotificationMessageRepository:
    """Generic repository class for notification message operations."""

    _model = NotificationMessage

    def __init__(self, logger: Logger) -> None:
        self._logger: Logger = logger

    @classmethod
    def default(cls) -> GenericNotificationMessageRepository:
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
        self, composite_key: str
    ) -> GenericNotificationMessage | None:
        """
        Returns the parent notification message for a given composite key if it exists, otherwise returns None.
        Will raise an exception if the query fails and logs the error with associated data.
        """
        try:
            base_filter = self._parent_notification_message_base_filter()
            instance = (
                self._model.objects.filter(base_filter)
                .filter(composite_key=composite_key)
                .latest("date_added")
            )
            return GenericNotificationMessage.from_model(instance=instance)
        except NotificationMessage.DoesNotExist:
            return None
        except Exception as e:
            self._logger.exception(
                "Failed to get parent notification by composite key",
                exc_info=e,
                extra={"composite_key": composite_key},
            )
            raise

    def create_notification_message(
        self, data: NewGenericNotificationMessage
    ) -> GenericNotificationMessage:
        if (error := data.get_validation_error()) is not None:
            raise error

        try:
            new_instance = self._model.objects.create(
                error_details=data.error_details,
                error_code=data.error_code,
                message_identifier=data.message_identifier,
                parent_notification_message_id=data.parent_notification_message_id,
                composite_key=data.composite_key,
                group_id=data.group_id,
            )
            return GenericNotificationMessage.from_model(instance=new_instance)
        except Exception as e:
            self._logger.exception(
                "failed to create new generic notification alert",
                exc_info=e,
                extra=data.__dict__,
            )
            raise

    def get_all_parent_notification_messages_by_filters(
        self, group_ids: list[int] | None = None
    ) -> Generator[GenericNotificationMessage]:
        """
        If no filters are passed, then all parent notification objects are returned.

        Because an unbounded amount of parent notification objects can be returned, this method leverages generator to
        control the usage of memory in the application.
        It is up to the caller to iterate over all the data, or store in memory if they need all objects concurrently.
        """
        group_id_filter = Q(group_id__in=group_ids) if group_ids else Q()

        query = self._model.objects.filter(group_id_filter).filter(
            self._parent_notification_message_base_filter()
        )

        try:
            for instance in query:
                yield GenericNotificationMessage.from_model(instance=instance)
        except Exception as e:
            self._logger.exception(
                "Failed to get parent notifications on filters",
                exc_info=e,
                extra=filter.__dict__,
            )
            raise
