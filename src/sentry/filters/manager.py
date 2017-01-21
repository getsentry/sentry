from __future__ import absolute_import, print_function

__all__ = ['FilterManager', 'FilterNotRegistered']

import six


class FilterNotRegistered(Exception):
    pass


# TODO(dcramer): a lot of these managers are very similar and should abstracted
# into some kind of base class
class FilterManager(object):
    def __init__(self):
        self.__values = {}

    def __iter__(self):
        return six.itervalues(self.__values)

    def all(self):
        return iter(self)

    def get(self, id):
        try:
            cls = self.__values[id]
        except KeyError:
            raise FilterNotRegistered(id)
        return cls

    def exists(self, id):
        return id in self.__values

    def register(self, cls):
        self.__values[cls.id] = cls

    def unregister(self, cls):
        try:
            if self.__values[cls.id] != cls:
                # dont allow unregistering of arbitrary provider
                raise FilterNotRegistered(cls.id)
        except KeyError:
            # we gracefully handle a missing provider
            return
        del self.__values[cls.id]
