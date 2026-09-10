import logging

import sentry_sdk
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.bases.organization import ControlSiloOrganizationEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.examples.sentry_app_examples import SentryAppExamples
from sentry.apidocs.parameters import CursorQueryParam, GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.organizations.services.organization.model import (
    RpcOrganization,
    RpcUserOrganizationContext,
)
from sentry.sentry_apps.api.bases.sentryapps import SentryAppBaseEndpoint
from sentry.sentry_apps.api.serializers.sentry_app_component import (
    SentryAppComponentSerializer,
    SentryAppComponentSerializerResponse,
)
from sentry.sentry_apps.components import SentryAppComponentPreparer
from sentry.sentry_apps.models.sentry_app_component import SentryAppComponent
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.sentry_apps.utils.errors import SentryAppError, SentryAppIntegratorError
from sentry.utils.tracing import start_span

logger = logging.getLogger("sentry.sentry_apps.components")


# TODO(mgaeta): These endpoints are doing the same thing, but one takes a
#  project and the other takes a sentry app. It would be better to have a single
#  endpoint that can take project_id or sentry_app_id as a query parameter.
@control_silo_endpoint
class SentryAppComponentsEndpoint(SentryAppBaseEndpoint):
    owner = ApiOwner.INTEGRATION_PLATFORM
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, sentry_app) -> Response:
        return self.paginate(
            request=request,
            queryset=sentry_app.components.all(),
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(
                x, request.user, errors={}, serializer=SentryAppComponentSerializer()
            ),
        )


@extend_schema(tags=["Integration"])
@control_silo_endpoint
class OrganizationSentryAppComponentsEndpoint(ControlSiloOrganizationEndpoint):
    owner = ApiOwner.INTEGRATION_PLATFORM
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="listOrganizationSentryAppComponents",
        summary="List an Organization's Installed Sentry App Components",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            CursorQueryParam,
            OpenApiParameter(
                name="filter",
                location="query",
                type=str,
                description="Filter components by type, such as `issue-link`.",
            ),
        ],
        responses={
            200: inline_sentry_response_serializer(
                "SentryAppComponentsResponse", list[SentryAppComponentSerializerResponse]
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=SentryAppExamples.GET_INSTALLED_COMPONENTS,
    )
    def get(
        self,
        request: Request,
        organization_context: RpcUserOrganizationContext,
        organization: RpcOrganization,
    ) -> Response[list[SentryAppComponentSerializerResponse]]:
        """Retrieve prepared UI components for installed custom integrations, including issue-link forms."""
        components = []
        errors = {}

        with start_span(name="sentry.api.sentry_app_components.get", transaction=True):
            with start_span(
                op="sentry-app-components.get_installs", name="sentry-app-components.get_installs"
            ):
                installs = SentryAppInstallation.objects.get_installed_for_organization(
                    organization.id
                ).order_by("pk")

            for install in installs:
                with start_span(
                    op="sentry-app-components.filter_components",
                    name="sentry-app-components.filter_components",
                ):
                    _components = SentryAppComponent.objects.filter(
                        sentry_app_id=install.sentry_app_id
                    ).order_by("pk")

                    if "filter" in request.GET:
                        _components = _components.filter(type=request.GET["filter"])

                for component in _components:
                    with start_span(
                        op="sentry-app-components.prepare_components",
                        name="sentry-app-components.prepare_components",
                    ):
                        try:
                            SentryAppComponentPreparer(component=component, install=install).run()

                        except (SentryAppIntegratorError, SentryAppError) as e:
                            errors[str(component.uuid)] = e.to_public_dict()

                        except Exception as e:
                            error_id = sentry_sdk.capture_exception(e)
                            logger.info(
                                "component-preparation-error",
                                exc_info=e,
                                extra={
                                    "component_uuid": component.uuid,
                                    "sentry_app": install.sentry_app.slug,
                                    "installation_uuid": install.uuid,
                                },
                            )
                            errors[str(component.uuid)] = {
                                "detail": f"Something went wrong while trying to link issue for component: {str(component.uuid)}. Sentry error ID: {error_id}"
                            }

                        components.append(component)
        return self.paginate(
            request=request,
            queryset=components,
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(
                x, request.user, serializer=SentryAppComponentSerializer(), errors=errors
            ),
        )
