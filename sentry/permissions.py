"""
sentry.permissions
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from sentry.conf import settings
from sentry.plugins import plugins


def can_create_projects(user):
    if not (user and user.is_authenticated()):
        return False

    if user.has_perm('sentry.can_add_project'):
        return True

    result = plugins.first('has_perm', user, 'add_project')
    if result is None:
        result = settings.ALLOW_PROJECT_CREATION

    if result is False:
        return result
    return True
