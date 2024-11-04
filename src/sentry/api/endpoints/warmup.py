from django.urls import reverse
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
        # our settings.LANGUAGE_CODE is 'en-us', but during requests it always
        # resolves to 'en', as 'en-us' is not a by default supported language.
        # call reverse here in the endpoint so we warm up the resolver
        # for the en language after the locale middleware has activated it
        reverse("sentry-warmup")

        return Response(200)
