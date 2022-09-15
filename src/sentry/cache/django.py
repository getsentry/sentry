from django.core.cache import cache

from .base import BaseCache


class DjangoCache(BaseCache):
    def set(self, key, value, timeout, version=None, raw=False):
        self._set(key, value, timeout, version=version)
        self._mark_transaction("set")

    def multi_set(self, payload, timeout, version=None, raw=False):
        for key, value in payload:
            self._set(key, value, timeout, version)
        self._mark_transaction("multi_set")

    def _set(self, key, value, timeout, version):
        cache.set(key, value, timeout, version=version or self.version)

    def delete(self, key, version=None):
        self._delete(key, version)
        self._mark_transaction("delete")

    def multi_delete(self, keys, version=None):
        for key in keys:
            self._delete(key, version)
        self._mark_transaction("multi_delete")

    def _delete(self, key, version=None):
        cache.delete(key, version=version or self.version)

    def get(self, key, version=None, raw=False):
        result = self._get(key, version)
        self._mark_transaction("get")
        return result

    def multi_get(self, keys, version=None, raw=False):
        results = [self._get(key, version) for key in keys]
        self._mark_transaction("multi_get")
        return results

    def _get(self, key, version):
        return cache.get(key, version=version or self.version)
