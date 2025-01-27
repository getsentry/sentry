import re
from collections.abc import Generator
from typing import Any

from django.urls import URLPattern, URLResolver
from django.urls.resolvers import get_resolver

from sentry.testutils.cases import TestCase
from sentry.testutils.silo import no_silo_test


def extract_slug_path_params(path: str) -> list[str]:
    return re.findall(r"<(\w+_slug)>", path)


def extract_all_url_patterns(
    urlpatterns, base: str = ""
) -> Generator[Any | tuple[str, Any], Any, None]:
    for pattern in urlpatterns:
        if isinstance(pattern, URLResolver):
            yield from extract_all_url_patterns(pattern.url_patterns, base + str(pattern.pattern))
        elif isinstance(pattern, URLPattern):
            url_pattern = base + str(pattern.pattern).replace("^", "").replace("$", "")
            callback = pattern.callback
            if hasattr(callback, "view_class"):
                yield (url_pattern, callback.view_class)


@no_silo_test
class TestPathParams(TestCase):

    IGNORE_CLASS_PREFIXES = (
        "sentry.web",
        "sentry.integrations.web",
        "sentry.users.web",
        "sentry.sentry_apps.web",
        "sentry.auth",
        "sentry.toolbar",
    )

    def test_if_sentry_endpoints_have_id_or_slug_path_params(self):
        """
        Extract all path parameters, if the url is for an endpoint, check if all path params have _id_or_slug suffix
        """
        root_resolver = get_resolver()
        all_url_patterns = extract_all_url_patterns(root_resolver.url_patterns)
        for pattern, callback in all_url_patterns:
            if hasattr(callback, "convert_args"):
                if slug_path_params := extract_slug_path_params(pattern):
                    if not callback.__module__.startswith(self.IGNORE_CLASS_PREFIXES):
                        # if any of the path params are just *_slug and not *_id_or_slug, error
                        for param in slug_path_params:
                            if not param.endswith("_id_or_slug"):
                                self.fail(
                                    f"Path param {param} in {callback} is missing '_id_or_slug' suffix. Our endpoints support ids and slugs, please only use *_id_or_slug path params."
                                )
