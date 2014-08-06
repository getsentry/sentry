"""
sentry.manager
~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import six

from django.conf import settings
from django.contrib.auth.models import UserManager
from django.utils.datastructures import SortedDict

from sentry.app import buffer, tsdb
from sentry.constants import MAX_TAG_VALUE_LENGTH, MEMBER_USER
from sentry.db.models import BaseManager
from sentry.utils.db import attach_foreignkey


class UserManager(BaseManager, UserManager):
    pass


class GroupManager(BaseManager):
    use_for_related_fields = True

    def get_by_natural_key(self, project, checksum):
        return self.get(project=project, checksum=checksum)

    def from_kwargs(self, project, **kwargs):
        from sentry.event_manager import EventManager

        manager = EventManager(kwargs)
        manager.normalize()
        return manager.save(project)

    def add_tags(self, group, tags):
        from sentry.models import TagValue, GroupTagValue

        project = group.project
        date = group.last_seen

        tsdb_keys = []

        for tag_item in tags:
            if len(tag_item) == 2:
                (key, value), data = tag_item, None
            else:
                key, value, data = tag_item

            if not value:
                continue

            value = six.text_type(value)
            if len(value) > MAX_TAG_VALUE_LENGTH:
                continue

            tsdb_id = u'%s=%s' % (key, value)

            tsdb_keys.extend([
                (tsdb.models.project_tag_value, tsdb_id),
            ])

            buffer.incr(TagValue, {
                'times_seen': 1,
            }, {
                'project': project,
                'key': key,
                'value': value,
            }, {
                'last_seen': date,
                'data': data,
            })

            buffer.incr(GroupTagValue, {
                'times_seen': 1,
            }, {
                'group': group,
                'project': project,
                'key': key,
                'value': value,
            }, {
                'last_seen': date,
            })

        if tsdb_keys:
            tsdb.incr_multi(tsdb_keys)


class ProjectManager(BaseManager):
    def get_for_user(self, user=None, access=None, hidden=False, team=None,
                     superuser=True):
        """
        Returns a SortedDict of all projects a user has some level of access to.
        """
        from sentry.models import Team

        if not (user and user.is_authenticated()):
            return []

        # TODO: the result of this function should be cached
        is_authenticated = (user and user.is_authenticated())

        base_qs = self
        if not hidden:
            base_qs = base_qs.filter(status=0)
        if team:
            base_qs = base_qs.filter(team=team)

        if team and user.is_superuser and superuser:
            projects = set(base_qs)
        else:
            projects_qs = base_qs
            if not settings.SENTRY_PUBLIC:
                # If the user is authenticated, include their memberships
                teams = Team.objects.get_for_user(
                    user, access, access_groups=False).values()
                if not teams:
                    projects_qs = self.none()
                if team and team not in teams:
                    projects_qs = self.none()
                elif not team:
                    projects_qs = projects_qs.filter(team__in=teams)

            projects = set(projects_qs)

            if is_authenticated:
                projects |= set(base_qs.filter(accessgroup__members=user))

        attach_foreignkey(projects, self.model.team)

        return sorted(projects, key=lambda x: x.name.lower())


class TeamManager(BaseManager):
    def get_for_user(self, user, access=None, access_groups=True, with_projects=False):
        """
        Returns a SortedDict of all teams a user has some level of access to.

        Each <Team> returned has an ``access_type`` attribute which holds the
        MEMBER_TYPE value.
        """
        from sentry.models import TeamMember, AccessGroup, Project

        results = SortedDict()

        if not user.is_authenticated():
            return results

        all_teams = set()

        qs = TeamMember.objects.filter(
            user=user,
        ).select_related('team')
        if access is not None:
            qs = qs.filter(type__lte=access)

        for tm in qs:
            team = tm.team
            team.access_type = tm.type
            all_teams.add(team)

        if access_groups:
            qs = AccessGroup.objects.filter(
                members=user,
            ).select_related('team')
            if access is not None:
                qs = qs.filter(type__lte=access)

            for group in qs:
                team = group.team
                team.access_type = group.type
                all_teams.add(team)

        if settings.SENTRY_PUBLIC and access is None:
            for team in self.iterator():
                all_teams.add(team)
                team.access_type = MEMBER_USER

        for team in sorted(all_teams, key=lambda x: x.name.lower()):
            results[team.slug] = team

        if with_projects:
            # these kinds of queries make people sad :(
            new_results = SortedDict()
            for team in results.itervalues():
                project_list = list(Project.objects.get_for_user(
                    user, team=team))
                new_results[team.slug] = (team, project_list)
            results = new_results

        return results
