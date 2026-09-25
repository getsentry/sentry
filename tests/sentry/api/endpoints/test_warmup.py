from django.conf import settings
from django.urls import URLResolver, get_resolver, reverse
from rest_framework import status

from sentry.api.endpoints.warmup import warmup_url_resolver
from sentry.testutils.cases import APITestCase


class WarmupEndpointTest(APITestCase):
    def test_warmup_endpoint(self) -> None:
        url = reverse("sentry-warmup")
        response = self.client.get(url)

        assert response.status_code == status.HTTP_200_OK

    def test_shares_language_independent_django_url_caches(self) -> None:
        with self.options({"warmup.url_resolver.enabled": True}):
            self.client.get(reverse("sentry-warmup"))

        languages = [lang for lang, _ in settings.LANGUAGES]
        languages.append(settings.LANGUAGE_CODE)
        warmup_url_resolver(languages)

        resolver = get_resolver()
        queue = [resolver]
        while len(queue):
            resolver = queue.pop()
            for pattern in resolver.url_patterns:
                if isinstance(pattern, URLResolver):
                    queue.append(pattern)

            cache = resolver._reverse_dict
            default_cache = cache[settings.LANGUAGE_CODE]
            assert all(cache[language] is default_cache for language in languages)
