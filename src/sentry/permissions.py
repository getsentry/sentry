"""
sentry.permissions
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from sentry.models import OrganizationMemberType


def can_remove_project(user, project):
    if not (user and user.is_authenticated()):
        return False

    if project.is_internal_project():
        return False

    if user.is_superuser:
        return True

    if not project.has_access(user, OrganizationMemberType.OWNER):
        return False

    return True
