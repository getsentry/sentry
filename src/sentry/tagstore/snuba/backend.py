import functools
import re
from collections import OrderedDict, defaultdict
from collections.abc import Iterable
from typing import Optional, Sequence

from dateutil.parser import parse as parse_datetime
from django.core.cache import cache
from pytz import UTC
from sentry_relay.consts import SPAN_STATUS_CODE_TO_NAME

from sentry.api.utils import default_start_end_dates
from sentry.models import (
    Project,
    Release,
    ReleaseEnvironment,
    ReleaseProject,
    ReleaseProjectEnvironment,
)
from sentry.search.events.constants import (
    PROJECT_ALIAS,
    RELEASE_STAGE_ALIAS,
    SEMVER_ALIAS,
    SEMVER_BUILD_ALIAS,
    SEMVER_PACKAGE_ALIAS,
    USER_DISPLAY_ALIAS,
)
from sentry.search.events.fields import FIELD_ALIASES
from sentry.search.events.filter import _flip_field_sort
from sentry.snuba.dataset import Dataset
from sentry.tagstore import TagKeyStatus
from sentry.tagstore.base import TOP_VALUES_DEFAULT_LIMIT, TagStorage
from sentry.tagstore.exceptions import (
    GroupTagKeyNotFound,
    GroupTagValueNotFound,
    TagKeyNotFound,
    TagValueNotFound,
)
from sentry.tagstore.types import GroupTagKey, GroupTagValue, TagKey, TagValue
from sentry.utils import metrics, snuba
from sentry.utils.dates import to_timestamp
from sentry.utils.hashlib import md5_text

SEEN_COLUMN = "timestamp"

# columns we want to exclude from methods that return
# all values for a given tag/column
BLACKLISTED_COLUMNS = frozenset(["project_id"])

FUZZY_NUMERIC_KEYS = frozenset(
    ["stack.colno", "stack.in_app", "stack.lineno", "stack.stack_level", "transaction.duration"]
)
FUZZY_NUMERIC_DISTANCE = 50

# Since all event types are currently stored together, we need to manually exclude transactions
# when querying the events dataset. This condition can be dropped once we cut over to the errors
# storage in Snuba.
DEFAULT_TYPE_CONDITION = ["type", "!=", "transaction"]

tag_value_data_transformers = {"first_seen": parse_datetime, "last_seen": parse_datetime}


def fix_tag_value_data(data):
    for key, transformer in tag_value_data_transformers.items():
        if key in data:
            data[key] = transformer(data[key]).replace(tzinfo=UTC)
    return data


