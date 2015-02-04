"""
sentry.permissions
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import six

from django.conf import settings
from django.db.models import Q
from functools import wraps

from sentry.models import OrganizationMemberType
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
    ADD_ORGANIZATION = Permission('add_organization', 'create new organizations')
    ADD_TEAM = Permission('add_team', 'create new teams')
    ADD_PROJECT = Permission('add_project', 'create new projects')


def requires_login(func):
    @wraps(func)
    def wrapped(user, *args, **kwargs):
        if not (user and user.is_authenticated()):
            return False

        return func(user, *args, **kwargs)
    return wrapped


def is_organization_admin(user, organization):
    # an organization admin *must* have global access
    return organization.member_set.filter(
        user=user,
        type__lte=OrganizationMemberType.ADMIN,
        has_global_access=True,
    ).exists()


def is_team_admin(user, team):
    return team.organization.member_set.filter(
        Q(has_global_access=True) | Q(teams=team),
        user=user,
        type__lte=OrganizationMemberType.ADMIN,
    ).exists()


def is_project_admin(user, project):
    return is_team_admin(user, project.team)


@cached_for_request
@requires_login
def can_create_organizations(user):
    """
    Returns a boolean describing whether a user has the ability to
    create new organizations.
    """
    if user.is_superuser:
        return True

    result = plugins.first('has_perm', user, 'add_organization')
    if result is False:
        return result

    return True


@cached_for_request
@requires_login
def can_create_teams(user, organization):
    """
    Returns a boolean describing whether a user has the ability to
    create new teams.
    """
    if user.is_superuser:
        return True

    if not is_organization_admin(user, organization):
        return False

    result = plugins.first('has_perm', user, 'add_team', organization)
    if result is False:
        return result

    return True


@cached_for_request
@requires_login
def can_create_projects(user, team):
    """
    Returns a boolean describing whether a user has the ability to
    create new projects.
    """
    if user.is_superuser:
        return True

    if not is_team_admin(user, team):
        return False

    result = plugins.first('has_perm', user, 'add_project', team)
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
def can_manage_org(user, organization):
    if user.is_superuser:
        return True

    if is_organization_admin(user, organization):
        return True

    return False


@requires_login
def can_manage_team(user, team):
    if can_manage_org(user, team.organization):
        return True

    if is_team_admin(user, team):
        return True

    return False


@requires_login
def can_manage_project(user, project):
    if can_manage_org(user, project.organization):
        return True

    if is_project_admin(user, project):
        return True

    return False


@requires_login
def can_add_organization_member(user, organization):
    # must be an owner of the team
    if user.is_superuser:
        return True

    if not is_organization_admin(user, organization):
        return False

    result = plugins.first('has_perm', user, 'add_organization_member', organization)
    if result is False:
        return False

    return True


@requires_login
def can_manage_organization_member(user, member, perm):
    # permissions always take precedence
    if user.is_superuser:
        return True

    # must be an owner of the team
    if not is_organization_admin(user, member.organization):
        return False

    result = plugins.first('has_perm', user, perm, member)
    if result is False:
        return False

    return True


def can_edit_organization_member(user, member):
    return can_manage_organization_member(user, member, 'edit_organization_member')


def can_remove_organization_member(user, member):
    return can_manage_organization_member(user, member, 'remove_organization_member')


@requires_login
def can_remove_project(user, project):
    if project.is_internal_project():
        return False

    if user.is_superuser:
        return True

    if not is_project_admin(user, project):
        return False

    result = plugins.first('has_perm', user, 'remove_project', project)
    if result is False:
        return False

    return True


@requires_login
def can_admin_group(user, group, is_remove=False):
    if user.is_superuser:
        return True

    if not group.project.has_access(user, OrganizationMemberType.MEMBER):
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

    if not is_project_admin(user, project):
        return False

    result = plugins.first('has_perm', user, 'add_project_key', project)
    if result is False:
        return False

    return True


@requires_login
def can_edit_project_key(user, key):
    if user.is_superuser:
        return True

    project = key.project

    if not is_project_admin(user, project):
        return False

    result = plugins.first('has_perm', user, 'edit_project_key', project, key)
    if result is False:
        return False

    return True


@requires_login
def can_remove_project_key(user, key):
    if user.is_superuser:
        return True

    project = key.project

    if not is_project_admin(user, project):
        return False

    result = plugins.first('has_perm', user, 'remove_project_key', project, key)
    if result is False:
        return False

    return True
