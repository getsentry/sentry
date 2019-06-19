from __future__ import absolute_import

import six


class EventTypeManager(object):
    def __init__(self):
        self.__values = []
        self.__lookup = {}

    def __iter__(self):
        return six.itervalues(self.__values)

    def __contains__(self, key):
        return key in self.__lookup

    def get(self, key, **kwargs):
        return self.__lookup[key]

    def exists(self, key):
        return key in self.__lookup

    def register(self, cls):
        self.__values.append(cls)
        self.__lookup[cls.key] = cls
