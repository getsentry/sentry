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
        super().__init__(message)
        self.identity = identity


class HookValidationError(Exception):
    pass


class NotRegistered(Exception):
    pass


class ApiTokenLimitError(Exception):
    pass


class InvalidSearchQuery(Exception):
    pass


class IncompatibleMetricsQuery(Exception):
    # Tried to build a metrics enhanced performance query but it was incompatible
    pass


class UnableToAcceptMemberInvitationException(Exception):
    pass


class UnsupportedQuerySubscription(Exception):
    pass


class InvalidQuerySubscription(Exception):
    pass
