__all__ = ["ProviderNotRegistered"]

from sentry.exceptions import NotRegistered


class ProviderNotRegistered(NotRegistered):
    pass


class IdentityNotValid(Exception):
    pass
