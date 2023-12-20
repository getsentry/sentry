from abc import ABC, abstractmethod


class ElevatedMode(ABC):
    @property
    @abstractmethod
    def is_active(self) -> bool:
        pass

    @abstractmethod
    def is_privileged_request(self):
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
    def on_response(self, response) -> None:
        pass
