from __future__ import annotations

import functools
from datetime import timedelta

from django.utils import timezone

from sentry import release_health, tsdb
from sentry.api.serializers.models.group import GroupSerializer, GroupSerializerSnuba, snuba_tsdb
from sentry.constants import StatsPeriod
from sentry.models import Environment
from sentry.models.groupinbox import get_inbox_details
from sentry.models.groupowner import get_owner_details
from sentry.utils import metrics
from sentry.utils.cache import cache
from sentry.utils.hashlib import hash_values


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

    def query_tsdb(self, group_ids, query_params):
        raise NotImplementedError

    def get_stats(self, item_list, user, **kwargs):
        if self.stats_period:
            # we need to compute stats at 1d (1h resolution), and 14d or a custom given period
            group_ids = [g.id for g in item_list]

            if self.stats_period == "auto":
                total_period = (self.stats_period_end - self.stats_period_start).total_seconds()
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
                    "start": self.stats_period_start,
                    "end": self.stats_period_end,
                    "rollup": int(rollup),
                }
            else:
                segments, interval = self.STATS_PERIOD_CHOICES[self.stats_period]
                now = timezone.now()
                query_params = {
                    "start": now - ((segments - 1) * interval),
                    "end": now,
                    "rollup": int(interval.total_seconds()),
                }

            return self.query_tsdb(group_ids, query_params, **kwargs)


class StreamGroupSerializer(GroupSerializer, GroupStatsMixin):
    def __init__(
        self,
        environment_func=None,
        stats_period=None,
        stats_period_start=None,
        stats_period_end=None,
        matching_event_id=None,
        matching_event_environment=None,
    ):
        super().__init__(environment_func)

        if stats_period is not None:
            assert stats_period in self.STATS_PERIOD_CHOICES or stats_period == "auto"

        self.stats_period = stats_period
        self.stats_period_start = stats_period_start
        self.stats_period_end = stats_period_end
        self.matching_event_id = matching_event_id
        self.matching_event_environment = matching_event_environment

    def query_tsdb(self, group_ids, query_params, **kwargs):
        try:
            environment = self.environment_func()
        except Environment.DoesNotExist:
            stats = {key: tsdb.make_series(0, **query_params) for key in group_ids}
        else:
            stats = tsdb.get_range(
                model=tsdb.models.group,
                keys=group_ids,
                environment_ids=environment and [environment.id],
                **query_params,
            )

        return stats

    def get_attrs(self, item_list, user):
        attrs = super().get_attrs(item_list, user)

        if self.stats_period:
            stats = self.get_stats(item_list, user)
            for item in item_list:
                attrs[item].update({"stats": stats[item.id]})

        return attrs

    def serialize(self, obj, attrs, user):
        result = super().serialize(obj, attrs, user)

        if self.stats_period:
            result["stats"] = {self.stats_period: attrs["stats"]}

        if self.matching_event_id:
            result["matchingEventId"] = self.matching_event_id

        if self.matching_event_environment:
            result["matchingEventEnvironment"] = self.matching_event_environment

        return result


class TagBasedStreamGroupSerializer(StreamGroupSerializer):
    def __init__(self, tags, **kwargs):
        super().__init__(**kwargs)
        self.tags = tags

    def serialize(self, obj, attrs, user):
        result = super().serialize(obj, attrs, user)
        result["tagLastSeen"] = self.tags[obj.id].last_seen
        result["tagFirstSeen"] = self.tags[obj.id].first_seen
        return result


class StreamGroupSerializerSnuba(GroupSerializerSnuba, GroupStatsMixin):
    def __init__(
        self,
        environment_ids=None,
        stats_period=None,
        stats_period_start=None,
        stats_period_end=None,
        matching_event_id=None,
        start=None,
        end=None,
        search_filters=None,
        collapse=None,
        expand=None,
        organization_id=None,
    ):
        super().__init__(
            environment_ids,
            start,
            end,
            search_filters,
            collapse=collapse,
            expand=expand,
            organization_id=organization_id,
        )

        if stats_period is not None:
            assert stats_period in self.STATS_PERIOD_CHOICES or (
                stats_period == "auto" and stats_period_start and stats_period_end
            )

        self.stats_period = stats_period
        self.stats_period_start = stats_period_start
        self.stats_period_end = stats_period_end
        self.matching_event_id = matching_event_id

    def _get_seen_stats(self, item_list, user):
        if not self._collapse("stats"):
            partial_execute_seen_stats_query = functools.partial(
                self._execute_seen_stats_query,
                item_list=item_list,
                environment_ids=self.environment_ids,
                start=self.start,
                end=self.end,
            )
            time_range_result = partial_execute_seen_stats_query()
            filtered_result = (
                partial_execute_seen_stats_query(conditions=self.conditions)
                if self.conditions and not self._collapse("filtered")
                else None
            )
            if not self._collapse("lifetime"):
                lifetime_result = (
                    partial_execute_seen_stats_query(start=None, end=None)
                    if self.start or self.end
                    else time_range_result
                )
            else:
                lifetime_result = None

            for item in item_list:
                time_range_result[item].update(
                    {
                        "filtered": filtered_result.get(item) if filtered_result else None,
                        "lifetime": lifetime_result.get(item) if lifetime_result else None,
                    }
                )
            return time_range_result
        return None

    def query_tsdb(self, group_ids, query_params, conditions=None, environment_ids=None, **kwargs):
        return snuba_tsdb.get_range(
            model=snuba_tsdb.models.group,
            keys=group_ids,
            environment_ids=environment_ids,
            conditions=conditions,
            **query_params,
        )

    def get_attrs(self, item_list, user):
        if not self._collapse("base"):
            attrs = super().get_attrs(item_list, user)
        else:
            seen_stats = self._get_seen_stats(item_list, user)
            if seen_stats:
                attrs = {item: seen_stats.get(item, {}) for item in item_list}
            else:
                attrs = {item: {} for item in item_list}

        if self.stats_period and not self._collapse("stats"):
            partial_get_stats = functools.partial(
                self.get_stats, item_list=item_list, user=user, environment_ids=self.environment_ids
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
                    project_sessions = release_health.get_num_sessions_per_project(
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

        return attrs

    def serialize(self, obj, attrs, user):
        if not self._collapse("base"):
            result = super().serialize(obj, attrs, user)
        else:
            result = {
                "id": str(obj.id),
            }
            if "times_seen" in attrs:
                result.update(self._convert_seen_stats(attrs))

        if self.matching_event_id:
            result["matchingEventId"] = self.matching_event_id

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

        return result

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
