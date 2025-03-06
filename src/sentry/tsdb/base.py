from collections.abc import Iterable, Mapping, Sequence
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, TypedDict, TypeVar

from django.conf import settings
from django.utils import timezone

from sentry.utils.dates import to_datetime
from sentry.utils.services import Service

ONE_MINUTE = 60
ONE_HOUR = ONE_MINUTE * 60
ONE_DAY = ONE_HOUR * 24

TSDBKey = TypeVar("TSDBKey", str, int)
TSDBItem = TypeVar("TSDBItem", str, int)


class IncrMultiOptions(TypedDict):
    timestamp: datetime
    count: int


class TSDBModel(Enum):
    internal = 0

    # number of events seen specific to grouping
    project = 1
    group = 4
    release = 7

    # number of occurrences seen specific to a generic group
    group_generic = 20

    # the number of events sent to the server
    project_total_received = 100
    # the number of events rejected due to rate limiting
    project_total_rejected = 101
    # the number of events blocked due to being blacklisted
    project_total_blacklisted = 104
    # the number of events forwarded to third party processors (data forwarding)
    project_total_forwarded = 105

    # the number of events sent to the server
    organization_total_received = 200
    # the number of events rejected due to rate limiting
    organization_total_rejected = 201
    # the number of events blocked due to being blacklisted
    organization_total_blacklisted = 202

    # distinct count of users that have been affected by an event in a group
    users_affected_by_group = 300
    # distinct count of users that have been affected by an event in a project
    users_affected_by_project = 301
    # distinct count of users that have been affected by an event in a generic group
    users_affected_by_generic_group = 303

    # frequent_organization_received_by_system = 400
    # frequent_organization_rejected_by_system = 401
    # frequent_organization_blacklisted_by_system = 402
    # frequent_values_by_issue_tag = 405

    # number of events seen for a project, by organization
    # frequent_projects_by_organization = 403  # DEPRECATED
    # number of issues seen for a project, by project
    frequent_issues_by_project = 404
    # number of events seen for a release, by issue
    # frequent_releases_by_group = 406  # DEPRECATED
    # number of events seen for a release, by issue
    frequent_releases_by_group = 407
    # number of events seen for an environment, by issue
    frequent_environments_by_group = 408

    # the number of events sent to the server
    key_total_received = 500
    # the number of events rejected due to rate limiting
    key_total_rejected = 501
    # the number of events blocked due to being blacklisted
    key_total_blacklisted = 502

    # the number of events filtered by ip
    project_total_received_ip_address = 601
    # the number of events filtered by release
    project_total_received_release_version = 602
    # the number of events filtered by error message
    project_total_received_error_message = 603
    # the number of events filtered by browser extension
    project_total_received_browser_extensions = 604
    # the number of events filtered by legacy browser
    project_total_received_legacy_browsers = 605
    # the number of events filtered by localhost
    project_total_received_localhost = 606
    # the number of events filtered by web crawlers
    project_total_received_web_crawlers = 607
    # the number of events filtered by invalid csp
    project_total_received_invalid_csp = 608
    # the number of events filtered by invalid origin
    project_total_received_cors = 609
    # the number of events filtered because their group was discarded
    project_total_received_discarded = 610
    # the number of events filtered because they refer to a healthcheck endpoint
    project_total_healthcheck = 611

    servicehook_fired = 700

    # the number of views that a Sentry App receives
    sentry_app_viewed = 800
    # the number of interactions a Sentry App UI Component receives
    sentry_app_component_interacted = 801


