from __future__ import absolute_import

from sentry.api.bases import OrganizationEndpoint, SentryAppBaseEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.features.helpers import requires_feature
from sentry.models import SentryAppComponent, SentryApp


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
        return self.paginate(
            request=request,
            queryset=SentryAppComponent.objects.filter(
                sentry_app_id__in=SentryApp.objects.filter(
                    installations__in=organization.sentry_app_installations.all(),
                )
            ),
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
        )
