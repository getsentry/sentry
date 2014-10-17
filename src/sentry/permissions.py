"""
sentry.permissions
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import six

from django.conf import settings
from functools import wraps

from sentry.constants import MEMBER_OWNER
from sentry.plugins import plugins
from sentry.utils.cache import cached_for_request


class Permission(object):
    def __init__(self, name, label):
        self.name = name
        self.label = label

    def __unicode__(self):
        return self.name

    def __eq__(self, other):
        return six.text_type(self) == six.text_type(other)


class Permissions(object):
    ADD_PROJECT = Permission('add_project', 'create new projects')
    ADD_TEAM = Permission('add_team', 'create new teams')


def requires_login(func):
    @wraps(func)
    def wrapped(user, *args, **kwargs):
        if not (user and user.is_authenticated()):
            return False

        return func(user, *args, **kwargs)
    return wrapped


@cached_for_request
@requires_login
def can_create_projects(user, team=None):
    """
    Returns a boolean describing whether a user has the ability to
    create new projects.
    """
    if user.is_superuser:
        return True

    # must be an owner of team
    if team and not team.member_set.filter(user=user, type=MEMBER_OWNER).exists():
        return False

    result = plugins.first('has_perm', user, 'add_project', team)
    if result is False:
        return result

    return True


@cached_for_request
@requires_login
def can_create_teams(user):
    """
    Returns a boolean describing whether a user has the ability to
    create new projects.
    """
    if user.is_superuser:
        return True

    result = plugins.first('has_perm', user, 'add_team')
    if result is False:
        return result

    return True


@requires_login
def can_set_public_projects(user):
    """
    Returns a boolean describing whether a user has the ability to
    change the ``public`` attribute of projects.
    """
    if user.is_superuser:
        return True

    result = plugins.first('has_perm', user, 'set_project_public')
    if result is None:
        result = settings.SENTRY_ALLOW_PUBLIC_PROJECTS

    if result is False:
        return result

    return True


@requires_login
def can_add_team_member(user, team):
    # must be an owner of the team
    if user.is_superuser:
        return True

    if not team.member_set.filter(user=user, type=MEMBER_OWNER).exists():
        return False

    result = plugins.first('has_perm', user, 'add_team_member', team)
    if result is False:
        return False

    return True


@requires_login
def can_manage_team_member(user, member, perm):
    # permissions always take precedence
    if user.is_superuser:
        return True

    # must be an owner of the team
    if not member.team.member_set.filter(user=user, type=MEMBER_OWNER).exists():
        return False

    result = plugins.first('has_perm', user, perm, member)
    if result is False:
        return False

    return True


def can_edit_team_member(user, member):
    return can_manage_team_member(user, member, 'edit_team_member')


def can_remove_team_member(user, member):
    return can_manage_team_member(user, member, 'remove_team_member')


@requires_login
def can_remove_team(user, team):
    if user.is_superuser:
        return True

    # must be an owner of the team
    if team.owner != user:
        return False

    result = plugins.first('has_perm', user, 'remove_team', team)
    if result is False:
        return False

    return True


@requires_login
def can_remove_project(user, project):
    if project.is_internal_project():
        return False

    if user.is_superuser:
        return True

    # must be an owner of the team
    if not project.team.member_set.filter(user=user, type=MEMBER_OWNER).exists():
        return False

    result = plugins.first('has_perm', user, 'remove_project', project)
    if result is False:
        return False

    return True


@requires_login
def can_admin_group(user, group, is_remove=False):
    from sentry.models import Team

    if user.is_superuser:
        return True

    # We make the assumption that we have a valid membership here
    try:
        Team.objects.get_for_user(user)[group.project.team.slug]
    except KeyError:
        return False

    # The "remove_event" permission was added after "admin_event".
    # First check the new "remove_event" permission, then fall back
    # to the "admin_event" permission.
    if is_remove:
        result = plugins.first('has_perm', user, 'remove_event', group)
        if result is False:
            return False

    result = plugins.first('has_perm', user, 'admin_event', group)
    if result is False:
        return False

    return True


def can_remove_group(user, group):
    return can_admin_group(user, group, is_remove=True)


@requires_login
def can_add_project_key(user, project):
    if user.is_superuser:
        return True

    # must be an owner of the team
    if project.team and not project.team.member_set.filter(user=user, type=MEMBER_OWNER).exists():
        return False

    result = plugins.first('has_perm', user, 'add_project_key', project)
    if result is False:
        return False

    return True


@requires_login
def can_edit_project_key(user, project):
    if user.is_superuser:
        return True

    # must be an owner of the team
    if project.team and not project.team.member_set.filter(user=user, type=MEMBER_OWNER).exists():
        return False

    result = plugins.first('has_perm', user, 'edit_project_key', project)
    if result is False:
        return False

    return True


@requires_login
def can_remove_project_key(user, key):
    if user.is_superuser:
        return True

    project = key.project

    # must be an owner of the team
    if project.team and not project.team.member_set.filter(user=user, type=MEMBER_OWNER).exists():
        return False

    result = plugins.first('has_perm', user, 'remove_project_key', project, key)
    if result is False:
        return False

    return True
