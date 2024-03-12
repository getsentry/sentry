from dataclasses import dataclass
from datetime import datetime
from typing import Any


class NotificationMessageValidationError(Exception):
    """
    Base error that is raised when there is a validation error
    """

    pass


class MessageIdentifierWithErrorValidationError(NotificationMessageValidationError):
    """
    Raised when a NotificationMessage has an error with a message identifier.
    A NotificationMessage can only have a message identifier when it is successful; therefore if error details exist,
    it means that the NotificationMessage was NOT successful, which implies that it should not have the value.
    """

    message = (
        "cannot create a new notification message with message identifier when an error exists"
    )


@dataclass(frozen=True)
class BaseNotificationMessage:
    """
    This dataclass represents a notification message domain object.
    The data in this instance should not change, as it is populated from a datastore,
    which is why it's a frozen data set.
    """

    id: int
    date_added: datetime
    error_details: dict[str, Any] | None = None
    error_code: int | None = None
    message_identifier: str | None = None
    parent_notification_message_id: int | None = None


@dataclass
class BaseNewNotificationMessage:
    """
    This dataclass represents a new, outgoing, notification message domain object that will get reflected in the
    datastore. The caller can define what that data looks like and which fields should be populated.
    """

    error_details: dict[str, Any] | None = None
    error_code: int | None = None
    message_identifier: str | None = None
    parent_notification_message_id: int | None = None

    def get_validation_error(self) -> Exception | None:
        """
        Helper method for getting any potential validation errors based on the state of the data.
        There are particular restrictions about the various fields, and this is to help the user check before
        trying to instantiate a new instance in the datastore.
        """
        if self.message_identifier is not None:
            if self.error_code is not None or self.error_details is not None:
                return MessageIdentifierWithErrorValidationError()

        return None
