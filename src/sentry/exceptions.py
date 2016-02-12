from __future__ import absolute_import

from django.core.exceptions import SuspiciousOperation


class InvalidData(Exception):
    pass


class InvalidInterface(InvalidData):
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


class InvalidConfiguration(Exception):
    pass


class DeleteAborted(Exception):
    pass


class RestrictedIPAddress(SuspiciousOperation):
    pass
