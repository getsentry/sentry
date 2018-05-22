"""
sentry.tagstore.snuba.backend
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2018 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import functools
from collections import defaultdict
from datetime import timedelta
from dateutil.parser import parse as parse_datetime
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
from sentry.tagstore.types import TagKey, TagValue, GroupTagKey, GroupTagValue
from sentry.utils import snuba


SEEN_COLUMN = 'timestamp'


tag_value_data_transformers = {
    'first_seen': parse_datetime,
    'last_seen': parse_datetime,
}


def fix_tag_value_data(data):
    for key, transformer in tag_value_data_transformers.items():
        if key in data:
            data[key] = transformer(data[key])
    return data


class SnubaTagStorage(TagStorage):

    def get_time_range(self, days=90):
        """
        Returns the default (start, end) time range for querrying snuba.
        """
        # TODO this should use the per-project retention figure to limit
        # the query to looking at only the retention window for the project.
        end = timezone.now()
        return (end - timedelta(days=days), end)

    def __get_tag_key(self, project_id, group_id, environment_id, key):
        start, end = self.get_time_range()
        tag = 'tags[{}]'.format(key)
        filters = {
            'project_id': [project_id],
            'environment': [environment_id],
        }
        if group_id is not None:
            filters['issue'] = [group_id]
        conditions = [[tag, '!=', '']]
        aggregations = [['uniq', tag, 'unique_values']]

        result = snuba.query(start, end, [], conditions, filters, aggregations,
                             referrer='tagstore.__get_tag_key')
        if result == 0:
            raise TagKeyNotFound if group_id is None else GroupTagKeyNotFound
        else:
            data = {
                'key': key,
                'values_seen': result,
            }
            if group_id is None:
                return TagKey(**data)
            else:
                return GroupTagKey(group_id=group_id, **data)

    def __get_tag_keys(self, project_id, group_id, environment_id, limit=1000):
        start, end = self.get_time_range()
        filters = {
            'project_id': [project_id],
            'environment': [environment_id],
        }
        if group_id is not None:
            filters['issue'] = [group_id]
        aggregations = [['uniq', 'tags_value', 'values_seen']]

        result = snuba.query(start, end, ['tags_key'], [], filters,
                             aggregations, limit=limit, orderby='-values_seen',
                             referrer='tagstore.__get_tag_keys')

        if group_id is None:
            ctor = TagKey
        else:
            ctor = functools.partial(GroupTagKey, group_id=group_id)

        return set([ctor(key=key, values_seen=values_seen)
                    for key, values_seen in six.iteritems(result) if values_seen])

    def __get_tag_value(self, project_id, group_id, environment_id, key, value):
        start, end = self.get_time_range()
        tag = 'tags[{}]'.format(key)
        filters = {
            'project_id': [project_id],
            'environment': [environment_id],
        }
        if group_id is not None:
            filters['issue'] = [group_id]
        conditions = [[tag, '=', value]]
        aggregations = [
            ['count()', '', 'times_seen'],
            ['min', SEEN_COLUMN, 'first_seen'],
            ['max', SEEN_COLUMN, 'last_seen'],
        ]

        data = snuba.query(start, end, [], conditions, filters, aggregations)
        if not data['times_seen'] > 0:
            raise TagValueNotFound if group_id is None else GroupTagValueNotFound
        else:
            data.update({
                'key': key,
                'value': value,
            })
            if group_id is None:
                return TagValue(**fix_tag_value_data(data))
            else:
                return GroupTagValue(group_id=group_id, **fix_tag_value_data(data))

    def __get_tag_values(self, project_id, group_id, environment_id, key):
        start, end = self.get_time_range()
        tag = 'tags[{}]'.format(key)
        filters = {
            'project_id': [project_id],
            'environment': [environment_id],
        }
        if group_id is not None:
            filters['issue'] = [group_id]
        conditions = [[tag, '!=', '']]
        aggregations = [
            ['count()', '', 'times_seen'],
            ['min', SEEN_COLUMN, 'first_seen'],
            ['max', SEEN_COLUMN, 'last_seen'],
        ]

        result = snuba.query(start, end, [tag], conditions, filters, aggregations,
                             referrer='tagstore.__get_tag_values')

        if group_id is None:
            ctor = TagValue
        else:
            ctor = functools.partial(GroupTagValue, group_id=group_id)

        return set([ctor(key=key, value=value, **fix_tag_value_data(data))
                    for value, data in result.items()])

    def get_tag_key(self, project_id, environment_id, key, status=TagKeyStatus.VISIBLE):
        assert status is TagKeyStatus.VISIBLE
        return self.__get_tag_key(project_id, None, environment_id, key)

    def get_tag_keys(self, project_id, environment_id, status=TagKeyStatus.VISIBLE):
        assert status is TagKeyStatus.VISIBLE
        return self.__get_tag_keys(project_id, None, environment_id)

    def get_tag_value(self, project_id, environment_id, key, value):
        return self.__get_tag_value(project_id, None, environment_id, key, value)

    def get_tag_values(self, project_id, environment_id, key):
        return self.__get_tag_values(project_id, None, environment_id, key)

    def get_group_tag_key(self, project_id, group_id, environment_id, key):
        return self.__get_tag_key(project_id, group_id, environment_id, key)

    def get_group_tag_keys(self, project_id, group_id, environment_id, limit=None):
        return self.__get_tag_keys(project_id, group_id, environment_id, limit=limit)

    def get_group_tag_value(self, project_id, group_id, environment_id, key, value):
        return self.__get_tag_value(project_id, group_id, environment_id, key, value)

    def get_group_tag_values(self, project_id, group_id, environment_id, key):
        return self.__get_tag_values(project_id, group_id, environment_id, key)

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
        aggregations = [
            ['count()', '', 'times_seen'],
            ['min', SEEN_COLUMN, 'first_seen'],
            ['max', SEEN_COLUMN, 'last_seen'],
        ]

        result = snuba.query(start, end, ['issue'], conditions, filters, aggregations,
                             referrer='tagstore.get_group_list_tag_value')

        return {
            issue: GroupTagValue(
                group_id=issue,
                key=key,
                value=value,
                **fix_tag_value_data(data)
            ) for issue, data in six.iteritems(result)
        }

    def get_group_tag_value_count(self, project_id, group_id, environment_id, key):
        start, end = self.get_time_range()
        tag = 'tags[{}]'.format(key)
        filters = {
            'project_id': [project_id],
            'environment': [environment_id],
            'issue': [group_id],
        }
        conditions = [[tag, '!=', '']]
        aggregations = [['count()', '', 'count']]

        return snuba.query(start, end, [], conditions, filters, aggregations,
                           referrer='tagstore.get_group_tag_value_count')

    def get_top_group_tag_values(self, project_id, group_id, environment_id, key, limit=3):
        start, end = self.get_time_range()
        tag = 'tags[{}]'.format(key)
        filters = {
            'project_id': [project_id],
            'environment': [environment_id],
            'issue': [group_id],
        }
        conditions = [[tag, '!=', '']]
        aggregations = [
            ['count()', '', 'times_seen'],
            ['min', SEEN_COLUMN, 'first_seen'],
            ['max', SEEN_COLUMN, 'last_seen'],
        ]

        result = snuba.query(start, end, [tag], conditions, filters,
                             aggregations, limit=limit, orderby='-times_seen',
                             referrer='tagstore.get_top_group_tag_values')
        return [
            GroupTagValue(
                group_id=group_id,
                key=key,
                value=value,
                **fix_tag_value_data(data)
            ) for value, data in six.iteritems(result)
        ]

    def __get_release(self, project_id, group_id, first=True):
        start, end = self.get_time_range()
        filters = {
            'project_id': [project_id],
        }
        conditions = [['tags[sentry:release]', 'IS NOT NULL', None]]
        if group_id is not None:
            filters['issue'] = [group_id]
        aggregations = [['min' if first else 'max', SEEN_COLUMN, 'seen']]
        orderby = 'seen' if first else '-seen'

        result = snuba.query(start, end, ['tags[sentry:release]'], conditions, filters,
                             aggregations, limit=1, orderby=orderby,
                             referrer='tagstore.__get_release')
        if not result:
            return None
        else:
            return result.keys()[0]

    def get_first_release(self, project_id, group_id):
        return self.__get_release(project_id, group_id, True)

    def get_last_release(self, project_id, group_id):
        return self.__get_release(project_id, group_id, False)

    def get_release_tags(self, project_ids, environment_id, versions):
        start, end = self.get_time_range()
        filters = {
            'project_id': project_ids,
            'environment': [environment_id],
        }
        # NB we add release as a condition rather than a filter because
        # this method is already dealing with version strings rather than
        # release ids which would need to be translated by the snuba util.
        key = 'tags[sentry:release]'
        conditions = [[key, 'IN', versions]]
        aggregations = [
            ['count()', '', 'times_seen'],
            ['min', SEEN_COLUMN, 'first_seen'],
            ['max', SEEN_COLUMN, 'last_seen'],
        ]

        result = snuba.query(start, end, ['project_id', key],
                             conditions, filters, aggregations,
                             referrer='tagstore.get_release_tags')

        values = []
        for project_data in six.itervalues(result):
            for value, data in six.iteritems(project_data):
                values.append(
                    TagValue(
                        key=key,
                        value=value,
                        **fix_tag_value_data(data)
                    )
                )

        return set(values)

    def get_group_ids_for_users(self, project_ids, event_users, limit=100):
        start, end = self.get_time_range()
        filters = {
            'project_id': project_ids,
        }
        or_conditions = [cond for cond in [
            ('user_id', 'IN', [eu.ident for eu in event_users if eu.ident]),
            ('email', 'IN', [eu.email for eu in event_users if eu.email]),
            ('username', 'IN', [eu.username for eu in event_users if eu.username]),
            ('ip_address', 'IN', [eu.ip_address for eu in event_users if eu.ip_address]),
        ] if cond[2] != []]
        conditions = [or_conditions]
        aggregations = [['max', SEEN_COLUMN, 'seen']]

        result = snuba.query(start, end, ['issue'], conditions, filters,
                             aggregations, limit=limit, orderby='-seen',
                             referrer='tagstore.get_group_ids_for_users')
        return result.keys()

    def get_group_tag_values_for_users(self, event_users, limit=100):
        start, end = self.get_time_range()
        filters = {
            'project_id': [eu.project_id for eu in event_users]
        }
        or_conditions = [cond for cond in [
            ('user_id', 'IN', [eu.ident for eu in event_users if eu.ident]),
            ('email', 'IN', [eu.email for eu in event_users if eu.email]),
            ('username', 'IN', [eu.username for eu in event_users if eu.username]),
            ('ip_address', 'IN', [eu.ip_address for eu in event_users if eu.ip_address]),
        ] if cond[2] != []]
        conditions = [or_conditions]
        aggregations = [
            ['count()', '', 'times_seen'],
            ['min', SEEN_COLUMN, 'first_seen'],
            ['max', SEEN_COLUMN, 'last_seen'],
        ]

        result = snuba.query(start, end, ['issue', 'user_id'], conditions, filters,
                             aggregations, orderby='-last_seen', limit=limit,
                             referrer='tagstore.get_group_tag_values_for_users')

        values = []
        for issue, users in six.iteritems(result):
            for name, data in six.iteritems(users):
                values.append(
                    GroupTagValue(
                        group_id=issue,
                        key='sentry:user',
                        value=name,
                        **fix_tag_value_data(data)
                    )
                )
        return values

    def get_groups_user_counts(self, project_id, group_ids, environment_id):
        start, end = self.get_time_range()
        filters = {
            'project_id': [project_id],
            'environment': [environment_id],
            'issue': group_ids,
        }
        aggregations = [['uniq', 'user_id', 'count']]

        result = snuba.query(start, end, ['issue'], None, filters, aggregations,
                             referrer='tagstore.get_groups_user_counts')
        return defaultdict(int, {k: v for k, v in result.items() if v})

    def get_group_event_ids(self, project_id, group_id, environment_id, tags):
        # This method is not implemented since the `event.id` column doesn't
        # exist in Snuba.
        raise NotImplementedError

    def get_group_ids_for_search_filter(
            self, project_id, environment_id, tags, candidates=None, limit=1000):
        # This method is not implemented since the `group.id` column doesn't
        # exist in Snuba. This logic is implemented in the search backend
        # instead.
        raise NotImplementedError
