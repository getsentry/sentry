from abc import ABC, abstractmethod
from datetime import datetime
from enum import Enum
from typing import Any

from django.contrib.auth.models import AnonymousUser
from django.http import HttpResponse
from django.http.request import HttpRequest

from sentry.users.models.user import User


class InactiveReason(str, Enum):
    INVALID_IP = "invalid-ip"
    INCOMPLETE_SSO = "incomplete-sso"
    # Indicates the request should be allowed
    NONE = None

    def __bool__(self) -> bool:
        return self.value is not None

    def __str__(self) -> str:
        return self.value


class ElevatedMode(ABC):
    @property
    @abstractmethod
    def is_active(self) -> bool:
        pass

    @abstractmethod
    def is_privileged_request(self) -> tuple[bool, InactiveReason]:
        pass

    @abstractmethod
    def get_session_data(self, current_datetime: datetime | None = None) -> dict[str, Any] | None:
        pass

    @abstractmethod
    def _populate(self) -> None:
        pass

    @abstractmethod
    def set_logged_in(self, user: User, current_datetime: datetime | None = None) -> None:
        pass

    @abstractmethod
    def set_logged_out(self) -> None:
        pass

    @abstractmethod
    def on_response(cls, response: HttpResponse) -> None:
        pass


def has_elevated_mode(request: HttpRequest) -> bool:
    """
    Checks if the user on the request has active staff mode.
    """
    from sentry.auth.staff import is_active_staff

    if isinstance(request.user, AnonymousUser):
        return False

    return is_active_staff(request)
