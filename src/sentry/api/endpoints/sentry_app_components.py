from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases import OrganizationEndpoint, SentryAppBaseEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.features.helpers import requires_feature
from sentry.mediators import sentry_app_components
from sentry.models import Project, SentryAppComponent


class SentryAppComponentsEndpoint(SentryAppBaseEndpoint):
    @requires_feature('organizations:sentry-apps', any_org=True)
    def get(self, request, sentry_app):
        return self.paginate(
            request=request,
            queryset=sentry_app.components.all(),
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
        )


class OrganizationSentryAppComponentsEndpoint(OrganizationEndpoint):
    @requires_feature('organizations:sentry-apps')
    def get(self, request, organization):
        try:
            project = Project.objects.get(
                id=request.GET['projectId'],
                organization_id=organization.id,
            )
        except Project.DoesNotExist:
            return Response([], status=404)

        components = []

        for install in organization.sentry_app_installations.all():
            _components = SentryAppComponent.objects.filter(
                sentry_app_id=install.sentry_app_id,
            )

            if 'filter' in request.GET:
                _components = _components.filter(type=request.GET['filter'])

            for component in _components:
                sentry_app_components.Preparer.run(
                    component=component,
                    install=install,
                    project=project,
                )

            components.extend(_components)

        return self.paginate(
            request=request,
            queryset=components,
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
        )
