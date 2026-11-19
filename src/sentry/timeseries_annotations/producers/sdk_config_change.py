"""Produce SDK-config-change timeseries annotations from the ``sdk.config`` trace metric."""

from __future__ import annotations

import dataclasses
import hashlib
import itertools
import logging
from collections import defaultdict
from collections.abc import Mapping, Sequence
from datetime import datetime, timezone
from typing import Any

import sentry_sdk
from django.db.models import Max
from sentry_sdk import traces

from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.snuba.referrer import Referrer
from sentry.snuba.trace_metrics import TraceMetrics
from sentry.timeseries_annotations.models import (
    AnnotationScope,
    AnnotationType,
    IntervalType,
    Severity,
    TimeseriesAnnotation,
)
from sentry.timeseries_annotations.service import TimeseriesAnnotationData
from sentry.utils import json

logger = logging.getLogger(__name__)

METRIC_NAME = "sdk.config"
_HASH_ATTR = "sentry.sdk_config.hash"
_PAYLOAD_ATTR = "sentry.sdk_config.payload"

_PROJECT_COL = "project.id"
_HASH_COL = f"tags[{_HASH_ATTR},string]"
_PAYLOAD_COL = f"tags[{_PAYLOAD_ATTR},string]"
_FIRST_SEEN_COL = "min(timestamp_precise)"

# Guards against a pathological org; normal grouped cardinality (projects x configs) is small.
_TIMELINE_ROW_LIMIT = 10000

_NOISE_OPTIONS = frozenset({"release", "dsn"})

_SAMPLE_RATE_KEYS = (
    "tracesSampleRate",
    "replaysSessionSampleRate",
    "replaysOnErrorSampleRate",
    "profileSessionSampleRate",
)
_FILTER_FUNCTION_KEYS = ("beforeSend", "beforeSendSpan", "beforeSendLog", "beforeBreadcrumb")

_ANNOTATION_TYPE = AnnotationType.SDK_CONFIG_CHANGE_EXPERIMENTAL
_SPAN_OP = "annotations.sdk_config"


@dataclasses.dataclass(frozen=True)
class _Sample:
    """One distinct config hash seen for a project, with its first appearance in the window."""

    project_id: int
    config_hash: str
    first_seen: datetime


@dataclasses.dataclass(frozen=True)
class _Config:
    """A config reduced to its meaningful form, plus the fingerprint computed over that form."""

    normalized: dict[str, Any]
    fingerprint: str

    @property
    def sdk_version(self) -> Any:
        return self.normalized["sdk"].get("version")


@dataclasses.dataclass(frozen=True)
class _ConfigAt:
    """A config as it appeared at a point in time (one project's timeline is a list of these)."""

    first_seen: datetime
    config: _Config


@traces.trace
def sdk_config_change_as_annotations(
    organization: Organization,
    projects: Sequence[Project],
    start: datetime,
    end: datetime,
) -> int:
    """Materialize config-change annotations, scanning the metric only forward of what's written."""
    # The last written annotation is a watermark: everything before it is already persisted, so we
    # scan only from there. Its config reappears as the diff baseline, so past transitions aren't
    # re-emitted and the read shrinks to recent data.
    scan_start = _scan_start(organization, projects, start)
    annotations = _detect_changes(organization, projects, scan_start, end)
    return _persist_new(organization, annotations, scan_start, end)


@traces.trace
def _detect_changes(
    organization: Organization,
    projects: Sequence[Project],
    start: datetime,
    end: datetime,
) -> list[TimeseriesAnnotationData]:
    """Read the metric over ``[start, end]`` and return one annotation per config transition."""
    if not projects:
        return []

    params = SnubaParams(start=start, end=end, projects=list(projects), organization=organization)

    samples_by_project: dict[int, list[_Sample]] = defaultdict(list)
    for sample in _query_timeline(params):
        samples_by_project[sample.project_id].append(sample)

    configs_by_hash = _resolve_configs(params, _hashes_to_fetch(samples_by_project))
    projects_by_id = {project.id: project for project in projects}

    annotations: list[TimeseriesAnnotationData] = []
    for project_id, samples in samples_by_project.items():
        if (project := projects_by_id.get(project_id)) is None:
            continue
        timeline = [
            _ConfigAt(sample.first_seen, configs_by_hash[sample.config_hash])
            for sample in samples
            if sample.config_hash in configs_by_hash
        ]
        annotations.extend(_annotations_for_timeline(project, timeline))
    return annotations


