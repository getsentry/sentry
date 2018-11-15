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
from sentry.tagstore.base import TagStorage, TOP_VALUES_DEFAULT_LIMIT
from sentry.tagstore.exceptions import (
    GroupTagKeyNotFound,
    GroupTagValueNotFound,
    TagKeyNotFound,
    TagValueNotFound,
)
from sentry.tagstore.types import TagKey, TagValue, GroupTagKey, GroupTagValue
from sentry.utils import snuba
from sentry.utils.dates import to_timestamp


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
        The snuba util may further reduce this range based on the project
        retention, and first/last seen dates of the groups being queried.
        """
        end = timezone.now()
        return (end - timedelta(days=days), end)

    def __get_tag_key(self, project_id, group_id, environment_id, key):
        start, end = self.get_time_range()
        tag = u'tags[{}]'.format(key)
        filters = {
            'project_id': [project_id],
        }
        if environment_id:
            filters['environment'] = [environment_id]
        if group_id is not None:
            filters['issue'] = [group_id]
        conditions = [[tag, '!=', '']]
        aggregations = [
            ['uniq', tag, 'values_seen'],
            ['count()', '', 'count']
        ]

        result = snuba.query(start, end, [], conditions, filters, aggregations,
                             referrer='tagstore.__get_tag_key')
        if result is None or result['count'] == 0:
            raise TagKeyNotFound if group_id is None else GroupTagKeyNotFound
        else:
            data = {
                'key': key,
                'values_seen': result['values_seen'],
                'count': result['count'],
            }
            if group_id is None:
                return TagKey(**data)
            else:
                return GroupTagKey(group_id=group_id, **data)

    def __get_tag_key_and_top_values(self, project_id, group_id, environment_id,
                                     key, limit=3, raise_on_empty=True):
        start, end = self.get_time_range()
        tag = u'tags[{}]'.format(key)
        filters = {
            'project_id': [project_id],
        }
        if environment_id:
            filters['environment'] = [environment_id]
        if group_id is not None:
            filters['issue'] = [group_id]
        conditions = [[tag, '!=', '']]
        aggregations = [
            ['uniq', tag, 'values_seen'],
            ['count()', '', 'count'],
            ['min', SEEN_COLUMN, 'first_seen'],
            ['max', SEEN_COLUMN, 'last_seen'],
        ]

        result, totals = snuba.query(
            start, end, [tag], conditions, filters, aggregations,
            orderby='-count', limit=limit, totals=True,
            referrer='tagstore.__get_tag_key_and_top_values'
        )

        if raise_on_empty and (not result or totals.get('count', 0) == 0):
            raise TagKeyNotFound if group_id is None else GroupTagKeyNotFound
        else:
            if group_id is None:
                key_ctor = TagKey
                value_ctor = TagValue
            else:
                key_ctor = functools.partial(GroupTagKey, group_id=group_id)
                value_ctor = functools.partial(GroupTagValue, group_id=group_id)

            top_values = [
                value_ctor(
                    key=key,
                    value=value,
                    times_seen=data['count'],
                    first_seen=parse_datetime(data['first_seen']),
                    last_seen=parse_datetime(data['last_seen']),
                ) for value, data in six.iteritems(result)
            ]

            return key_ctor(
                key=key,
                values_seen=totals.get('values_seen', 0),
                count=totals.get('count', 0),
                top_values=top_values
            )

    def __get_tag_keys(self, project_id, group_id, environment_id, limit=1000, keys=None):
        start, end = self.get_time_range()
        filters = {
            'project_id': [project_id],
        }
        if environment_id:
            filters['environment'] = [environment_id]
        if group_id is not None:
            filters['issue'] = [group_id]
        if keys is not None:
            filters['tags_key'] = keys
        aggregations = [
            ['uniq', 'tags_value', 'values_seen'],
            ['count()', '', 'count']
        ]

        # TODO should this be sorted by count() descending, rather than the
        # number of unique values
        result = snuba.query(start, end, ['tags_key'], [], filters,
                             aggregations, limit=limit, orderby='-values_seen',
                             referrer='tagstore.__get_tag_keys')

        if group_id is None:
            ctor = TagKey
        else:
            ctor = functools.partial(GroupTagKey, group_id=group_id)

        return set([
            ctor(
                key=key,
                values_seen=data['values_seen'],
                count=data['count'],
            ) for key, data in six.iteritems(result) if data['values_seen']
        ])

    def __get_tag_value(self, project_id, group_id, environment_id, key, value):
        start, end = self.get_time_range()
        tag = u'tags[{}]'.format(key)
        filters = {
            'project_id': [project_id],
        }
        if environment_id:
            filters['environment'] = [environment_id]
        if group_id is not None:
            filters['issue'] = [group_id]
        conditions = [[tag, '=', value]]
        aggregations = [
            ['count()', '', 'times_seen'],
            ['min', SEEN_COLUMN, 'first_seen'],
            ['max', SEEN_COLUMN, 'last_seen'],
        ]

        data = snuba.query(start, end, [], conditions, filters, aggregations,
                           referrer='tagstore.__get_tag_value')
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

    def get_tag_key(self, project_id, environment_id, key, status=TagKeyStatus.VISIBLE):
        assert status is TagKeyStatus.VISIBLE
        return self.__get_tag_key_and_top_values(project_id, None, environment_id, key)

    def get_tag_keys(self, project_id, environment_id, status=TagKeyStatus.VISIBLE):
        assert status is TagKeyStatus.VISIBLE
        return self.__get_tag_keys(project_id, None, environment_id)

    def get_tag_value(self, project_id, environment_id, key, value):
        return self.__get_tag_value(project_id, None, environment_id, key, value)

    def get_tag_values(self, project_id, environment_id, key):
        key = self.__get_tag_key_and_top_values(project_id, None, environment_id, key,
                                                limit=None, raise_on_empty=False)
        return set(key.top_values)

    def get_group_tag_key(self, project_id, group_id, environment_id, key):
        return self.__get_tag_key_and_top_values(
            project_id, group_id, environment_id, key, limit=TOP_VALUES_DEFAULT_LIMIT)

    def get_group_tag_keys(self, project_id, group_id, environment_id, limit=None, keys=None):
        return self.__get_tag_keys(project_id, group_id, environment_id, limit=limit, keys=keys)

    def get_group_tag_value(self, project_id, group_id, environment_id, key, value):
        return self.__get_tag_value(project_id, group_id, environment_id, key, value)

    def get_group_tag_values(self, project_id, group_id, environment_id, key):
        # NB this uses a 'top' values function, but the limit is None so it should
        # return all values for this key.
        key = self.__get_tag_key_and_top_values(project_id, group_id, environment_id, key,
                                                limit=None, raise_on_empty=False)
        return set(key.top_values)

    def get_group_list_tag_value(self, project_id, group_id_list, environment_id, key, value):
        start, end = self.get_time_range()
        tag = u'tags[{}]'.format(key)
        filters = {
            'project_id': [project_id],
            'issue': group_id_list,
        }
        if environment_id:
            filters['environment'] = [environment_id]
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
        tag = u'tags[{}]'.format(key)
        filters = {
            'project_id': [project_id],
            'issue': [group_id],
        }
        if environment_id:
            filters['environment'] = [environment_id]
        conditions = [[tag, '!=', '']]
        aggregations = [['count()', '', 'count']]

        return snuba.query(start, end, [], conditions, filters, aggregations,
                           referrer='tagstore.get_group_tag_value_count')

    def get_top_group_tag_values(self, project_id, group_id,
                                 environment_id, key, limit=TOP_VALUES_DEFAULT_LIMIT):
        tag = self.__get_tag_key_and_top_values(project_id, group_id, environment_id, key, limit)
        return tag.top_values

    def get_group_tag_keys_and_top_values(
            self, project_id, group_id, environment_id, user=None, keys=None, value_limit=TOP_VALUES_DEFAULT_LIMIT):
        # Similar to __get_tag_key_and_top_values except we get the top values
        # for all the keys provided. value_limit in this case means the number
        # of top values for each key, so the total rows returned should be
        # num_keys * limit.  We also can't use `totals` here to get the number
        # of "other" values for each key as we only get a single total back,
        # which will be the total count across all keys.
        start, end = self.get_time_range()
        filters = {
            'project_id': [project_id],
        }
        if environment_id:
            filters['environment'] = [environment_id]
        if keys is not None:
            filters['tags_key'] = keys
        if group_id is not None:
            filters['issue'] = [group_id]

        aggregations = [
            ['count()', '', 'count'],
            ['min', SEEN_COLUMN, 'first_seen'],
            ['max', SEEN_COLUMN, 'last_seen'],
        ]

        result = snuba.query(
            start, end, ['tags_key', 'tags_value'], None, filters, aggregations,
            orderby='-count', limitby=[value_limit, 'tags_key'],
            referrer='tagstore.__get_tag_keys_and_top_values'
        )

        if group_id is None:
            key_ctor = TagKey
            value_ctor = TagValue
        else:
            key_ctor = functools.partial(GroupTagKey, group_id=group_id)
            value_ctor = functools.partial(GroupTagValue, group_id=group_id)

        return set([
            key_ctor(

                # TODO we don't know these from the current query, but in the
                # context of this method, the client usually knows these values
                # from the result of a previous call to get_group_tag_keys, so
                # we could fill them in here with another query, but also it
                # could be a waste of time.
                values_seen=0,
                count=0,

                key=key,
                top_values=[
                    value_ctor(
                        key=key,
                        value=value,
                        times_seen=data['count'],
                        first_seen=parse_datetime(data['first_seen']),
                        last_seen=parse_datetime(data['last_seen']),
                    ) for value, data in six.iteritems(values)
                ]
            ) for key, values in six.iteritems(result)
        ])

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
        }
        if environment_id:
            filters['environment'] = [environment_id]
        # NB we add release as a condition rather than a filter because
        # this method is already dealing with version strings rather than
        # release ids which would need to be translated by the snuba util.
        tag = 'sentry:release'
        col = u'tags[{}]'.format(tag)
        conditions = [[col, 'IN', versions]]
        aggregations = [
            ['count()', '', 'times_seen'],
            ['min', SEEN_COLUMN, 'first_seen'],
            ['max', SEEN_COLUMN, 'last_seen'],
        ]

        result = snuba.query(start, end, ['project_id', col],
                             conditions, filters, aggregations,
                             referrer='tagstore.get_release_tags')

        values = []
        for project_data in six.itervalues(result):
            for value, data in six.iteritems(project_data):
                values.append(
                    TagValue(
                        key=tag,
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
        conditions = [
            ['tags[sentry:user]', 'IN', filter(None, [eu.tag_value for eu in event_users])],
        ]
        aggregations = [['max', SEEN_COLUMN, 'last_seen']]

        result = snuba.query(start, end, ['issue'], conditions, filters,
                             aggregations, limit=limit, orderby='-last_seen',
                             referrer='tagstore.get_group_ids_for_users')
        return set(result.keys())

    def get_group_tag_values_for_users(self, event_users, limit=100):
        start, end = self.get_time_range()
        filters = {
            'project_id': [eu.project_id for eu in event_users]
        }
        conditions = [
            ['tags[sentry:user]', 'IN', filter(None, [eu.tag_value for eu in event_users])]
        ]
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
            'issue': group_ids,
        }
        if environment_id:
            filters['environment'] = [environment_id]
        aggregations = [['uniq', 'tags[sentry:user]', 'count']]

        result = snuba.query(start, end, ['issue'], None, filters, aggregations,
                             referrer='tagstore.get_groups_user_counts')
        return defaultdict(int, {k: v for k, v in result.items() if v})

    def get_tag_value_paginator(self, project_id, environment_id, key, query=None,
                                order_by='-last_seen'):
        from sentry.api.paginator import SequencePaginator

        if not order_by == '-last_seen':
            raise ValueError("Unsupported order_by: %s" % order_by)

        conditions = []
        if query:
            conditions.append(['tags_value', 'LIKE', u'%{}%'.format(query)])

        start, end = self.get_time_range()
        filters = {
            'project_id': [project_id],
            'tags_key': [key],
        }
        if environment_id:
            filters['environment'] = [environment_id]
        results = snuba.query(
            start=start,
            end=end,
            groupby=['tags_value'],
            filter_keys=filters,
            aggregations=[
                ['count()', '', 'times_seen'],
                ['min', 'timestamp', 'first_seen'],
                ['max', 'timestamp', 'last_seen'],
            ],
            conditions=conditions,
            orderby=order_by,
            # TODO: This means they can't actually paginate all TagValues.
            limit=1000,
            referrer='tagstore.get_tag_value_paginator',
        )

        tag_values = [
            TagValue(
                key=key,
                value=value,
                **fix_tag_value_data(data)
            ) for value, data in six.iteritems(results)
        ]

        desc = order_by.startswith('-')
        score_field = order_by.lstrip('-')
        return SequencePaginator(
            [(int(to_timestamp(getattr(tv, score_field)) * 1000), tv) for tv in tag_values],
            reverse=desc
        )

    def get_group_tag_value_iter(self, project_id, group_id, environment_id, key, callbacks=()):
        start, end = self.get_time_range()
        filters = {
            'project_id': [project_id],
            'tags_key': [key],
            'issue': [group_id],
        }
        if environment_id:
            filters['environment'] = [environment_id]
        results = snuba.query(
            start=start,
            end=end,
            groupby=['tags_value'],
            filter_keys=filters,
            aggregations=[
                ['count()', '', 'times_seen'],
                ['min', 'timestamp', 'first_seen'],
                ['max', 'timestamp', 'last_seen'],
            ],
            orderby='-first_seen',  # Closest thing to pre-existing `-id` order
            # TODO: This means they can't actually iterate all GroupTagValues.
            limit=1000,
            referrer='tagstore.get_group_tag_value_iter',
        )

        group_tag_values = [
            GroupTagValue(
                group_id=group_id,
                key=key,
                value=value,
                **fix_tag_value_data(data)
            ) for value, data in six.iteritems(results)
        ]

        for cb in callbacks:
            cb(group_tag_values)

        return group_tag_values

    def get_group_tag_value_paginator(self, project_id, group_id, environment_id, key,
                                      order_by='-id'):
        from sentry.api.paginator import SequencePaginator

        if order_by in ('-last_seen', '-first_seen'):
            pass
        elif order_by == '-id':
            # Snuba has no unique id per GroupTagValue so we'll substitute `-first_seen`
            order_by = '-first_seen'
        else:
            raise ValueError("Unsupported order_by: %s" % order_by)

        group_tag_values = self.get_group_tag_value_iter(
            project_id, group_id, environment_id, key
        )

        desc = order_by.startswith('-')
        score_field = order_by.lstrip('-')
        return SequencePaginator(
            [(int(to_timestamp(getattr(gtv, score_field)) * 1000), gtv)
             for gtv in group_tag_values],
            reverse=desc
        )

    def get_group_tag_value_qs(self, project_id, group_id, environment_id, key, value=None):
        # This method is not implemented because it is only used by the Django
        # search backend.
        raise NotImplementedError

    def get_event_tag_qs(self, project_id, environment_id, key, value):
        # This method is not implemented because it is only used by the Django
        # search backend.
        raise NotImplementedError

    def get_group_event_filter(self, project_id, group_id, environment_id, tags):
        start, end = self.get_time_range()
        filters = {
            'project_id': [project_id],
            'issue': [group_id],
        }
        if environment_id:
            filters['environment'] = [environment_id]

        conditions = [[u'tags[{}]'.format(k), '=', v] for (k, v) in tags.items()]

        result = snuba.raw_query(start, end, selected_columns=['event_id'],
                                 conditions=conditions, orderby='-timestamp', filter_keys=filters,
                                 limit=1000, referrer='tagstore.get_group_event_filter')

        event_id_set = set(row['event_id'] for row in result['data'])

        if not event_id_set:
            return None

        return {'event_id__in': event_id_set}

    def get_group_ids_for_search_filter(
            self, project_id, environment_id, tags, candidates=None, limit=1000):
        # This method is not implemented since the `group.id` column doesn't
        # exist in Snuba. This logic is implemented in the search backend
        # instead.
        raise NotImplementedError
