from __future__ import annotations

import functools
from abc import abstractmethod
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Callable, Mapping, MutableMapping, Optional, Sequence

from django.utils import timezone
from rest_framework.request import Request

from sentry import features, release_health, tsdb
from sentry.api.serializers.models.group import (
    BaseGroupSerializerResponse,
    GroupSerializer,
    GroupSerializerSnuba,
    SeenStats,
    snuba_tsdb,
)
from sentry.api.serializers.models.plugin import is_plugin_deprecated
from sentry.constants import StatsPeriod
from sentry.issues.grouptype import GroupCategory
from sentry.models.environment import Environment
from sentry.models.group import Group
from sentry.models.groupinbox import get_inbox_details
from sentry.models.groupowner import get_owner_details
from sentry.snuba.dataset import Dataset
from sentry.tsdb.base import TSDBModel
from sentry.utils import metrics
from sentry.utils.cache import cache
from sentry.utils.hashlib import hash_values
from sentry.utils.safe import safe_execute
from sentry.utils.snuba import resolve_column, resolve_conditions


def get_actions(request: Request, group):
    from sentry.plugins.base import plugins

    project = group.project

    action_list = []
    for plugin in plugins.for_project(project, version=1):
        if is_plugin_deprecated(plugin, project):
            continue

        results = safe_execute(plugin.actions, request, group, action_list, _with_transaction=False)

        if not results:
            continue

        action_list = results

    for plugin in plugins.for_project(project, version=2):
        if is_plugin_deprecated(plugin, project):
            continue
        for action in (
            safe_execute(plugin.get_actions, request, group, _with_transaction=False) or ()
        ):
            action_list.append(action)

    return action_list


def get_available_issue_plugins(request: Request, group):
    from sentry.plugins.base import plugins
    from sentry.plugins.bases.issue2 import IssueTrackingPlugin2

    project = group.project

    plugin_issues = []
    for plugin in plugins.for_project(project, version=1):
        if isinstance(plugin, IssueTrackingPlugin2):
            if is_plugin_deprecated(plugin, project):
                continue
            plugin_issues = safe_execute(
                plugin.plugin_issues, request, group, plugin_issues, _with_transaction=False
            )
    return plugin_issues


@dataclass
class GroupStatsQueryArgs:
    stats_period: Optional[str]
    stats_period_start: Optional[datetime]
    stats_period_end: Optional[datetime]


class GroupStatsMixin:
    STATS_PERIOD_CHOICES = {
        "14d": StatsPeriod(14, timedelta(hours=24)),
        "24h": StatsPeriod(24, timedelta(hours=1)),
    }

    CUSTOM_ROLLUP_CHOICES = {
        "1h": timedelta(hours=1).total_seconds(),
        "2h": timedelta(hours=2).total_seconds(),
        "3h": timedelta(hours=3).total_seconds(),
        "6h": timedelta(hours=6).total_seconds(),
        "12h": timedelta(hours=12).total_seconds(),
        "24h": timedelta(hours=24).total_seconds(),
    }

    CUSTOM_SEGMENTS = 29  # for 30 segments use 1/29th intervals
    CUSTOM_SEGMENTS_12H = 35  # for 12h 36 segments, otherwise 15-16-17 bars is too few
    CUSTOM_ROLLUP_6H = timedelta(hours=6).total_seconds()  # rollups should be increments of 6hs

    @abstractmethod
    def query_tsdb(
        self, groups: Sequence[Group], query_params: MutableMapping[str, Any], user=None
    ):
        pass

    def get_stats(
        self, item_list: Sequence[Group], user, stats_query_args: GroupStatsQueryArgs, **kwargs
    ):
        if stats_query_args and stats_query_args.stats_period:
            # we need to compute stats at 1d (1h resolution), and 14d or a custom given period
            if stats_query_args.stats_period == "auto":
                total_period = (
                    stats_query_args.stats_period_end - stats_query_args.stats_period_start
                ).total_seconds()
                if total_period < timedelta(hours=24).total_seconds():
                    rollup = total_period / self.CUSTOM_SEGMENTS
                elif total_period < self.CUSTOM_SEGMENTS * self.CUSTOM_ROLLUP_CHOICES["1h"]:
                    rollup = self.CUSTOM_ROLLUP_CHOICES["1h"]
                elif total_period < self.CUSTOM_SEGMENTS * self.CUSTOM_ROLLUP_CHOICES["2h"]:
                    rollup = self.CUSTOM_ROLLUP_CHOICES["2h"]
                elif total_period < self.CUSTOM_SEGMENTS * self.CUSTOM_ROLLUP_CHOICES["3h"]:
                    rollup = self.CUSTOM_ROLLUP_CHOICES["3h"]
                elif total_period < self.CUSTOM_SEGMENTS * self.CUSTOM_ROLLUP_CHOICES["6h"]:
                    rollup = self.CUSTOM_ROLLUP_CHOICES["6h"]
                elif (
                    total_period < self.CUSTOM_SEGMENTS_12H * self.CUSTOM_ROLLUP_CHOICES["12h"]
                ):  # 36 segments is ok
                    rollup = self.CUSTOM_ROLLUP_CHOICES["12h"]
                elif total_period < self.CUSTOM_SEGMENTS * self.CUSTOM_ROLLUP_CHOICES["24h"]:
                    rollup = self.CUSTOM_ROLLUP_CHOICES["24h"]
                else:
                    delta_day = self.CUSTOM_ROLLUP_CHOICES["24h"]
                    rollup = round(total_period / (self.CUSTOM_SEGMENTS * delta_day)) * delta_day

                query_params = {
                    "start": stats_query_args.stats_period_start,
                    "end": stats_query_args.stats_period_end,
                    "rollup": int(rollup),
                }
            else:
                segments, interval = self.STATS_PERIOD_CHOICES[stats_query_args.stats_period]
                now = timezone.now()
                query_params = {
                    "start": now - ((segments - 1) * interval),
                    "end": now,
                    "rollup": int(interval.total_seconds()),
                }

            return self.query_tsdb(item_list, query_params, user=user, **kwargs)


