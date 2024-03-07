from dataclasses import dataclass
from datetime import datetime
from typing import Any


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
