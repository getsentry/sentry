__all__ = ["IdentityManager"]

from sentry.exceptions import NotRegistered
from sentry.identity.base import Provider


class IdentityManager:
    def __init__(self):
        self.__values = {}
        self._login_providers = {}

    def __iter__(self):
        return iter(self.all())

    def all(self):
        for key in self.__values.keys():
            provider = self.get(key)
            is_configured = getattr(provider, "is_configured", None)
            if is_configured is None or is_configured():
                yield provider

    def get(self, key: str, **kwargs) -> Provider:
        try:
            cls = self.__values[key]
        except KeyError:
            raise NotRegistered(key)
        return cls(**kwargs)

    def exists(self, key):
        return key in self.__values

    def register(self, cls, login_provider_cls=None):
        self.__values[cls.key] = cls
        if login_provider_cls:
            self._login_providers[login_provider_cls.key] = cls

    def unregister(self, cls):
        try:
            if self.__values[cls.key] != cls:
                # don't allow unregistering of arbitrary provider
                raise NotRegistered(cls.key)
        except KeyError:
            # we gracefully handle a missing provider
            return
        del self.__values[cls.key]

    def is_login_provider(self, key) -> bool:
        return key in self._login_providers
