from django.conf import settings
from rest_framework.response import Response

from sentry import options
from sentry.api.base import Endpoint
from sentry.api.permissions import SuperuserPermission


class InternalQuotasEndpoint(Endpoint):
    permission_classes = (SuperuserPermission,)

    def get(self, request):
        return Response(
            {
                "backend": settings.SENTRY_QUOTAS,
                "options": {"system.rate-limit": options.get("system.rate-limit")},
            }
        )
