from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases import (
    OrganizationEndpoint,
    SentryAppBaseEndpoint,
    add_integration_platform_metric_tag,
)
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.coreapi import APIError
from sentry.mediators import sentry_app_components
from sentry.models import Project, SentryAppComponent, SentryAppInstallation


class SentryAppComponentsEndpoint(SentryAppBaseEndpoint):
    def get(self, request, sentry_app):
        return self.paginate(
            request=request,
            queryset=sentry_app.components.all(),
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
        )


class OrganizationSentryAppComponentsEndpoint(OrganizationEndpoint):
    @add_integration_platform_metric_tag
    def get(self, request, organization):
        try:
            project = Project.objects.get(
                id=request.GET["projectId"], organization_id=organization.id
            )
        except Project.DoesNotExist:
            return Response([], status=404)

        components = []

        for install in SentryAppInstallation.get_installed_for_org(organization.id):
            _components = SentryAppComponent.objects.filter(sentry_app_id=install.sentry_app_id)

            if "filter" in request.GET:
                _components = _components.filter(type=request.GET["filter"])

            for component in _components:
                try:
                    sentry_app_components.Preparer.run(
                        component=component, install=install, project=project
                    )
                    components.append(component)
                except APIError:
                    continue

        return self.paginate(
            request=request,
            queryset=components,
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
        )
