import logging
from typing import Iterator

import django.contrib.messages.storage.fallback  # NOQA
import django.contrib.sessions.serializers  # NOQA
import django.db.models.sql.compiler  # NOQA
from django.conf import settings
from django.urls import URLResolver, get_resolver  # NOQA
from django.utils import translation
from rest_framework.request import Request
from rest_framework.response import Response

import sentry.identity.services.identity.impl  # NOQA
import sentry.integrations.services.integration.impl  # NOQA
import sentry.notifications.services.impl  # NOQA
import sentry.sentry_apps.services.app.impl  # NOQA
import sentry.users.services.user.impl  # NOQA
import sentry.users.services.user_option.impl  # NOQA
from sentry import options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, all_silo_endpoint
from sentry.ratelimits.config import RateLimitConfig
from sentry.utils import metrics

logger = logging.getLogger(__name__)


def _iter_url_resolvers(resolver: URLResolver) -> Iterator[URLResolver]:
    """Walk nested URL includes once, including repeated or recursive resolvers."""
    pending = [resolver]
    seen: set[int] = set()
    while pending:
        resolver = pending.pop()
        if id(resolver) in seen:
            continue
        seen.add(id(resolver))
        yield resolver
        pending.extend(
            pattern for pattern in resolver.url_patterns if isinstance(pattern, URLResolver)
        )


def warmup_url_resolver(languages: list[str]) -> None:
    if not options.get("warmup.url_resolver.enabled"):
        return

    default_language = settings.LANGUAGE_CODE

    resolvers = list(_iter_url_resolvers(get_resolver()))
    for language in languages:
        if language == default_language:
            continue

        # Django stores a complete reverse cache per language, even when URL
        # patterns are identical as we don't use localized URLs.
        # Tests guard this private Django attribute.
        for resolver in resolvers:
            cache = resolver._reverse_dict
            if language not in cache:
                cache[language] = cache[default_language]


@all_silo_endpoint
class WarmupEndpoint(Endpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.UNOWNED
    permission_classes = ()
    rate_limits = RateLimitConfig(group="INTERNAL")

    def get(self, request: Request) -> Response:
        languages = [lang for lang, _ in settings.LANGUAGES]
        languages.append(settings.LANGUAGE_CODE)

        with metrics.timer("warmup.url_resolver.duration"):
            warmup_url_resolver(languages)

        with metrics.timer("warmup.translation.duration"):
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
