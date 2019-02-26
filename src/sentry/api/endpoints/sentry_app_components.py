from __future__ import absolute_import

from sentry.api.bases import SentryAppBaseEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.features.helpers import requires_feature


class SentryAppComponentsEndpoint(SentryAppBaseEndpoint):
    @requires_feature('organizations:sentry-apps', any_org=True)
    def get(self, request, sentry_app):
        return self.paginate(
            request=request,
            queryset=sentry_app.components.all(),
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
        )