def _hashes_to_fetch(samples_by_project: Mapping[int, Sequence[_Sample]]) -> set[str]:
    """Hashes whose payload we actually need: only projects with a possible transition"""
    return {
        sample.config_hash
        for samples in samples_by_project.values()
        if len({s.config_hash for s in samples}) >= 2
        for sample in samples
    }


def _annotations_for_timeline(
    project: Project, timeline: Sequence[_ConfigAt]
) -> list[TimeseriesAnnotationData]:
    """Walk one project's configs oldest-first, emitting an annotation at each real change."""
    # Collapse deploy-noise siblings (same config, new release/token) before pairing, so each
    # remaining neighbor pair is a genuine fingerprint change to diff.
    ordered = sorted(timeline, key=lambda point: point.first_seen)
    distinct = [
        point
        for i, point in enumerate(ordered)
        if i == 0 or point.config.fingerprint != ordered[i - 1].config.fingerprint
    ]
    return [
        _to_annotation(project, previous, current, changes)
        for previous, current in itertools.pairwise(distinct)
        if (changes := diff(previous.config.normalized, current.config.normalized))
    ]


def _to_annotation(
    project: Project,
    previous: _ConfigAt,
    current: _ConfigAt,
    changes: Mapping[str, tuple[Any, Any]],
) -> TimeseriesAnnotationData:
    return TimeseriesAnnotationData(
        organization_id=project.organization_id,
        project_id=project.id,
        annotation_type=_ANNOTATION_TYPE,
        scope=AnnotationScope.GLOBAL,
        interval_type=IntervalType.POINT,
        description=describe(changes),
        start_timestamp=current.first_seen,
        tags={
            "from_fingerprint": previous.config.fingerprint,
            "to_fingerprint": current.config.fingerprint,
            "sdk_version": current.config.sdk_version,
            "changed_keys": sorted(changes.keys()),
        },
        created_by_label="sdk-config-producer",
    )


def normalize(payload: Mapping[str, Any]) -> dict[str, Any]:
    """Reduce a raw config payload to its comparable, useful-keys form.

    Function tokens like ``[Function:xxxx]`` are kept: a changed token means the user's function
    changed. ``release``/``dsn`` are dropped — they shift per deploy without a real config change.
    """
    options = payload.get("options", {})
    sdk = payload.get("sdk", {})
    return {
        "sdk": {
            "name": sdk.get("name"),
            "version": sdk.get("version"),
            "settings": sdk.get("settings"),
        },
        "options": {
            key: _normalize_value(key, value)
            for key, value in options.items()
            if key not in _NOISE_OPTIONS
        },
        "options_set_by_user": sorted(payload.get("options_set_by_user", [])),
        "integrations": sorted(
            entry.get("name", "")
            for entry in payload.get("integrations", [])
            if isinstance(entry, dict)
        ),
    }


def _normalize_value(key: str, value: Any) -> Any:
    # Order-insensitive list options: sort so a reorder alone is not a change.
    if key in ("allowUrls", "whitelistUrls", "ignoreErrors", "ignoreSpans") and isinstance(
        value, list
    ):
        return sorted(value)
    return value


def fingerprint(normalized: Mapping[str, Any]) -> str:
    """Stable hash of a normalized config, used to collapse deploy-noise siblings."""
    return hashlib.sha1(json.dumps(normalized, sort_keys=True).encode()).hexdigest()


def diff(previous: Mapping[str, Any], current: Mapping[str, Any]) -> dict[str, tuple[Any, Any]]:
    """Return ``{dotted_key: (old, new)}`` for every leaf that changed between two configs."""
    changes: dict[str, tuple[Any, Any]] = {}
    _collect_changes(previous, current, "", changes)
    return changes


