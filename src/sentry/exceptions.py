from __future__ import absolute_import


class InvalidData(Exception):
    pass


class InvalidInterface(InvalidData):
    pass


class InvalidTimestamp(InvalidData):
    pass


class InvalidRequest(Exception):
    pass


class InvalidOrigin(InvalidRequest):
    def __init__(self, origin):
        self.origin = origin

    def __str__(self):
        return "Invalid origin: '%s'" % self.origin


class CacheNotPopulated(Exception):
    pass
