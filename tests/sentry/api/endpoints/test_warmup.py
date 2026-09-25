from django.conf import settings
from django.urls import LocalePrefixPattern, clear_url_caches, get_resolver, reverse
from rest_framework import status

from sentry.api.endpoints.warmup import _iter_url_resolvers
from sentry.testutils.cases import APITestCase


class WarmupEndpointTest(APITestCase):
    def test_warmup_endpoint(self) -> None:
        url = reverse("sentry-warmup")
        response = self.client.get(url)

        assert response.status_code == status.HTTP_200_OK

    def _clear_url_caches(self) -> None:
        """clear cached resolver state"""
        clear_url_caches()
        for resolver in _iter_url_resolvers(get_resolver()):
            resolver._reverse_dict = {}
            resolver._populated = False

    def test_shares_language_independent_django_url_caches(self) -> None:
        self._clear_url_caches()

        with self.options({"warmup.url_resolver.enabled": True}):
            self.client.get(reverse("sentry-warmup"))

        languages = [lang for lang, _ in settings.LANGUAGES]
        languages.append(settings.LANGUAGE_CODE)

        # After calling the endpoint with url_resolver warming enabled
        # all url resolvers should have cache populated.
        for resolver in _iter_url_resolvers(get_resolver()):
            cache = resolver._reverse_dict
            default_cache = cache[settings.LANGUAGE_CODE]
            for language in languages:
                assert cache[language] is default_cache, f"cache is not the same for {language}"

    def test_ensure_no_localized_urls(self) -> None:
        # Our URL resolver caching relies on us not using LocalePrefixPattern urls.
        # If we change that assumption, resolver caching needs rework.
        languages = [lang for lang, _ in settings.LANGUAGES]
        languages.append(settings.LANGUAGE_CODE)

        for resolver in _iter_url_resolvers(get_resolver()):
            assert not isinstance(resolver.pattern, LocalePrefixPattern), (
                "found LocalePrefixPattern URL"
            )
            for pattern in resolver.url_patterns:
                assert not isinstance(pattern.pattern, LocalePrefixPattern), (
                    "found LocalePrefixPattern URL"
                )
