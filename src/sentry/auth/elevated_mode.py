import ipaddress
from abc import ABC, abstractmethod

from django.conf import settings

ALLOWED_IPS = frozenset(getattr(settings, "SUPERUSER_ALLOWED_IPS", settings.INTERNAL_IPS) or ())


class ElevatedMode(ABC):
    allowed_ips = [ipaddress.ip_network(str(v), strict=False) for v in ALLOWED_IPS]

    @staticmethod
    @abstractmethod
    def _needs_validation():
        pass

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
