from __future__ import annotations

from django.db.models import BooleanField, Case, QuerySet, Value, When
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import CursorQueryParam, GlobalParams, OrganizationParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.organization import Organization
from sentry.telemetry_classifiers.models import TelemetryClassifier
from sentry.telemetry_classifiers.search import filter_classifiers_by_query
from sentry.telemetry_classifiers.serializers import (
    TelemetryClassifierRequestSerializer,
    TelemetryClassifierResponse,
    TelemetryClassifierSerializer,
)
from sentry.telemetry_classifiers.types import TelemetryClassifierStatus


class TelemetryClassifierPermission(OrganizationPermission):
    # Members only have org:read on the org, so writes check project:read on the classifier's
    # project instead (in the create serializer and in the update handler).
    scope_map = {
        "GET": ["org:read", "org:write", "org:admin"],
        "POST": ["org:read", "org:write", "org:admin"],
        "PUT": ["org:read", "org:write", "org:admin"],
    }


@cell_silo_endpoint
@extend_schema(tags=["Seer"])
class OrganizationTelemetryClassifiersEndpoint(OrganizationEndpoint):
    owner = ApiOwner.AGENT_TRACING
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (TelemetryClassifierPermission,)

    @extend_schema(
        operation_id="List an Organization's Telemetry Classifiers",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            OrganizationParams.PROJECT,
            OpenApiParameter(
                name="query",
                location="query",
                required=False,
                type=str,
                description=(
                    "Filter classifiers with search syntax. Supported keys are `name`, "
                    "`attribute`, `status` and `dataset`. Free text matches the name or "
                    "result attribute. For example, `status:enabled frustration`."
                ),
            ),
            CursorQueryParam,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "ListTelemetryClassifiersResponse", list[TelemetryClassifierResponse]
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self, request: Request, organization: Organization
    ) -> Response[list[TelemetryClassifierResponse]]:
        """
        List the telemetry classifiers defined on the projects the caller can access, newest first with
        disabled classifiers last.
        """
        if not features.has("organizations:classifiers-ui", organization, actor=request.user):
            return self.respond(status=404)

        projects = self.get_projects(request, organization)
        queryset: QuerySet[TelemetryClassifier] = TelemetryClassifier.objects.filter(
            project__in=projects
        )

        if raw_query := request.GET.get("query", "").strip():
            queryset = filter_classifiers_by_query(queryset, raw_query)

        queryset = queryset.annotate(
            is_disabled=Case(
                When(status=TelemetryClassifierStatus.DISABLED, then=Value(True)),
                default=Value(False),
                output_field=BooleanField(),
            )
        )

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by=("is_disabled", "-date_added", "-id"),
            paginator_cls=OffsetPaginator,
            on_results=lambda results: serialize(
                results, request.user, serializer=TelemetryClassifierSerializer()
            ),
        )

    @extend_schema(
        operation_id="Create a Telemetry Classifier",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        request=TelemetryClassifierRequestSerializer,
        responses={
            201: inline_sentry_response_serializer(
                "CreateTelemetryClassifierResponse", TelemetryClassifierResponse
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def post(
        self, request: Request, organization: Organization
    ) -> Response[TelemetryClassifierResponse]:
        """
        Create a telemetry classifier on a project the caller can access.
        """
        if not features.has("organizations:classifiers-ui", organization, actor=request.user):
            return self.respond(status=404)

        serializer = TelemetryClassifierRequestSerializer(
            data=request.data,
            context={"organization": organization, "access": request.access, "request": request},
        )
        serializer.is_valid(raise_exception=True)

        classifier = serializer.save()
        return self.respond(
            serialize(classifier, request.user, serializer=TelemetryClassifierSerializer()),
            status=201,
        )
