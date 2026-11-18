from __future__ import annotations

import logging

from django.utils import timezone

from sentry import features
from sentry.auth.principal import RequestPrincipal, acting_user_id
from sentry.ingest.inbound_filters import FilterStatKeys
from sentry.models.custominboundfilter import DataType
from sentry.models.project import Project
from sentry.timeseries_annotations.models import AnnotationScope, AnnotationType
from sentry.timeseries_annotations.service import (
    TimeseriesAnnotationData,
    create_timeseries_annotation,
)
from sentry.viewer_context import ActorId, ActorType

logger = logging.getLogger(__name__)

# The framework-wide flag gates every annotation producer; each use case has its own flag
# on top so a single producer can be rolled out or killed without the others.
_ANNOTATIONS_FEATURE = "organizations:timeseries-annotations"
_FILTER_CHANGE_FEATURE = "organizations:timeseries-annotations-usecase-filter-change"

# Built-in inbound filters drop events from a single telemetry dataset. Most act on the
# error pipeline; the health-check filter drops transactions (spans). The scope tells the
# chart which dataset's volume stepped when the filter changed.
_BUILTIN_FILTER_SCOPE: dict[str, AnnotationScope] = {
    FilterStatKeys.LOCALHOST: AnnotationScope.ERRORS,
    FilterStatKeys.BROWSER_EXTENSION: AnnotationScope.ERRORS,
    FilterStatKeys.LEGACY_BROWSER: AnnotationScope.ERRORS,
    FilterStatKeys.WEB_CRAWLER: AnnotationScope.ERRORS,
    FilterStatKeys.HEALTH_CHECK: AnnotationScope.SPANS,
}

# Custom inbound filters carry their own dataset, so map it straight onto the scope.
_CUSTOM_DATA_TYPE_SCOPE: dict[DataType, AnnotationScope] = {
    DataType.ALL: AnnotationScope.GLOBAL,
    DataType.ERROR: AnnotationScope.ERRORS,
    DataType.LOG: AnnotationScope.LOGS,
    DataType.METRIC: AnnotationScope.TRACEMETRICS,
    DataType.SPAN: AnnotationScope.SPANS,
}


def _actor(principal: RequestPrincipal) -> ActorId | None:
    user_id = acting_user_id(principal)
    return ActorId(ActorType.USER, user_id) if user_id is not None else None


def _record(
    project: Project,
    scope: AnnotationScope,
    description: str,
    tags: dict[str, str],
    principal: RequestPrincipal,
) -> None:
    organization = project.organization
    if not features.has(_ANNOTATIONS_FEATURE, organization):
        return
    if not features.has(_FILTER_CHANGE_FEATURE, organization):
        return
    # Best-effort context: a producer failure must never break the filter write.
    try:
        create_timeseries_annotation(
            TimeseriesAnnotationData(
                organization_id=project.organization_id,
                project_id=project.id,
                annotation_type=AnnotationType.INBOUND_FILTER_CHANGE,
                scope=scope,
                description=description,
                start_timestamp=timezone.now(),
                tags=tags,
                created_by=_actor(principal),
            )
        )
    except Exception:
        logger.exception("timeseries_annotations.inbound_filter_producer_failed")


def record_builtin_filter_change_as_annotation(
    project: Project, filter_id: str, principal: RequestPrincipal
) -> None:
    """Annotate a change to a built-in inbound filter. Call only when state changed."""
    scope = _BUILTIN_FILTER_SCOPE.get(filter_id, AnnotationScope.ERRORS)
    _record(
        project,
        scope,
        description=f"Inbound filter '{filter_id}' changed",
        tags={"filter": filter_id},
        principal=principal,
    )


def record_custom_filter_change_as_annotation(
    project: Project,
    filter_id: int,
    data_type: DataType,
    action: str,
    principal: RequestPrincipal,
) -> None:
    """Annotate a create/update/delete of a custom inbound filter."""
    scope = _CUSTOM_DATA_TYPE_SCOPE.get(data_type, AnnotationScope.GLOBAL)
    _record(
        project,
        scope,
        description=f"Custom inbound filter {action}",
        tags={"filter_id": str(filter_id), "data_type": data_type.value},
        principal=principal,
    )
