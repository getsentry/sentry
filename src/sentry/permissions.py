"""
sentry.permissions
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from sentry.conf import settings
from sentry.plugins import plugins


def can_create_projects(user, team=None):
    """
    Returns a boolean describing whether a user has the ability to
    create new projects.
    """
    if not (user and user.is_authenticated()):
        return False

    if user.has_perm('sentry.can_add_project'):
        return True

    result = plugins.first('has_perm', user, 'add_project', team)
    if result is None:
        result = settings.ALLOW_PROJECT_CREATION

    if result is False:
        return result
    return True


def can_create_teams(user):
    """
    Returns a boolean describing whether a user has the ability to
    create new projects.
    """
    if not (user and user.is_authenticated()):
        return False

    if user.has_perm('sentry.can_add_team'):
        return True

    result = plugins.first('has_perm', user, 'add_team')
    if result is None:
        result = settings.ALLOW_TEAM_CREATION

    if result is False:
        return result
    return True


def can_set_public_projects(user):
    """
    Returns a boolean describing whether a user has the ability to
    change the ``public`` attribute of projects.
    """
    if not (user and user.is_authenticated()):
        return False

    if user.has_perm('sentry.can_change_project'):
        return True

    result = plugins.first('has_perm', user, 'set_project_public')
    if result is None:
        result = settings.ALLOW_PUBLIC_PROJECTS

    if result is False:
        return result
    return True


def can_add_team_member(user, team):
    result = plugins.first('has_perm', user, 'add_team_member', team)
    if result is False and not user.has_perm('sentry.can_add_teammember'):
        return False
    return True


def can_remove_team(user, team):
    if team.project_set.exists():
        return False
    result = plugins.first('has_perm', user, 'remove_team', team)
    if result is False and not user.has_perm('sentry.can_remove_team'):
        return False
    return True


def can_remove_project(user, team):
    result = plugins.first('has_perm', user, 'remove_project', team)
    if result is False and not user.has_perm('sentry.can_remove_project'):
        return False
    return True
