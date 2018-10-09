from __future__ import absolute_import

from rest_framework.permissions import IsAuthenticated

from sentry.api.base import Endpoint, SessionAuthentication
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.constants import SentryAppStatus
from sentry.models import SentryApp


class SentryAppsEndpoint(Endpoint):
    authentication_classes = (SessionAuthentication, )
    permission_classes = (IsAuthenticated, )

    def get(self, request):
        if request.user.is_superuser:
            # Superusers have access to all apps, published and unpublished
            queryset = SentryApp.objects.all()
        else:
            # Anyone else only has access to published apps
            queryset = SentryApp.objects.filter(status=SentryAppStatus.PUBLISHED)

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by='name',
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
        )
