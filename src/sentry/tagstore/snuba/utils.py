from __future__ import absolute_import

from collections import OrderedDict
from copy import deepcopy

from sentry import tagstore
from sentry.models import Project
from sentry.tagstore.types import TagKey, TagValue
from sentry.tagstore.base import TOP_VALUES_DEFAULT_LIMIT
from sentry.utils.snuba import (
    raw_query,
    SENTRY_SNUBA_MAP,
)

NON_TAG_KEYS = SENTRY_SNUBA_MAP.copy()
NON_TAG_KEYS.update({'project.name': 'project_id'})


def lookup_tags(keys, **snuba_args):
    tag_keys = []
    non_tag_keys = []

    for key in keys:
        if key in NON_TAG_KEYS:
            non_tag_keys.append(key)
        else:
            tag_keys.append(tagstore.prefix_reserved_key(key))

    if tag_keys:
        top_values = get_top_values(keys=tag_keys, **snuba_args)
    else:
        top_values = []

    if non_tag_keys:
        handle_non_tag_keys(non_tag_keys, top_values, **snuba_args)

    total_count = get_total_value_count(**snuba_args)
    tag_keys = create_tag_objects(keys, total_count, top_values)

    # sort heatmap categories in the same order requested.
    tag_keys = sorted(tag_keys, key=lambda x: keys.index(x.key))
    return tag_keys


def handle_non_tag_keys(keys, top_values, **kwargs):
    for key in keys:
        data = query_non_tag_data(NON_TAG_KEYS[key], **kwargs)

        if key == 'project.name':
            for value in data:
                # Skip the project as the current user might not be able to see it.
                if value['project_id'] not in kwargs['filter_keys']['project_id']:
                    continue
                project_slug = (Project.objects
                                .values_list('slug', flat=True)
                                .get(id=value['project_id']))
                value['tags_key'] = key
                value['tags_value'] = project_slug
        else:
            for value in data:
                tag_value = value[NON_TAG_KEYS[key]]
                # If we have multiple values take the last one.
                # This happens most commonly with error.type and chained
                # exceptions.
                if isinstance(tag_value, list):
                    tag_value = tag_value[-1] if len(tag_value) else ''
                value['tags_key'] = key
                value['tags_value'] = tag_value

        top_values += data

    # order combined values by count
    top_values = sorted(top_values, key=lambda x: x['count'])
    return top_values


def query_non_tag_data(key, value_limit=TOP_VALUES_DEFAULT_LIMIT, **kwargs):
    kwargs = deepcopy(kwargs)
    data = raw_query(
        groupby=[key],
        conditions=kwargs.pop('conditions', []) + [
            [['isNotNull', [key]], '=', 1]
        ],
        aggregations=kwargs.pop('aggregations', []) + [
            ['count()', '', 'count'],
            ['min', 'timestamp', 'first_seen'],
            ['max', 'timestamp', 'last_seen'],
        ],
        orderby='-count',
        referrer='api.organization-events-heatmap',
        limit=value_limit,
        **kwargs
    )

    return data['data']


def create_tag_objects(keys, total_count, top_values):
    tag_keys_dict = OrderedDict()

    for top_value in top_values:
        key = top_value['tags_key']

        if key not in tag_keys_dict:
            tag_keys_dict[key] = TagKey(
                key=key,
                top_values=[],
                count=total_count,
            )
        tag_keys_dict[key].top_values.append(
            TagValue(
                key=key,
                value=top_value['tags_value'],
                times_seen=top_value['count'],
                first_seen=top_value['first_seen'],
                last_seen=top_value['last_seen'],
            )
        )

    # Add categories with no values
    for key in keys:
        if key not in tag_keys_dict:
            tag_keys_dict[key] = TagKey(
                key=key,
                top_values=[],
                count=total_count,
            )
    return tag_keys_dict.values()


def get_total_value_count(**kwargs):
    kwargs = deepcopy(kwargs)
    aggregations = kwargs.pop('aggregations', [])
    aggregations += [
        ['count()', '', 'count'],
    ]

    total_count = raw_query(
        aggregations=aggregations,
        referrer='api.organization-events-heatmap',
        **kwargs
    )['data'][0]['count']
    return total_count


def get_top_values(keys, value_limit=TOP_VALUES_DEFAULT_LIMIT, **kwargs):

    kwargs = deepcopy(kwargs)
    filters = kwargs.pop('filter_keys', {})
    filters['tags_key'] = keys

    aggregations = kwargs.pop('aggregations', [])
    aggregations += [
        ['count()', '', 'count'],
        ['min', 'timestamp', 'first_seen'],
        ['max', 'timestamp', 'last_seen'],
    ]

    values = raw_query(
        groupby=['tags_key', 'tags_value'],
        filter_keys=filters,
        aggregations=aggregations,
        orderby='-count',
        limitby=[value_limit, 'tags_key'],
        referrer='api.organization-events-heatmap',
        **kwargs
    )
    return values['data']
