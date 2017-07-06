from __future__ import absolute_import

__all__ = ('OrganizationBoundMixin', 'ProjectBoundMixin')

from .manager import OrganizationBoundManager, ProjectBoundManager


class OrganizationBoundMixin(object):
    # XXX(dcramer): cant seem to define fields via mixin
    # organization = FlexibleForeignKey('sentry.Organization', related_name=None)

    objects = OrganizationBoundManager()


class ProjectBoundMixin(object):
    # XXX(dcramer): cant seem to define fields via mixin
    # project = FlexibleForeignKey('sentry.Project', related_name=None)

    objects = ProjectBoundManager()
