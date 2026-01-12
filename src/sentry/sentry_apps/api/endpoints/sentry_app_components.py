import logging

import sentry_sdk
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.bases.organization import ControlSiloOrganizationEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.organizations.services.organization.model import (
    RpcOrganization,
    RpcUserOrganizationContext,
)
from sentry.sentry_apps.api.bases.sentryapps import SentryAppBaseEndpoint
from sentry.sentry_apps.api.serializers.sentry_app_component import SentryAppComponentSerializer
from sentry.sentry_apps.components import SentryAppComponentPreparer
from sentry.sentry_apps.models.sentry_app_component import SentryAppComponent
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.sentry_apps.utils.errors import SentryAppError, SentryAppIntegratorError

logger = logging.getLogger("sentry.sentry_apps.components")


# TODO(mgaeta): These endpoints are doing the same thing, but one takes a
#  project and the other takes a sentry app. It would be better to have a single
#  endpoint that can take project_id or sentry_app_id as a query parameter.
@control_silo_endpoint
class SentryAppComponentsEndpoint(SentryAppBaseEndpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, sentry_app) -> Response:
        return self.paginate(
            request=request,
            # Prefetch avatars to avoid N+1 queries in serializer
            queryset=sentry_app.components.select_related("sentry_app").prefetch_related(
                "sentry_app__avatar"
            ),
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(
                x, request.user, errors={}, serializer=SentryAppComponentSerializer()
            ),
        )


@control_silo_endpoint
class OrganizationSentryAppComponentsEndpoint(ControlSiloOrganizationEndpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(
        self,
        request: Request,
        organization_context: RpcUserOrganizationContext,
        organization: RpcOrganization,
    ) -> Response:
        components = []
        errors = {}

        with sentry_sdk.start_transaction(name="sentry.api.sentry_app_components.get"):
            with sentry_sdk.start_span(op="sentry-app-components.get_installs"):
                # Prefetch sentry_app to avoid N+1 queries when accessing install.sentry_app
                installs = SentryAppInstallation.objects.get_installed_for_organization(
                    organization.id
                ).select_related("sentry_app").order_by("pk")

            for install in installs:
                with sentry_sdk.start_span(op="sentry-app-components.filter_components"):
                    # Prefetch sentry_app and its avatars to avoid N+1 queries in serializer
                    _components = SentryAppComponent.objects.filter(
                        sentry_app_id=install.sentry_app_id
                    ).select_related("sentry_app").prefetch_related("sentry_app__avatar").order_by("pk")

                    if "filter" in request.GET:
                        _components = _components.filter(type=request.GET["filter"])

                for component in _components:
                    with sentry_sdk.start_span(op="sentry-app-components.prepare_components"):
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
