from django.conf import settings
from django.conf.urls.i18n import i18n_patterns
from django.http import HttpRequest, HttpResponse
from django.test import SimpleTestCase, override_settings
from django.urls import get_resolver, path, reverse
from django.utils import translation
from rest_framework import status

from sentry.api.endpoints.warmup import _iter_url_resolvers, _warm_up_url_resolver
from sentry.testutils.cases import APITestCase


def warmup_view(request: HttpRequest) -> HttpResponse:
    return HttpResponse()


urlpatterns = i18n_patterns(path("_warmup/", warmup_view, name="sentry-warmup"))


class WarmupEndpointTest(APITestCase):
    def test_warmup_endpoint(self) -> None:
        url = reverse("sentry-warmup")
        response = self.client.get(url)

        assert response.status_code == status.HTTP_200_OK

    def test_shares_language_independent_django_url_caches(self) -> None:
        self.client.get(reverse("sentry-warmup"))

        languages = [lang for lang, _ in settings.LANGUAGES]
        languages.append(settings.LANGUAGE_CODE)
        for resolver in _iter_url_resolvers(get_resolver()):
            cache = resolver._reverse_dict
            default_cache = cache[settings.LANGUAGE_CODE]
            assert all(cache[language] is default_cache for language in languages)


class LocalizedWarmupTest(SimpleTestCase):
    @override_settings(
        ROOT_URLCONF=__name__,
        LANGUAGE_CODE="en",
        LANGUAGES=(("en", "English"), ("de", "German")),
    )
    def test_keeps_language_dependent_django_url_caches_separate(self) -> None:
        _warm_up_url_resolver(["en", "de"])

        resolver = get_resolver()
        assert resolver._reverse_dict["en"] is not resolver._reverse_dict["de"]
        with translation.override("en"):
            assert reverse("sentry-warmup") == "/en/_warmup/"
        with translation.override("de"):
            assert reverse("sentry-warmup") == "/de/_warmup/"
