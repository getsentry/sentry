from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.bases.organization import ControlSiloOrganizationEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.apidocs.examples.sentry_app_examples import SentryAppExamples
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.constants import SentryAppStatus
from sentry.organizations.services.organization import RpcOrganization
from sentry.organizations.services.organization.model import RpcUserOrganizationContext
from sentry.sentry_apps.api.serializers.sentry_app import (
    SentryAppSerializer as ResponseSentryAppSerializer,
)
from sentry.sentry_apps.api.serializers.sentry_app import SentryAppSerializerResponse
from sentry.sentry_apps.models.sentry_app import SentryApp


@extend_schema(tags=["Integration"])
@control_silo_endpoint
class OrganizationSentryAppsEndpoint(ControlSiloOrganizationEndpoint):
    owner = ApiOwner.ECOSYSTEM
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="Retrieve the custom integrations created by the given organization",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "OrganizationSentryAppDetailsResponse", list[SentryAppSerializerResponse]
            ),
        },
        examples=SentryAppExamples.GET_ORGANIZATIONS_SENTRY_APPS,
    )
    def get(
        self,
        request: Request,
        organization_context: RpcUserOrganizationContext,
        organization: RpcOrganization,
    ) -> Response:
        queryset = SentryApp.objects.filter(owner_id=organization.id, application__isnull=False)

        status = request.GET.get("status")
        if status is not None:
            queryset = queryset.filter(status=SentryAppStatus.as_int(status))

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="-date_added",
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(
                x, request.user, access=request.access, serializer=ResponseSentryAppSerializer()
            ),
        )
