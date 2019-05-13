from __future__ import absolute_import

from sentry.exceptions import NotRegistered

__all__ = ['ProviderNotRegistered']


class ProviderNotRegistered(NotRegistered):
    pass


class IdentityNotValid(Exception):
    pass
