from __future__ import absolute_import, print_function

__all__ = ['ProviderManager']

from .exceptions import ProviderNotRegistered


# Ideally this and PluginManager abstracted from the same base, but
# InstanceManager has become convulated and wasteful
class ProviderManager(object):
    def __init__(self):
        self.__values = {}

    def __iter__(self):
        return self.__values.iteritems()

    def get(self, name, **kwargs):
        try:
            cls = self.__values[name]
        except KeyError:
            raise ProviderNotRegistered(name)
        return cls(name=name, **kwargs)

    def exists(self, name):
        return name in self.__values

    def register(self, name, cls):
        self.__values[name] = cls

    def unregister(self, name, cls):
        if self.__values[name] != cls:
            raise ProviderNotRegistered(name)
        del self.__values[name]
