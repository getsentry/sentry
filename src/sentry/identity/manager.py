__all__ = ["IdentityManager"]


from sentry.exceptions import NotRegistered


class IdentityManager:
    def __init__(self):
        self.__values = {}
        self._login_providers = {}

    def __iter__(self):
        return iter(self.all())

    def all(self):
        for key in self.__values.keys():
            provider = self.get(key)
            if provider.is_configured():
                yield provider

    def get(self, key, **kwargs):
        try:
            cls = self.__values[key]
        except KeyError:
            raise NotRegistered(key)
        return cls(**kwargs)

    def exists(self, key):
        return key in self.__values

    def register(self, cls):
        self.__values[cls.key] = cls

    def unregister(self, cls):
        try:
            if self.__values[cls.key] != cls:
                # don't allow unregistering of arbitrary provider
                raise NotRegistered(cls.key)
        except KeyError:
            # we gracefully handle a missing provider
            return
        del self.__values[cls.key]

    def register_login_provider(self, login_cls, provider_cls):
        self.register(login_cls)
        self._login_providers[provider_cls.key] = login_cls

    def is_login_provider(self, key) -> bool:
        return key in self._login_providers
