from __future__ import absolute_import


class EventTypeManager(object):
    def __init__(self):
        self.__values = []
        self.__lookup = {}

    def __iter__(self):
        return self.__values.itervalues()

    def __contains__(self, key):
        return key in self.__lookup

    def get(self, key, **kwargs):
        return self.__lookup[key]

    def exists(self, key):
        return key in self.__lookup

    def register(self, cls):
        self.__values.append(cls)
        self.__lookup[cls.key] = cls

    def infer(self, data):
        for eventtype in self.__values:
            if eventtype(data).has_metadata():
                return eventtype
        raise Exception('No event types registered which can handle data.')
