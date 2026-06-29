from django.db.models import Q
from drf_spectacular.utils import OpenApiExample, OpenApiParameter, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import (
    OrganizationEndpoint,
    OrganizationIntegrationsLoosePermission,
)
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.repository import (
    RepositorySerializer,
    RepositorySerializerResponse,
)
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import CursorQueryParam, GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.constants import ObjectStatus
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.plugins.base import bindings
from sentry.ratelimits.config import SENTRY_RATELIMITER_GROUP_DEFAULTS, RateLimitConfig


@extend_schema(tags=["Organizations"])
@cell_silo_endpoint
class OrganizationRepositoriesEndpoint(OrganizationEndpoint):
    owner = ApiOwner.CODING_WORKFLOWS
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
        "POST": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (OrganizationIntegrationsLoosePermission,)
    rate_limits = RateLimitConfig(
        group="CLI", limit_overrides={"POST": SENTRY_RATELIMITER_GROUP_DEFAULTS["default"]}
    )

    @extend_schema(
        operation_id="listOrganizationRepos",
        summary="List an Organization's Repositories",
        description="Return a list of version control repositories for a given organization.",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            OpenApiParameter(
                name="query",
                location="query",
                required=False,
                type=str,
                description="Filter repositories by name.",
            ),
            OpenApiParameter(
                name="status",
                location="query",
                required=False,
                type=str,
                enum=["active", "deleted"],
                description="Filter repositories by status. Defaults to `active`.",
            ),
            OpenApiParameter(
                name="integration_id",
                location="query",
                required=False,
                type=str,
                description="Filter repositories by integration ID.",
            ),
            OpenApiParameter(
                name="expand",
                location="query",
                required=False,
                type=str,
                many=True,
                description="Optional repository fields to expand, such as `settings`.",
            ),
            CursorQueryParam,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "ListOrganizationRepositoriesResponse", list[RepositorySerializerResponse]
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=[
            OpenApiExample(
                "Organization Repositories",
                value=[
                    {
                        "dateCreated": "2018-11-06T21:19:58.536Z",
                        "id": "3",
                        "name": "sentry/sentry",
                    }
                ],
                status_codes=["200"],
                response_only=True,
            ),
        ],
    )
    def get(
        self, request: Request, organization: Organization
    ) -> Response[list[RepositorySerializerResponse]]:
        queryset = Repository.objects.filter(organization_id=organization.id)

        integration_id = request.GET.get("integration_id", None)
        if integration_id:
            queryset = queryset.filter(integration_id=integration_id)

        status = request.GET.get("status", "active")
        query = request.GET.get("query")
        expand = request.GET.getlist("expand", [])

        if query:
            queryset = queryset.filter(Q(name__icontains=query))
        if status == "active":
            queryset = queryset.filter(status=ObjectStatus.ACTIVE)
        elif status == "deleted":
            queryset = queryset.exclude(status=ObjectStatus.ACTIVE)
        elif status:
            queryset = queryset.none()

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="name",
            on_results=lambda x: serialize(x, request.user, RepositorySerializer(expand=expand)),
            paginator_cls=OffsetPaginator,
            count_hits=True,
        )

    def post(self, request: Request, organization) -> Response:
        if not request.user.is_authenticated:
            return Response(status=401)
        provider_id = request.data.get("provider")

        if provider_id is not None and provider_id.startswith("integrations:"):
            try:
                provider_cls = bindings.get("integration-repository.provider").get(provider_id)
            except KeyError:
                return Response({"error_type": "validation"}, status=400)
            provider = provider_cls(id=provider_id)
            return provider.dispatch(request, organization)

        try:
            provider_cls = bindings.get("repository.provider").get(provider_id)
        except KeyError:
            return Response({"error_type": "validation"}, status=400)

        provider = provider_cls(id=provider_id)
        return provider.dispatch(request, organization)
