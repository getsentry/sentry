import math
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, cast

from rest_framework.request import Request
from sentry_sdk import traces

from sentry.api.endpoints.timeseries import INGESTION_DELAY
from sentry.cache import default_cache
from sentry.search.events.types import SnubaParams
from sentry.snuba.spans_rpc import Spans
from sentry.snuba.utils import RPC_DATASETS
from sentry.utils import json
from sentry.utils.hashlib import md5_text

# Dashboard line/area/bar widgets use this prefix.
DASHBOARD_TIMESERIES_REFERRER_PREFIX = "api.dashboards.widget."

INCREMENTAL_CACHE_TTL = int(timedelta(hours=1).total_seconds())
# We can only store 50mb in cache, a timestamp & 1 aggregate is about 52 bytes, so the actual max is closer to one
# million, doing 500k so we have room to grow
MAX_CACHE_LENGTH = 500_000


def is_dashboard_chart_referrer(referrer: str) -> bool:
    """Dashboard line/area/bar queries. Table rows use the same prefix with a `.row` suffix."""
    return (
        referrer.startswith(DASHBOARD_TIMESERIES_REFERRER_PREFIX)
        and "-chart" in referrer
        and not referrer.endswith(".row")
    )


def cache_candidate(
    request: Request,
    dataset: Any,
    query: str,
    query_columns: list[str],
    rollup: int,
    top_events: int,
    comparison_delta: timedelta | None,
    referrer: str,
) -> bool:
    """Check if this query is a good candidate for caching.

    Only RPC datasets. Only statsPeriod queries. Those windows all end at now, so one series stays nested
    instead of holding two disjoint ranges.
    """
    if (
        dataset not in RPC_DATASETS
        or not request.GET.get("statsPeriod")
        or top_events != 0
        or comparison_delta is not None
    ):
        return False
    if is_dashboard_chart_referrer(referrer):
        return True
    return (
        dataset == Spans
        and query == ""
        and query_columns == ["count(span.duration)"]
        and rollup in [1800, 10_800]
    )


def add_cache_time_filter(query: str, filter_start: datetime) -> str:
    """AND the cache window onto the whole query.

    This is so the request meta still has the full time window so snuba requests the same tier as before, but we still
    only need to scan a few buckets
    """
    condition = (
        f"timestamp:>={filter_start.astimezone(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}"
    )
    stripped = query.strip()
    if not stripped:
        return condition
    return f"({stripped}) {condition}"


def create_cache_key(request: Request, snuba_params: SnubaParams, rollup: int) -> str:
    """Identity for one timeseries. The time window is not included; rows are filtered on read.

    Every other query parameter is part of the hash, so a new parameter changes the key
    without another argument here.
    """
    query_params = [
        f"{key}={value}"
        for key in sorted(request.GET)
        if key
        not in {
            "start",
            "end",
            "statsPeriod",
            "utc",
            # Shouldn't get here if this is on anyways
            "skipCache",
            # Handled at the top level
            "project",
            "environment",
            "interval",
        }
        for value in request.GET.getlist(key)
    ]
    identity = json.dumps(
        {
            "organization": snuba_params.organization_id,
            "projects": list(snuba_params.project_ids),
            "environments": sorted(snuba_params.environment_names),
            "rollup": rollup,
            "params": query_params,
        },
        sort_keys=True,
    )
    return f"incremental_timeseries:{md5_text(identity).hexdigest()}"


@dataclass
class SeriesCache:
    cache_key: str
    cached: list[dict[str, Any]] | None
    cached_timestamps: list[int] | None
    merge_from: int | None


@traces.trace
def inspect_cached_series(
    cache_key: str, snuba_params: SnubaParams, rollup: int
) -> tuple[SeriesCache, datetime | None]:
    """Load a series. The datetime is set only when the stored range can be narrowed."""
    cached = default_cache.get(cache_key)
    if not cached:
        return SeriesCache(cache_key, None, None, None), None
    cached_rows = cast(Sequence[Mapping[str, Any]], cached)
    cached_timestamps = sorted(int(row["time"]) for row in cached_rows)
    stored = [dict(row) for row in cached_rows]
    # Haven't queried this start before, so don't narrow the scan.
    if not cached_timestamps or cached_timestamps[0] > snuba_params.start_date.timestamp():
        return SeriesCache(cache_key, stored, cached_timestamps, None), None
    if rollup <= 0:
        refresh_count = 3
    else:
        refresh_count = max(3, math.ceil(INGESTION_DELAY / rollup) + 1)
    if len(cached_timestamps) <= refresh_count:
        return SeriesCache(cache_key, stored, cached_timestamps, None), None
    merge_from = cached_timestamps[-refresh_count]
    return (
        SeriesCache(cache_key, stored, cached_timestamps, merge_from),
        datetime.fromtimestamp(merge_from, tz=timezone.utc),
    )


@dataclass
class TimeseriesCache:
    candidate: bool = False
    cache_key: str | None = None
    cached: list[dict[str, Any]] | None = None
    cached_timestamps: list[int] | None = None
    filter_start: datetime | None = None
    merge_from: int | None = None


