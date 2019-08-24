from __future__ import absolute_import

from django.core.cache import cache

from .base import BaseCache


class DjangoCache(BaseCache):
    def set(self, key, value, timeout, version=None, raw=False):
        cache.set(key, value, timeout, version=version or self.version)

    def delete(self, key, version=None):
        cache.delete(key, version=version or self.version)

    def get(self, key, version=None, raw=False):
        return cache.get(key, version=version or self.version)
