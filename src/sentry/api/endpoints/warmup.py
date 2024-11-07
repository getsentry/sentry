from django.conf import settings
from django.urls import reverse
from django.utils.translation import override
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, all_silo_endpoint
from sentry.ratelimits.config import RateLimitConfig


@all_silo_endpoint
class WarmupEndpoint(Endpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.UNOWNED
    permission_classes = ()
    rate_limits = RateLimitConfig(group="INTERNAL")

    def get(self, request: Request) -> Response:
        # for each possible language we support, warm up the url resolver
        # this fixes an issue we were seeing where many languages trying
        # to resolve at once would cause lock contention
        for lang, _ in settings.LANGUAGES:
            with override(lang):
                reverse("sentry-warmup")

        return Response(200)
