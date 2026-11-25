"""Produce feature-flag-change timeseries annotations from FlagAuditLog writes."""

from __future__ import annotations

import logging
from typing import Any

from sentry import features
from sentry.flags.models import ActionEnum, FlagAuditLogModel, ProviderEnum
from sentry.models.environment import Environment
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.timeseries_annotations.models import (
    AnnotationScope,
    AnnotationType,
    IntervalType,
    Severity,
)
from sentry.timeseries_annotations.service import (
    TimeseriesAnnotationData,
    create_timeseries_annotation,
)
from sentry.utils import metrics
from sentry.utils.safe import get_path

logger = logging.getLogger(__name__)

_PRODUCER = "feature_flag_change"
_MAX_DESCRIPTION_LEN = 500
_PROVIDER_LABELS = {
    "launchdarkly": "LaunchDarkly",
    "unleash": "Unleash",
    "statsig": "Statsig",
    "generic": "Generic",
    "flagpole": "Flagpole",
}


def build_feature_flag_annotation_description(
    *,
    flag: str,
    action: str,
    provider: str,
    tags: dict[str, Any] | None,
) -> str:
    """Pick a user-visible description: changelog → purpose → constructed."""
    tags = tags or {}

    changelog = _as_nonempty_str(tags.get("description"))
    if changelog:
        return _truncate(changelog)

    purpose = _as_nonempty_str(tags.get("flag_description"))
    if purpose:
        return _truncate(purpose)

    return _truncate(_construct_description(flag=flag, action=action, provider=provider, tags=tags))


def _construct_description(
    *,
    flag: str,
    action: str,
    provider: str,
    tags: dict[str, Any],
) -> str:
    provider_label = _PROVIDER_LABELS.get(provider, provider or "unknown provider")
    parts = [f"Feature flag '{flag}' {action} via {provider_label}"]

    change_type = _as_nonempty_str(tags.get("change_type"))
    if change_type:
        parts.append(f"({change_type})")

    environment = _environment_label(tags)
    if environment:
        parts.append(f"in {environment}")

    if tags.get("on") is not None:
        parts.append(f"— targeting {'on' if str(tags['on']).lower() == 'true' else 'off'}")

    value = tags.get("value")
    if value is not None and value != "":
        parts.append(f"(value={value})")

    return " ".join(parts)


def _environment_label(tags: dict[str, Any]) -> str | None:
    env = _as_nonempty_str(tags.get("environment"))
    if env:
        return env
    return _as_nonempty_str(tags.get("environments"))


