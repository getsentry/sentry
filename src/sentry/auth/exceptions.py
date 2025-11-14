from typing import int
__all__ = ["ProviderNotRegistered"]

from sentry.exceptions import NotRegistered


class ProviderNotRegistered(NotRegistered):
    pass


class IdentityNotValid(Exception):
    pass
