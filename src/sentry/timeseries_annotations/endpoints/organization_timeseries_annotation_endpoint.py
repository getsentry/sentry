from __future__ import annotations

import logging
from collections.abc import Iterable
from datetime import datetime

from django.db.models import Q
from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.exceptions import ConflictError, ResourceDoesNotExist
from sentry.api.paginator import SequencePaginator
from sentry.api.serializers import serialize
from sentry.api.utils import get_date_range_from_params
from sentry.auth.principal import resolve_actor
from sentry.db.models.manager.base_query_set import BaseQuerySet
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.timeseries_annotations.endpoints.serializers import (
    TimeseriesAnnotationPostSerializer,
    TimeseriesAnnotationPutSerializer,
    TimeseriesAnnotationSerializer,
)
from sentry.timeseries_annotations.models import (
    AnnotationScope,
    AnnotationType,
    IntervalType,
    Severity,
    TimeseriesAnnotation,
)
from sentry.timeseries_annotations.producers.sdk_config_change import (
    sdk_config_change_as_annotations,
)
from sentry.timeseries_annotations.rarity import annotation_type_counts
from sentry.timeseries_annotations.service import (
    TimeseriesAnnotationData,
    create_timeseries_annotation,
    update_timeseries_annotation,
)
from sentry.viewer_context import ActorId, ActorType

logger = logging.getLogger(__name__)


class TimeseriesAnnotationPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read", "org:write", "org:admin"],
        "POST": ["org:write", "org:admin"],
        "PUT": ["org:write", "org:admin"],
    }


