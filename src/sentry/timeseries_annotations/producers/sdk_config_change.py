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
from sentry_sdk import traces

from sentry.models.environment import Environment
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
from sentry.utils import json

logger = logging.getLogger(__name__)

METRIC_NAME = "sdk.config"
_HASH_ATTR = "sentry.sdk_config.hash"
_PAYLOAD_ATTR = "sentry.sdk_config.payload"

_PROJECT_COL = "project.id"
_ENVIRONMENT_COL = "environment"
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
class _Scope:
    """A (project, environment) pair. Configs are diffed within one scope, never across."""

    project_id: int
    environment: str | None


@dataclasses.dataclass(frozen=True)
class _Sample:
    """One distinct config hash seen in a scope, with its first appearance in the window."""

    scope: _Scope
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


@traces.trace
def sdk_config_change_as_annotations(
    organization: Organization,
    projects: Sequence[Project],
    start: datetime,
    end: datetime,
) -> list[TimeseriesAnnotation]:
    """Read the metric over ``[start, end]`` and return one annotation per config transition on demand"""
    if not projects:
        return []

    params = SnubaParams(start=start, end=end, projects=list(projects), organization=organization)

    # Bucket by (project, environment): a project running prod and staging on different configs
    # must not look like one config flapping between them.
    samples_by_scope: dict[_Scope, list[_Sample]] = defaultdict(list)
    for sample in _query_timeline(params):
        samples_by_scope[sample.scope].append(sample)

    configs_by_hash = _resolve_configs(params, _hashes_to_fetch(samples_by_scope))
    projects_by_id = {project.id: project for project in projects}
    environment_ids = _environment_ids(organization, samples_by_scope)

    annotations: list[TimeseriesAnnotation] = []
    for scope, samples in samples_by_scope.items():
        if (project := projects_by_id.get(scope.project_id)) is None:
            continue
        # Each sample carries its own first_seen; pair it with the resolved config for that hash.
        timeline = [
            (sample.first_seen, configs_by_hash[sample.config_hash])
            for sample in samples
            if sample.config_hash in configs_by_hash
        ]
        annotations.extend(
            _annotations_for_timeline(project, environment_ids.get(scope.environment), timeline)
        )
    return annotations


def _environment_ids(
    organization: Organization, samples_by_scope: Mapping[_Scope, Sequence[_Sample]]
) -> dict[str | None, int]:
    """Resolve the environment names seen in the metric to their row ids, in one query."""
    names = {scope.environment for scope in samples_by_scope if scope.environment is not None}
    if not names:
        return {}
    return {
        name: env_id
        for name, env_id in Environment.objects.filter(
            organization_id=organization.id, name__in=names
        ).values_list("name", "id")
    }


def _hashes_to_fetch(samples_by_scope: Mapping[_Scope, Sequence[_Sample]]) -> set[str]:
    """Hashes whose payload we actually need: only scopes with a possible transition"""
    return {
        sample.config_hash
        for samples in samples_by_scope.values()
        if len({s.config_hash for s in samples}) >= 2
        for sample in samples
    }


def _annotations_for_timeline(
    project: Project,
    environment_id: int | None,
    timeline: Sequence[tuple[datetime, _Config]],
) -> list[TimeseriesAnnotation]:
    """Walk one scope's configs oldest-first, emitting an annotation at each real change."""
    # Collapse deploy-noise siblings (same config, new release/token) before pairing, so each
    # remaining neighbor pair is a genuine fingerprint change to diff.
    ordered = sorted(timeline, key=lambda point: point[0])
    distinct = [
        point
        for i, point in enumerate(ordered)
        if i == 0 or point[1].fingerprint != ordered[i - 1][1].fingerprint
    ]
    return [
        _to_annotation(project, environment_id, first_seen, previous, current, changes)
        for (_, previous), (first_seen, current) in itertools.pairwise(distinct)
        if (changes := diff(previous.normalized, current.normalized))
    ]


