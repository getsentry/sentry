import re
from collections.abc import Callable, Generator
from typing import Any
from unittest.mock import patch

from django.test import TestCase
from django.urls import URLPattern, URLResolver
from django.urls.resolvers import get_resolver

from sentry.api.bases.doc_integrations import DocIntegrationBaseEndpoint
from sentry.testutils.cases import BaseTestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import no_silo_test


@no_silo_test
class APIIdOrSlugPathParamTest(BaseTestCase, TestCase):
    databases: set[str] | str = "__all__"

    def setUp(self):
        super().setUp()

        # If a new `convert_args` method is created for an endpoint, add the endpoint to the registry and create/assign a test method
        self.convert_args_setup_registry: dict[Any, Callable] = {
            DocIntegrationBaseEndpoint.convert_args: self.doc_integration_test,
        }

        self.doc_integration = self.create_doc_integration()
        self.sentry_app = self.create_sentry_app(organization=self.organization)

        # Add slug mappings for the test methods
        self.slug_mappings = {
            "doc_integration_slug": self.doc_integration,
            "sentry_app_slug": self.sentry_app,
        }

        # Map values in kwargs to the actual objects
        self.reverse_slug_mappings = {
            "doc_integration": self.doc_integration,
            "sentry_app": self.sentry_app,
        }

        # Some endpoints don't properly handle all slugs in kwargs, and pass them to the base class without converting them
        # Add the endpoint's `convert_args` method to this list to skip the check for slugs in kwargs
        self.no_slugs_in_kwargs_allowlist = {}

    def extract_slug_path_params(self, path: str) -> list[str]:
        """
        Extracts path parameters from a path string which end with _slug.
        """
        return re.findall(r"<(\w+_slug)>", path)

    def extract_other_path_params(self, path: str) -> list[str]:
        """
        Extracts path parameters from a path string which do not end with _slug.
        """
        return re.findall(r"<(\w+?)(?<!_slug)>", path)

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

    def assert_objects(
        self, endpoint_class, converted_slugs, converted_ids, reverse_other_mappings=None
    ) -> None:
        check_no_slugs_in_kwargs = (
            endpoint_class.convert_args not in self.no_slugs_in_kwargs_allowlist
        )
        if check_no_slugs_in_kwargs:
            assert not any(str.endswith(param, "_slug") for param in converted_ids)

        assert converted_slugs == converted_ids
        if reverse_other_mappings:
            assert all(
                converted_slugs[key] == self.reverse_slug_mappings.get(key)
                or converted_slugs[key] == reverse_other_mappings[key]
                for key in converted_slugs
            )
            assert all(
                converted_ids[key] == self.reverse_slug_mappings.get(key)
                or converted_slugs[key] == reverse_other_mappings[key]
                for key in converted_ids
            )
        else:
            assert all(
                converted_slugs[key] == self.reverse_slug_mappings.get(key)
                for key in converted_slugs
            )
            assert all(
                converted_ids[key] == self.reverse_slug_mappings.get(key) for key in converted_ids
            )

    def assert_ids(
        self, endpoint_class, converted_slugs, converted_ids, reverse_other_mappings=None
    ) -> None:
        check_no_slugs_in_kwargs = (
            endpoint_class.convert_args not in self.no_slugs_in_kwargs_allowlist
        )
        if check_no_slugs_in_kwargs:
            assert not any(str.endswith(param, "_slug") for param in converted_ids)

        assert converted_slugs == converted_ids
        if reverse_other_mappings:
            assert all(
                converted_slugs[key].id == self.reverse_slug_mappings.get(key).id
                or converted_slugs[key].id == reverse_other_mappings[key].id
                for key in converted_slugs
            )
            assert all(
                converted_ids[key].id == self.reverse_slug_mappings.get(key).id
                or converted_slugs[key].id == reverse_other_mappings[key].id
                for key in converted_ids
            )
        else:
            assert all(
                converted_slugs[key].id == self.reverse_slug_mappings.get(key).id
                for key in converted_slugs
            )
            assert all(
                converted_ids[key].id == self.reverse_slug_mappings.get(key).id
                for key in converted_ids
            )

    @patch("sentry.api.bases.doc_integrations.DocIntegrationBaseEndpoint.check_object_permissions")
    @override_options({"api.id-or-slug-enabled": True})
    def doc_integration_test(self, endpoint_class, slug_params, other_params, *args):

        slug_kwargs = {param: self.slug_mappings[param].slug for param in slug_params}
        id_kwargs = {param: self.slug_mappings[param].id for param in slug_params}

        _, converted_slugs = endpoint_class().convert_args(request=None, **slug_kwargs)
        _, converted_ids = endpoint_class().convert_args(request=None, **id_kwargs)

        self.assert_objects(endpoint_class, converted_slugs, converted_ids)

    def test_if_endpoints_work_with_id_or_slug(self):
        root_resolver = get_resolver()
        all_url_patterns = self.extract_all_url_patterns(root_resolver.url_patterns)

        for pattern, callback in all_url_patterns:
            slug_path_params = self.extract_slug_path_params(pattern)
            if slug_path_params:
                if slug_path_params == ["doc_integration_slug"]:
                    other_params = self.extract_other_path_params(pattern)
                    self.convert_args_setup_registry[callback.convert_args](
                        callback, slug_path_params, other_params
                    )
