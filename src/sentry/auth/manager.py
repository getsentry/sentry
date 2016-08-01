from __future__ import absolute_import, print_function

__all__ = ['ProviderManager']

import six

from .exceptions import ProviderNotRegistered


# Ideally this and PluginManager abstracted from the same base, but
# InstanceManager has become convulated and wasteful
class ProviderManager(object):
    def __init__(self):
        self.__values = {}

    def __iter__(self):
        return six.iteritems(self.__values)

    def get(self, key, **kwargs):
        try:
            cls = self.__values[key]
        except KeyError:
            raise ProviderNotRegistered(key)
        return cls(key=key, **kwargs)

    def exists(self, key):
        return key in self.__values

    def register(self, key, cls):
        self.__values[key] = cls

    def unregister(self, key, cls):
        try:
            if self.__values[key] != cls:
                # dont allow unregistering of arbitrary provider
                raise ProviderNotRegistered(key)
        except KeyError:
            # we gracefully handle a missing provider
            return
        del self.__values[key]