def _to_annotation(
    project: Project,
    environment_id: int | None,
    first_seen: datetime,
    previous: _Config,
    current: _Config,
    changes: Mapping[str, tuple[Any, Any]],
) -> TimeseriesAnnotation:
    return TimeseriesAnnotation(
        # Unsaved and never written; a synthetic id keyed on the transition keeps repeat reads
        # stable and distinct without touching the DB sequence.
        id=_synthetic_id(project.id, environment_id, first_seen, current.fingerprint),
        organization_id=project.organization_id,
        project_id=project.id,
        environment_id=environment_id,
        annotation_type=_ANNOTATION_TYPE,
        scope=AnnotationScope.GLOBAL,
        severity=Severity.HIGH,
        interval_type=IntervalType.POINT,
        description=describe(changes),
        start_timestamp=first_seen,
        tags={
            "from_fingerprint": previous.fingerprint,
            "to_fingerprint": current.fingerprint,
            "sdk_version": current.sdk_version,
            "changed_keys": sorted(changes.keys()),
        },
        created_by_label="sdk-config-producer",
    )


def _synthetic_id(
    project_id: int, environment_id: int | None, first_seen: datetime, to_fingerprint: str
) -> int:
    key = f"{project_id}:{environment_id}:{first_seen.isoformat()}:{to_fingerprint}"
    # Negative so it can never collide with a real (positive) TimeseriesAnnotation primary key.
    return -int(hashlib.sha1(key.encode()).hexdigest()[:15], 16)


def normalize(payload: Mapping[str, Any]) -> dict[str, Any]:
    """Reduce a raw config payload to its comparable, useful-keys form.

    Function tokens like ``[Function:xxxx]`` are kept: a changed token means the user's function
    changed. ``release``/``dsn`` are dropped — they shift per deploy without a real config change.
    """
    # Fields come from untrusted client JSON: a present-but-null key (e.g. {"options": null})
    # returns None from .get(default), so coalesce every nested container before using it.
    options = payload.get("options") or {}
    sdk = payload.get("sdk") or {}
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
        "options_set_by_user": sorted(payload.get("options_set_by_user") or []),
        "integrations": sorted(
            entry.get("name", "")
            for entry in (payload.get("integrations") or [])
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


def _query_timeline(params: SnubaParams) -> list[_Sample]:
    """One row per (project, config hash) with its first-seen time, all projects in one query.

    Each distinct hash contributes a single first-seen (``min(timestamp_precise)``) within the
    window, so this intentionally does not resolve a re-adopted config (A→B→A reads as one A) or
    place a marker for two configs that already coexisted at the window start. This experimental
    producer trades that temporal precision for one cheap grouped read; a time-bucketed scan is
    the upgrade path if exact transition timing is needed.
    """
    with traces.start_span(
        name="timeseries_annotations.sdk_config.timeline_query", attributes={"sentry.op": _SPAN_OP}
    ) as span:
        results = TraceMetrics.run_table_query(
            params=params,
            query_string=f"metric.name:{METRIC_NAME}",
            selected_columns=[_PROJECT_COL, _ENVIRONMENT_COL, _HASH_COL, _FIRST_SEEN_COL],
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
    # A metric row with no environment tag maps to the null-environment scope.
    environment = row.get(_ENVIRONMENT_COL) or None
    scope = _Scope(int(project_id), environment)
    return _Sample(scope, config_hash, _to_datetime(first_seen))


def _resolve_configs(params: SnubaParams, hashes: set[str]) -> dict[str, _Config]:
    """Resolve each distinct hash to its normalized config + fingerprint, deduped org-wide."""
    with traces.start_span(
        name="timeseries_annotations.sdk_config.payload_fetch", attributes={"sentry.op": _SPAN_OP}
    ) as span:
        span.set_attribute("distinct_hash_count", len(hashes))
        resolved: dict[str, _Config] = {}
        for config_hash in hashes:
            config = _resolve_config(params, config_hash)
            if config is not None:
                resolved[config_hash] = config
        return resolved


def _resolve_config(params: SnubaParams, config_hash: str) -> _Config | None:
    """Fetch and normalize one hash's config; skip (don't abort the batch) on a bad payload."""
    payload = _query_payload(params, config_hash)
    if payload is None:
        return None
    try:
        normalized = normalize(payload)
    except (AttributeError, TypeError):
        # Malformed client metric JSON for this one hash: skip it, keep the rest.
        logger.warning("timeseries_annotations.sdk_config_payload_unnormalizable")
        return None
    return _Config(normalized, fingerprint(normalized))


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
