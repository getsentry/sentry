from __future__ import annotations

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
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import DateTimePaginator
from sentry.api.serializers import serialize
from sentry.api.utils import get_date_range_from_params
from sentry.models.organization import Organization
from sentry.timeseries_annotations.endpoints.serializers import TimeseriesAnnotationSerializer
from sentry.timeseries_annotations.models import (
    AnnotationScope,
    AnnotationType,
    IntervalType,
    Severity,
    TimeseriesAnnotation,
)


@extend_schema(tags=["Timeseries Annotations"])
@cell_silo_endpoint
class OrganizationTimeseriesAnnotationEndpoint(OrganizationEndpoint):
    owner = ApiOwner.DATA_BROWSING
    publish_status = {"GET": ApiPublishStatus.EXPERIMENTAL}

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
        project_ids = [p.id for p in self.get_projects(request, organization)]
        queryset = (
            TimeseriesAnnotation.objects.within_retention(organization)
            .filter(organization_id=organization.id)
            .filter(_window_overlap(start, end))
            .filter(Q(project_id__in=project_ids) | Q(project_id__isnull=True))
        )

        # Environment-level annotations are scoped like projects: a request filtering by
        # environment still sees org-wide (null environment) rows, never another env's.
        environments = self.get_environments(request, organization)
        if environments:
            queryset = queryset.filter(
                Q(environment_id__in=[e.id for e in environments]) | Q(environment_id__isnull=True)
            )

        scopes = _parse_labels(request.GET.getlist("scope"), AnnotationScope, "scope")
        if scopes:
            queryset = queryset.filter(scope__in=scopes)

        types = _parse_labels(
            request.GET.getlist("annotationType"), AnnotationType, "annotationType"
        )
        if types:
            queryset = queryset.filter(annotation_type__in=types)

        severities = _parse_labels(request.GET.getlist("severity"), Severity, "severity")
        if severities:
            queryset = queryset.filter(severity__in=severities)

        # Client-side bucketing is correct only when the window fits one page; once results span
        # pages it undercounts. Server-side bucketing to come.
        return self.paginate(
            request=request,
            queryset=queryset,
            paginator_cls=DateTimePaginator,
            order_by="start_timestamp",
            on_results=lambda rows: serialize(
                list(rows), request.user, TimeseriesAnnotationSerializer()
            ),
        )


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
