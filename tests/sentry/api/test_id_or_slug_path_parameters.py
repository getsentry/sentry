import re
from collections.abc import Callable, Generator
from typing import Any
from unittest.mock import patch

from django.test import TestCase
from django.urls import URLPattern, URLResolver
from django.urls.resolvers import get_resolver

from sentry.api.bases.doc_integrations import DocIntegrationBaseEndpoint
from sentry.api.bases.sentryapps import RegionSentryAppBaseEndpoint, SentryAppBaseEndpoint
from sentry.api.endpoints.integrations.sentry_apps import SentryInternalAppTokenDetailsEndpoint
from sentry.testutils.cases import BaseTestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import no_silo_test


def extract_slug_path_params(path: str) -> list[str]:
    return re.findall(r"<(\w+_slug)>", path)


def extract_other_path_params(path: str) -> list[str]:
    return re.findall(r"<(\w+?)(?<!_slug)>", path)


def extract_all_url_patterns(
    urlpatterns, base: str = ""
) -> Generator[Any | tuple[str, Any], Any, None]:
    for pattern in urlpatterns:
        if isinstance(pattern, URLResolver):
            yield from extract_all_url_patterns(pattern.url_patterns, base + str(pattern.pattern))
        elif isinstance(pattern, URLPattern):
            url_pattern = base + str(pattern.pattern).replace("^", "").replace(
                "$", ""
            )  # Clean up pattern string
            callback = pattern.callback
            if hasattr(callback, "view_class"):
                callback = callback.view_class
                yield (url_pattern, callback)


