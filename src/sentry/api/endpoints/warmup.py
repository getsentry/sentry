from collections.abc import Iterator

import django.contrib.messages.storage.fallback
import django.contrib.sessions.serializers
import django.db.models.sql.compiler  # NOQA
from django.conf import settings
from django.urls import URLResolver, get_resolver, reverse
from django.utils import translation
from rest_framework.request import Request
from rest_framework.response import Response

import sentry.identity.services.identity.impl  # NOQA
import sentry.integrations.services.integration.impl  # NOQA
import sentry.notifications.services.impl  # NOQA
import sentry.sentry_apps.services.app.impl  # NOQA
import sentry.users.services.user.impl  # NOQA
import sentry.users.services.user_option.impl  # NOQA
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, all_silo_endpoint
from sentry.ratelimits.config import RateLimitConfig


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


def _warm_up_url_resolver(languages: list[str]) -> None:
    with translation.override(settings.LANGUAGE_CODE):
        reverse("sentry-warmup")
        default_language = translation.get_language()

    resolvers = list(_iter_url_resolvers(get_resolver()))
    for lang in languages:
        with translation.override(lang):
            reverse("sentry-warmup")
            language = translation.get_language()

        if language == default_language:
            continue

        # Django stores a complete reverse cache per language, even when URL
        # patterns are identical. Preserve distinct translated routes while
        # sharing equal caches. Tests guard this private Django attribute.
        for resolver in resolvers:
            cache = resolver._reverse_dict
            if cache[language] == cache[default_language]:
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

        # Warm every language to avoid resolver lock contention on requests.
        _warm_up_url_resolver(languages)

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
