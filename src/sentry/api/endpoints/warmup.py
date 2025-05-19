import logging

import sentry_sdk
from django.conf import settings
from django.urls import reverse
from django.utils import translation
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_sdk.consts import VERSION as SDK_VERSION

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, all_silo_endpoint
from sentry.ratelimits.config import RateLimitConfig

logger = logging.getLogger(__name__)


@all_silo_endpoint
class WarmupEndpoint(Endpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.UNOWNED
    permission_classes = ()
    rate_limits = RateLimitConfig(group="INTERNAL")

    def get(self, request: Request) -> Response:
        logger.warning("xxxxxxxxxxxxxxxxxx")
        logger.warning(sentry_sdk)
        logger.warning("yyyyyyyyyyyyyyyyyy")
        logger.warning(SDK_VERSION)
        logger.warning("zzzzzzzzzzzzzzzz")

        languages = [lang for lang, _ in settings.LANGUAGES]
        languages.append(settings.LANGUAGE_CODE)

        # for each possible language we support, warm up the url resolver
        # this fixes an issue we were seeing where many languages trying
        # to resolve at once would cause lock contention
        for lang in languages:
            with translation.override(lang):
                reverse("sentry-warmup")

        # for each possible language we support, warm up the translations
        # cache for faster access
        for lang in languages:
            try:
                language = translation.get_supported_language_variant(lang)
            except LookupError:
                pass
            else:
                translation.activate(language)

        return Response(200)
