from typing import Annotated, TypedDict
from urllib.parse import urlparse

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_TOO_MANY_REQUESTS,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.descriptions import ApiDescription
from sentry.apidocs.examples.project_examples import ProjectExamples
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.response_types import DetailResponse
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.constants import ObjectStatus
from sentry.models.organization import Organization
from sentry.models.projectkey import ProjectKey, ProjectKeyStatus, UseCase
from sentry.ratelimits.config import RateLimitConfig
from sentry.types.ratelimit import RateLimit, RateLimitCategory


class DsnLookupResponse(TypedDict):
    organizationSlug: Annotated[str, ApiDescription("Slug of the organization")]
    projectSlug: Annotated[str, ApiDescription("Slug of the project the DSN belongs to")]
    projectId: Annotated[str, ApiDescription("ID of the project the DSN belongs to")]
    projectName: Annotated[str, ApiDescription("Name of the project the DSN belongs to")]
    projectPlatform: Annotated[str | None, ApiDescription("Platform of the project, if set")]
    keyLabel: Annotated[str | None, ApiDescription("Label of the client key")]
    keyId: Annotated[str, ApiDescription("ID of the client key")]


@extend_schema(tags=["Projects"])
@cell_silo_endpoint
class DsnLookupEndpoint(OrganizationEndpoint):
    """Resolve a DSN to its project and key metadata within an organization.

    Used by the command palette to let users paste a DSN and quickly navigate
    to the corresponding project.
    """

    owner = ApiOwner.TELEMETRY_EXPERIENCE
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }
    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={
            "GET": {
                RateLimitCategory.USER: RateLimit(limit=5, window=1),
            }
        }
    )

    @extend_schema(
        operation_id="resolveOrganizationDsn",
        summary="Resolve a DSN to Its Project",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            OpenApiParameter(
                name="dsn",
                location="query",
                required=True,
                type=str,
                description="The DSN to look up, such as `https://<public_key>@o1.ingest.sentry.io/2`.",
            ),
        ],
        responses={
            200: inline_sentry_response_serializer("DsnLookupResponse", DsnLookupResponse),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
            429: RESPONSE_TOO_MANY_REQUESTS,
        },
        examples=ProjectExamples.RESOLVE_DSN,
    )
    def get(
        self, request: Request, organization: Organization
    ) -> Response[DsnLookupResponse] | Response[DetailResponse]:
        """
        Return the project and client key that a DSN belongs to. Only the DSN's public key
        is used: the host and project ID in the DSN are ignored.

        Returns 400 when `dsn` is missing. Returns 404 when the DSN has no public key, or
        when it doesn't match an active client key of an active project in this
        organization that you can access.
        """
        dsn = request.GET.get("dsn")
        if not dsn:
            return Response({"detail": "Missing required parameter: dsn"}, status=400)

        parsed = urlparse(dsn)
        public_key = parsed.username
        if not public_key:
            return Response({"detail": "Invalid DSN"}, status=404)

        try:
            project_key = ProjectKey.objects.select_related("project").get(
                public_key=public_key,
                project__organization_id=organization.id,
                project__status=ObjectStatus.ACTIVE,
                status=ProjectKeyStatus.ACTIVE,
                use_case=UseCase.USER.value,
            )
        except ProjectKey.DoesNotExist:
            return Response({"detail": "DSN not found"}, status=404)

        # Don't leak the existence of the project if the user does not have access to it.
        if not request.access.has_project_access(project_key.project):
            return Response({"detail": "DSN not found"}, status=404)

        data: DsnLookupResponse = {
            "organizationSlug": organization.slug,
            "projectSlug": project_key.project.slug,
            "projectId": str(project_key.project.id),
            "projectName": project_key.project.name,
            "projectPlatform": project_key.project.platform,
            "keyLabel": project_key.label,
            "keyId": str(project_key.id),
        }
        return Response(data)