def get_project_list(project_id):
    return project_id if isinstance(project_id, Iterable) else [project_id]


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
        self, project_id, group_id, environment_id, key, limit=3, raise_on_empty=True, **kwargs
    ):
        tag = f"tags[{key}]"
        filters = {"project_id": get_project_list(project_id)}
        if environment_id:
            filters["environment"] = [environment_id]
        if group_id is not None:
            filters["group_id"] = [group_id]
        conditions = kwargs.get("conditions", [])
        aggregations = kwargs.get("aggregations", [])

        conditions.append([tag, "!=", ""])
        conditions.append(DEFAULT_TYPE_CONDITION)
        aggregations += [
            ["uniq", tag, "values_seen"],
            ["count()", "", "count"],
            ["min", SEEN_COLUMN, "first_seen"],
            ["max", SEEN_COLUMN, "last_seen"],
        ]

        result, totals = snuba.query(
            dataset=Dataset.Events,
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
        group_id,
        environment_ids,
        limit=1000,
        keys=None,
        include_values_seen=True,
        include_transactions=False,
        **kwargs,
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
            include_transactions=include_transactions,
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
        use_cache=False,
        include_transactions=False,
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

        filters = {"project_id": sorted(projects)}
        if environments:
            filters["environment"] = sorted(environments)
        if group_id is not None:
            filters["group_id"] = [group_id]
        if keys is not None:
            filters["tags_key"] = sorted(keys)
        aggregations = [["count()", "", "count"]]

        if include_values_seen:
            aggregations.append(["uniq", "tags_value", "values_seen"])
        conditions = [DEFAULT_TYPE_CONDITION]
        conditions = []

        should_cache = use_cache and group_id is None
        result = None

        dataset = Dataset.Events
        if include_transactions:
            dataset = Dataset.Discover

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

        if group_id is None:
            ctor = TagKey
        else:
            ctor = functools.partial(GroupTagKey, group_id=group_id)

        results = set()
        for key, data in result.items():
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
        self,
        projects,
        environments,
        start,
        end,
        status=TagKeyStatus.VISIBLE,
        use_cache=False,
        include_transactions=False,
    ):
        max_unsampled_projects = 50
        # We want to disable FINAL in the snuba query to reduce load.
        optimize_kwargs = {"turbo": True}
        # If we are fetching less than max_unsampled_projects, then disable
        # the sampling that turbo enables so that we get more accurate results.
        # We only want sampling when we have a large number of projects, so
        # that we don't cause performance issues for Snuba.
        if len(projects) <= max_unsampled_projects:
            optimize_kwargs["sample"] = 1
        return self.__get_tag_keys_for_projects(
            projects,
            None,
            environments,
            start,
            end,
            include_values_seen=False,
            use_cache=use_cache,
            include_transactions=include_transactions,
            **optimize_kwargs,
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
        """Get tag keys for a specific group"""
        return self.__get_tag_keys(
            project_id,
            group_id,
            environment_ids,
            dataset=Dataset.Events,
            limit=limit,
            keys=keys,
            include_values_seen=False,
            **kwargs,
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
        tag = f"tags[{key}]"
        filters = {"project_id": project_ids, "group_id": group_id_list}
        if environment_ids:
            filters["environment"] = environment_ids
        conditions = [[tag, "=", value], DEFAULT_TYPE_CONDITION]
        aggregations = [
            ["count()", "", "times_seen"],
            ["min", SEEN_COLUMN, "first_seen"],
            ["max", SEEN_COLUMN, "last_seen"],
        ]

        result = snuba.query(
            dataset=Dataset.Events,
            groupby=["group_id"],
            conditions=conditions,
            filter_keys=filters,
            aggregations=aggregations,
            referrer="tagstore.get_group_list_tag_value",
        )

        return {
            issue: GroupTagValue(group_id=issue, key=key, value=value, **fix_tag_value_data(data))
            for issue, data in result.items()
        }

    def get_group_seen_values_for_environments(
        self, project_ids, group_id_list, environment_ids, start=None, end=None
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
        )

        return {issue: fix_tag_value_data(data) for issue, data in result.items()}

    def get_group_tag_value_count(self, project_id, group_id, environment_id, key):
        tag = f"tags[{key}]"
        filters = {"project_id": get_project_list(project_id), "group_id": [group_id]}
        if environment_id:
            filters["environment"] = [environment_id]
        conditions = [[tag, "!=", ""]]
        aggregations = [["count()", "", "count"]]

        return snuba.query(
            dataset=Dataset.Events,
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
        **kwargs,
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
        conditions.append(DEFAULT_TYPE_CONDITION)
        aggregations = kwargs.get("aggregations", [])
        aggregations += [
            ["count()", "", "count"],
            ["min", SEEN_COLUMN, "first_seen"],
            ["max", SEEN_COLUMN, "last_seen"],
        ]

        values_by_key = snuba.query(
            dataset=Dataset.Events,
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

    def get_group_ids_for_users(self, project_ids, event_users, limit=100):
        filters = {"project_id": project_ids}
        conditions = [
            ["tags[sentry:user]", "IN", [_f for _f in [eu.tag_value for eu in event_users] if _f]]
        ]
        aggregations = [["max", SEEN_COLUMN, "last_seen"]]

        result = snuba.query(
            dataset=Dataset.Events,
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
        )

        values = []
        for issue, users in result.items():
            for name, data in users.items():
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
            dataset=Dataset.Events,
            start=start,
            end=end,
            groupby=["group_id"],
            conditions=None,
            filter_keys=filters,
            aggregations=aggregations,
            orderby="-count",
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
        environments: Optional[Sequence[str]],
        query: Optional[str],
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

    def get_tag_value_paginator_for_projects(
        self,
        projects,
        environments,
        key,
        start=None,
        end=None,
        query=None,
        order_by="-last_seen",
        include_transactions=False,
    ):
        from sentry.api.paginator import SequencePaginator

        if not order_by == "-last_seen":
            raise ValueError("Unsupported order_by: %s" % order_by)

        dataset = Dataset.Events
        if include_transactions:
            dataset = Dataset.Discover
        snuba_key = snuba.get_snuba_column_name(key, dataset=dataset)

        # We cannot search the values of these columns like we do other columns because they are
        # a different type, and as such, LIKE and != do not work on them. Furthermore, because the
        # use case for these values in autosuggestion is minimal, so we choose to disable them here.
        #
        # event_id:     This is a FixedString which disallows us to use LIKE on it when searching,
        #               but does work with !=. However, for consistency sake we disallow it
        #               entirely, furthermore, suggesting an event_id is not a very useful feature
        #               as they are not human readable.
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
        if snuba_key in {"event_id", "timestamp", "time"} or key in {
            "trace",
            "trace.span",
            "trace.parent_span",
        }:
            return SequencePaginator([])

        # These columns have fixed values and we don't need to emit queries to find out the
        # potential options.
        if key in {"error.handled", "error.unhandled"}:
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
        elif key in FUZZY_NUMERIC_KEYS:
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
                # together multiple user attributes. Here we get the coalese function used,
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
            arrayjoin=snuba.get_arrayjoin(snuba_key),
            referrer="tagstore.get_tag_value_paginator_for_projects",
        )

        if include_transactions:
            # With transaction_status we need to map the ids back to their names
            if transaction_status:
                results = OrderedDict(
                    [
                        (SPAN_STATUS_CODE_TO_NAME[result_key], data)
                        for result_key, data in results.items()
                    ]
                )
            # With project names we map the ids back to the project slugs
            elif key == PROJECT_ALIAS:
                results = OrderedDict(
                    [
                        (project_slugs[value], data)
                        for value, data in results.items()
                        if value in project_slugs
                    ]
                )

        tag_values = [
            TagValue(key=key, value=str(value), **fix_tag_value_data(data))
            for value, data in results.items()
        ]

        desc = order_by.startswith("-")
        score_field = order_by.lstrip("-")
        return SequencePaginator(
            [(int(to_timestamp(getattr(tv, score_field)) * 1000), tv) for tv in tag_values],
            reverse=desc,
        )

    def get_group_tag_value_iter(
        self, project_id, group_id, environment_ids, key, callbacks=(), limit=1000, offset=0
    ):
        filters = {
            "project_id": get_project_list(project_id),
            "tags_key": [key],
            "group_id": [group_id],
        }
        if environment_ids:
            filters["environment"] = environment_ids
        results = snuba.query(
            dataset=Dataset.Events,
            groupby=["tags_value"],
            filter_keys=filters,
            aggregations=[
                ["count()", "", "times_seen"],
                ["min", "timestamp", "first_seen"],
                ["max", "timestamp", "last_seen"],
            ],
            orderby="-first_seen",  # Closest thing to pre-existing `-id` order
            limit=limit,
            referrer="tagstore.get_group_tag_value_iter",
            offset=offset,
        )

        group_tag_values = [
            GroupTagValue(group_id=group_id, key=key, value=value, **fix_tag_value_data(data))
            for value, data in results.items()
        ]

        for cb in callbacks:
            cb(group_tag_values)

        return group_tag_values

    def get_group_tag_value_paginator(
        self, project_id, group_id, environment_ids, key, order_by="-id"
    ):
        from sentry.api.paginator import SequencePaginator

        if order_by in ("-last_seen", "-first_seen", "-times_seen"):
            pass
        elif order_by == "-id":
            # Snuba has no unique id per GroupTagValue so we'll substitute `-first_seen`
            order_by = "-first_seen"
        else:
            raise ValueError("Unsupported order_by: %s" % order_by)

        group_tag_values = self.get_group_tag_value_iter(project_id, group_id, environment_ids, key)

        desc = order_by.startswith("-")
        score_field = order_by.lstrip("-")
        if score_field == "times_seen":
            return SequencePaginator(
                [(int(getattr(gtv, score_field)), gtv) for gtv in group_tag_values],
                reverse=desc,
            )

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
        )

        event_id_set = {row["event_id"] for row in result["data"]}

        if not event_id_set:
            return None

        return {"event_id__in": event_id_set}
