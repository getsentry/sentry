import functools
import os
import re
from collections import defaultdict
from collections.abc import Iterable, Sequence
from datetime import timedelta, timezone
from typing import Any

from dateutil.parser import parse as parse_datetime
from django.core.cache import cache
from sentry_relay.consts import SPAN_STATUS_CODE_TO_NAME
from snuba_sdk import Column, Condition, Direction, Entity, Function, Op, OrderBy, Query, Request

from sentry import analytics, features, options
from sentry.api.utils import default_start_end_dates
from sentry.issues.grouptype import GroupCategory
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.release import Release
from sentry.models.releaseenvironment import ReleaseEnvironment
from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment
from sentry.models.releases.release_project import ReleaseProject
from sentry.replays.query import query_replays_dataset_tagkey_values
from sentry.search.events.constants import (
    PROJECT_ALIAS,
    RELEASE_ALIAS,
    RELEASE_STAGE_ALIAS,
    SEMVER_ALIAS,
    SEMVER_BUILD_ALIAS,
    SEMVER_PACKAGE_ALIAS,
    USER_DISPLAY_ALIAS,
)
from sentry.search.events.fields import FIELD_ALIASES
from sentry.search.events.filter import _flip_field_sort
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.tagstore.base import TOP_VALUES_DEFAULT_LIMIT, TagKeyStatus, TagStorage
from sentry.tagstore.exceptions import (
    GroupTagKeyNotFound,
    GroupTagValueNotFound,
    TagKeyNotFound,
    TagValueNotFound,
)
from sentry.tagstore.types import GroupTagKey, GroupTagValue, TagKey, TagValue
from sentry.utils import metrics, snuba
from sentry.utils.hashlib import md5_text
from sentry.utils.snuba import (
    _prepare_start_end,
    get_organization_id_from_project_ids,
    get_snuba_translators,
    nest_groups,
    raw_snql_query,
)

_max_unsampled_projects = 50
if os.environ.get("SENTRY_SINGLE_TENANT"):
    # This is a patch we used to have in single-tenant, but moving here
    # to simplify image builds.
    # hack(tagstore): Always sample get_tag_keys_for_projects query
    _max_unsampled_projects = 0

SEEN_COLUMN = "timestamp"

# columns we want to exclude from methods that return
# all values for a given tag/column
BLACKLISTED_COLUMNS = frozenset(["project_id"])

BOOLEAN_KEYS = frozenset(["error.handled", "error.unhandled", "error.main_thread", "stack.in_app"])

FUZZY_NUMERIC_KEYS = frozenset(
    ["stack.colno", "stack.lineno", "stack.stack_level", "transaction.duration"]
)
FUZZY_NUMERIC_DISTANCE = 50

# Since all event types are currently stored together, we need to manually exclude transactions
# when querying the events dataset. This condition can be dropped once we cut over to the errors
# storage in Snuba.
DEFAULT_TYPE_CONDITION = ["type", "!=", "transaction"]

tag_value_data_transformers = {"first_seen": parse_datetime, "last_seen": parse_datetime}


def is_boolean_key(key):
    return key in BOOLEAN_KEYS


def is_fuzzy_numeric_key(key):
    return key in FUZZY_NUMERIC_KEYS or snuba.is_measurement(key) or snuba.is_span_op_breakdown(key)


def fix_tag_value_data(data):
    for key, transformer in tag_value_data_transformers.items():
        if key in data:
            data[key] = transformer(data[key]).replace(tzinfo=timezone.utc)
    return data


def get_project_list(project_id):
    return project_id if isinstance(project_id, Iterable) else [project_id]


def _translate_filter_keys(project_ids, group_ids, environment_ids) -> dict[str, Any]:
    filter_keys = {"project_id": project_ids}

    if environment_ids:
        filter_keys["environment"] = environment_ids
    if group_ids:
        filter_keys["group_id"] = group_ids

    forward, reverse = get_snuba_translators(filter_keys, is_grouprelease=False)
    return forward(filter_keys)


