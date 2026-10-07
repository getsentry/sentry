from collections.abc import Mapping
from typing import Any

from django.db import router
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_SUCCESS,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.response_types import ValidationErrorResponse, as_validation_errors
from sentry.insights.models import InsightsStarredSegment
from sentry.models.organization import Organization
from sentry.utils.db import atomic_transaction


class StarTransactionSerializer(serializers.Serializer):
    transaction = serializers.CharField(
        required=True,
        help_text="The name of the transaction to star or unstar.",
    )
    project_id = serializers.IntegerField(
        required=True,
        min_value=1,
        help_text="The ID of the project the transaction belongs to.",
    )

    def to_internal_value(self, data: Any) -> Any:
        # `segment_name` is the undocumented legacy name for `transaction`.
        if isinstance(data, Mapping) and "transaction" not in data and "segment_name" in data:
            data = {key: data.get(key) for key in data}
            data["transaction"] = data.pop("segment_name")
        return super().to_internal_value(data)


class MemberPermission(OrganizationPermission):
    scope_map = {
        "POST": ["member:read", "member:write"],
        "DELETE": ["member:read", "member:write"],
    }


@extend_schema(tags=["Dashboards"])
@cell_silo_endpoint
class InsightsStarredTransactionsEndpoint(OrganizationEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.PUBLIC_EXPERIMENTAL,
        "DELETE": ApiPublishStatus.PUBLIC_EXPERIMENTAL,
    }
    owner = ApiOwner.DATA_BROWSING
    permission_classes = (MemberPermission,)

    def has_feature(self, organization, request):
        return features.has(
            "organizations:insights-modules-use-eap", organization, actor=request.user
        )

    @extend_schema(
        operation_id="starOrganizationTransaction",
        summary="Star a Transaction",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        request=StarTransactionSerializer,
        responses={
            200: RESPONSE_SUCCESS,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def post(
        self, request: Request, organization: Organization
    ) -> Response[None] | Response[ValidationErrorResponse]:
        """
        Star a transaction for the requesting user. Span queries expose this as the
        `is_starred_transaction` field. Returns `403` if the user has already starred
        the transaction.
        """
        if not self.has_feature(organization, request):
            return self.respond(status=404)

        serializer = StarTransactionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(as_validation_errors(serializer), status=status.HTTP_400_BAD_REQUEST)

        transaction_name = serializer.validated_data["transaction"]
        project_id = serializer.validated_data["project_id"]
        projects = self.get_projects(
            request=request,
            organization=organization,
            project_ids={project_id},
        )
        project = projects[0]
        with atomic_transaction(using=router.db_for_write(InsightsStarredSegment)):
            _, created = InsightsStarredSegment.objects.get_or_create(
                organization=organization,
                project_id=project.id,
                user_id=request.user.id,
                segment_name=transaction_name,
            )

            if not created:
                return Response(status=status.HTTP_403_FORBIDDEN)

        return Response(status=status.HTTP_200_OK)

    @extend_schema(
        operation_id="unstarOrganizationTransaction",
        summary="Unstar a Transaction",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            OpenApiParameter(
                name="transaction",
                location="query",
                required=True,
                type=str,
                description="The name of the transaction to unstar.",
            ),
            OpenApiParameter(
                name="project_id",
                location="query",
                required=True,
                type=int,
                description="The ID of the project the transaction belongs to.",
            ),
        ],
        responses={
            200: RESPONSE_SUCCESS,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def delete(
        self, request: Request, organization: Organization
    ) -> Response[None] | Response[ValidationErrorResponse]:
        """
        Unstar a transaction for the requesting user. Succeeds even if the
        transaction was not starred.
        """
        if not request.user.is_authenticated:
            return Response(status=status.HTTP_400_BAD_REQUEST)

        if not self.has_feature(organization, request):
            return self.respond(status=404)

        # OpenAPI has no request body for DELETE, so the documented contract is query
        # params. The body is still accepted for existing callers.
        serializer = StarTransactionSerializer(data=request.data or request.query_params)
        if not serializer.is_valid():
            return Response(as_validation_errors(serializer), status=status.HTTP_400_BAD_REQUEST)

        transaction_name = serializer.validated_data["transaction"]
        project_id = serializer.validated_data["project_id"]
        projects = self.get_projects(
            request=request,
            organization=organization,
            project_ids={project_id},
        )
        project = projects[0]

        InsightsStarredSegment.objects.filter(
            organization=organization,
            user_id=request.user.id,
            project_id=project.id,
            segment_name=transaction_name,
        ).delete()

        return Response(status=status.HTTP_200_OK)


@cell_silo_endpoint
class InsightsStarredSegmentsEndpoint(InsightsStarredTransactionsEndpoint):
    """
    Legacy route for `InsightsStarredTransactionsEndpoint`, still called by the frontend.
    """

    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
        "DELETE": ApiPublishStatus.PRIVATE,
    }