@no_silo_test
class APIIdOrSlugPathParamTest(BaseTestCase, TestCase):
    """
    This test class is used to test if all endpoints work with both slugs and ids as path parameters.
    Ex: /api/0/organizations/{organization_slug}/integrations/{doc_integration_slug}/ &
        /api/0/organizations/{organization_id}/integrations/{doc_integration_id}/

    The test works by recursively searching through all Django URL patterns and checking if the endpoint has a `convert_args` method.
    If the endpoint has a `convert_args` method, the test will call the method with both slugs and ids as path parameters and compare the results.

    If the endpoint that is created uses an existing `convert_args` method thats in the test, DO NOTHING.

    To add a new endpoint that creates a new `convert_args`  to the test, complete the following steps:
        1. If the endpoint creates a new `convert_args` method, you will need to creatre a new entry in the `convert_args_setup_registry` dictionary.
            1a. The key should be the new `convert_args` method.
            1b. The value should be the test method that will be called with the endpoint. You can either reuse an existing test method or create a new one.
        2. If you are introducing a new slug parameter, add the slug to the `slug_mappings` dictionary & `reverse_slug_mappings` dictionary.
        3. Some of our endpoints don't properly handle all slugs in kwargs, and pass them to the base endpoint without converting them. If the endpoint is one of these, add the endpoint's `convert_args` method to the `no_slugs_in_kwargs_allowlist` list.
        4. Each test method should have the following signature: `def test_method(self, endpoint_class, slug_params, other_params, *args):`
            4a. `endpoint_class` is the endpoint class that is being tested.
            4b. `slug_params` is a list of path parameters that end with `_slug`.
            4c. `other_params` is a list of path parameters that do not end with `_slug`.
            4d. `*args` is a list of additional arguments that can be passed to the test method, including mock objects.
        5. If the endpoint requires additional parameters to be passed to the `convert_args` method, add the parameters to the `other_mappings` & `reverse_other_mappings` dictionaries.
        6. For assertations, use the `assert_conversion` method to compare the results of the `convert_args` method. This is for endpoints that use RPC objects instead of the actual objects or generally don't return the same object.
            6a. Pass reverse_other_mappings if the endpoint.convert_args has additional parameters that need to be compared.
            6b. Pass use_id=True if you want to compare the ids of the objects instead of the objects themselves.


    Take a look at `sentry_app_test` for an example of how to add a new endpoint to the test.
    """

    databases: set[str] | str = "__all__"

    def setUp(self):
        super().setUp()

        # Step 1: Add new endpoints to the registry
        # If a new `convert_args` method is created for an endpoint, add the endpoint to the registry and create/assign a test method
        self.convert_args_setup_registry: dict[Any, Callable] = {
            DocIntegrationBaseEndpoint.convert_args: self.doc_integration_test,
            SentryAppBaseEndpoint.convert_args: self.sentry_app_test,
            SentryInternalAppTokenDetailsEndpoint.convert_args: self.sentry_app_test,
            RegionSentryAppBaseEndpoint.convert_args: self.region_sentry_app_test,
        }

        self.doc_integration = self.create_doc_integration()
        self.sentry_app = self.create_sentry_app(organization=self.organization)

        # Step 2: Add new slugs to the mappings
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

        # Step 3: Add endpoints to the allowlist
        # Some endpoints don't properly handle all slugs in kwargs, and pass them to the base class without converting them
        # Add the endpoint's `convert_args` method to this list to skip the check for slugs in kwargs
        self.no_slugs_in_kwargs_allowlist = {}

    def assert_objects(self, converted_slugs, converted_ids, reverse_other_mappings=None) -> None:
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

    def assert_ids(self, converted_slugs, converted_ids, reverse_other_mappings=None) -> None:
        if reverse_other_mappings:
            for key, value in converted_slugs.items():
                correct_mapping = self.reverse_slug_mappings.get(key, reverse_other_mappings[key])
                assert value.id == correct_mapping.id

            for key, value in converted_ids.items():
                correct_mapping = self.reverse_slug_mappings.get(key, reverse_other_mappings[key])
                assert value.id == correct_mapping.id

        else:
            assert all(
                converted_slugs[key].id == self.reverse_slug_mappings[key].id
                for key in converted_slugs
            )
            assert all(
                converted_ids[key].id == self.reverse_slug_mappings[key].id for key in converted_ids
            )

    def assert_conversion(
        self,
        endpoint_class,
        converted_slugs,
        converted_ids,
        reverse_other_mappings=None,
        use_id=False,
    ) -> None:
        check_no_slugs_in_kwargs = (
            endpoint_class.convert_args not in self.no_slugs_in_kwargs_allowlist
        )
        if check_no_slugs_in_kwargs:
            assert not any(str.endswith(param, "_slug") for param in converted_ids)

        assert converted_slugs == converted_ids

        if use_id:
            self.assert_ids(converted_slugs, converted_ids, reverse_other_mappings)
        else:
            self.assert_objects(converted_slugs, converted_ids, reverse_other_mappings)

    @patch("sentry.api.bases.doc_integrations.DocIntegrationBaseEndpoint.check_object_permissions")
    @override_options({"api.id-or-slug-enabled": True})
    def doc_integration_test(self, endpoint_class, slug_params, other_params, *args):

        slug_kwargs = {param: self.slug_mappings[param].slug for param in slug_params}
        id_kwargs = {param: self.slug_mappings[param].id for param in slug_params}

        _, converted_slugs = endpoint_class().convert_args(request=None, **slug_kwargs)
        _, converted_ids = endpoint_class().convert_args(request=None, **id_kwargs)

        self.assert_conversion(endpoint_class, converted_slugs, converted_ids)

    @patch("sentry.api.bases.sentryapps.SentryAppBaseEndpoint.check_object_permissions")
    @patch("sentry.api.bases.sentryapps.RegionSentryAppBaseEndpoint.check_object_permissions")
    @override_options({"api.id-or-slug-enabled": True})
    def sentry_app_test(self, endpoint_class, slug_params, other_params, *args):

        slug_kwargs = {param: self.slug_mappings[param].slug for param in slug_params}
        id_kwargs = {param: self.slug_mappings[param].id for param in slug_params}

        api_token = self.create_user_auth_token(user=self.user)

        # Step 5: Add extra params to the mappings
        # mapping extra params required for the endpoint
        other_mappings: dict[str, Any] = {
            "api_token_id": api_token.id,
        }

        # mapping kwargs to the actual objects
        reverse_other_mappings: dict[str, Any] = {
            "api_token": api_token,
        }

        if other_params:
            slug_kwargs.update({param: other_mappings[param] for param in other_params})
            id_kwargs.update({param: other_mappings[param] for param in other_params})

        # convert both slugs and ids
        _, converted_slugs = endpoint_class().convert_args(request=None, **slug_kwargs)
        _, converted_ids = endpoint_class().convert_args(request=None, **id_kwargs)

        # Step 6: Assert the conversion
        self.assert_conversion(
            endpoint_class, converted_slugs, converted_ids, reverse_other_mappings, use_id=False
        )

    @patch("sentry.api.bases.sentryapps.RegionSentryAppBaseEndpoint.check_object_permissions")
    @override_options({"api.id-or-slug-enabled": True})
    def region_sentry_app_test(self, endpoint_class, slug_params, other_params, *args):
        slug_kwargs = {param: self.slug_mappings[param].slug for param in slug_params}
        id_kwargs = {param: self.slug_mappings[param].id for param in slug_params}

        _, converted_slugs = endpoint_class().convert_args(request=None, **slug_kwargs)
        _, converted_ids = endpoint_class().convert_args(request=None, **id_kwargs)

        assert converted_slugs == converted_ids

        # Need to check if a RPC Sentry App is created instead of a Sentry App
        # Because we can't check for equality between the two, we check the ids
        self.assert_conversion(endpoint_class, converted_slugs, converted_ids, use_id=True)

    def test_if_endpoints_work_with_id_or_slug(self):
        root_resolver = get_resolver()
        all_url_patterns = extract_all_url_patterns(root_resolver.url_patterns)

        for pattern, callback in all_url_patterns:
            slug_path_params = extract_slug_path_params(pattern)
            if slug_path_params:
                if slug_path_params == ["doc_integration_slug"] or slug_path_params == [
                    "sentry_app_slug"
                ]:
                    other_params = extract_other_path_params(pattern)
                    self.convert_args_setup_registry[callback.convert_args](
                        callback, slug_path_params, other_params
                    )
