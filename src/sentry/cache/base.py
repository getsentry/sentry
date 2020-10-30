from __future__ import absolute_import

from django.conf import settings

from threading import local


class BaseCache(local):
    prefix = "c"

    def __init__(self, version=None, prefix=None):
        self.version = version or settings.CACHE_VERSION
        if prefix is not None:
            self.prefix = prefix

    def make_key(self, key, version=None):
        return u"{}:{}:{}".format(self.prefix, version or self.version, key)

    def set(self, key, value, timeout, version=None, raw=False):
        raise NotImplementedError

    def delete(self, key, version=None):
        raise NotImplementedError

    def get(self, key, version=None, raw=False):
        raise NotImplementedError
