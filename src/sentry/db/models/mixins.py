from __future__ import absolute_import

__all__ = ('OrganizationBoundMixin',)

from .fields import FlexibleForeignKey
from .manager import OrganizationBoundManager


class OrganizationBoundMixin(object):
    organization = FlexibleForeignKey('sentry.Organization', related_name=None)

    objects = OrganizationBoundManager()