@extend_schema(tags=["Timeseries Annotations"])
@cell_silo_endpoint
class OrganizationTimeseriesAnnotationEndpoint(OrganizationEndpoint):
    owner = ApiOwner.DATA_BROWSING
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "POST": ApiPublishStatus.EXPERIMENTAL,
        "PUT": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (TimeseriesAnnotationPermission,)

    def get(self, request: Request, organization: Organization) -> Response:
        """
        List an organization's timeseries annotations overlapping a time window
        """
        if not features.has(
            "organizations:timeseries-annotations", organization, actor=request.user
        ):
            raise ResourceDoesNotExist

        start, end = get_date_range_from_params(request.GET)

        # Scope project-level annotations to projects the caller can access; org-wide
        # annotations (null project) apply to every chart. Unconditional: with no access the
        # caller still sees org-wide rows, never another project's.
        projects = self.get_projects(request, organization)
        project_ids = [p.id for p in projects]
        environments = self.get_environments(request, organization)
        environment_ids = {e.id for e in environments}

        scopes = _parse_labels(request.GET.getlist("scope"), AnnotationScope, "scope")
        types = _parse_labels(
            request.GET.getlist("annotationType"), AnnotationType, "annotationType"
        )
        severities = _parse_labels(request.GET.getlist("severity"), Severity, "severity")

        queryset = (
            TimeseriesAnnotation.objects.within_retention(organization)
            .filter(organization_id=organization.id)
            .filter(_window_overlap(start, end))
            .filter(Q(project_id__in=project_ids) | Q(project_id__isnull=True))
        )
        # Environment-level annotations are scoped like projects: a request filtering by
        # environment still sees org-wide (null environment) rows, never another env's.
        if environment_ids:
            queryset = queryset.filter(
                Q(environment_id__in=environment_ids) | Q(environment_id__isnull=True)
            )
        if scopes:
            queryset = queryset.filter(scope__in=scopes)
        if types:
            queryset = queryset.filter(annotation_type__in=types)
        if severities:
            queryset = queryset.filter(severity__in=severities)

        annotations: list[TimeseriesAnnotation] = list(queryset)
        if features.has(
            "organizations:timeseries-annotations-usecase-sdk-config-experimental",
            organization,
            actor=request.user,
        ):
            annotations += self._sdk_config_annotations(
                organization, projects, start, end, environment_ids, scopes, types, severities
            )

        # Order stored and derived (unsaved) annotations together by start time, id as a stable
        # tiebreaker. The paginator scores by list position so equal-timestamp rows never fall
        # back to comparing model instances (which aren't orderable).
        annotations.sort(key=lambda a: (a.start_timestamp, a.id))

        # Rarity is computed in context of retention period, hardcoded to max 90d.
        rarity_kwargs: dict[str, object] = {}
        counts, window_days = annotation_type_counts(organization)
        rarity_kwargs = {"rarity_counts": counts, "rarity_window_days": window_days}

        return self.paginate(
            request=request,
            paginator=SequencePaginator(list(enumerate(annotations))),
            on_results=lambda rows: serialize(
                rows, request.user, TimeseriesAnnotationSerializer(), **rarity_kwargs
            ),
        )

    def _sdk_config_annotations(
        self,
        organization: Organization,
        projects: list[Project],
        start: datetime,
        end: datetime,
        environment_ids: set[int],
        scopes: list[int],
        types: list[int],
        severities: list[int],
    ) -> list[TimeseriesAnnotation]:
        """Derive SDK-config-change annotations live from the metric; never persisted.

        Best-effort: a metrics-read failure must never break the list. The derived rows are
        filtered by the same request criteria the stored queryset applies.
        """
        try:
            derived = sdk_config_change_as_annotations(organization, projects, start, end)
        except Exception:
            logger.exception("timeseries_annotations.sdk_config_producer_failed")
            return []
        return [
            a
            for a in derived
            # Mirror the stored queryset's env scoping: an environment filter still keeps
            # org-wide (null environment) rows, exactly as `_env_id__in | _env_id__isnull`.
            if (
                not environment_ids
                or a.environment_id in environment_ids
                or a.environment_id is None
            )
            and (not scopes or a.scope in scopes)
            and (not types or a.annotation_type in types)
            and (not severities or a.severity in severities)
        ]

    def post(self, request: Request, organization: Organization) -> Response:
        """
        Create a timeseries annotation
        """
        if not features.has(
            "organizations:timeseries-annotations", organization, actor=request.user
        ):
            raise ResourceDoesNotExist

        serializer = TimeseriesAnnotationPostSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        data = serializer.validated_data

        project_id = data.get("projectId")
        if project_id is not None:
            # Trust get_projects, not the body: a project the caller can't reach raises 403.
            self.get_projects(request, organization, project_ids={project_id})

        end = data.get("endTimestamp")
        annotation = create_timeseries_annotation(
            TimeseriesAnnotationData(
                organization_id=organization.id,
                project_id=project_id,
                annotation_type=data["annotationType"],
                description=data["description"],
                start_timestamp=data["startTimestamp"],
                end_timestamp=end,
                interval_type=IntervalType.RANGE if end is not None else IntervalType.POINT,
                scope=data["scope"],
                severity=data["severity"],
                tags=data.get("tags"),
                created_by=_creating_actor(request),
            )
        )
        return Response(
            serialize(annotation, request.user, TimeseriesAnnotationSerializer()), status=201
        )

    def put(self, request: Request, organization: Organization) -> Response:
        """
        Update one range annotation selected by id and/or tags.
        """
        if not features.has(
            "organizations:timeseries-annotations", organization, actor=request.user
        ):
            raise ResourceDoesNotExist

        serializer = TimeseriesAnnotationPutSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        data = serializer.validated_data

        queryset = self._accessible_ranges(request, organization)
        filters = data["filters"]
        if "id" in filters:
            queryset = queryset.filter(id=filters["id"])
        if "tags" in filters:
            queryset = queryset.filter(tags__contains=filters["tags"])

        matches = list(queryset[:2])
        if not matches:
            raise ResourceDoesNotExist
        if len(matches) > 1:
            raise ConflictError(detail="filters matched more than one annotation")

        try:
            annotation = update_timeseries_annotation(
                matches[0],
                updated_by=_creating_actor(request),
                description=data.get("description"),
                severity=data.get("severity"),
                end_timestamp=data.get("endTimestamp"),
                set_end_timestamp="endTimestamp" in data,
            )
        except ValueError:
            return Response(
                {"detail": "endTimestamp must be at or after startTimestamp"}, status=400
            )
        return Response(serialize(annotation, request.user, TimeseriesAnnotationSerializer()))

    def _accessible_ranges(
        self, request: Request, organization: Organization
    ) -> BaseQuerySet[TimeseriesAnnotation]:
        # A caller may select by id or tags, but must not update a project they cannot see.
        # Org-wide rows stay visible, as on GET.
        project_ids = [project.id for project in self.get_projects(request, organization)]
        return (
            TimeseriesAnnotation.objects.within_retention(organization)
            .filter(organization_id=organization.id, interval_type=IntervalType.RANGE)
            .filter(Q(project_id__in=project_ids) | Q(project_id__isnull=True))
        )


def _creating_actor(request: Request) -> ActorId | None:
    """The user or service account behind the request, as a stored-creator reference."""
    actor = resolve_actor(request.user, request.auth)
    if actor is None:
        return None
    if actor.type in (ActorType.USER, ActorType.AGENT):
        return ActorId(ActorType.USER, actor.user_id)
    if actor.type == ActorType.SERVICE_ACCOUNT:
        return ActorId(ActorType.SERVICE_ACCOUNT, actor.actor_id)
    return None


def _window_overlap(start: datetime, end: datetime) -> Q:
    """
    Annotations whose interval overlaps [start, end].

    A point (null end) matches only when its start is inside the window. A range matches when it
    starts at or before the window end and either ends at or after the window start or is still
    open (null end).
    """
    point = Q(
        interval_type=IntervalType.POINT, start_timestamp__gte=start, start_timestamp__lte=end
    )
    range_ = Q(interval_type=IntervalType.RANGE, start_timestamp__lte=end) & (
        Q(end_timestamp__gte=start) | Q(end_timestamp__isnull=True)
    )
    return point | range_


def _parse_labels(
    labels: Iterable[str], enum_cls: type[AnnotationScope | AnnotationType | Severity], param: str
) -> list[int]:
    by_label = {label: value for value, label in enum_cls.as_choices()}
    try:
        return [by_label[label] for label in labels]
    except KeyError:
        raise ParseError(detail=f"Invalid {param}: must be one of {sorted(by_label)}")
