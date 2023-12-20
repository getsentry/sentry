from abc import ABC, abstractmethod
from enum import Enum
from typing import Tuple


class RequestStatus(str, Enum):
    INVALID_IP = "invalid-ip"
    INCOMPLETE_SSO = "incomplete-sso"
    NONE = None

    def __bool__(self):
        return self.value is not None

    def __str__(self) -> str:
        return self.value


class ElevatedMode(ABC):
    @property
    @abstractmethod
    def is_active(self) -> bool:
        pass

    @abstractmethod
    def is_privileged_request(self) -> Tuple[bool, RequestStatus]:
        pass

    @abstractmethod
    def get_session_data(self, current_datetime=None):
        pass

    @abstractmethod
    def _populate(self, current_datetime=None):
        pass

    @abstractmethod
    def set_logged_in(self, user, current_datetime=None) -> None:
        pass

    @abstractmethod
    def set_logged_out(self) -> None:
        pass

    @abstractmethod
    def on_response(cls, response) -> None:
        pass
