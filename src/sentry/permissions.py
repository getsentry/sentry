"""
sentry.permissions
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from functools import wraps
from sentry.conf import settings
from sentry.constants import MEMBER_OWNER
from sentry.plugins import plugins


def perm_override(perm):
    def inner(func):
        @wraps(func)
        def wrapped(user, *args, **kwargs):
            # permissions always take precedence
            if user.has_perm('sentry.%s' % (perm,)):
                return True

            return func(user, *args, **kwargs)
        return wrapped
    return inner


def requires_login(func):
    @wraps(func)
    def wrapped(user, *args, **kwargs):
        if not (user and user.is_authenticated()):
            return False

        return func(user, *args, **kwargs)
    return wrapped


@requires_login
@perm_override('can_add_project')
def can_create_projects(user, team=None):
    """
    Returns a boolean describing whether a user has the ability to
    create new projects.
    """
    # must be an owner of team
    if team and not team.member_set.filter(user=user, type=MEMBER_OWNER).exists():
        return False

    result = plugins.first('has_perm', user, 'add_project', team)
    if result is None:
        result = settings.ALLOW_PROJECT_CREATION

    if result is False:
        return result

    return True


@requires_login
@perm_override('can_add_team')
def can_create_teams(user):
    """
    Returns a boolean describing whether a user has the ability to
    create new projects.
    """
    result = plugins.first('has_perm', user, 'add_team')
    if result is None:
        result = settings.ALLOW_TEAM_CREATION

    if result is False:
        return result

    return True


@requires_login
@perm_override('can_change_project')
def can_set_public_projects(user):
    """
    Returns a boolean describing whether a user has the ability to
    change the ``public`` attribute of projects.
    """
    result = plugins.first('has_perm', user, 'set_project_public')
    if result is None:
        result = settings.ALLOW_PUBLIC_PROJECTS

    if result is False:
        return result

    return True


@requires_login
@perm_override('can_add_teammember')
def can_add_team_member(user, team):
    # must be an owner of the team
    if not team.member_set.filter(user=user, type=MEMBER_OWNER).exists():
        return False

    result = plugins.first('has_perm', user, 'add_team_member', team)
    if result is False:
        return False

    return True


@requires_login
def can_manage_team_member(user, member, django_perm, perm):
    # permissions always take precedence
    if user.has_perm(django_perm):
        return True

    # must be an owner of the team
    if not member.team.member_set.filter(user=user, type=MEMBER_OWNER).exists():
        return False

    result = plugins.first('has_perm', user, perm, member)
    if result is False:
        return False

    return True


def can_edit_team_member(user, member):
    return can_manage_team_member(user, member, 'sentry.can_change_teammember', 'edit_team_member')


def can_remove_team_member(user, member):
    return can_manage_team_member(user, member, 'sentry.can_remove_teammember', 'remove_team_member')


@requires_login
def can_remove_team(user, team):
    # projects with teams can never be removed
    if team.project_set.exists():
        return False

    # permissions always take precedence
    if user.has_perm('sentry.can_remove_team'):
        return True

    # must be an owner of the team
    if not team.member_set.filter(user=user, type=MEMBER_OWNER).exists():
        return False

    result = plugins.first('has_perm', user, 'remove_team', team)
    if result is False:
        return False

    return True


@requires_login
def can_remove_project(user, project):
    if project.is_default_project():
        return False

    # permissions always take precedence
    if user.has_perm('sentry.can_remove_project'):
        return True

    # must be an owner of the team
    if not project.team.member_set.filter(user=user, type=MEMBER_OWNER).exists():
        return False

    result = plugins.first('has_perm', user, 'remove_project', project)
    if result is False:
        return False

    return True


@requires_login
@perm_override('can_change_group')
def can_admin_group(user, group):
    from sentry.models import Team
    # We make the assumption that we have a valid membership here
    try:
        Team.objects.get_for_user(user)[group.project.team.slug]
    except KeyError:
        return False

    result = plugins.first('has_perm', user, 'admin_event', group)
    if result is False:
        return False

    return True