@traces.trace(name="set_cache")
def update_result_with_cache(
    loaded: TimeseriesCache, result: Any, snuba_params: SnubaParams
) -> None:
    if not loaded.candidate or loaded.cache_key is None:
        return
    cache_key = loaded.cache_key
    cached = loaded.cached
    cached_timestamps = loaded.cached_timestamps
    merge_from = loaded.merge_from
    processed = result.data.get("processed_timeseries")
    if processed is not None:
        for row, sample_count, sampling_rate, confidence in zip(
            result.data["data"],
            processed.sample_count,
            processed.sampling_rate,
            processed.confidence,
        ):
            # Keep every y-axis. A single label drops confidence for the other series.
            row["sampleCount"] = {
                key: value for key, value in sample_count.items() if key != "time"
            }
            row["sampleRate"] = {
                key: value for key, value in sampling_rate.items() if key != "time"
            }
            row["confidence"] = {key: value for key, value in confidence.items() if key != "time"}
    fresh_by_time: dict[int, dict[str, Any]] = {}
    for row in result.data["data"]:
        # The RPC still returns the full metadata window. Buckets before the
        # cache filter are zerofilled and must not replace stored counts.
        if merge_from is not None and row["time"] < merge_from:
            continue
        fresh_by_time[int(row["time"])] = row

    start_ts = snuba_params.start_date.timestamp()
    end_ts = snuba_params.end_date.timestamp()
    if not cached or not cached_timestamps:
        cached = list(result.data["data"])
    else:
        refreshed: list[dict[str, Any]] = []
        cached_by_time: dict[int, dict[str, Any]] = {}
        for row in cached:
            bucket_time = int(row["time"])
            in_refresh = merge_from is not None and bucket_time >= merge_from
            in_request = start_ts <= bucket_time <= end_ts
            if in_refresh or (merge_from is None and in_request):
                fresh = fresh_by_time.get(bucket_time)
                if fresh is None:
                    continue
                row.update(fresh)
            refreshed.append(row)
            cached_by_time[bucket_time] = row
        for bucket_time, row in fresh_by_time.items():
            if bucket_time not in cached_by_time:
                refreshed.append(row)
        cached = refreshed

    cached.sort(key=lambda row: row["time"])
    # Trim only the stored series. The response still needs every bucket in this
    # window, including ones that fall outside the retained tail.
    final_result = [row for row in cached if start_ts <= row["time"] <= end_ts]
    if len(cached) > MAX_CACHE_LENGTH:
        cached = cached[-MAX_CACHE_LENGTH:]
    if processed is not None:
        sample_count = []
        sampling_rate = []
        confidence = []
        for row in final_result:
            for field, restored in (
                ("sampleCount", sample_count),
                ("sampleRate", sampling_rate),
                ("confidence", confidence),
            ):
                stats = row.get(field) or {}
                if not isinstance(stats, dict):
                    stats = {}
                restored.append({"time": row["time"], **stats})
        processed.sample_count = sample_count
        processed.sampling_rate = sampling_rate
        processed.confidence = confidence
    default_cache.set(cache_key, cached, timeout=INCREMENTAL_CACHE_TTL)
    result.data["data"] = final_result


def read_timeseries_cache(
    *,
    enabled: bool,
    request: Request,
    dataset: Any,
    query: str,
    query_columns: list[str],
    rollup: int,
    top_events: int,
    comparison_delta: timedelta | None,
    referrer: str,
    snuba_params: SnubaParams,
) -> TimeseriesCache:
    """Load a cached series when this query is allowed to use one."""
    loaded = TimeseriesCache()
    if not enabled:
        return loaded

    with traces.start_span("get_cache") as span:
        if not cache_candidate(
            request,
            dataset,
            query,
            query_columns,
            rollup,
            top_events,
            comparison_delta,
            referrer,
        ):
            span.set_attribute("query.invalid_cache_reason", "non_candidate")
            return loaded

        # Saved formulas are cached by name for now. The body is not in the key, so an edit can stay stale until the TTL.
        loaded.candidate = True
        state, loaded.filter_start = inspect_cached_series(
            create_cache_key(request, snuba_params, rollup), snuba_params, rollup
        )
        loaded.cache_key = state.cache_key
        loaded.cached = state.cached
        loaded.cached_timestamps = state.cached_timestamps
        loaded.merge_from = state.merge_from if loaded.filter_start is not None else None
        if loaded.cached is None:
            span.set_attribute("query.cache_hit", "missing")
        elif (
            loaded.cached_timestamps
            and loaded.cached_timestamps[0] > snuba_params.start_date.timestamp()
        ):
            span.set_attribute("query.invalid_cache_reason", "missing_start")
            span.set_attribute("query.truncated", "None")
        elif loaded.filter_start is not None:
            # Re-read the tail through a query filter. Leave the metadata
            # range alone so Snuba keeps the same storage tier.
            span.set_attribute("query.truncated", "by_cache")
        else:
            span.set_attribute("query.truncated", "None")
    return loaded
