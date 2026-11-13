from __future__ import annotations

from typing import Any

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.api.utils import to_valid_int_id
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.organization import Organization
from sentry.telemetry_classifiers.endpoints.organization_telemetry_classifiers import (
    TelemetryClassifierPermission,
)
from sentry.telemetry_classifiers.models import TelemetryClassifier
from sentry.telemetry_classifiers.serializers import (
    TelemetryClassifierResponse,
    TelemetryClassifierSerializer,
    TelemetryClassifierUpdateRequestSerializer,
)

CLASSIFIER_ID_PARAM = OpenApiParameter(
    name="classifier_id",
    location="path",
    required=True,
    type=int,
    description="The ID of the telemetry classifier.",
)


@cell_silo_endpoint
@extend_schema(tags=["Seer"])
class OrganizationTelemetryClassifierDetailsEndpoint(OrganizationEndpoint):
    owner = ApiOwner.AGENT_TRACING
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (TelemetryClassifierPermission,)

    def convert_args(
        self,
        request: Request,
        organization_id_or_slug: str,
        classifier_id: str,
        *args: Any,
        **kwargs: Any,
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        args, kwargs = super().convert_args(request, organization_id_or_slug, *args, **kwargs)
        organization: Organization = kwargs["organization"]

        if not features.has("organizations:classifiers-ui", organization, actor=request.user):
            raise ResourceDoesNotExist

        try:
            classifier = TelemetryClassifier.objects.select_related("project").get(
                id=to_valid_int_id("classifier_id", classifier_id, raise_404=True),
                project__organization_id=organization.id,
            )
        except TelemetryClassifier.DoesNotExist:
            raise ResourceDoesNotExist

        # Hide classifiers on projects the caller can't see instead of revealing they exist.
        if not request.access.has_project_access(classifier.project):
            raise ResourceDoesNotExist

        kwargs["classifier"] = classifier
        return args, kwargs

    @extend_schema(
        operation_id="Retrieve a Telemetry Classifier",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, CLASSIFIER_ID_PARAM],
        responses={
            200: inline_sentry_response_serializer(
                "TelemetryClassifierDetailsResponse", TelemetryClassifierResponse
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self, request: Request, organization: Organization, classifier: TelemetryClassifier
    ) -> Response[TelemetryClassifierResponse]:
        """
        Retrieve a telemetry classifier on a project the caller can access.
        """
        return self.respond(
            serialize(classifier, request.user, serializer=TelemetryClassifierSerializer())
        )

    @extend_schema(
        operation_id="Update a Telemetry Classifier",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, CLASSIFIER_ID_PARAM],
        request=TelemetryClassifierUpdateRequestSerializer,
        responses={
            200: inline_sentry_response_serializer(
                "UpdateTelemetryClassifierResponse", TelemetryClassifierResponse
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def put(
        self, request: Request, organization: Organization, classifier: TelemetryClassifier
    ) -> Response[TelemetryClassifierResponse]:
        """
        Enable or disable a telemetry classifier on a project the caller can access.
        """
        if not request.access.has_project_scope(classifier.project, "project:read"):
            raise PermissionDenied

        serializer = TelemetryClassifierUpdateRequestSerializer(
            instance=classifier, data=request.data
        )
        serializer.is_valid(raise_exception=True)

        classifier = serializer.save()
        return self.respond(
            serialize(classifier, request.user, serializer=TelemetryClassifierSerializer())
        )
