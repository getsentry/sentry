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


class PluginError(Exception):
    pass


class PluginIdentityRequired(PluginError):
    pass


class InvalidIdentity(Exception):
    def __init__(self, message="", identity=None):
        super(InvalidIdentity, self).__init__(message)
        self.identity = identity


class HookValidationError(Exception):
    pass


class NotRegistered(Exception):
    pass


class ApiTokenLimitError(Exception):
    pass