class SnubaTagStorage(TagStorage):
    def __get_tag_key(self, project_id, group_id, environment_id, key):
        tag = f"tags[{key}]"
        filters = {"project_id": get_project_list(project_id)}
        if environment_id:
            filters["environment"] = [environment_id]
        if group_id is not None:
            filters["group_id"] = [group_id]
        conditions = [[tag, "!=", ""], DEFAULT_TYPE_CONDITION]
        aggregations = [["uniq", tag, "values_seen"], ["count()", "", "count"]]

        result = snuba.query(
            dataset=Dataset.Events,
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
        self,
        project_id,
        group,
        environment_id,
        key,
        limit=3,
        raise_on_empty=True,
        tenant_ids=None,
        **kwargs,
    ):
        tag = f"tags[{key}]"
        filters = {"project_id": get_project_list(project_id)}
        if environment_id:
            filters["environment"] = [environment_id]
        conditions = kwargs.get("conditions", [])
        aggregations = kwargs.get("aggregations", [])

        dataset, conditions, filters = self.apply_group_filters_conditions(
            group, conditions, filters
        )
        conditions.append([tag, "!=", ""])
        aggregations += [
            ["uniq", tag, "values_seen"],
            ["count()", "", "count"],
            ["min", SEEN_COLUMN, "first_seen"],
            ["max", SEEN_COLUMN, "last_seen"],
        ]

        result, totals = snuba.query(
            dataset=dataset,
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
            tenant_ids=tenant_ids,
        )

        if raise_on_empty and (not result or totals.get("count", 0) == 0):
            raise TagKeyNotFound if group is None else GroupTagKeyNotFound
        else:
            if group is None:
                key_ctor = TagKey
                value_ctor = TagValue
            else:
                key_ctor = functools.partial(GroupTagKey, group_id=group.id)
                value_ctor = functools.partial(GroupTagValue, group_id=group.id)

            top_values = [
                value_ctor(
                    key=key,
                    value=value,
                    times_seen=data["count"],
                    first_seen=parse_datetime(data["first_seen"]),
                    last_seen=parse_datetime(data["last_seen"]),
                )
                for value, data in result.items()
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
        group,
        environment_ids,
        limit=1000,
        keys=None,
        include_values_seen=True,
        dataset: Dataset = Dataset.Events,
        denylist=None,
        tenant_ids=None,
        **kwargs,
    ):
        return self.__get_tag_keys_for_projects(
            get_project_list(project_id),
            group,
            environment_ids,
            kwargs.get("start"),
            kwargs.get("end"),
            limit,
            keys,
            include_values_seen=include_values_seen,
            dataset=dataset,
            denylist=denylist,
            tenant_ids=tenant_ids,
        )

    def __get_tag_keys_for_projects(
        self,
        projects,
        group,
        environments,
        start,
        end,
        limit=1000,
        keys=None,
        include_values_seen=True,
        use_cache=False,
        denylist=None,
        dataset: Dataset = Dataset.Discover,
        **kwargs,
    ):
        """Query snuba for tag keys based on projects

        When use_cache is passed, we'll attempt to use the cache. There's an exception if group_id was passed
        which refines the query enough caching isn't required.
        The cache key is based on the filters being passed so that different queries don't hit the same cache, with
        exceptions for start and end dates. Since even a microsecond passing would result in a different caching
        key, which means always missing the cache.
        Instead, to keep the cache key the same for a short period we append the duration, and the end time rounded
        with a certain jitter to the cache key.
        This jitter is based on the hash of the key before duration/end time is added for consistency per query.
        The jitter's intent is to avoid a dogpile effect of many queries being invalidated at the same time.
        This is done by changing the rounding of the end key to a random offset. See snuba.quantize_time for
        further explanation of how that is done.
        """
        default_start, default_end = default_start_end_dates()
        if start is None:
            start = default_start
        if end is None:
            end = default_end

        conditions = []
        aggregations = [["count()", "", "count"]]

        filters = {"project_id": sorted(projects)}
        if environments:
            filters["environment"] = sorted(environments)
        if group is not None:
            # We override dataset changes from `dataset` here. They aren't relevant
            # when filtering by a group.
            dataset, conditions, filters = self.apply_group_filters_conditions(
                group, conditions, filters
            )

        if keys is not None:
            filters["tags_key"] = sorted(keys)

        if include_values_seen:
            aggregations.append(["uniq", "tags_value", "values_seen"])

        should_cache = use_cache and group is None
        result = None

        cache_key = None
        if should_cache:
            filtering_strings = [f"{key}={value}" for key, value in filters.items()]
            filtering_strings.append(f"dataset={dataset.name}")
            cache_key = "tagstore.__get_tag_keys:{}".format(
                md5_text(*filtering_strings).hexdigest()
            )
            key_hash = hash(cache_key)

            # Needs to happen before creating the cache suffix otherwise rounding will cause different durations
            duration = (end - start).total_seconds()
            # Cause there's rounding to create this cache suffix, we want to update the query end so results match
            end = snuba.quantize_time(end, key_hash)
            cache_key += f":{duration}@{end.isoformat()}"
            result = cache.get(cache_key, None)
            if result is not None:
                metrics.incr("testing.tagstore.cache_tag_key.hit")
            else:
                metrics.incr("testing.tagstore.cache_tag_key.miss")

        if result is None:
            result = snuba.query(
                dataset=dataset,
                start=start,
                end=end,
                groupby=["tags_key"],
                conditions=conditions,
                filter_keys=filters,
                aggregations=aggregations,
                limit=limit,
                orderby="-count",
                referrer="tagstore.__get_tag_keys",
                **kwargs,
            )
            if should_cache:
                cache.set(cache_key, result, 300)
                metrics.incr("testing.tagstore.cache_tag_key.len", amount=len(result))

        if group is None:
            ctor = TagKey
        else:
            ctor = functools.partial(GroupTagKey, group_id=group.id)

        results = set()

        for key, data in result.items():
            # Ignore key (skip interaction) if it's in denylist
            if denylist is not None and key in denylist:
                continue

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

    def __get_tag_value(self, project_id, group_id, environment_id, key, value, tenant_ids=None):
        tag = f"tags[{key}]"
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
            dataset=Dataset.Events,
            conditions=conditions,
            filter_keys=filters,
            aggregations=aggregations,
            referrer="tagstore.__get_tag_value",
            tenant_ids=tenant_ids,
        )
        if not data["times_seen"] > 0:
            raise TagValueNotFound if group_id is None else GroupTagValueNotFound
        else:
            data.update({"key": key, "value": value})
            if group_id is None:
                return TagValue(**fix_tag_value_data(data))
            else:
                return GroupTagValue(group_id=group_id, **fix_tag_value_data(data))

    def get_tag_key(
        self,
        project_id,
        environment_id,
        key,
        status=TagKeyStatus.ACTIVE,
        tenant_ids=None,
        **kwargs,
    ):
        assert status is TagKeyStatus.ACTIVE
        return self.__get_tag_key_and_top_values(
            project_id, None, environment_id, key, tenant_ids=tenant_ids, **kwargs
        )

    def get_tag_keys(
        self,
        project_id,
        environment_id,
        status=TagKeyStatus.ACTIVE,
        include_values_seen=False,
        denylist=None,
        tenant_ids=None,
    ):
        assert status is TagKeyStatus.ACTIVE
        return self.__get_tag_keys(
            project_id,
            None,
            environment_id and [environment_id],
            denylist=denylist,
            tenant_ids=tenant_ids,
        )

    def get_tag_keys_for_projects(
        self,
        projects,
        environments,
        start,
        end,
        dataset: Dataset = Dataset.Events,
        status=TagKeyStatus.ACTIVE,
        use_cache: bool = False,
        tenant_ids=None,
    ):
        max_unsampled_projects = _max_unsampled_projects
        # We want to disable FINAL in the snuba query to reduce load.
        optimize_kwargs = {"turbo": True}

        # Add static sample amount to the query. Turbo will sample at 10% by
        # default, but organizations with many events still get timeouts. A
        # static sample creates more consistent performance.
        organization_id = get_organization_id_from_project_ids(projects)
        organization = Organization.objects.get_from_cache(id=organization_id)
        if features.has("organizations:tag-key-sample-n", organization):
            optimize_kwargs["sample"] = options.get("visibility.tag-key-sample-size")
        # If we are fetching less than max_unsampled_projects, then disable
        # the sampling that turbo enables so that we get more accurate results.
        # We only want sampling when we have a large number of projects, so
        # that we don't cause performance issues for Snuba.
        # We also see issues with long timeranges in large projects,
        # So only disable sampling if the timerange is short enough.
        elif len(projects) <= max_unsampled_projects and end - start <= timedelta(days=14):
            optimize_kwargs["sample"] = 1

        # Replays doesn't support sampling.
        if dataset == Dataset.Replays:
            optimize_kwargs = {}

        return self.__get_tag_keys_for_projects(
            projects,
            None,
            environments,
            start,
            end,
            dataset=dataset,
            include_values_seen=False,
            use_cache=use_cache,
            tenant_ids=tenant_ids,
            **optimize_kwargs,
        )

    def get_tag_value(self, project_id, environment_id, key, value, tenant_ids=None):
        return self.__get_tag_value(
            project_id, None, environment_id, key, value, tenant_ids=tenant_ids
        )

    def get_tag_values(self, project_id, environment_id, key, tenant_ids=None):
        key = self.__get_tag_key_and_top_values(
            project_id,
            None,
            environment_id,
            key,
            limit=None,
            raise_on_empty=False,
            tenant_ids=tenant_ids,
        )
        return set(key.top_values)

    def get_group_tag_key(self, group, environment_id, key, tenant_ids=None):
        return self.__get_tag_key_and_top_values(
            group.project_id,
            group,
            environment_id,
            key,
            limit=TOP_VALUES_DEFAULT_LIMIT,
            tenant_ids=tenant_ids,
        )

    def get_group_tag_keys(
        self, group, environment_ids, limit=None, keys=None, tenant_ids=None, **kwargs
    ):
        """Get tag keys for a specific group"""
        return self.__get_tag_keys(
            group.project_id,
            group,
            environment_ids,
            dataset=Dataset.Events,
            limit=limit,
            keys=keys,
            include_values_seen=False,
            tenant_ids=tenant_ids,
            **kwargs,
        )

    def get_group_tag_value(
        self, project_id, group_id, environment_id, key, value, tenant_ids=None
    ):
        return self.__get_tag_value(
            project_id, group_id, environment_id, key, value, tenant_ids=tenant_ids
        )

    def get_group_tag_values(self, group, environment_id, key, tenant_ids=None):
        # NB this uses a 'top' values function, but the limit is None so it should
        # return all values for this key.
        key = self.__get_tag_key_and_top_values(
            group.project_id,
            group,
            environment_id,
            key,
            limit=None,
            raise_on_empty=False,
            tenant_ids=tenant_ids,
        )
        return set(key.top_values)

    def __get_group_list_tag_value(
        self,
        project_ids,
        group_id_list,
        environment_ids,
        key,
        value,
        dataset,
        extra_conditions,
        extra_aggregations,
        referrer,
        tenant_ids=None,
    ):
        filters = {"project_id": project_ids, "group_id": group_id_list}
        if environment_ids:
            filters["environment"] = environment_ids
        conditions = (extra_conditions if extra_conditions else []) + [[f"tags[{key}]", "=", value]]
        aggregations = (extra_aggregations if extra_aggregations else []) + [
            ["count()", "", "times_seen"],
            ["min", SEEN_COLUMN, "first_seen"],
            ["max", SEEN_COLUMN, "last_seen"],
        ]

        result = snuba.query(
            dataset=dataset,
            groupby=["group_id"],
            conditions=conditions,
            filter_keys=filters,
            aggregations=aggregations,
            referrer=referrer,
            tenant_ids=tenant_ids,
        )

        return {
            group_id: GroupTagValue(
                group_id=group_id, key=key, value=value, **fix_tag_value_data(data)
            )
            for group_id, data in result.items()
        }

    def get_group_list_tag_value(
        self, project_ids, group_id_list, environment_ids, key, value, tenant_ids=None
    ):
        return self.__get_group_list_tag_value(
            project_ids,
            group_id_list,
            environment_ids,
            key,
            value,
            Dataset.Events,
            [DEFAULT_TYPE_CONDITION],
            [],
            "tagstore.get_group_list_tag_value",
            tenant_ids=tenant_ids,
        )

    def get_generic_group_list_tag_value(
        self, project_ids, group_id_list, environment_ids, key, value, tenant_ids=None
    ):
        translated_params = _translate_filter_keys(project_ids, group_id_list, environment_ids)
        organization_id = get_organization_id_from_project_ids(project_ids)
        start, end = _prepare_start_end(
            None,
            None,
            organization_id,
            group_id_list,
        )

        where_conditions = [
            Condition(Column("project_id"), Op.IN, project_ids),
            Condition(Column("group_id"), Op.IN, group_id_list),
            Condition(Column("timestamp"), Op.LT, end),
            Condition(Column("timestamp"), Op.GTE, start),
            Condition(Column(f"tags[{key}]"), Op.EQ, value),
        ]
        if translated_params.get("environment"):
            Condition(Column("environment"), Op.IN, translated_params["environment"]),

        snuba_request = Request(
            dataset="search_issues",
            app_id="tagstore",
            query=Query(
                match=Entity("search_issues"),
                select=[
                    Column("group_id"),
                    Function("count", [], "times_seen"),
                    Function("min", [Column("timestamp")], "first_seen"),
                    Function("max", [Column("timestamp")], "last_seen"),
                ],
                where=where_conditions,
                groupby=[Column("group_id")],
            ),
            tenant_ids=tenant_ids,
        )
        result_snql = raw_snql_query(
            snuba_request, referrer="tagstore.get_generic_group_list_tag_value", use_cache=True
        )

        nested_groups = nest_groups(
            result_snql["data"], ["group_id"], ["times_seen", "first_seen", "last_seen"]
        )

        return {
            group_id: GroupTagValue(
                group_id=group_id, key=key, value=value, **fix_tag_value_data(data)
            )
            for group_id, data in nested_groups.items()
        }

    def get_group_seen_values_for_environments(
        self, project_ids, group_id_list, environment_ids, start=None, end=None, tenant_ids=None
    ):
        # Get the total times seen, first seen, and last seen across multiple environments
        filters = {"project_id": project_ids, "group_id": group_id_list}
        if environment_ids:
            filters["environment"] = environment_ids

        aggregations = [
            ["count()", "", "times_seen"],
            ["min", SEEN_COLUMN, "first_seen"],
            ["max", SEEN_COLUMN, "last_seen"],
        ]

        result = snuba.query(
            dataset=Dataset.Events,
            start=start,
            end=end,
            groupby=["group_id"],
            conditions=[DEFAULT_TYPE_CONDITION],
            filter_keys=filters,
            aggregations=aggregations,
            referrer="tagstore.get_group_seen_values_for_environments",
            tenant_ids=tenant_ids,
        )

        return {issue: fix_tag_value_data(data) for issue, data in result.items()}

    def apply_group_filters_conditions(self, group: Group, conditions, filters):
        dataset = Dataset.Events
        if group:
            filters["group_id"] = [group.id]
            if group.issue_category != GroupCategory.ERROR:
                dataset = Dataset.IssuePlatform
        return dataset, conditions, filters

    def get_group_tag_value_count(self, group, environment_id, key, tenant_ids=None):
        tag = f"tags[{key}]"
        filters = {"project_id": get_project_list(group.project_id)}
        if environment_id:
            filters["environment"] = [environment_id]
        conditions = [[tag, "!=", ""]]
        aggregations = [["count()", "", "count"]]
        dataset, conditions, filters = self.apply_group_filters_conditions(
            group, conditions, filters
        )

        return snuba.query(
            dataset=dataset,
            conditions=conditions,
            filter_keys=filters,
            aggregations=aggregations,
            referrer="tagstore.get_group_tag_value_count",
            tenant_ids=tenant_ids,
        )

    def get_top_group_tag_values(
        self, group, environment_id, key, limit=TOP_VALUES_DEFAULT_LIMIT, tenant_ids=None
    ):
        tag = self.__get_tag_key_and_top_values(
            group.project_id, group, environment_id, key, limit, tenant_ids=tenant_ids
        )
        return tag.top_values

    def get_group_tag_keys_and_top_values(
        self,
        group: Group,
        environment_ids: Sequence[int],
        keys: Sequence[str] | None = None,
        value_limit: int = TOP_VALUES_DEFAULT_LIMIT,
        tenant_ids=None,
        **kwargs,
    ):
        # Similar to __get_tag_key_and_top_values except we get the top values
        # for all the keys provided. value_limit in this case means the number
        # of top values for each key, so the total rows returned should be
        # num_keys * limit.

        # First get totals and unique counts by key.
        keys_with_counts = self.get_group_tag_keys(
            group, environment_ids, keys=keys, tenant_ids=tenant_ids
        )

        # Then get the top values with first_seen/last_seen/count for each
        filters = {"project_id": get_project_list(group.project_id)}
        conditions = kwargs.get("conditions", [])

        if environment_ids:
            filters["environment"] = environment_ids
        if keys is not None:
            filters["tags_key"] = keys
        dataset, conditions, filters = self.apply_group_filters_conditions(
            group, conditions, filters
        )
        aggregations = kwargs.get("aggregations", [])
        aggregations += [
            ["count()", "", "count"],
            ["min", SEEN_COLUMN, "first_seen"],
            ["max", SEEN_COLUMN, "last_seen"],
        ]

        values_by_key = snuba.query(
            dataset=dataset,
            start=kwargs.get("start"),
            end=kwargs.get("end"),
            groupby=["tags_key", "tags_value"],
            conditions=conditions,
            filter_keys=filters,
            aggregations=aggregations,
            orderby="-count",
            limitby=[value_limit, "tags_key"],
            referrer="tagstore._get_tag_keys_and_top_values",
            tenant_ids=tenant_ids,
        )

        # Then supplement the key objects with the top values for each.
        for keyobj in keys_with_counts:
            key = keyobj.key
            values = values_by_key.get(key, dict())
            keyobj.top_values = [
                GroupTagValue(
                    group_id=group.id,
                    key=keyobj.key,
                    value=value,
                    times_seen=data["count"],
                    first_seen=parse_datetime(data["first_seen"]),
                    last_seen=parse_datetime(data["last_seen"]),
                )
                for value, data in values.items()
            ]

        return keys_with_counts

    def get_release_tags(self, organization_id, project_ids, environment_id, versions):
        filters = {"project_id": project_ids}
        if environment_id:
            filters["environment"] = [environment_id]
        # NB we add release as a condition rather than a filter because
        # this method is already dealing with version strings rather than
        # release ids which would need to be translated by the snuba util.
        tag = "sentry:release"
        col = f"tags[{tag}]"
        conditions = [[col, "IN", versions], DEFAULT_TYPE_CONDITION]
        aggregations = [
            ["count()", "", "times_seen"],
            ["min", SEEN_COLUMN, "first_seen"],
            ["max", SEEN_COLUMN, "last_seen"],
        ]
        start = self.get_min_start_date(organization_id, project_ids, environment_id, versions)
        result = snuba.query(
            dataset=Dataset.Events,
            start=start,
            groupby=["project_id", col],
            conditions=conditions,
            filter_keys=filters,
            aggregations=aggregations,
            orderby="-times_seen",
            referrer="tagstore.get_release_tags",
            tenant_ids={"organization_id": organization_id},
        )

        values = []
        for project_data in result.values():
            for value, data in project_data.items():
                values.append(TagValue(key=tag, value=value, **fix_tag_value_data(data)))

        return set(values)

    def get_min_start_date(self, organization_id, project_ids, environment_id, versions):
        rpe = ReleaseProjectEnvironment.objects.filter(
            project_id__in=project_ids,
            release__version__in=versions,
            release__organization_id=organization_id,
        ).order_by("first_seen")

        if environment_id:
            rpe = rpe.filter(environment_id=environment_id)

        rpe = rpe.first()
        if rpe:
            return rpe.first_seen

        return None

    def get_group_tag_values_for_users(self, event_users, limit=100, tenant_ids=None):
        """While not specific to a group_id, this is currently only used in issues, so the Events dataset is used"""
        filters = {"project_id": [eu.project_id for eu in event_users]}
        conditions = [
            ["tags[sentry:user]", "IN", [_f for _f in [eu.tag_value for eu in event_users] if _f]]
        ]
        aggregations = [
            ["count()", "", "times_seen"],
            ["min", SEEN_COLUMN, "first_seen"],
            ["max", SEEN_COLUMN, "last_seen"],
        ]

        result = snuba.query(
            dataset=Dataset.Events,
            groupby=["group_id", "user_id"],
            conditions=conditions,
            filter_keys=filters,
            aggregations=aggregations,
            orderby="-last_seen",
            limit=limit,
            referrer="tagstore.get_group_tag_values_for_users",
            tenant_ids=tenant_ids,
        )

        values = []
        for issue, users in result.items():
            for name, data in users.items():
                values.append(
                    GroupTagValue(
                        group_id=issue, key="sentry:user", value=name, **fix_tag_value_data(data)
                    )
                )
        for project_id in {eu.project_id for eu in event_users}:
            analytics.record(
                "eventuser_endpoint.request",
                project_id=project_id,
                endpoint="sentry.tagstore.snuba.backend.SnubaTagStorage.get_group_tag_values_for_users",
            )

        return values

    def __get_groups_user_counts(
        self,
        project_ids,
        group_ids,
        environment_ids,
        start=None,
        end=None,
        dataset=Dataset.Events,
        extra_aggregations=None,
        referrer=Referrer.TAGSTORE_GET_GROUPS_USER_COUNTS.value,
        tenant_ids=None,
    ):
        filters = {"project_id": project_ids, "group_id": group_ids}
        if environment_ids:
            filters["environment"] = environment_ids

        aggregations = (extra_aggregations if extra_aggregations else []) + [
            ["uniq", "tags[sentry:user]", "count"]
        ]

        result = snuba.query(
            dataset=dataset,
            start=start,
            end=end,
            groupby=["group_id"],
            conditions=None,
            filter_keys=filters,
            aggregations=aggregations,
            orderby="-count",
            referrer=referrer,
            tenant_ids=tenant_ids,
        )

        return defaultdict(int, {k: v for k, v in result.items() if v})

    def get_groups_user_counts(
        self,
        project_ids,
        group_ids,
        environment_ids,
        start=None,
        end=None,
        tenant_ids=None,
        referrer="tagstore.get_groups_user_counts",
    ):
        return self.__get_groups_user_counts(
            project_ids,
            group_ids,
            environment_ids,
            start,
            end,
            Dataset.Events,
            [],
            referrer,
            tenant_ids=tenant_ids,
        )

    def get_generic_groups_user_counts(
        self, project_ids, group_ids, environment_ids, start=None, end=None, tenant_ids=None
    ):
        translated_params = _translate_filter_keys(project_ids, group_ids, environment_ids)
        organization_id = get_organization_id_from_project_ids(project_ids)
        start, end = _prepare_start_end(
            start,
            end,
            organization_id,
            group_ids,
        )

        where_conditions = [
            Condition(Column("project_id"), Op.IN, project_ids),
            Condition(Column("group_id"), Op.IN, group_ids),
            Condition(Column("timestamp"), Op.LT, end),
            Condition(Column("timestamp"), Op.GTE, start),
        ]
        if translated_params.get("environment"):
            where_conditions.append(
                Condition(Column("environment"), Op.IN, translated_params["environment"])
            )
        snuba_request = Request(
            dataset="search_issues",
            app_id="tagstore",
            query=Query(
                match=Entity("search_issues"),
                select=[
                    Column("group_id"),
                    Function("uniq", [Column("tags[sentry:user]")], "count"),
                ],
                where=where_conditions,
                groupby=[Column("group_id")],
                orderby=[OrderBy(Column("count"), Direction.DESC)],
            ),
            tenant_ids=tenant_ids,
        )

        result_snql = raw_snql_query(
            snuba_request, referrer="tagstore.get_generic_groups_user_counts", use_cache=True
        )

        result = nest_groups(result_snql["data"], ["group_id"], ["count"])

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
        tenant_ids=None,
    ):
        return self.get_tag_value_paginator_for_projects(
            get_project_list(project_id),
            [environment_id] if environment_id else None,
            key,
            start=start,
            end=end,
            query=query,
            order_by=order_by,
            tenant_ids=tenant_ids,
        )

    def _get_semver_versions_for_package(self, projects, organization_id, package):
        packages = (
            Release.objects.filter(organization_id=organization_id, package__startswith=package)
            .values_list("package")
            .distinct()
        )

        return Release.objects.filter(
            organization_id=organization_id,
            package__in=packages,
            id__in=ReleaseProject.objects.filter(project_id__in=projects).values_list(
                "release_id", flat=True
            ),
        ).annotate_prerelease_column()

    def _get_tag_values_for_semver(
        self,
        projects: Sequence[int],
        environments: Sequence[str] | None,
        query: str | None,
    ):
        from sentry.api.paginator import SequencePaginator

        query = query if query else ""
        organization_id = Project.objects.filter(id=projects[0]).values_list(
            "organization_id", flat=True
        )[0]

        if query and "@" not in query and re.search(r"[^\d.\*]", query):
            # Handle searching just on package
            include_package = True
            versions = self._get_semver_versions_for_package(projects, organization_id, query)
        else:
            include_package = "@" in query
            query = query.replace("*", "")
            if "@" in query:
                versions = Release.objects.filter(version__startswith=query)
            else:
                versions = Release.objects.filter(version__contains="@" + query)

        if projects:
            versions = versions.filter(
                id__in=ReleaseProject.objects.filter(project_id__in=projects).values_list(
                    "release_id", flat=True
                )
            )
        if environments:
            versions = versions.filter(
                id__in=ReleaseEnvironment.objects.filter(
                    environment_id__in=environments
                ).values_list("release_id", flat=True)
            )

        order_by = map(_flip_field_sort, Release.SEMVER_COLS + ["package"])
        versions = (
            versions.filter_to_semver()
            .annotate_prerelease_column()
            .order_by(*order_by)
            .values_list("version", flat=True)[:1000]
        )

        seen = set()
        formatted_versions = []
        # We want to format versions here in a way that makes sense for autocomplete. So we
        # - Only include package if we think the user entered a package
        # - Exclude build number, since it's not used as part of filtering
        # When we don't include package, this can result in duplicate version numbers, so we
        # also de-dupe here. This can result in less than 1000 versions returned, but we
        # typically use very few values so this works ok.
        for version in versions:
            formatted_version = version if include_package else version.split("@", 1)[1]
            formatted_version = formatted_version.split("+", 1)[0]
            if formatted_version in seen:
                continue

            seen.add(formatted_version)
            formatted_versions.append(formatted_version)

        return SequencePaginator(
            [
                (i, TagValue(SEMVER_ALIAS, v, None, None, None))
                for i, v in enumerate(formatted_versions)
            ]
        )

    def _get_tag_values_for_semver_package(self, projects, environments, package):
        from sentry.api.paginator import SequencePaginator

        package = package if package else ""

        organization_id = Project.objects.filter(id=projects[0]).values_list(
            "organization_id", flat=True
        )[0]
        versions = self._get_semver_versions_for_package(projects, organization_id, package)
        if environments:
            versions = versions.filter(
                id__in=ReleaseEnvironment.objects.filter(
                    environment_id__in=environments
                ).values_list("release_id", flat=True)
            )
        packages = versions.values_list("package", flat=True).distinct().order_by("package")[:1000]
        return SequencePaginator(
            [
                (i, TagValue(SEMVER_PACKAGE_ALIAS, v, None, None, None))
                for i, v in enumerate(packages)
            ]
        )

    def _get_tag_values_for_release_stages(self, projects, environments, query):
        from sentry.api.paginator import SequencePaginator

        organization_id = Project.objects.filter(id=projects[0]).values_list(
            "organization_id", flat=True
        )[0]
        versions = Release.objects.filter_by_stage(
            organization_id,
            "=",
            query,
            project_ids=projects,
            environments=environments,
        )
        if environments:
            versions = versions.filter(
                id__in=ReleaseEnvironment.objects.filter(
                    environment_id__in=environments
                ).values_list("release_id", flat=True)
            )

        versions = versions.order_by("version").values_list("version", flat=True)[:1000]
        return SequencePaginator(
            [
                (i, TagValue(RELEASE_STAGE_ALIAS, v, None, None, None))
                for i, v in enumerate(versions)
            ]
        )

    def _get_tag_values_for_semver_build(self, projects, environments, build):
        from sentry.api.paginator import SequencePaginator

        build = build if build else ""
        if not build.endswith("*"):
            build += "*"

        organization_id = Project.objects.filter(id=projects[0]).values_list(
            "organization_id", flat=True
        )[0]
        builds = Release.objects.filter_by_semver_build(organization_id, "exact", build, projects)

        if environments:
            builds = builds.filter(
                id__in=ReleaseEnvironment.objects.filter(
                    environment_id__in=environments
                ).values_list("release_id", flat=True)
            )

        packages = (
            builds.values_list("build_code", flat=True).distinct().order_by("build_code")[:1000]
        )
        return SequencePaginator(
            [(i, TagValue(SEMVER_BUILD_ALIAS, v, None, None, None)) for i, v in enumerate(packages)]
        )

    def _get_tag_values_for_releases_across_all_datasets(self, projects, environments, query):
        from sentry.api.paginator import SequencePaginator

        organization_id = Project.objects.filter(id=projects[0]).values_list(
            "organization_id", flat=True
        )[0]
        qs = Release.objects.filter(organization_id=organization_id)

        if projects:
            qs = qs.filter(
                id__in=ReleaseProject.objects.filter(project_id__in=projects).values_list(
                    "release_id", flat=True
                )
            )
        if environments:
            qs = qs.filter(
                id__in=ReleaseEnvironment.objects.filter(
                    environment_id__in=environments
                ).values_list("release_id", flat=True)
            )

        if query:
            qs = qs.filter(version__startswith=query)

        versions = qs.order_by("version").values_list("version", flat=True)[:1000]

        return SequencePaginator(
            [(i, TagValue(RELEASE_ALIAS, v, None, None, None)) for i, v in enumerate(versions)]
        )

    def get_tag_value_paginator_for_projects(
        self,
        projects,
        environments,
        key,
        start=None,
        end=None,
        dataset: Dataset | None = None,
        query: str | None = None,
        order_by="-last_seen",
        include_transactions: bool = False,
        include_sessions: bool = False,
        include_replays: bool = False,
        tenant_ids=None,
    ):
        from sentry.api.paginator import SequencePaginator

        if not (order_by == "-last_seen" or order_by == "-count"):
            raise ValueError("Unsupported order_by: %s" % order_by)

        # We need to replace `-count` into `-times_seen`, because
        # internally we can not order by `count` we can only by `times_seen`.
        if order_by == "-count":
            order_by = "-times_seen"

        if not dataset:
            dataset = Dataset.Events
            if include_transactions:
                dataset = Dataset.Discover
            if include_replays:
                dataset = Dataset.Replays

        snuba_key = snuba.get_snuba_column_name(key, dataset=dataset)

        # We cannot search the values of these columns like we do other columns because they are
        # a different type, and as such, LIKE and != do not work on them. Furthermore, because the
        # use case for these values in autosuggestion is minimal, so we choose to disable them here.
        #
        # event_id:     This is a FixedString which disallows us to use LIKE on it when searching,
        #               but does work with !=. However, for consistency sake we disallow it
        #               entirely, furthermore, suggesting an event_id is not a very useful feature
        #               as they are not human readable.
        # profile_id    Same as event_id
        # replay_id     Same as event_id
        # trace.*:      The same logic of event_id not being useful applies to the trace fields
        #               which are all also non human readable ids
        # timestamp:    This is a DateTime which disallows us to use both LIKE and != on it when
        #               searching. Suggesting a timestamp can potentially be useful but as it does
        #               work at all, we opt to disable it here. A potential solution can be to
        #               generate a time range to bound where they are searching. e.g. if a user
        #               enters 2020-07 we can generate the following conditions:
        #               >= 2020-07-01T00:00:00 AND <= 2020-07-31T23:59:59
        # time:         This is a column computed from timestamp so it suffers the same issues
        if snuba_key in {"group_id"}:
            snuba_key = f"tags[{snuba_key}]"
        if snuba_key in {"event_id", "timestamp", "time", "profile_id", "replay_id"} or key in {
            "trace",
            "trace.span",
            "trace.parent_span",
        }:
            return SequencePaginator([])

        # These columns have fixed values and we don't need to emit queries to find out the
        # potential options.
        if is_boolean_key(key):
            return SequencePaginator(
                [
                    (
                        1,
                        TagValue(
                            key=key, value="true", times_seen=None, first_seen=None, last_seen=None
                        ),
                    ),
                    (
                        2,
                        TagValue(
                            key=key, value="false", times_seen=None, first_seen=None, last_seen=None
                        ),
                    ),
                ]
            )

        if key == SEMVER_PACKAGE_ALIAS:
            return self._get_tag_values_for_semver_package(projects, environments, query)

        if key == SEMVER_ALIAS:
            # If doing a search on semver, we want to hit postgres to query the releases
            return self._get_tag_values_for_semver(projects, environments, query)

        if key == RELEASE_STAGE_ALIAS:
            return self._get_tag_values_for_release_stages(projects, environments, query)

        if key == SEMVER_BUILD_ALIAS:
            return self._get_tag_values_for_semver_build(projects, environments, query)

        if key == RELEASE_ALIAS and include_sessions:
            return self._get_tag_values_for_releases_across_all_datasets(
                projects, environments, query
            )

        conditions = []
        project_slugs = {}
        # transaction status needs a special case so that the user interacts with the names and not codes
        transaction_status = snuba_key == "transaction_status"
        if include_transactions and transaction_status:
            # Here we want to use the status codes during filtering,
            # but want to do this with names that include our query
            status_codes = [
                span_key
                for span_key, value in SPAN_STATUS_CODE_TO_NAME.items()
                if (query and query in value) or (not query)
            ]
            if status_codes:
                conditions.append([snuba_key, "IN", status_codes])
            else:
                return SequencePaginator([])
        elif is_fuzzy_numeric_key(key):
            converted_query = int(query) if query is not None and query.isdigit() else None
            if converted_query is not None:
                conditions.append([snuba_key, ">=", converted_query - FUZZY_NUMERIC_DISTANCE])
                conditions.append([snuba_key, "<=", converted_query + FUZZY_NUMERIC_DISTANCE])
        elif include_transactions and key == PROJECT_ALIAS:
            project_filters = {
                "id__in": projects,
            }
            if query:
                project_filters["slug__icontains"] = query
            project_queryset = Project.objects.filter(**project_filters).values("id", "slug")

            if not project_queryset.exists():
                return SequencePaginator([])

            project_slugs = {project["id"]: project["slug"] for project in project_queryset}
            projects = [project["id"] for project in project_queryset]
            snuba_key = "project_id"
        else:
            snuba_name = snuba_key

            is_user_alias = include_transactions and key == USER_DISPLAY_ALIAS
            if is_user_alias:
                # user.alias is a pseudo column in discover. It is computed by coalescing
                # together multiple user attributes. Here we get the coalesce function used,
                # and resolve it to the corresponding snuba query
                resolver = snuba.resolve_column(dataset)
                snuba_name = FIELD_ALIASES[USER_DISPLAY_ALIAS].get_field()
                snuba.resolve_complex_column(snuba_name, resolver, [])
            elif snuba_name in BLACKLISTED_COLUMNS:
                snuba_name = f"tags[{key}]"

            if query:
                query = query.replace("\\", "\\\\")
                conditions.append([snuba_name, "LIKE", f"%{query}%"])
            else:
                conditions.append([snuba_name, "!=", ""])

        filters = {"project_id": projects}
        if environments:
            filters["environment"] = environments

        if dataset == Dataset.Events:
            conditions.append(DEFAULT_TYPE_CONDITION)

        if dataset == Dataset.Replays:
            results = query_replays_dataset_tagkey_values(
                project_ids=filters["project_id"],
                start=start,
                end=end,
                environment=filters.get("environment"),
                tag_key=key,
                tag_substr_query=query,
                tenant_ids=tenant_ids,
            )
            results = {
                d["tag_value"]: {
                    "times_seen": d["times_seen"],
                    "first_seen": d["first_seen"],
                    "last_seen": d["last_seen"],
                }
                for d in results["data"]
            }

        else:
            results = snuba.query(
                dataset=dataset,
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
                # 1 mill chosen arbitrarily, based it on a query that was timing out, and took 8s once this was set
                sample=1_000_000,
                arrayjoin=snuba.get_arrayjoin(snuba_key),
                referrer="tagstore.get_tag_value_paginator_for_projects",
                tenant_ids=tenant_ids,
            )

        if include_transactions:
            # With transaction_status we need to map the ids back to their names
            if transaction_status:
                results = {
                    SPAN_STATUS_CODE_TO_NAME[result_key]: data
                    for result_key, data in results.items()
                }
            # With project names we map the ids back to the project slugs
            elif key == PROJECT_ALIAS:
                results = {
                    project_slugs[value]: data
                    for value, data in results.items()
                    if value in project_slugs
                }
            elif is_fuzzy_numeric_key(key):
                # numeric keys like measurements and breakdowns are nullable
                # so filter out the None values from the results
                results = {value: data for value, data in results.items() if value is not None}

        tag_values = [
            TagValue(key=key, value=str(value), **fix_tag_value_data(data))
            for value, data in results.items()
        ]

        desc = order_by.startswith("-")
        score_field = order_by.lstrip("-")

        def score_field_to_int(tv: TagValue) -> int:
            if score_field == "times_seen":
                # times_seen already an int
                return int(getattr(tv, score_field))
            return int(getattr(tv, score_field).timestamp() * 1000)

        return SequencePaginator(
            [(score_field_to_int(tv), tv) for tv in tag_values],
            reverse=desc,
        )

    def get_group_tag_value_iter(
        self,
        group,
        environment_ids,
        key,
        callbacks=(),
        orderby="-first_seen",
        limit: int = 1000,
        offset: int = 0,
        tenant_ids=None,
    ):
        filters = {
            "project_id": get_project_list(group.project_id),
            "tags_key": [key],
        }
        dataset, conditions, filters = self.apply_group_filters_conditions(group, [], filters)

        if environment_ids:
            filters["environment"] = environment_ids
        results = snuba.query(
            dataset=dataset,
            groupby=["tags_value"],
            filter_keys=filters,
            conditions=conditions,
            aggregations=[
                ["count()", "", "times_seen"],
                ["min", "timestamp", "first_seen"],
                ["max", "timestamp", "last_seen"],
            ],
            orderby=orderby,
            limit=limit,
            referrer="tagstore.get_group_tag_value_iter",
            offset=offset,
            tenant_ids=tenant_ids,
        )

        group_tag_values = [
            GroupTagValue(group_id=group.id, key=key, value=value, **fix_tag_value_data(data))
            for value, data in results.items()
        ]

        for cb in callbacks:
            cb(group_tag_values)

        return group_tag_values

    def get_group_tag_value_paginator(
        self, group, environment_ids, key, order_by="-id", tenant_ids=None
    ):
        from sentry.api.paginator import SequencePaginator

        if order_by in ("-last_seen", "-first_seen", "-times_seen"):
            pass
        elif order_by == "-id":
            # Snuba has no unique id per GroupTagValue so we'll substitute `-first_seen`
            order_by = "-first_seen"
        else:
            raise ValueError("Unsupported order_by: %s" % order_by)

        group_tag_values = self.get_group_tag_value_iter(
            group, environment_ids, key, orderby="-last_seen", tenant_ids=tenant_ids
        )

        desc = order_by.startswith("-")
        score_field = order_by.lstrip("-")
        if score_field == "times_seen":
            return SequencePaginator(
                [(int(getattr(gtv, score_field)), gtv) for gtv in group_tag_values],
                reverse=desc,
            )

        return SequencePaginator(
            [(int(getattr(gtv, score_field).timestamp() * 1000), gtv) for gtv in group_tag_values],
            reverse=desc,
        )

    def get_group_tag_value_qs(self, project_id, group_id, environment_id, key, value=None):
        # This method is not implemented because it is only used by the Django
        # search backend.
        raise NotImplementedError

    def get_group_event_filter(
        self, project_id, group_id, environment_ids, tags, start, end, tenant_ids=None
    ):
        filters = {"project_id": get_project_list(project_id), "group_id": [group_id]}
        if environment_ids:
            filters["environment"] = environment_ids

        conditions = []
        for tag_name, tag_val in tags.items():
            operator = "IN" if isinstance(tag_val, list) else "="
            conditions.append([f"tags[{tag_name}]", operator, tag_val])

        result = snuba.raw_query(
            dataset=Dataset.Events,
            start=start,
            end=end,
            selected_columns=["event_id"],
            conditions=conditions,
            orderby="-timestamp",
            filter_keys=filters,
            limit=1000,
            referrer="tagstore.get_group_event_filter",
            tenant_ids=tenant_ids,
        )

        event_id_set = {row["event_id"] for row in result["data"]}

        if not event_id_set:
            return None

        return {"event_id__in": event_id_set}
