from __future__ import annotations

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
from sentry.exceptions import InvalidParams
from sentry.models.organization import Organization
from sentry.timeseries_annotations.endpoints.serializers import TimeseriesAnnotationSerializer
from sentry.timeseries_annotations.models import (
    AnnotationScope,
    AnnotationType,
    TimeseriesAnnotation,
)
from sentry.timeseries_annotations.utils import parse_enum_labels, window_overlap_query


@extend_schema(tags=["Timeseries Annotations"])
@cell_silo_endpoint
class OrganizationTimeseriesAnnotationIndexEndpoint(OrganizationEndpoint):
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

        try:
            start, end = get_date_range_from_params(request.GET)
        except InvalidParams as e:
            raise ParseError(detail=f"Invalid date range: {e}")

        # Scope project-level annotations to projects the caller can access; org-wide
        # annotations (null project) apply to every chart. Unconditional: with no access the
        # caller still sees org-wide rows, never another project's.
        project_ids = [p.id for p in self.get_projects(request, organization)]
        queryset = (
            TimeseriesAnnotation.objects.filter(organization_id=organization.id)
            .filter(window_overlap_query(start, end))
            .filter(Q(project_id__in=project_ids) | Q(project_id__isnull=True))
        )

        scopes = parse_enum_labels(request.GET.getlist("scope"), AnnotationScope, "scope")
        if scopes:
            queryset = queryset.filter(scope__in=scopes)

        types = parse_enum_labels(
            request.GET.getlist("annotationType"), AnnotationType, "annotationType"
        )
        if types:
            queryset = queryset.filter(annotation_type__in=types)

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
