"""
sentry.tagstore.snuba.backend
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2018 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from collections import defaultdict
from datetime import timedelta
from django.utils import timezone
import six

from sentry.tagstore import TagKeyStatus
from sentry.tagstore.base import TagStorage
from sentry.tagstore.exceptions import (
    GroupTagKeyNotFound,
    GroupTagValueNotFound,
    TagKeyNotFound,
    TagValueNotFound,
)
from sentry.utils import snuba

SEEN_COLUMN = 'timestamp'


class ObjectWrapper(object):
    def __init__(self, dictionary):
        self.__dict__ = dictionary


class SnubaTagStorage(TagStorage):

    def get_time_range(self, days=90):
        """
        Returns the default (start, end) time range for querrying snuba.
        """
        # TODO this should use the per-project retention figure to limit
        # the query to looking at only the retention window for the project.
        end = timezone.now()
        return (end - timedelta(days=days), end)

    def get_tag_key(self, project_id, environment_id, key, status=TagKeyStatus.VISIBLE):
        try:
            return self.get_group_tag_key(project_id, None, environment_id, key)
        except GroupTagKeyNotFound:
            raise TagKeyNotFound

    def get_tag_keys(self, project_id, environment_id, status=TagKeyStatus.VISIBLE):
        return self.get_group_tag_keys(project_id, None, environment_id)

    def get_tag_value(self, project_id, environment_id, key, value):
        try:
            return self.get_group_tag_value(project_id, None, environment_id, key, value)
        except GroupTagValueNotFound:
            raise TagValueNotFound

    def get_tag_values(self, project_id, environment_id, key):
        return self.get_group_tag_values(project_id, None, environment_id, key)

    def get_group_tag_key(self, project_id, group_id, environment_id, key):
        start, end = self.get_time_range()
        tag = 'tags[{}]'.format(key)
        filters = {
            'project_id': [project_id],
            'environment': [environment_id],
        }
        if group_id is not None:
            filters['issue'] = [group_id]
        conditions = [[tag, '!=', '']]
        aggregations = [['count', '', 'count']]

        result = snuba.query(start, end, [], conditions, filters, aggregations)
        if result == 0:
            raise GroupTagKeyNotFound
        else:
            return ObjectWrapper({
                'times_seen': result,
                'key': key,
                'group_id': group_id,
            })

    def get_group_tag_keys(self, project_id, group_id, environment_id, limit=1000):
        start, end = self.get_time_range()
        filters = {
            'project_id': [project_id],
            'environment': [environment_id],
        }
        if group_id is not None:
            filters['issue'] = [group_id]
        aggregations = [['count', '', 'count']]

        result = snuba.query(start, end, ['tags.key'], [], filters, aggregations,
                             limit=limit, orderby='-count', arrayjoin='tags')

        return [ObjectWrapper({
            'times_seen': count,
            'key': name,
            'group_id': group_id,
        }) for name, count in six.iteritems(result)]

    def get_group_tag_value(self, project_id, group_id, environment_id, key, value):
        from sentry.tagstore.exceptions import GroupTagValueNotFound
        start, end = self.get_time_range()
        tag = 'tags[{}]'.format(key)
        filters = {
            'project_id': [project_id],
            'environment': [environment_id],
        }
        if group_id is not None:
            filters['issue'] = [group_id]
        conditions = [
            [tag, '=', value]
        ]
        aggregations = [['count', '', 'count']]

        result = snuba.query(start, end, [], conditions, filters, aggregations)

        if result == 0:
            raise GroupTagValueNotFound
        else:
            return ObjectWrapper({
                'times_seen': result,
                'key': key,
                'value': value,
                'group_id': group_id,
            })

    def get_group_tag_values(self, project_id, group_id, environment_id, key):
        start, end = self.get_time_range(7)
        tag = 'tags[{}]'.format(key)
        filters = {
            'project_id': [project_id],
            'environment': [environment_id],
        }
        if group_id is not None:
            filters['issue'] = [group_id]
        conditions = [[tag, '!=', '']]
        aggregations = [
            ['count', '', 'count'],
            ['min', SEEN_COLUMN, 'first_seen'],
            ['max', SEEN_COLUMN, 'last_seen'],
        ]

        result = snuba.query(start, end, [tag], conditions, filters,
                             aggregations)

        return [ObjectWrapper({
            'times_seen': val['count'],
            'first_seen': val['first_seen'],
            'last_seen': val['last_seen'],
            'key': key,
            'value': name,
            'group_id': group_id,
        }) for name, val in six.iteritems(result)]

    def get_group_list_tag_value(self, project_id, group_ids, environment_id, key, value):
        start, end = self.get_time_range()
        tag = 'tags[{}]'.format(key)
        filters = {
            'project_id': [project_id],
            'environment': [environment_id],
            'issue': group_ids,
        }
        conditions = [
            [tag, '=', value]
        ]
        aggregations = [['count', '', 'count']]

        result = snuba.query(start, end, ['issue'], conditions, filters, aggregations)

        return {
            issue: ObjectWrapper({
                'times_seen': count,
                'key': key,
                'value': value,
                'group_id': issue,
            }) for issue, count in six.iteritems(result)}

    def get_group_tag_value_count(self, project_id, group_id, environment_id, key):
        start, end = self.get_time_range(7)
        tag = 'tags[{}]'.format(key)
        filters = {
            'project_id': [project_id],
            'environment': [environment_id],
            'issue': [group_id],
        }
        conditions = [[tag, '!=', '']]
        aggregations = [['count', '', 'count']]

        return snuba.query(start, end, [], conditions, filters, aggregations)

    def get_top_group_tag_values(self, project_id, group_id, environment_id, key, limit=3):
        start, end = self.get_time_range(7)
        tag = 'tags[{}]'.format(key)
        filters = {
            'project_id': [project_id],
            'environment': [environment_id],
            'issue': [group_id],
        }
        conditions = [[tag, '!=', '']]
        aggregations = [
            ['count', '', 'count'],
            ['min', SEEN_COLUMN, 'first_seen'],
            ['max', SEEN_COLUMN, 'last_seen'],
        ]

        result = snuba.query(start, end, [tag], conditions, filters,
                             aggregations, limit=limit, orderby='-count')

        return [ObjectWrapper({
            'times_seen': val['count'],
            'first_seen': val['first_seen'],
            'last_seen': val['last_seen'],
            'key': key,
            'value': name,
            'group_id': group_id,
        }) for name, val in six.iteritems(result)]

    def get_group_tag_keys_and_top_values(self, project_id, group_id, environment_id, user=None):
        from sentry import tagstore
        start, end = self.get_time_range()
        filters = {
            'project_id': [project_id],
            'environment': [environment_id],
            'issue': [group_id],
        }
        aggregations = [
            ['topK(10)', 'tags.value', 'top'],
            ['count', '', 'count'],
            ['uniq', 'tags.key', 'uniq'],
        ]
        results = snuba.query(start, end, ['tags.key'], None, filters,
                              aggregations, arrayjoin='tags')

        return [{
            'id': key,
            'name': tagstore.get_tag_key_label(key),
            'key': tagstore.get_standardized_key(key),
            'uniqueValues': res['uniq'],
            'totalValues': res['count'],
            'topValues': [{
                'id': val,
                'name': tagstore.get_tag_value_label(key, val),
                'key': tagstore.get_standardized_key(key),
                'value': val,
            } for val in res['top']],
        } for key, res in six.iteritems(results)]

    def get_release(self, project_id, group_id, first=True):
        start, end = self.get_time_range()
        filters = {
            'project_id': [project_id],
        }
        conditions = [['release', 'IS NOT NULL', None]]
        if group_id is not None:
            filters['issue'] = [group_id]
        aggregations = [['min' if first else 'max', SEEN_COLUMN, 'seen']]
        orderby = 'seen' if first else '-seen'

        result = snuba.query(start, end, ['release'], conditions, filters,
                             aggregations, limit=1, orderby=orderby)
        if not result:
            return None
        else:
            return result.keys()[0]

    def get_first_release(self, project_id, group_id):
        return self.get_release(project_id, group_id, True)

    def get_last_release(self, project_id, group_id):
        return self.get_release(project_id, group_id, False)

    def get_release_tags(self, project_ids, environment_id, versions):
        start, end = self.get_time_range()
        filters = {
            'project_id': project_ids,
            'environment': [environment_id],
        }
        # NB we add release as a condition rather than a filter because
        # this method is already dealing with version strings rather than
        # release ids which would need to be translated by the snuba util.
        conditions = [['release', 'IN', versions]]
        aggregations = [
            ['count', '', 'count'],
            ['min', SEEN_COLUMN, 'first_seen'],
            ['max', SEEN_COLUMN, 'last_seen'],
        ]

        result = snuba.query(start, end, ['release'], conditions, filters, aggregations)

        return [ObjectWrapper({
            'times_seen': val['count'],
            'first_seen': val['first_seen'],
            'last_seen': val['last_seen'],
            'key': 'release',
            'value': name,
        }) for name, val in six.iteritems(result)]

    def get_group_event_ids(self, project_id, group_id, environment_id, tags):
        start, end = self.get_time_range()
        filters = {
            'environment': [environment_id],
            'project_id': [project_id],
        }
        # TODO implement environment_id exclusion, its a little bit more complex
        # than adding a != condition because environment_ids need to be translated
        # to filters in snuba.

        # TODO OR conditions?
        conditions = [['tags[{}]'.format(tag), '=', val] for tag, val in six.iteritems(tags)]

        events = snuba.query(start, end, ['event_id'], conditions, filters)
        return events.keys()

    def get_group_ids_for_users(self, project_ids, event_users, limit=100):
        start, end = self.get_time_range()
        filters = {
            'project_id': project_ids,
        }
        conditions = [cond for cond in [
            # TODO OR these conditions
            ['user_id', 'IN', [eu.ident for eu in event_users if eu.ident]],
            ['email', 'IN', [eu.email for eu in event_users if eu.email]],
            ['username', 'IN', [eu.username for eu in event_users if eu.username]],
            ['ip_address', 'IN', [eu.ip_address for eu in event_users if eu.ip_address]],
        ] if cond[2] != []]
        aggregations = [['max', SEEN_COLUMN, 'seen']]

        result = snuba.query(start, end, ['issue'], conditions, filters,
                             aggregations, limit=limit, orderby='-seen')
        return result.keys()

    def get_group_tag_values_for_users(self, event_users, limit=100):
        start, end = self.get_time_range()
        filters = {
            'project_id': [eu.project_id for eu in event_users]
        }
        conditions = [cond for cond in [
            ['user_id', 'IN', [eu.ident for eu in event_users if eu.ident]],
            ['email', 'IN', [eu.email for eu in event_users if eu.email]],
            ['username', 'IN', [eu.username for eu in event_users if eu.username]],
            ['ip_address', 'IN', [eu.ip_address for eu in event_users if eu.ip_address]],
        ] if cond[2] != []]

        aggregations = [
            ['count', '', 'count'],
            ['min', SEEN_COLUMN, 'first_seen'],
            ['max', SEEN_COLUMN, 'last_seen'],
        ]

        result = snuba.query(start, end, ['user_id'], conditions, filters,
                             aggregations, orderby='-last_seen', limit=limit)

        return [ObjectWrapper({
            'times_seen': val['count'],
            'first_seen': val['first_seen'],
            'last_seen': val['last_seen'],
            'key': 'sentry:user',
            'value': name,
        }) for name, val in six.iteritems(result)]

    def get_groups_user_counts(self, project_id, group_ids, environment_id):
        start, end = self.get_time_range()
        filters = {
            'project_id': [project_id],
            'environment': [environment_id],
            'issue': group_ids,
        }
        aggregations = [['uniq', 'user_id', 'count']]

        result = snuba.query(start, end, ['issue'], None, filters, aggregations)
        return defaultdict(int, result.items())

    # Search
    def get_group_ids_for_search_filter(self, project_id, environment_id, tags):
        from sentry.search.base import ANY, EMPTY
        start, end = self.get_time_range()
        # Any EMPTY value means there can be no results for this query so
        # return an empty list immediately.
        if any(val == EMPTY for _, val in six.iteritems(tags)):
            return []

        filters = {
            'environment': [environment_id],
            'project_id': [project_id],
        }

        conditions = []
        for tag, val in six.iteritems(tags):
            col = 'tags[{}]'.format(tag)
            if val == ANY:
                conditions.append((col, 'IS NOT NULL', None))
            else:
                conditions.append((col, '=', val))

        issues = snuba.query(start, end, ['issue'], conditions, filters)
        return issues.keys()
