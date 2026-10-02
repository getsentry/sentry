from datetime import timedelta
from typing import Any

from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationAlertRulePermission, OrganizationEndpoint
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.utils import get_date_range_from_params, handle_query_errors
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import CursorQueryParam, GlobalParams, OrganizationParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.db.models.fields.bounded import I64_MAX
from sentry.exceptions import InvalidParams
from sentry.models.organization import Organization
from sentry.workflow_engine.endpoints.serializers.evaluation_artifact import (
    EvaluationArtifactResponse,
    EvaluationArtifactSerializer,
)
from sentry.workflow_engine.processors.evaluations.eap import EAP_RETENTION_DAYS
from sentry.workflow_engine.processors.evaluations.query import (
    EVALUATION_ATTRIBUTE_TYPES,
    build_evaluation_filter,
    query_evaluation_artifacts,
)

FEATURE_FLAG = "organizations:workflow-engine-evaluation-artifacts-api"
_ATTRIBUTE_PARAM_TYPES = {
    AttributeKey.TYPE_STRING: str,
    AttributeKey.TYPE_INT: int,
    AttributeKey.TYPE_BOOLEAN: bool,
    AttributeKey.TYPE_ARRAY_INT: int,
}


class ActivityTypeField(serializers.Field[str | int, Any, str | int, Any]):
    def to_internal_value(self, data: Any) -> str | int:
        value = serializers.CharField().run_validation(data)
        if value.lstrip("+-").isdecimal():
            return serializers.IntegerField(
                min_value=-I64_MAX - 1, max_value=I64_MAX
            ).run_validation(value)
        return value


def evaluation_filter_field(name: str) -> serializers.Field[Any, Any, Any, Any]:
    attr_type = EVALUATION_ATTRIBUTE_TYPES[name]
    if name == "activity_type":
        return ActivityTypeField()
    if name == "evaluation_type":
        return serializers.ChoiceField(choices=["detector", "workflow"])
    if name == "evaluation_phase":
        return serializers.ChoiceField(choices=["initial", "delayed"])
    if name == "event_kind":
        return serializers.ChoiceField(choices=["group_event", "activity"])
    if attr_type == AttributeKey.TYPE_BOOLEAN:
        return serializers.BooleanField()
    if attr_type in (AttributeKey.TYPE_INT, AttributeKey.TYPE_ARRAY_INT):
        return serializers.IntegerField(min_value=0, max_value=I64_MAX)
    return serializers.CharField()


@cell_silo_endpoint
@extend_schema(tags=["Monitors"])
class OrganizationEvaluationArtifactsEndpoint(OrganizationEndpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC_EXPERIMENTAL}
    owner = ApiOwner.ISSUES
    permission_classes = (OrganizationAlertRulePermission,)

    @extend_schema(
        operation_id="listOrganizationEvaluationArtifacts",
        summary="List an Organization's Evaluation Artifacts",
        description=(
            "Experimental detector and workflow evaluation history. Defaults to the last seven days. "
            "All attribute filters are exact matches, ANDed across fields. Repeat a parameter to "
            "match any of its values. triggered_action_ids matches any listed action ID. "
            "JSON attribute filters compare the stored JSON string, not nested condition fields. "
            "Results are newest first, with artifact ID as the tie-breaker. "
            "Use explicit start/end dates when traversing pages of live data."
        ),
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            OrganizationParams.PROJECT,
            GlobalParams.STATS_PERIOD,
            GlobalParams.START,
            GlobalParams.END,
            CursorQueryParam,
            OpenApiParameter(name="per_page", type=int, description="Page size, up to 100."),
            *[
                OpenApiParameter(
                    name=name,
                    type=_ATTRIBUTE_PARAM_TYPES[attr_type],
                    many=True,
                    description="Exact attribute filter; repeat to match any value.",
                )
                for name, attr_type in EVALUATION_ATTRIBUTE_TYPES.items()
            ],
        ],
        responses={
            200: inline_sentry_response_serializer(
                "ListOrganizationEvaluationArtifactsResponse", list[EvaluationArtifactResponse]
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self, request: Request, organization: Organization
    ) -> Response[list[EvaluationArtifactResponse]] | Response[None]:
        if not features.has(FEATURE_FLAG, organization, actor=request.user):
            return Response(status=404)

        filters: dict[str, list[Any]] = {}
        for name in EVALUATION_ATTRIBUTE_TYPES:
            if name not in request.GET:
                continue
            field = serializers.ListField(child=evaluation_filter_field(name), allow_empty=False)
            try:
                filters[name] = field.run_validation(request.GET.getlist(name))
            except serializers.ValidationError as error:
                raise ParseError(detail=f"Invalid {name}: {error.detail}")

        project_ids = [project.id for project in self.get_projects(request, organization)]
        try:
            start, end = get_date_range_from_params(
                request.GET, default_stats_period=timedelta(days=EAP_RETENTION_DAYS)
            )
        except InvalidParams as error:
            raise ParseError(detail=f"Invalid date range: {error}")
        # Older starts can route EAP queries to downsampled storage, which does
        # not contain these artifacts. Only the retained window is searchable.
        start = max(start, timezone.now() - timedelta(days=EAP_RETENTION_DAYS))
        query_filter = build_evaluation_filter(filters)

        def data_fn(offset: int, limit: int) -> list[dict[str, Any]]:
            if not project_ids or start >= end:
                return []
            with handle_query_errors():
                return query_evaluation_artifacts(
                    organization_id=organization.id,
                    project_ids=project_ids,
                    start=start,
                    end=end,
                    filters=query_filter,
                    offset=offset,
                    limit=limit,
                )

        return self.paginate(
            request=request,
            paginator=GenericOffsetPaginator(data_fn),
            on_results=lambda rows: EvaluationArtifactSerializer(rows, many=True).data,
        )
