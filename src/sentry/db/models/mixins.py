from __future__ import absolute_import

__all__ = ('OrganizationBoundMixin',)

from .manager import OrganizationBoundManager


class OrganizationBoundMixin(object):
    # XXX(dcramer): cant seem to define fields via mixin
    # organization = FlexibleForeignKey('sentry.Organization', related_name=None)

    objects = OrganizationBoundManager()
