from __future__ import annotations

import logging
from typing import Any, TypedDict

from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, internal_cell_silo_endpoint
from sentry.api.permissions import StaffPermission
from sentry.apidocs.response_types import DetailResponse
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.auth.access import from_request
from sentry.constants import ObjectStatus
from sentry.db.models.fields.bounded import I64_MAX
from sentry.models.organization import Organization
from sentry.seer.workflows.synthetic_breaches import (
    SyntheticBreachError,
    create_synthetic_breach,
    prepare_synthetic_breach,
)
from sentry.workflow_engine.models import Detector

logger = logging.getLogger(__name__)


class SyntheticMetricBreachRequest(serializers.Serializer):
    organizationId = serializers.IntegerField(min_value=1, max_value=I64_MAX)
    monitorId = serializers.IntegerField(min_value=1, max_value=I64_MAX)

    def to_internal_value(self, data: Any) -> dict[str, Any]:
        values = super().to_internal_value(data)
        if set(data) - set(self.fields):
            raise serializers.ValidationError("Only organizationId and monitorId are accepted.")
        return values


class SyntheticMetricBreachResponse(TypedDict):
    issueId: str
    issueUrl: str
    eventId: str


class SyntheticMetricBreachValidationResponse(TypedDict):
    detail: dict[str, Any]


@internal_cell_silo_endpoint
@extend_schema(tags=["Seer"])
class SeerAdminMetricBreachesEndpoint(Endpoint):
    owner = ApiOwner.ML_AI
    permission_classes = (StaffPermission,)
    publish_status = {"POST": ApiPublishStatus.PRIVATE}

    @extend_schema(
        operation_id="Create a Synthetic Metric Breach",
        request=SyntheticMetricBreachRequest,
        responses={
            201: inline_sentry_response_serializer(
                "SyntheticMetricBreach", SyntheticMetricBreachResponse
            ),
            400: inline_sentry_response_serializer(
                "SyntheticMetricBreachValidation", SyntheticMetricBreachValidationResponse
            ),
            401: inline_sentry_response_serializer(
                "SyntheticMetricBreachUnauthorized", DetailResponse
            ),
            403: inline_sentry_response_serializer(
                "SyntheticMetricBreachForbidden", DetailResponse
            ),
            404: inline_sentry_response_serializer("SyntheticMetricBreachNotFound", DetailResponse),
            409: inline_sentry_response_serializer("SyntheticMetricBreachConflict", DetailResponse),
            429: inline_sentry_response_serializer(
                "SyntheticMetricBreachRateLimited", DetailResponse
            ),
            503: inline_sentry_response_serializer("SyntheticMetricBreachFailure", DetailResponse),
        },
    )
    def post(
        self, request: Request
    ) -> (
        Response[SyntheticMetricBreachResponse]
        | Response[SyntheticMetricBreachValidationResponse]
        | Response[DetailResponse]
    ):
        """Create a fresh test metric issue and attempt first-seen publication to workflows.

        Each POST is independent. Matching actions can execute asynchronously, including
        non-Seer actions. A successful response confirms issue creation only; event delivery
        and Seer execution are not guaranteed. Processing or propagated publication errors
        return detail without an issue link, even if an issue was already created.
        """
        serializer = SyntheticMetricBreachRequest(data=request.data)
        if not serializer.is_valid():
            return Response({"detail": dict(serializer.errors)}, status=400)
        values = serializer.validated_data
        try:
            organization = Organization.objects.get(
                id=values["organizationId"], status=ObjectStatus.ACTIVE
            )
        except Organization.DoesNotExist:
            raise NotFound
        access = from_request(request, organization)
        if not access.has_scope("event:write"):
            raise PermissionDenied
        if not features.has("organizations:seer-automations", organization, actor=request.user):
            raise NotFound
        try:
            detector = Detector.objects.select_related("project", "workflow_condition_group").get(
                id=values["monitorId"], project__organization_id=organization.id
            )
        except Detector.DoesNotExist:
            raise NotFound
        if detector.project is not None and not access.has_project_access(detector.project):
            raise NotFound
        try:
            context = prepare_synthetic_breach(organization, detector)
            group, event_id = create_synthetic_breach(context)
        except SyntheticBreachError as error:
            failure: DetailResponse = {"detail": error.detail}
            return Response(failure, status=error.status_code)
        except Exception:
            logger.exception("seer.synthetic_metric_breach.creation_failed")
            unavailable: DetailResponse = {"detail": "Test issue creation is unavailable."}
            return Response(unavailable, status=503)
        result: SyntheticMetricBreachResponse = {
            "issueId": str(group.id),
            "issueUrl": group.get_absolute_url(),
            "eventId": event_id,
        }
        return Response(result, status=201)
