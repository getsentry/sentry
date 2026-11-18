__all__ = ["IdentityManager"]

from collections.abc import Iterator

from sentry.exceptions import NotRegistered
from sentry.identity.base import Provider


class IdentityManager:
    def __init__(self) -> None:
        self.__values: dict[str, type[Provider]] = {}
        self._login_providers: dict[str, type[Provider]] = {}

    def __iter__(self) -> Iterator[Provider]:
        return iter(self.all())

    def all(self) -> Iterator[Provider]:
        for key in self.__values.keys():
            provider = self.get(key)
            is_configured = getattr(provider, "is_configured", None)
            if is_configured is None or is_configured():
                yield provider

    def get(self, key: str, **kwargs: object) -> Provider:
        try:
            cls = self.__values[key]
        except KeyError:
            raise NotRegistered(key)
        return cls(**kwargs)

    def exists(self, key: str) -> bool:
        return key in self.__values

    def register(
        self, cls: type[Provider], login_provider_cls: type[Provider] | None = None
    ) -> None:
        self.__values[cls.key] = cls
        if login_provider_cls:
            self._login_providers[login_provider_cls.key] = cls

    def unregister(self, cls: type[Provider]) -> None:
        try:
            if self.__values[cls.key] != cls:
                # don't allow unregistering of arbitrary provider
                raise NotRegistered(cls.key)
        except KeyError:
            # we gracefully handle a missing provider
            return
        del self.__values[cls.key]

    def is_login_provider(self, key: str) -> bool:
        return key in self._login_providers