class BaseTSDB(Service):
    __read_methods__ = frozenset(
        [
            "get_range",
            "get_sums",
            "get_distinct_counts_series",
            "get_distinct_counts_totals",
            "get_frequency_series",
        ]
    )

    __write_methods__ = frozenset(
        [
            "incr",
            "incr_multi",
            "merge",
            "delete",
            "record",
            "record_multi",
            "merge_distinct_counts",
            "delete_distinct_counts",
            "record_frequency_multi",
            "merge_frequencies",
            "delete_frequencies",
            "flush",
        ]
    )

    __all__ = (
        frozenset(
            [
                "get_earliest_timestamp",
                "get_optimal_rollup",
                "get_optimal_rollup_series",
                "get_rollups",
                "make_series",
                "models_with_environment_support",
                "normalize_to_epoch",
                "rollup",
            ]
        )
        | __write_methods__
        | __read_methods__
    )

    models_with_environment_support = frozenset(
        [
            TSDBModel.project,
            TSDBModel.group,
            TSDBModel.release,
            TSDBModel.users_affected_by_group,
            TSDBModel.users_affected_by_project,
        ]
    )

    def __init__(
        self,
        rollups: Iterable[tuple[int, int]] | None = None,
        legacy_rollups: dict[int, int] | None = None,
        **options: object,
    ):
        if rollups is None:
            rollups = settings.SENTRY_TSDB_ROLLUPS

        self.rollups: dict[int, int] = dict(rollups)

        # The ``SENTRY_TSDB_LEGACY_ROLLUPS`` setting should be used to store
        # previous rollup configuration values after they are modified in
        # ``SENTRY_TSDB_ROLLUPS``. The values can be removed after the new
        # rollup period is full of new data.
        if legacy_rollups is None:
            legacy_rollups = getattr(settings, "SENTRY_TSDB_LEGACY_ROLLUPS", {})

        self.__legacy_rollups = legacy_rollups

    def validate_arguments(
        self, models: list[TSDBModel], environment_ids: Iterable[int | None]
    ) -> None:
        if any(e is not None for e in environment_ids):
            unsupported_models = set(models) - self.models_with_environment_support
            if unsupported_models:
                raise ValueError("not all models support environment parameters")

    def get_rollups(self) -> dict[int, int]:
        return self.rollups

    def normalize_to_epoch(self, timestamp: datetime, seconds: int) -> int:
        """
        Given a ``timestamp`` (datetime object) normalize to an epoch timestamp.

        i.e. if the rollup is minutes, the resulting timestamp would have
        the seconds and microseconds rounded down.
        """
        epoch = int(timestamp.timestamp())
        return epoch - (epoch % seconds)

    def normalize_ts_to_epoch(self, epoch: float, seconds: int) -> float:
        """
        Given a ``epoch`` normalize to an epoch rollup.
        """
        return epoch - (epoch % seconds)

    def normalize_to_rollup(self, timestamp: datetime | float, seconds: int) -> int:
        """
        Given a ``timestamp`` (datetime object) normalize to an epoch rollup.
        """
        if isinstance(timestamp, datetime):
            epoch = int(timestamp.timestamp())
        else:
            epoch = int(timestamp)
        return int(epoch / seconds)

    def normalize_ts_to_rollup(self, epoch: float, seconds: int) -> int:
        """
        Given a ``epoch`` normalize to an epoch rollup.
        """
        return int(epoch / seconds)

    def get_optimal_rollup(self, start_timestamp: datetime, end_timestamp: datetime) -> int:
        """
        Identify the lowest granularity rollup available within the given time
        range.
        """
        num_seconds = int(end_timestamp.timestamp()) - int(start_timestamp.timestamp())

        # This loop attempts to find the smallest possible rollup that will
        # contain both the start and end timestamps. ``self.rollups`` is
        # ordered from the highest resolution (smallest interval) to lowest
        # resolution (largest interval.)
        # XXX: There is a bug here, since this function assumes that the end
        # timestamp is always equal to or greater than the current time. If the
        # time range is shifted far enough into the past (e.g. a 30 second
        # window, retrieved several days after it's occurrence), this can
        # return a rollup that has already been evicted due to TTL, even if a
        # lower resolution representation of the range exists.
        for rollup, samples in self.rollups.items():
            if rollup * samples >= num_seconds:
                return rollup

        # If nothing actually matches the requested range, just return the
        # lowest resolution interval.
        return list(self.rollups)[-1]

    def get_optimal_rollup_series(
        self, start: datetime, end: datetime | None = None, rollup: int | None = None
    ) -> tuple[int, list[int]]:
        if end is None:
            end = timezone.now()

        if rollup is None:
            rollup = self.get_optimal_rollup(start, end)

        # This attempts to create a range with a duration as close as possible
        # to the requested interval using the requested (or inferred) rollup
        # resolution. This result always includes the ``end`` timestamp, but
        # may not include the ``start`` timestamp.
        series = []
        timestamp = end
        while timestamp >= start:
            series.append(self.normalize_to_epoch(timestamp, rollup))
            timestamp = timestamp - timedelta(seconds=rollup)

        return rollup, series[::-1]

    def get_active_series(
        self,
        start: datetime | None = None,
        end: datetime | None = None,
        timestamp: datetime | None = None,
    ) -> dict[int, list[datetime]]:
        rollups: dict[int, list[datetime]] = {}
        for rollup, samples in self.rollups.items():
            _, series = self.get_optimal_rollup_series(
                (
                    start
                    if start is not None
                    else to_datetime(self.get_earliest_timestamp(rollup, timestamp=timestamp))
                ),
                end,
                rollup=rollup,
            )
            rollups[rollup] = [to_datetime(item) for item in series]
        return rollups

    def make_series(
        self, default, start: datetime, end: datetime | None = None, rollup: int | None = None
    ) -> list[tuple[int, int]]:
        f = default if callable(default) else lambda timestamp: default
        return [
            (timestamp, f(timestamp))
            for timestamp in self.get_optimal_rollup_series(start, end, rollup)[1]
        ]

    def calculate_expiry(self, rollup: int, samples: int, timestamp: datetime) -> int:
        """
        Calculate the expiration time for a rollup.

        :param rollup: rollup interval (in seconds)
        :param samples: number of samples to maintain
        :param timestamp: datetime used to calculate the rollup epoch
        """
        epoch = self.normalize_to_epoch(timestamp, rollup)
        return epoch + (rollup * samples)

    def get_earliest_timestamp(self, rollup: int, timestamp: datetime | None = None) -> int:
        """
        Calculate the earliest available timestamp for a rollup.
        """
        if timestamp is None:
            timestamp = timezone.now()

        samples = self.__legacy_rollups.get(rollup)
        if samples is None:
            samples = self.rollups[rollup]

        seconds = rollup * (samples - 1)
        lifespan = timedelta(seconds=seconds)
        return self.normalize_to_epoch(timestamp - lifespan, rollup)

    def incr(
        self,
        model: TSDBModel,
        key: TSDBKey,
        timestamp: datetime | None = None,
        count: int = 1,
        environment_id: int | None = None,
    ) -> None:
        """
        Increment project ID=1:

        >>> incr(TimeSeriesModel.project, 1)
        """
        raise NotImplementedError

    def incr_multi(
        self,
        items: Sequence[tuple[TSDBModel, TSDBKey] | tuple[TSDBModel, TSDBKey, IncrMultiOptions]],
        timestamp: datetime | None = None,
        count: int = 1,
        environment_id: int | None = None,
    ) -> None:
        """
        Increment project ID=1 and group ID=5:

        >>> incr_multi([(TimeSeriesModel.project, 1), (TimeSeriesModel.group, 5)])

        Increment individual timestamps:

        >>> incr_multi([(TimeSeriesModel.project, 1, {"timestamp": ...}),
        ...             (TimeSeriesModel.group, 5, {"timestamp": ...})])
        """
        for item in items:
            if len(item) == 2:
                model, key = item
                _timestamp: datetime | None = timestamp
                _count: int = count
            elif len(item) == 3:
                model, key, options = item
                _timestamp = options.get("timestamp", timestamp) or timestamp
                _count = options.get("count", count) or count
            else:
                raise AssertionError("unreachable")

            self.incr(
                model,
                key,
                timestamp=_timestamp,
                count=_count,
                environment_id=environment_id,
            )

    def merge(
        self,
        model: TSDBModel,
        destination: int,
        sources: list[int],
        timestamp: datetime | None = None,
        environment_ids: Iterable[int] | None = None,
    ) -> None:
        """
        Transfer all counters from the source keys to the destination key.
        """
        raise NotImplementedError

    def delete(
        self,
        models: list[TSDBModel],
        keys: list[int],
        start: datetime | None = None,
        end: datetime | None = None,
        timestamp: datetime | None = None,
        environment_ids: Iterable[int | None] | None = None,
    ) -> None:
        """
        Delete all counters.
        """
        raise NotImplementedError

    def get_range(
        self,
        model: TSDBModel,
        keys: Sequence[TSDBKey],
        start: datetime,
        end: datetime,
        rollup: int | None = None,
        environment_ids: Sequence[int] | None = None,
        conditions=None,
        use_cache: bool = False,
        jitter_value: int | None = None,
        tenant_ids: dict[str, str | int] | None = None,
        referrer_suffix: str | None = None,
    ) -> dict[TSDBKey, list[tuple[int, int]]]:
        """
        To get a range of data for group ID=[1, 2, 3]:

        Returns a mapping of key => [(timestamp, count), ...].

        >>> now = timezone.now()
        >>> get_range([TSDBModel.group], [1, 2, 3],
        >>>           start=now - timedelta(days=1),
        >>>           end=now)
        """
        raise NotImplementedError

    def get_sums(
        self,
        model: TSDBModel,
        keys: list[int],
        start: datetime,
        end: datetime,
        rollup: int | None = None,
        environment_id: int | None = None,
        use_cache: bool = False,
        jitter_value: int | None = None,
        tenant_ids: dict[str, str | int] | None = None,
        referrer_suffix: str | None = None,
        conditions: list[tuple[str, str, str]] | None = None,
    ) -> dict[int, int]:
        range_set = self.get_range(
            model,
            keys,
            start,
            end,
            rollup,
            environment_ids=[environment_id] if environment_id is not None else None,
            use_cache=use_cache,
            jitter_value=jitter_value,
            tenant_ids=tenant_ids,
            referrer_suffix=referrer_suffix,
            conditions=conditions,
        )
        sum_set = {key: sum(p for _, p in points) for (key, points) in range_set.items()}
        return sum_set

    def _add_jitter_to_series(
        self, series: list[int], start: datetime, rollup: int, jitter_value: int | None
    ) -> list[int]:
        if jitter_value and series:
            jitter = jitter_value % rollup
            if (start - to_datetime(series[0])).total_seconds() < jitter:
                jitter -= rollup
            return [value + jitter for value in series]
        return series

    def rollup(
        self, values: Mapping[TSDBKey, Sequence[tuple[float, int]]], rollup: int
    ) -> dict[TSDBKey, list[list[float]]]:
        """
        Given a set of values (as returned from ``get_range``), roll them up
        using the ``rollup`` time (in seconds).
        """
        result: dict[TSDBKey, list[list[float]]] = {}
        for key, points in values.items():
            result[key] = []
            last_new_ts = None
            for ts, count in points:
                new_ts = self.normalize_ts_to_epoch(ts, rollup)
                if new_ts == last_new_ts:
                    result[key][-1][1] += count
                else:
                    result[key].append([new_ts, count])
                    last_new_ts = new_ts
        return result

    def record(
        self,
        model: TSDBModel,
        key: int,
        values: Iterable[str],
        timestamp: datetime | None = None,
        environment_id: int | None = None,
    ) -> None:
        """
        Record occurrence of items in a single distinct counter.
        """
        raise NotImplementedError

    def record_multi(
        self,
        items: Iterable[tuple[TSDBModel, int, Iterable[str]]],
        timestamp: datetime | None = None,
        environment_id: int | None = None,
    ) -> None:
        """
        Record occurrence of items in multiple distinct counters.
        """
        for model, key, values in items:
            self.record(model, key, values, timestamp, environment_id=environment_id)

    def get_distinct_counts_series(
        self,
        model: TSDBModel,
        keys: Sequence[int],
        start: datetime,
        end: datetime | None = None,
        rollup: int | None = None,
        environment_id: int | None = None,
        tenant_ids: dict[str, str | int] | None = None,
    ) -> dict[int, list[tuple[int, Any]]]:
        """
        Fetch counts of distinct items for each rollup interval within the range.
        """
        raise NotImplementedError

    def get_distinct_counts_totals(
        self,
        model: TSDBModel,
        keys: Sequence[int],
        start: datetime,
        end: datetime | None = None,
        rollup: int | None = None,
        environment_id: int | None = None,
        use_cache: bool = False,
        jitter_value: int | None = None,
        tenant_ids: dict[str, int | str] | None = None,
        referrer_suffix: str | None = None,
        conditions: list[tuple[str, str, str]] | None = None,
    ) -> dict[int, Any]:
        """
        Count distinct items during a time range with optional conditions
        """
        raise NotImplementedError

    def merge_distinct_counts(
        self,
        model: TSDBModel,
        destination: int,
        sources: list[int],
        timestamp: datetime | None = None,
        environment_ids: Iterable[int] | None = None,
    ) -> None:
        """
        Transfer all distinct counters from the source keys to the
        destination key.
        """
        raise NotImplementedError

    def delete_distinct_counts(
        self,
        models: list[TSDBModel],
        keys: list[int],
        start: datetime | None = None,
        end: datetime | None = None,
        timestamp: datetime | None = None,
        environment_ids: Iterable[int] | None = None,
    ) -> None:
        """
        Delete all distinct counters.
        """
        raise NotImplementedError

    def record_frequency_multi(
        self,
        requests: Sequence[tuple[TSDBModel, Mapping[str, Mapping[str, int | float]]]],
        timestamp: datetime | None = None,
        environment_id: int | None = None,
    ) -> None:
        """
        Record items in a frequency table.

        Metrics to increment should be passed as sequence pairs, using this
        structure: ``(model, {key: {item: score, ...}, ...})``
        """
        raise NotImplementedError

    def get_frequency_series(
        self,
        model: TSDBModel,
        items: Mapping[TSDBKey, Sequence[TSDBItem]],
        start: datetime,
        end: datetime | None = None,
        rollup: int | None = None,
        environment_id: int | None = None,
        tenant_ids: dict[str, str | int] | None = None,
    ) -> dict[TSDBKey, list[tuple[float, dict[TSDBItem, float]]]]:
        """
        Retrieve the frequency of known items in a table over time.

        The items requested should be passed as a mapping, where the key is the
        metric key, and the value is a sequence of members to retrieve scores
        for.

        Results are returned as a mapping, where the key is the key requested
        and the value is a list of ``(timestamp, {item: score, ...})`` pairs
        over the series.
        """
        raise NotImplementedError

    def merge_frequencies(
        self,
        model: TSDBModel,
        destination: str,
        sources: Sequence[TSDBKey],
        timestamp: datetime | None = None,
        environment_ids: Iterable[int] | None = None,
    ) -> None:
        """
        Transfer all frequency tables from the source keys to the destination
        key.
        """
        raise NotImplementedError

    def delete_frequencies(
        self,
        models: list[TSDBModel],
        keys: Iterable[str],
        start: datetime | None = None,
        end: datetime | None = None,
        timestamp: datetime | None = None,
        environment_ids: Iterable[int] | None = None,
    ) -> None:
        """
        Delete all frequency tables.
        """
        raise NotImplementedError

    def flush(self) -> None:
        """
        Delete all data.
        """
        raise NotImplementedError
