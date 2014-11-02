"""
sentry.manager
~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import six

from django.contrib.auth.models import UserManager

from sentry.app import buffer, tsdb
from sentry.constants import MAX_TAG_VALUE_LENGTH
from sentry.db.models import BaseManager


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
    def get_for_user(self, team, user, access=None):
        """
        Returns a SortedDict of all projects a user has some level of access to.
        """
        if not (user and user.is_authenticated()):
            return []

        base_qs = self.filter(team=team)

        project_list = []
        for project in base_qs:
            project.team = team
            project_list.append(project)

        return sorted(project_list, key=lambda x: x.name.lower())
