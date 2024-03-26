import re
from collections.abc import Generator
from typing import Any
from unittest.mock import patch

from django.test import TestCase
from django.urls import URLPattern, URLResolver
from django.urls.resolvers import get_resolver

from sentry.testutils.cases import BaseTestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import no_silo_test


@no_silo_test
class APIIdOrSlugPathParamTest(BaseTestCase, TestCase):
    databases: set[str] | str = "__all__"

    def setUp(self):
        super().setUp()
        self.doc_integration = self.create_doc_integration()
        self.mapping = {
            "doc_integration_slug": self.doc_integration,
        }

    def extract_slug_path_params(self, path: str) -> list[str]:
        """
        Extracts path parameters from a path string which end with _slug.
        """
        return re.findall(r"<(\w+_slug)>", path)

    def extract_all_url_patterns(
        self, urlpatterns, base: str = ""
    ) -> Generator[Any | tuple[str, Any], Any, None]:
        """
        Recursively search through Django URL patterns and yield all URL patterns.

        Args:
        - urlpatterns: The list of urlpatterns to search through.
        - base: The base URL path for recursive accumulation.

        Yields:
        - All URL patterns as strings, including their full recursive path.
        """
        for pattern in urlpatterns:
            if isinstance(pattern, URLResolver):
                # For URLResolver objects, recursively yield from its url_patterns
                yield from self.extract_all_url_patterns(
                    pattern.url_patterns, base + str(pattern.pattern)
                )
            elif isinstance(pattern, URLPattern):
                # For URLPattern objects, yield the combined base + pattern string and its callback
                url_pattern = base + str(pattern.pattern).replace("^", "").replace(
                    "$", ""
                )  # Clean up pattern string
                callback = pattern.callback
                if hasattr(callback, "view_class"):
                    callback = callback.view_class
                    yield (url_pattern, callback)

    @patch("sentry.api.bases.doc_integrations.DocIntegrationBaseEndpoint.check_object_permissions")
    @override_options({"api.id-or-slug-enabled": True})
    def doc_integration_test(self, class_name, mappings, mock_has_permission):
        slug_kwargs = {key: value.slug for key, value in mappings.items()}
        id_kwargs = {key: value.id for key, value in mappings.items()}

        converted_slugs = class_name().convert_args(request=None, **slug_kwargs)
        converted_ids = class_name().convert_args(request=None, **id_kwargs)

        assert converted_slugs == converted_ids

    def test_if_endpoints_work_with_id_or_slug(self):
        root_resolver = get_resolver()
        all_urlpatterns = self.extract_all_url_patterns(root_resolver.url_patterns)

        for pattern, callback in all_urlpatterns:
            path_params = self.extract_slug_path_params(pattern)
            if path_params:
                if path_params == ["doc_integration_slug"]:
                    self.doc_integration_test(callback, self.mapping)