def _as_nonempty_str(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _truncate(text: str) -> str:
    if len(text) <= _MAX_DESCRIPTION_LEN:
        return text
    return text[: _MAX_DESCRIPTION_LEN - 3] + "..."


def _parse_launchdarkly_resource(resource: str) -> tuple[str | None, str | None]:
    """Parse ``proj/<project>:env/<environment>:flag/<key>`` into project + environment."""
    project: str | None = None
    environment: str | None = None
    for part in resource.split(":"):
        if part.startswith("proj/"):
            project = part[len("proj/") :] or None
        elif part.startswith("env/"):
            environment = part[len("env/") :] or None
    return project, environment


def _enrich_tags_for_annotation(raw_tags: dict[str, Any] | None) -> dict[str, Any]:
    """Derive annotation-oriented fields from FlagLog tags (resource, version blobs).

    Providers persist simple additive copies; this is where we parse LD ``resource``
    and pull targeting/kind signals from an optional ``current_version`` blob.
    """
    tags: dict[str, Any] = dict(raw_tags or {})

    if not tags.get("project") or not tags.get("environment"):
        resource = _as_nonempty_str(tags.get("resource"))
        if resource:
            project, environment = _parse_launchdarkly_resource(resource)
            if project and not tags.get("project"):
                tags["project"] = project
            if environment and not tags.get("environment"):
                tags["environment"] = environment

    current = tags.get("current_version")
    if isinstance(current, dict):
        if kind := current.get("kind"):
            tags.setdefault("kind", kind)
        if "temporary" in current:
            tags.setdefault("temporary", str(bool(current["temporary"])).lower())
        if "deprecated" in current:
            tags.setdefault("deprecated", str(bool(current["deprecated"])).lower())
        environment = _as_nonempty_str(tags.get("environment"))
        if environment and tags.get("on") is None:
            env_cfg = get_path(current, "environments", environment)
            if isinstance(env_cfg, dict) and "on" in env_cfg:
                tags["on"] = str(bool(env_cfg["on"])).lower()

    return tags


def _annotation_tags(
    flag_log: FlagAuditLogModel, action: str, provider: str, enriched: dict[str, Any]
) -> dict[str, str]:
    raw = dict(enriched)
    if "description" in raw and "change_description" not in raw:
        raw["change_description"] = raw["description"]
    # Opaque blobs are for enrichment only — omit from annotation tags.
    raw.pop("current_version", None)

    out: dict[str, str] = {
        "flag": flag_log.flag,
        "action": action,
        "provider": provider,
        "flag_log_id": str(flag_log.id),
    }
    for key, value in raw.items():
        if value is None:
            continue
        out[str(key)] = str(value)
    return out


def _resolve_project_id(organization_id: int, tags: dict[str, Any]) -> int | None:
    slug = (
        _as_nonempty_str(tags.get("project"))
        or _as_nonempty_str(tags.get("projectName"))
        or _as_nonempty_str(tags.get("projectID"))
    )
    if not slug or slug.isdigit():
        return None
    project = Project.objects.get_or_none(organization_id=organization_id, slug=slug)
    return project.id if project is not None else None


def _resolve_environment_id(organization_id: int, tags: dict[str, Any]) -> int | None:
    name = _as_nonempty_str(tags.get("environment"))
    if not name:
        envs = _as_nonempty_str(tags.get("environments"))
        if not envs or "," in envs:
            return None
        name = envs
    environment = Environment.objects.get_or_none(organization_id=organization_id, name=name)
    return environment.id if environment is not None else None


def _action_label(action: int) -> str:
    try:
        return ActionEnum.to_string(action)
    except ValueError:
        return "updated"


def _provider_label(provider: int | None) -> str:
    if provider is None:
        return "unknown"
    try:
        return ProviderEnum.to_string(provider)
    except ValueError:
        return "unknown"


def record_feature_flag_change_as_annotation(flag_log: FlagAuditLogModel) -> None:
    """Create a POINT annotation for one FlagAuditLog row. Best-effort; never raises.

    Lean metrics (all tagged ``producer`` + ``provider``):
    - ``producer_created`` — annotation write succeeded
    - ``producer_failed`` — unexpected error after FlagLog was already persisted
    - ``producer_skipped_flag_off`` / ``producer_skipped_org_missing`` — expected skips
    """
    provider = _provider_label(flag_log.provider)
    metric_tags = {"producer": _PRODUCER, "provider": provider}
    try:
        organization = Organization.objects.get_or_none(id=flag_log.organization_id)
        if organization is None:
            metrics.incr("timeseries_annotations.producer_skipped_org_missing", tags=metric_tags)
            return

        if not features.has(
            "organizations:timeseries-annotations-usecase-feature-flag-change", organization
        ):
            metrics.incr("timeseries_annotations.producer_skipped_flag_off", tags=metric_tags)
            logger.info(
                "timeseries_annotations.producer_skipped_flag_off",
                extra={
                    "producer": _PRODUCER,
                    "provider": provider,
                    "organization_id": organization.id,
                    "flag_log_id": flag_log.id,
                },
            )
            return

        action = _action_label(flag_log.action)
        enriched = _enrich_tags_for_annotation(flag_log.tags)
        description = build_feature_flag_annotation_description(
            flag=flag_log.flag,
            action=action,
            provider=provider,
            tags=enriched,
        )
        create_timeseries_annotation(
            TimeseriesAnnotationData(
                organization_id=flag_log.organization_id,
                project_id=_resolve_project_id(flag_log.organization_id, enriched),
                environment_id=_resolve_environment_id(flag_log.organization_id, enriched),
                annotation_type=AnnotationType.FEATURE_FLAG_CHANGE,
                scope=AnnotationScope.GLOBAL,
                severity=Severity.LOW,
                interval_type=IntervalType.POINT,
                description=description,
                start_timestamp=flag_log.created_at,
                tags=_annotation_tags(flag_log, action, provider, enriched),
                created_by_label="feature-flag-webhook",
            )
        )
        metrics.incr("timeseries_annotations.producer_created", tags=metric_tags)
    except Exception:
        metrics.incr("timeseries_annotations.producer_failed", tags=metric_tags)
        logger.exception(
            "timeseries_annotations.feature_flag_producer_failed",
            extra={
                "flag_log_id": flag_log.id,
                "organization_id": flag_log.organization_id,
                "provider": provider,
            },
        )