def _collect_changes(
    previous: Any, current: Any, prefix: str, changes: dict[str, tuple[Any, Any]]
) -> None:
    if isinstance(previous, Mapping) and isinstance(current, Mapping):
        for key in previous.keys() | current.keys():
            child = f"{prefix}.{key}" if prefix else key
            _collect_changes(previous.get(key), current.get(key), child, changes)
    elif previous != current:
        changes[prefix] = (previous, current)


def describe(changes: Mapping[str, tuple[Any, Any]]) -> str:
    """Turn a diff into a short human sentence, calling out the changes users care about."""
    parts: list[str] = []

    if "sdk.version" in changes:
        old, new = changes["sdk.version"]
        parts.append(f"SDK version {old} → {new}")

    for key in _SAMPLE_RATE_KEYS:
        if f"options.{key}" in changes:
            old, new = changes[f"options.{key}"]
            parts.append(f"{key} {old} → {new}")

    added, removed = _integration_delta(changes)
    if added:
        parts.append(f"enabled {', '.join(added)}")
    if removed:
        parts.append(f"disabled {', '.join(removed)}")

    changed_filters = [key for key in _FILTER_FUNCTION_KEYS if f"options.{key}" in changes]
    if changed_filters:
        parts.append(f"changed {', '.join(changed_filters)}")

    if not parts:
        parts.append(f"config changed ({', '.join(sorted(changes.keys()))})")

    return "SDK config changed: " + "; ".join(parts)


def _integration_delta(changes: Mapping[str, tuple[Any, Any]]) -> tuple[list[str], list[str]]:
    if "integrations" not in changes:
        return [], []
    old, new = changes["integrations"]
    old_set, new_set = set(old or []), set(new or [])
    return sorted(new_set - old_set), sorted(old_set - new_set)


# --- persistence -----------------------------------------------------------


def _scan_start(
    organization: Organization, projects: Sequence[Project], start: datetime
) -> datetime:
    """Clamp the scan start to just past the newest annotation already written for these projects."""
    project_ids = {project.id for project in projects}
    if not project_ids:
        return start

    latest_by_project = dict(
        TimeseriesAnnotation.objects.filter(
            organization_id=organization.id,
            annotation_type=_ANNOTATION_TYPE,
            project_id__in=project_ids,
            start_timestamp__gte=start,
        )
        .values_list("project_id")
        .annotate(latest=Max("start_timestamp"))
    )

    if len(latest_by_project) < len(project_ids):
        return start
    return min(latest_by_project.values())


def _persist_new(
    organization: Organization,
    annotations: Sequence[TimeseriesAnnotationData],
    start: datetime,
    end: datetime,
) -> int:
    """Bulk-create annotations that don't already exist. Returns the number created."""
    if not annotations:
        return 0

    existing = _existing_keys(organization, start, end)
    to_create = [
        _as_model(data)
        for data in annotations
        if _dedup_key(data.project_id, data.start_timestamp, data.tags) not in existing
    ]
    if not to_create:
        return 0

    with traces.start_span(
        name="timeseries_annotations.sdk_config.bulk_create", attributes={"sentry.op": _SPAN_OP}
    ) as span:
        span.set_attribute("created_count", len(to_create))
        TimeseriesAnnotation.objects.bulk_create(to_create)
    return len(to_create)


def _as_model(data: TimeseriesAnnotationData) -> TimeseriesAnnotation:
    return TimeseriesAnnotation(
        organization_id=data.organization_id,
        project_id=data.project_id,
        start_timestamp=data.start_timestamp,
        end_timestamp=data.end_timestamp,
        interval_type=data.interval_type,
        annotation_type=data.annotation_type,
        scope=data.scope,
        # A config change (sampling, integrations, beforeSend) can move telemetry volume a lot, so
        # it always warrants attention on the timeline.
        severity=Severity.HIGH,
        description=data.description,
        tags=dict(data.tags) if data.tags is not None else None,
        created_by_label=data.created_by_label,
        updated_by_label=data.created_by_label,
    )


