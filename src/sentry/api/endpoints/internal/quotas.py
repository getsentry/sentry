from django.conf import settings
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, all_silo_endpoint
from sentry.api.permissions import SuperuserPermission


@all_silo_endpoint
class InternalQuotasEndpoint(Endpoint):
    owner = ApiOwner.DEV_INFRA
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (SuperuserPermission,)

    def get(self, request: Request) -> Response:
        return Response(
            {
                "backend": settings.SENTRY_QUOTAS,
                "options": {"system.rate-limit": options.get("system.rate-limit")},
            }
        )
