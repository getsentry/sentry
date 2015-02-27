from __future__ import absolute_import

__all__ = ['ProviderNotRegistered']


class ProviderNotRegistered(Exception):
    pass


class IdentityNotValid(Exception):
    pass