def _existing_keys(
    organization: Organization, start: datetime, end: datetime
) -> set[tuple[int | None, datetime, str | None]]:
    rows = TimeseriesAnnotation.objects.filter(
        organization_id=organization.id,
        annotation_type=_ANNOTATION_TYPE,
        start_timestamp__gte=start,
        start_timestamp__lte=end,
    ).values_list("project_id", "start_timestamp", "tags")
    return {_dedup_key(project_id, ts, tags) for project_id, ts, tags in rows}


def _dedup_key(
    project_id: int | None, start_timestamp: datetime, tags: Mapping[str, Any] | None
) -> tuple[int | None, datetime, str | None]:
    return (project_id, start_timestamp, tags.get("to_fingerprint") if tags else None)


def _query_timeline(params: SnubaParams) -> list[_Sample]:
    """One row per (project, config hash) with its first-seen time, all projects in one query."""
    with traces.start_span(
        name="timeseries_annotations.sdk_config.timeline_query", attributes={"sentry.op": _SPAN_OP}
    ) as span:
        results = TraceMetrics.run_table_query(
            params=params,
            query_string=f"metric.name:{METRIC_NAME}",
            selected_columns=[_PROJECT_COL, _HASH_COL, _FIRST_SEEN_COL],
            orderby=[_FIRST_SEEN_COL],
            offset=0,
            limit=_TIMELINE_ROW_LIMIT,
            referrer=Referrer.API_TIMESERIES_ANNOTATIONS_SDK_CONFIG_TIMELINE.value,
            config=SearchResolverConfig(),
        )
        rows = results["data"]
        span.set_attribute("timeline_row_count", len(rows))
        if len(rows) >= _TIMELINE_ROW_LIMIT:
            logger.warning(
                "timeseries_annotations.sdk_config_timeline_truncated",
                extra={"limit": _TIMELINE_ROW_LIMIT},
            )

    return [sample for row in rows if (sample := _row_to_sample(row)) is not None]


def _row_to_sample(row: Mapping[str, Any]) -> _Sample | None:
    config_hash = row.get(_HASH_COL)
    project_id = row.get(_PROJECT_COL)
    first_seen = row.get(_FIRST_SEEN_COL)
    if not config_hash or project_id is None or first_seen is None:
        return None
    return _Sample(int(project_id), config_hash, _to_datetime(first_seen))


def _resolve_configs(params: SnubaParams, hashes: set[str]) -> dict[str, _Config]:
    """Resolve each distinct hash to its normalized config + fingerprint, deduped org-wide."""
    with traces.start_span(
        name="timeseries_annotations.sdk_config.payload_fetch", attributes={"sentry.op": _SPAN_OP}
    ) as span:
        span.set_attribute("distinct_hash_count", len(hashes))
        return {
            config_hash: _Config(normalized, fingerprint(normalized))
            for config_hash in hashes
            if (payload := _query_payload(params, config_hash)) is not None
            and (normalized := normalize(payload))
        }


def _query_payload(params: SnubaParams, config_hash: str) -> dict[str, Any] | None:
    """One representative serialized config for a given hash."""
    results = TraceMetrics.run_table_query(
        params=params,
        query_string=f'metric.name:{METRIC_NAME} {_HASH_ATTR}:"{config_hash}"',
        selected_columns=[_PAYLOAD_COL],
        orderby=None,
        offset=0,
        limit=1,
        referrer=Referrer.API_TIMESERIES_ANNOTATIONS_SDK_CONFIG_PAYLOAD.value,
        config=SearchResolverConfig(),
    )
    rows = results["data"]
    raw = rows[0].get(_PAYLOAD_COL) if rows else None
    if not raw:
        return None
    try:
        parsed = json.loads(raw)
    except (ValueError, TypeError):
        sentry_sdk.capture_message("sdk_config payload failed to parse")
        return None
    return parsed if isinstance(parsed, dict) else None


def _to_datetime(value: float) -> datetime:
    # timestamp_precise is unix seconds (float), e.g. 1795020154.742.
    return datetime.fromtimestamp(value, tz=timezone.utc)
