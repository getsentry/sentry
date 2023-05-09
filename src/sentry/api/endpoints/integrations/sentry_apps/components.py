from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import control_silo_endpoint
from sentry.api.bases import (
    OrganizationEndpoint,
    SentryAppBaseEndpoint,
    add_integration_platform_metric_tag,
)
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.coreapi import APIError
from sentry.models import SentryAppComponent, SentryAppInstallation
from sentry.sentry_apps.components import SentryAppComponentPreparer


# TODO(mgaeta): These endpoints are doing the same thing, but one takes a
#  project and the other takes a sentry app. It would be better to have a single
#  endpoint that can take project_id or sentry_app_id as a query parameter.
@control_silo_endpoint
class SentryAppComponentsEndpoint(SentryAppBaseEndpoint):
    def get(self, request: Request, sentry_app) -> Response:
        return self.paginate(
            request=request,
            queryset=sentry_app.components.all(),
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user, errors=[]),
        )


@control_silo_endpoint
class OrganizationSentryAppComponentsEndpoint(OrganizationEndpoint):
    @add_integration_platform_metric_tag
    def get(self, request: Request, organization) -> Response:
        components = []
        errors = []

        for install in SentryAppInstallation.objects.get_installed_for_organization(
            organization.id
        ):
            _components = SentryAppComponent.objects.filter(sentry_app_id=install.sentry_app_id)

            if "filter" in request.GET:
                _components = _components.filter(type=request.GET["filter"])

            for component in _components:
                try:
                    SentryAppComponentPreparer(component=component, install=install).run()
                except APIError:
                    errors.append(str(component.uuid))

                components.append(component)

        return self.paginate(
            request=request,
            queryset=components,
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user, errors=errors),
        )