class StreamGroupSerializer(GroupSerializer, GroupStatsMixin):
    def __init__(
        self,
        environment_func=None,
        stats_period=None,
        stats_period_start=None,
        stats_period_end=None,
    ):
        super().__init__(environment_func)

        if stats_period is not None:
            assert stats_period in self.STATS_PERIOD_CHOICES or stats_period == "auto"

        self.stats_period = stats_period
        self.stats_period_start = stats_period_start
        self.stats_period_end = stats_period_end

    def get_attrs(
        self,
        item_list: Sequence[Group],
        user: Any,
        **kwargs: Any,
    ) -> MutableMapping[Group, MutableMapping[str, Any]]:
        attrs = super().get_attrs(item_list, user)

        if self.stats_period:
            stats = self.get_stats(
                item_list,
                user,
                GroupStatsQueryArgs(
                    self.stats_period, self.stats_period_start, self.stats_period_end
                ),
            )
            for item in item_list:
                attrs[item].update({"stats": stats[item.id]})

        return attrs

    def serialize(
        self, obj: Group, attrs: MutableMapping[str, Any], user: Any, **kwargs: Any
    ) -> BaseGroupSerializerResponse:
        result = super().serialize(obj, attrs, user)

        if self.stats_period:
            result["stats"] = {self.stats_period: attrs["stats"]}

        return result

    def query_tsdb(self, groups: Sequence[Group], query_params, user=None, **kwargs):
        try:
            environment = self.environment_func()
        except Environment.DoesNotExist:
            stats = {g.id: tsdb.make_series(0, **query_params) for g in groups}
        else:
            org_id = groups[0].project.organization_id if groups else None
            stats = tsdb.get_range(
                model=TSDBModel.group,
                keys=[g.id for g in groups],
                environment_ids=environment and [environment.id],
                **query_params,
                tenant_ids={"organization_id": org_id} if org_id else None,
            )

        return stats


