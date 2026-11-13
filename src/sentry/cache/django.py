from django.core.cache import cache

from .base import BaseCache


class DjangoCache(BaseCache):
    def set(
        self,
        key: str,
        value: object,
        timeout: int | float | None,
        version: int | None = None,
        raw: bool = False,
    ) -> None:
        cache.set(key, value, timeout, version=version or self.version)
        self._mark_transaction("set")

    def delete(self, key: str, version: int | None = None) -> None:
        cache.delete(key, version=version or self.version)
        self._mark_transaction("delete")

    def get(self, key: str, version: int | None = None, raw: bool = False) -> object:
        result = cache.get(key, version=version or self.version)
        self._mark_transaction("get")
        return result
