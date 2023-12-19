from abc import ABC, abstractmethod


class ElevatedMode(ABC):
    @property
    @abstractmethod
    def is_active(self):
        pass

    @classmethod
    @abstractmethod
    def is_privileged_request(self):
        pass

    @classmethod
    @abstractmethod
    def get_session_data(self, current_datetime=None):
        pass

    @classmethod
    @abstractmethod
    def _populate(self, current_datetime=None):
        pass

    @classmethod
    @abstractmethod
    def set_logged_in(self, user, current_datetime=None):
        pass

    @classmethod
    @abstractmethod
    def set_logged_out(self):
        pass

    @classmethod
    @abstractmethod
    def on_response(cls, request, response):
        pass
