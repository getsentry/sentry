from __future__ import absolute_import

import functools
from collections import defaultdict, Iterable
from dateutil.parser import parse as parse_datetime
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


SEEN_COLUMN = "timestamp"

# columns we want to exclude from methods that return
# all values for a given tag/column
BLACKLISTED_COLUMNS = frozenset(["project_id"])

tag_value_data_transformers = {"first_seen": parse_datetime, "last_seen": parse_datetime}


def fix_tag_value_data(data):
    for key, transformer in tag_value_data_transformers.items():
        if key in data:
            data[key] = transformer(data[key])
    return data


def get_project_list(project_id):
    return project_id if isinstance(project_id, Iterable) else [project_id]


class SnubaTagStorage(TagStorage):
    def __get_tag_key(self, project_id, group_id, environment_id, key):
        tag = u"tags[{}]".format(key)
        filters = {"project_id": get_project_list(project_id)}
        if environment_id:
            filters["environment"] = [environment_id]
        if group_id is not None:
            filters["group_id"] = [group_id]
        conditions = [[tag, "!=", ""]]
        aggregations = [["uniq", tag, "values_seen"], ["count()", "", "count"]]

        result = snuba.query(
            conditions=conditions,
            filter_keys=filters,
            aggregations=aggregations,
            referrer="tagstore.__get_tag_key",
        )
        if result is None or result["count"] == 0:
            raise TagKeyNotFound if group_id is None else GroupTagKeyNotFound
        else:
            data = {"key": key, "values_seen": result["values_seen"], "count": result["count"]}
            if group_id is None:
                return TagKey(**data)
            else:
                return GroupTagKey(group_id=group_id, **data)

    def __get_tag_key_and_top_values(
        self, project_id, group_id, environment_id, key, limit=3, raise_on_empty=True, **kwargs
    ):

        tag = u"tags[{}]".format(key)
        filters = {"project_id": get_project_list(project_id)}
        if environment_id:
            filters["environment"] = [environment_id]
        if group_id is not None:
            filters["group_id"] = [group_id]
        conditions = kwargs.get("conditions", [])
        aggregations = kwargs.get("aggregations", [])

        conditions.append([tag, "!=", ""])
        aggregations += [
            ["uniq", tag, "values_seen"],
            ["count()", "", "count"],
            ["min", SEEN_COLUMN, "first_seen"],
            ["max", SEEN_COLUMN, "last_seen"],
        ]

        result, totals = snuba.query(
            start=kwargs.get("start"),
            end=kwargs.get("end"),
            groupby=[tag],
            conditions=conditions,
            filter_keys=filters,
            aggregations=aggregations,
            orderby="-count",
            limit=limit,
            totals=True,
            referrer="tagstore.__get_tag_key_and_top_values",
        )

        if raise_on_empty and (not result or totals.get("count", 0) == 0):
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
                    times_seen=data["count"],
                    first_seen=parse_datetime(data["first_seen"]),
                    last_seen=parse_datetime(data["last_seen"]),
                )
                for value, data in six.iteritems(result)
            ]

            return key_ctor(
                key=key,
                values_seen=totals.get("values_seen", 0),
                count=totals.get("count", 0),
                top_values=top_values,
            )

    def __get_tag_keys(
        self,
        project_id,
        group_id,
        environment_ids,
        limit=1000,
        keys=None,
        include_values_seen=True,
        **kwargs
    ):
        return self.__get_tag_keys_for_projects(
            get_project_list(project_id),
            group_id,
            environment_ids,
            kwargs.get("start"),
            kwargs.get("end"),
            limit,
            keys,
            include_values_seen=include_values_seen,
        )

    def __get_tag_keys_for_projects(
        self,
        projects,
        group_id,
        environments,
        start,
        end,
        limit=1000,
        keys=None,
        include_values_seen=True,
        **kwargs
    ):
        filters = {"project_id": projects}
        if environments:
            filters["environment"] = environments
        if group_id is not None:
            filters["group_id"] = [group_id]
        if keys is not None:
            filters["tags_key"] = keys
        aggregations = [["count()", "", "count"]]

        if include_values_seen:
            aggregations.append(["uniq", "tags_value", "values_seen"])
        conditions = []

        result = snuba.query(
            start=start,
            end=end,
            groupby=["tags_key"],
            conditions=conditions,
            filter_keys=filters,
            aggregations=aggregations,
            limit=limit,
            orderby="-count",
            referrer="tagstore.__get_tag_keys",
            **kwargs
        )

        if group_id is None:
            ctor = TagKey
        else:
            ctor = functools.partial(GroupTagKey, group_id=group_id)

        results = set()
        for key, data in six.iteritems(result):
            params = {"key": key}
            if include_values_seen:
                params["values_seen"] = data["values_seen"]
                params["count"] = data["count"]
            else:
                # If only one aggregate is requested then data is just that raw
                # aggregate value, rather than a dictionary of
                # key:aggregate_value pairs
                params["count"] = data
            results.add(ctor(**params))
        return results

    def __get_tag_value(self, project_id, group_id, environment_id, key, value):
        tag = u"tags[{}]".format(key)
        filters = {"project_id": get_project_list(project_id)}
        if environment_id:
            filters["environment"] = [environment_id]
        if group_id is not None:
            filters["group_id"] = [group_id]
        conditions = [[tag, "=", value]]
        aggregations = [
            ["count()", "", "times_seen"],
            ["min", SEEN_COLUMN, "first_seen"],
            ["max", SEEN_COLUMN, "last_seen"],
        ]

        data = snuba.query(
            conditions=conditions,
            filter_keys=filters,
            aggregations=aggregations,
            referrer="tagstore.__get_tag_value",
        )
        if not data["times_seen"] > 0:
            raise TagValueNotFound if group_id is None else GroupTagValueNotFound
        else:
            data.update({"key": key, "value": value})
            if group_id is None:
                return TagValue(**fix_tag_value_data(data))
            else:
                return GroupTagValue(group_id=group_id, **fix_tag_value_data(data))

    def get_tag_key(self, project_id, environment_id, key, status=TagKeyStatus.VISIBLE, **kwargs):
        assert status is TagKeyStatus.VISIBLE
        return self.__get_tag_key_and_top_values(project_id, None, environment_id, key, **kwargs)

    def get_tag_keys(
        self, project_id, environment_id, status=TagKeyStatus.VISIBLE, include_values_seen=False
    ):
        assert status is TagKeyStatus.VISIBLE
        return self.__get_tag_keys(project_id, None, environment_id and [environment_id])

    def get_tag_keys_for_projects(
        self, projects, environments, start, end, status=TagKeyStatus.VISIBLE
    ):
        MAX_UNSAMPLED_PROJECTS = 50
        # We want to disable FINAL in the snuba query to reduce load.
        optimize_kwargs = {"turbo": True}
        # If we are fetching less than MAX_UNSAMPLED_PROJECTS, then disable
        # the sampling that turbo enables so that we get more accurate results.
        # We only want sampling when we have a large number of projects, so
        # that we don't cause performance issues for Snuba.
        if len(projects) <= MAX_UNSAMPLED_PROJECTS:
            optimize_kwargs["sample"] = 1
        return self.__get_tag_keys_for_projects(
            projects, None, environments, start, end, include_values_seen=False, **optimize_kwargs
        )

    def get_tag_value(self, project_id, environment_id, key, value):
        return self.__get_tag_value(project_id, None, environment_id, key, value)

    def get_tag_values(self, project_id, environment_id, key):
        key = self.__get_tag_key_and_top_values(
            project_id, None, environment_id, key, limit=None, raise_on_empty=False
        )
        return set(key.top_values)

    def get_group_tag_key(self, project_id, group_id, environment_id, key):
        return self.__get_tag_key_and_top_values(
            project_id, group_id, environment_id, key, limit=TOP_VALUES_DEFAULT_LIMIT
        )

    def get_group_tag_keys(
        self, project_id, group_id, environment_ids, limit=None, keys=None, **kwargs
    ):
        return self.__get_tag_keys(
            project_id,
            group_id,
            environment_ids,
            limit=limit,
            keys=keys,
            include_values_seen=False,
            **kwargs
        )

    def get_group_tag_value(self, project_id, group_id, environment_id, key, value):
        return self.__get_tag_value(project_id, group_id, environment_id, key, value)

    def get_group_tag_values(self, project_id, group_id, environment_id, key):
        # NB this uses a 'top' values function, but the limit is None so it should
        # return all values for this key.
        key = self.__get_tag_key_and_top_values(
            project_id, group_id, environment_id, key, limit=None, raise_on_empty=False
        )
        return set(key.top_values)

    def get_group_list_tag_value(self, project_ids, group_id_list, environment_ids, key, value):
        tag = u"tags[{}]".format(key)
        filters = {"project_id": project_ids, "group_id": group_id_list}
        if environment_ids:
            filters["environment"] = environment_ids
        conditions = [[tag, "=", value]]
        aggregations = [
            ["count()", "", "times_seen"],
            ["min", SEEN_COLUMN, "first_seen"],
            ["max", SEEN_COLUMN, "last_seen"],
        ]

        result = snuba.query(
            groupby=["group_id"],
            conditions=conditions,
            filter_keys=filters,
            aggregations=aggregations,
            referrer="tagstore.get_group_list_tag_value",
        )

        return {
            issue: GroupTagValue(group_id=issue, key=key, value=value, **fix_tag_value_data(data))
            for issue, data in six.iteritems(result)
        }

    def get_group_seen_values_for_environments(
        self, project_ids, group_id_list, environment_ids, start=None, end=None
    ):
        # Get the total times seen, first seen, and last seen across multiple environments
        filters = {"project_id": project_ids, "group_id": group_id_list}
        conditions = None
        if environment_ids:
            filters["environment"] = environment_ids

        aggregations = [
            ["count()", "", "times_seen"],
            ["min", SEEN_COLUMN, "first_seen"],
            ["max", SEEN_COLUMN, "last_seen"],
        ]

        result = snuba.query(
            start=start,
            end=end,
            groupby=["group_id"],
            conditions=conditions,
            filter_keys=filters,
            aggregations=aggregations,
            referrer="tagstore.get_group_seen_values_for_environments",
        )

        return {issue: fix_tag_value_data(data) for issue, data in six.iteritems(result)}

    def get_group_tag_value_count(self, project_id, group_id, environment_id, key):
        tag = u"tags[{}]".format(key)
        filters = {"project_id": get_project_list(project_id), "group_id": [group_id]}
        if environment_id:
            filters["environment"] = [environment_id]
        conditions = [[tag, "!=", ""]]
        aggregations = [["count()", "", "count"]]

        return snuba.query(
            conditions=conditions,
            filter_keys=filters,
            aggregations=aggregations,
            referrer="tagstore.get_group_tag_value_count",
        )

    def get_top_group_tag_values(
        self, project_id, group_id, environment_id, key, limit=TOP_VALUES_DEFAULT_LIMIT
    ):
        tag = self.__get_tag_key_and_top_values(project_id, group_id, environment_id, key, limit)
        return tag.top_values

    def get_group_tag_keys_and_top_values(
        self,
        project_id,
        group_id,
        environment_ids,
        user=None,
        keys=None,
        value_limit=TOP_VALUES_DEFAULT_LIMIT,
        **kwargs
    ):
        # Similar to __get_tag_key_and_top_values except we get the top values
        # for all the keys provided. value_limit in this case means the number
        # of top values for each key, so the total rows returned should be
        # num_keys * limit.

        # First get totals and unique counts by key.
        keys_with_counts = self.get_group_tag_keys(project_id, group_id, environment_ids, keys=keys)

        # Then get the top values with first_seen/last_seen/count for each
        filters = {"project_id": get_project_list(project_id)}
        if environment_ids:
            filters["environment"] = environment_ids
        if keys is not None:
            filters["tags_key"] = keys
        if group_id is not None:
            filters["group_id"] = [group_id]
        conditions = kwargs.get("conditions", [])
        aggregations = kwargs.get("aggregations", [])
        aggregations += [
            ["count()", "", "count"],
            ["min", SEEN_COLUMN, "first_seen"],
            ["max", SEEN_COLUMN, "last_seen"],
        ]

        values_by_key = snuba.query(
            start=kwargs.get("start"),
            end=kwargs.get("end"),
            groupby=["tags_key", "tags_value"],
            conditions=conditions,
            filter_keys=filters,
            aggregations=aggregations,
            orderby="-count",
            limitby=[value_limit, "tags_key"],
            referrer="tagstore.__get_tag_keys_and_top_values",
        )

        # Then supplement the key objects with the top values for each.
        if group_id is None:
            value_ctor = TagValue
        else:
            value_ctor = functools.partial(GroupTagValue, group_id=group_id)

        for keyobj in keys_with_counts:
            key = keyobj.key
            values = values_by_key.get(key, [])
            keyobj.top_values = [
                value_ctor(
                    key=keyobj.key,
                    value=value,
                    times_seen=data["count"],
                    first_seen=parse_datetime(data["first_seen"]),
                    last_seen=parse_datetime(data["last_seen"]),
                )
                for value, data in six.iteritems(values)
            ]

        return keys_with_counts

    def __get_release(self, project_id, group_id, first=True):
        filters = {"project_id": get_project_list(project_id)}
        conditions = [["tags[sentry:release]", "IS NOT NULL", None]]
        if group_id is not None:
            filters["group_id"] = [group_id]
        aggregations = [["min" if first else "max", SEEN_COLUMN, "seen"]]
        orderby = "seen" if first else "-seen"

        result = snuba.query(
            groupby=["tags[sentry:release]"],
            conditions=conditions,
            filter_keys=filters,
            aggregations=aggregations,
            limit=1,
            orderby=orderby,
            referrer="tagstore.__get_release",
        )
        if not result:
            return None
        else:
            return result.keys()[0]

    def get_first_release(self, project_id, group_id):
        return self.__get_release(project_id, group_id, True)

    def get_last_release(self, project_id, group_id):
        return self.__get_release(project_id, group_id, False)

    def get_release_tags(self, project_ids, environment_id, versions):
        filters = {"project_id": project_ids}
        if environment_id:
            filters["environment"] = [environment_id]
        # NB we add release as a condition rather than a filter because
        # this method is already dealing with version strings rather than
        # release ids which would need to be translated by the snuba util.
        tag = "sentry:release"
        col = u"tags[{}]".format(tag)
        conditions = [[col, "IN", versions]]
        aggregations = [
            ["count()", "", "times_seen"],
            ["min", SEEN_COLUMN, "first_seen"],
            ["max", SEEN_COLUMN, "last_seen"],
        ]

        result = snuba.query(
            groupby=["project_id", col],
            conditions=conditions,
            filter_keys=filters,
            aggregations=aggregations,
            referrer="tagstore.get_release_tags",
        )

        values = []
        for project_data in six.itervalues(result):
            for value, data in six.iteritems(project_data):
                values.append(TagValue(key=tag, value=value, **fix_tag_value_data(data)))

        return set(values)

    def get_group_ids_for_users(self, project_ids, event_users, limit=100):
        filters = {"project_id": project_ids}
        conditions = [
            ["tags[sentry:user]", "IN", filter(None, [eu.tag_value for eu in event_users])]
        ]
        aggregations = [["max", SEEN_COLUMN, "last_seen"]]

        result = snuba.query(
            groupby=["group_id"],
            conditions=conditions,
            filter_keys=filters,
            aggregations=aggregations,
            limit=limit,
            orderby="-last_seen",
            referrer="tagstore.get_group_ids_for_users",
        )
        return set(result.keys())

    def get_group_tag_values_for_users(self, event_users, limit=100):
        filters = {"project_id": [eu.project_id for eu in event_users]}
        conditions = [
            ["tags[sentry:user]", "IN", filter(None, [eu.tag_value for eu in event_users])]
        ]
        aggregations = [
            ["count()", "", "times_seen"],
            ["min", SEEN_COLUMN, "first_seen"],
            ["max", SEEN_COLUMN, "last_seen"],
        ]

        result = snuba.query(
            groupby=["group_id", "user_id"],
            conditions=conditions,
            filter_keys=filters,
            aggregations=aggregations,
            orderby="-last_seen",
            limit=limit,
            referrer="tagstore.get_group_tag_values_for_users",
        )

        values = []
        for issue, users in six.iteritems(result):
            for name, data in six.iteritems(users):
                values.append(
                    GroupTagValue(
                        group_id=issue, key="sentry:user", value=name, **fix_tag_value_data(data)
                    )
                )
        return values

    def get_groups_user_counts(self, project_ids, group_ids, environment_ids, start=None, end=None):
        filters = {"project_id": project_ids, "group_id": group_ids}
        if environment_ids:
            filters["environment"] = environment_ids
        aggregations = [["uniq", "tags[sentry:user]", "count"]]

        result = snuba.query(
            start=start,
            end=end,
            groupby=["group_id"],
            conditions=None,
            filter_keys=filters,
            aggregations=aggregations,
            referrer="tagstore.get_groups_user_counts",
        )
        return defaultdict(int, {k: v for k, v in result.items() if v})

    def get_tag_value_paginator(
        self,
        project_id,
        environment_id,
        key,
        start=None,
        end=None,
        query=None,
        order_by="-last_seen",
    ):
        return self.get_tag_value_paginator_for_projects(
            get_project_list(project_id),
            [environment_id] if environment_id else None,
            key,
            start=start,
            end=end,
            query=query,
            order_by=order_by,
        )

    def get_tag_value_paginator_for_projects(
        self, projects, environments, key, start=None, end=None, query=None, order_by="-last_seen"
    ):
        from sentry.api.paginator import SequencePaginator

        if not order_by == "-last_seen":
            raise ValueError("Unsupported order_by: %s" % order_by)

        snuba_key = snuba.get_snuba_column_name(key)

        conditions = []

        if snuba_key in BLACKLISTED_COLUMNS:
            snuba_key = "tags[%s]" % (key,)

        if query:
            conditions.append([snuba_key, "LIKE", u"%{}%".format(query)])
        else:
            conditions.append([snuba_key, "!=", ""])

        filters = {"project_id": projects}
        if environments:
            filters["environment"] = environments

        results = snuba.query(
            start=start,
            end=end,
            groupby=[snuba_key],
            filter_keys=filters,
            aggregations=[
                ["count()", "", "times_seen"],
                ["min", "timestamp", "first_seen"],
                ["max", "timestamp", "last_seen"],
            ],
            conditions=conditions,
            orderby=order_by,
            # TODO: This means they can't actually paginate all TagValues.
            limit=1000,
            arrayjoin=snuba.get_arrayjoin(snuba_key),
            referrer="tagstore.get_tag_value_paginator_for_projects",
        )

        tag_values = [
            TagValue(key=key, value=value, **fix_tag_value_data(data))
            for value, data in six.iteritems(results)
        ]

        desc = order_by.startswith("-")
        score_field = order_by.lstrip("-")
        return SequencePaginator(
            [(int(to_timestamp(getattr(tv, score_field)) * 1000), tv) for tv in tag_values],
            reverse=desc,
        )

    def get_group_tag_value_iter(self, project_id, group_id, environment_id, key, callbacks=()):
        filters = {
            "project_id": get_project_list(project_id),
            "tags_key": [key],
            "group_id": [group_id],
        }
        if environment_id:
            filters["environment"] = [environment_id]
        results = snuba.query(
            groupby=["tags_value"],
            filter_keys=filters,
            aggregations=[
                ["count()", "", "times_seen"],
                ["min", "timestamp", "first_seen"],
                ["max", "timestamp", "last_seen"],
            ],
            orderby="-first_seen",  # Closest thing to pre-existing `-id` order
            # TODO: This means they can't actually iterate all GroupTagValues.
            limit=1000,
            referrer="tagstore.get_group_tag_value_iter",
        )

        group_tag_values = [
            GroupTagValue(group_id=group_id, key=key, value=value, **fix_tag_value_data(data))
            for value, data in six.iteritems(results)
        ]

        for cb in callbacks:
            cb(group_tag_values)

        return group_tag_values

    def get_group_tag_value_paginator(
        self, project_id, group_id, environment_id, key, order_by="-id"
    ):
        from sentry.api.paginator import SequencePaginator

        if order_by in ("-last_seen", "-first_seen"):
            pass
        elif order_by == "-id":
            # Snuba has no unique id per GroupTagValue so we'll substitute `-first_seen`
            order_by = "-first_seen"
        else:
            raise ValueError("Unsupported order_by: %s" % order_by)

        group_tag_values = self.get_group_tag_value_iter(project_id, group_id, environment_id, key)

        desc = order_by.startswith("-")
        score_field = order_by.lstrip("-")
        return SequencePaginator(
            [
                (int(to_timestamp(getattr(gtv, score_field)) * 1000), gtv)
                for gtv in group_tag_values
            ],
            reverse=desc,
        )

    def get_group_tag_value_qs(self, project_id, group_id, environment_id, key, value=None):
        # This method is not implemented because it is only used by the Django
        # search backend.
        raise NotImplementedError

    def get_group_event_filter(self, project_id, group_id, environment_ids, tags, start, end):
        filters = {"project_id": get_project_list(project_id), "group_id": [group_id]}
        if environment_ids:
            filters["environment"] = environment_ids

        conditions = []
        for tag_name, tag_val in tags.items():
            operator = "IN" if isinstance(tag_val, list) else "="
            conditions.append([u"tags[{}]".format(tag_name), operator, tag_val])

        result = snuba.raw_query(
            start=start,
            end=end,
            selected_columns=["event_id"],
            conditions=conditions,
            orderby="-timestamp",
            filter_keys=filters,
            limit=1000,
            referrer="tagstore.get_group_event_filter",
        )

        event_id_set = set(row["event_id"] for row in result["data"])

        if not event_id_set:
            return None

        return {"event_id__in": event_id_set}
