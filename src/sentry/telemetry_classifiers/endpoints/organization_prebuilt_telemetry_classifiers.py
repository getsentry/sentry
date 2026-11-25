from __future__ import annotations

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.paginator import ChainPaginator
from sentry.api.serializers import serialize
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import CursorQueryParam, GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.organization import Organization
from sentry.telemetry_classifiers.prebuilt import PREBUILT_CLASSIFIERS
from sentry.telemetry_classifiers.serializers import (
    PrebuiltClassifierResponse,
    PrebuiltClassifierSerializer,
)
from sentry.telemetry_classifiers.types import Dataset


@cell_silo_endpoint
@extend_schema(tags=["Seer"])
class OrganizationPrebuiltTelemetryClassifiersEndpoint(OrganizationEndpoint):
    owner = ApiOwner.AGENT_TRACING
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    @extend_schema(
        operation_id="List Prebuilt Telemetry Classifiers",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            OpenApiParameter(
                name="dataset",
                location="query",
                required=False,
                type=str,
                enum=Dataset.values,
                description="Only return prebuilt classifiers for this dataset.",
            ),
            CursorQueryParam,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "ListPrebuiltTelemetryClassifiersResponse", list[PrebuiltClassifierResponse]
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self, request: Request, organization: Organization
    ) -> Response[list[PrebuiltClassifierResponse]]:
        """
        List the prebuilt classifiers a telemetry classifier can run, optionally for one dataset.
        """
        if not features.has("organizations:classifiers-ui", organization, actor=request.user):
            return self.respond(status=404)

        dataset = request.GET.get("dataset")
        if dataset is not None and dataset not in Dataset.values:
            raise ValidationError({"dataset": f'"{dataset}" is not a valid dataset.'})

        classifiers = [
            classifier
            for classifier in PREBUILT_CLASSIFIERS.values()
            if dataset is None or classifier.dataset == dataset
        ]
        return self.paginate(
            request=request,
            sources=[classifiers],
            paginator_cls=ChainPaginator,
            on_results=lambda results: serialize(
                results, request.user, serializer=PrebuiltClassifierSerializer()
            ),
        )
