from __future__ import absolute_import

__all__ = ["ProviderNotRegistered"]

from sentry.exceptions import NotRegistered


class ProviderNotRegistered(NotRegistered):
    pass


class IdentityNotValid(Exception):
    pass
