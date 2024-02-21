from dataclasses import dataclass
from datetime import datetime
from typing import Any


@dataclass(frozen=True)
class BaseNotificationMessage:
    id: int
    date_added: datetime
    error_details: dict[Any, Any] | None = None
    error_code: int | None = None
    message_identifier: str | None = None
    parent_notification_message_id: int | None = None


@dataclass
class BaseNewNotificationMessage:
    error_details: dict[Any, Any] | None = None
    error_code: int | None = None
    message_identifier: str | None = None
    parent_notification_message_id: int | None = None