class StreamGroupSerializerSnuba(GroupSerializerSnuba, GroupStatsMixin):
    def __init__(
        self,
        environment_ids=None,
        stats_period=None,
        stats_period_start=None,
        stats_period_end=None,
        start=None,
        end=None,
        search_filters=None,
        collapse=None,
        expand=None,
        organization_id=None,
        project_ids=None,
    ):
        super().__init__(
            environment_ids,
            start,
            end,
            search_filters,
            collapse=collapse,
            expand=expand,
            organization_id=organization_id,
            project_ids=project_ids,
        )

        if stats_period is not None:
            assert stats_period in self.STATS_PERIOD_CHOICES or (
                stats_period == "auto" and stats_period_start and stats_period_end
            )

        self.stats_period = stats_period
        self.stats_period_start = stats_period_start
        self.stats_period_end = stats_period_end

    def get_attrs(
        self,
        item_list: Sequence[Group],
        user: Any,
        request: Request,
        **kwargs: Any,
    ) -> MutableMapping[Group, MutableMapping[str, Any]]:
        if not self._collapse("base"):
            attrs = super().get_attrs(item_list, user)
        else:
            seen_stats = self._get_seen_stats(item_list, user)

            if seen_stats:
                attrs = {item: seen_stats.get(item, {}) for item in item_list}
            else:
                attrs = {item: {} for item in item_list}
            if len(item_list) > 0 and features.has(
                "organizations:issue-stream-performance", item_list[0].project.organization
            ):
                unhandled_stats = self._get_group_snuba_stats(item_list, seen_stats)

                if unhandled_stats is not None:
                    for item in item_list:
                        attrs[item]["is_unhandled"] = bool(
                            unhandled_stats.get(item.id, {}).get("unhandled")
                        )

        if self.stats_period and not self._collapse("stats"):
            partial_get_stats = functools.partial(
                self.get_stats,
                item_list=item_list,
                user=user,
                stats_query_args=GroupStatsQueryArgs(
                    self.stats_period, self.stats_period_start, self.stats_period_end
                ),
                environment_ids=self.environment_ids,
            )
            stats = partial_get_stats()
            filtered_stats = (
                partial_get_stats(conditions=self.conditions)
                if self.conditions and not self._collapse("filtered")
                else None
            )
            for item in item_list:
                if filtered_stats:
                    attrs[item].update({"filtered_stats": filtered_stats[item.id]})
                attrs[item].update({"stats": stats[item.id]})

            if self._expand("sessions"):
                uniq_project_ids = list({item.project_id for item in item_list})
                cache_keys = {pid: self._build_session_cache_key(pid) for pid in uniq_project_ids}
                cache_data = cache.get_many(cache_keys.values())
                missed_items = []
                for item in item_list:
                    num_sessions = cache_data.get(cache_keys[item.project_id])
                    if num_sessions is None:
                        found = "miss"
                        missed_items.append(item)
                    else:
                        found = "hit"
                        attrs[item].update(
                            {
                                "sessionCount": num_sessions,
                            }
                        )
                    metrics.incr(f"group.get_session_counts.{found}")

                if missed_items:
                    project_ids = list({item.project_id for item in missed_items})
                    project_sessions = release_health.backend.get_num_sessions_per_project(
                        project_ids,
                        self.start,
                        self.end,
                        self.environment_ids,
                    )

                    results = {}
                    for project_id, count in project_sessions:
                        cache_key = self._build_session_cache_key(project_id)
                        results[project_id] = count
                        cache.set(cache_key, count, 3600)

                    for item in missed_items:
                        if item.project_id in results.keys():
                            attrs[item].update(
                                {
                                    "sessionCount": results[item.project_id],
                                }
                            )
                        else:
                            attrs[item].update({"sessionCount": None})

        if self._expand("inbox"):
            inbox_stats = get_inbox_details(item_list)
            for item in item_list:
                attrs[item].update({"inbox": inbox_stats.get(item.id)})

        if self._expand("owners"):
            owner_details = get_owner_details(item_list, user)
            for item in item_list:
                attrs[item].update({"owners": owner_details.get(item.id)})

        if self._expand("pluginActions"):
            for item in item_list:
                action_list = get_actions(request, item)
                attrs[item].update({"pluginActions": action_list})

        if self._expand("pluginIssues"):
            for item in item_list:
                plugin_issue_list = get_available_issue_plugins(request, item)
                attrs[item].update({"pluginIssues": plugin_issue_list})

        return attrs

    def serialize(
        self, obj: Group, attrs: MutableMapping[str, Any], user: Any, **kwargs: Any
    ) -> BaseGroupSerializerResponse:
        if not self._collapse("base"):
            result = super().serialize(obj, attrs, user)
        else:
            result = {
                "id": str(obj.id),
            }
            if "times_seen" in attrs:
                result.update(self._convert_seen_stats(attrs))
            if "is_unhandled" in attrs:
                result["isUnhandled"] = attrs["is_unhandled"]

        if not self._collapse("stats"):
            if self.stats_period:
                result["stats"] = {self.stats_period: attrs["stats"]}

            if not self._collapse("lifetime"):
                result["lifetime"] = self._convert_seen_stats(attrs["lifetime"])
                if self.stats_period:
                    result["lifetime"].update(
                        {"stats": None}
                    )  # Not needed in current implementation

            if not self._collapse("filtered"):
                if self.conditions:
                    result["filtered"] = self._convert_seen_stats(attrs["filtered"])
                    if self.stats_period:
                        result["filtered"].update(
                            {"stats": {self.stats_period: attrs["filtered_stats"]}}
                        )
                else:
                    result["filtered"] = None

            if self._expand("sessions"):
                result["sessionCount"] = attrs["sessionCount"]

        if self._expand("inbox"):
            result["inbox"] = attrs["inbox"]

        if self._expand("owners"):
            result["owners"] = attrs["owners"]

        if self._expand("pluginActions"):
            result["pluginActions"] = attrs["pluginActions"]

        if self._expand("pluginIssues"):
            result["pluginIssues"] = attrs["pluginIssues"]

        return result

    def query_tsdb(
        self,
        groups: Sequence[Group],
        query_params,
        conditions=None,
        environment_ids=None,
        user=None,
        **kwargs,
    ):
        if not groups:
            return

        error_issue_ids, generic_issue_ids = [], []
        for group in groups:
            if GroupCategory.ERROR == group.issue_category:
                error_issue_ids.append(group.id)
            else:
                generic_issue_ids.append(group.id)

        error_conditions = resolve_conditions(conditions, resolve_column(Dataset.Discover))
        issue_conditions = resolve_conditions(conditions, resolve_column(Dataset.IssuePlatform))

        get_range = functools.partial(
            snuba_tsdb.get_range,
            environment_ids=environment_ids,
            tenant_ids={"organization_id": self.organization_id},
            **query_params,
        )

        results = {}

        if error_issue_ids:
            results.update(
                get_range(model=TSDBModel.group, keys=error_issue_ids, conditions=error_conditions)
            )
        if generic_issue_ids:
            results.update(
                get_range(
                    model=TSDBModel.group_generic,
                    keys=generic_issue_ids,
                    conditions=issue_conditions,
                )
            )
        return results

    def _seen_stats_error(
        self, error_issue_list: Sequence[Group], user
    ) -> Mapping[Group, SeenStats]:
        return self.__seen_stats_impl(error_issue_list, self._execute_error_seen_stats_query)

    def _seen_stats_generic(
        self, generic_issue_list: Sequence[Group], user
    ) -> Mapping[Group, SeenStats]:
        return self.__seen_stats_impl(generic_issue_list, self._execute_generic_seen_stats_query)

    def __seen_stats_impl(
        self,
        error_issue_list: Sequence[Group],
        seen_stats_func: Callable[[Any, Any, Any, Any, Any], Mapping[str, Any]],
    ) -> Mapping[Any, SeenStats]:
        partial_execute_seen_stats_query = functools.partial(
            seen_stats_func,
            item_list=error_issue_list,
            environment_ids=self.environment_ids,
            start=self.start,
            end=self.end,
        )
        time_range_result = self._parse_seen_stats_results(
            partial_execute_seen_stats_query(),
            error_issue_list,
            self.start or self.end or self.conditions,
            self.environment_ids,
        )
        filtered_result = (
            self._parse_seen_stats_results(
                partial_execute_seen_stats_query(conditions=self.conditions),
                error_issue_list,
                self.start or self.end or self.conditions,
                self.environment_ids,
            )
            if self.conditions and not self._collapse("filtered")
            else None
        )
        lifetime_result = (
            (
                self._parse_seen_stats_results(
                    partial_execute_seen_stats_query(start=None, end=None),
                    error_issue_list,
                    False,
                    self.environment_ids,
                )
                if self.start or self.end
                else time_range_result
            )
            if not self._collapse("lifetime")
            else None
        )

        for item in error_issue_list:
            time_range_result[item].update(
                {
                    "filtered": filtered_result.get(item) if filtered_result else None,
                    "lifetime": lifetime_result.get(item) if lifetime_result else None,
                }
            )
        return time_range_result

    def _build_session_cache_key(self, project_id):
        start_key = end_key = env_key = ""
        if self.start:
            start_key = self.start.replace(second=0, microsecond=0, tzinfo=None)

        if self.end:
            end_key = self.end.replace(second=0, microsecond=0, tzinfo=None)

        if self.end and self.start and self.end - self.start >= timedelta(minutes=60):
            # Cache to the hour for longer time range queries, and to the minute if the query if for a time period under 1 hour
            end_key = end_key.replace(minute=0)
            start_key = start_key.replace(minute=0)

        if self.environment_ids:
            self.environment_ids.sort()
            env_key = "-".join(str(eid) for eid in self.environment_ids)

        start_key = start_key.strftime("%m/%d/%Y, %H:%M:%S") if start_key != "" else ""
        end_key = end_key.strftime("%m/%d/%Y, %H:%M:%S") if end_key != "" else ""
        key_hash = hash_values([project_id, start_key, end_key, env_key])
        session_cache_key = f"w-s:{key_hash}"
        return session_cache_key
