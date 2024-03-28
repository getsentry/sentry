import re
from collections.abc import Callable, Generator
from typing import Any
from unittest.mock import patch

from django.test import TestCase
from django.urls import URLPattern, URLResolver
from django.urls.resolvers import get_resolver
from rest_framework.request import Request

from sentry.api.base import Endpoint
from sentry.api.bases.doc_integrations import DocIntegrationBaseEndpoint
from sentry.api.bases.group import GroupEndpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.bases.organizationmember import OrganizationMemberEndpoint
from sentry.api.bases.sentryapps import RegionSentryAppBaseEndpoint, SentryAppBaseEndpoint
from sentry.api.endpoints.integrations.sentry_apps import SentryInternalAppTokenDetailsEndpoint
from sentry.api.endpoints.organization_search_details import OrganizationSearchDetailsEndpoint
from sentry.testutils.cases import BaseTestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import no_silo_test
from sentry.web.frontend.base import BaseView


def extract_slug_path_params(path: str) -> list[str]:
    return re.findall(r"<(\w+_slug)>", path)


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
        4. Each test method should have the following signature: `def test_method(self, endpoint_class, slug_params, non_slug_params, *args):`
            4a. `endpoint_class` is the endpoint class that is being tested.
            4b. `slug_params` is a list of path parameters that end with `_slug`.
            4c. `non_slug_params` is a list of path parameters that do not end with `_slug`.
            4d. `*args` is a list of additional arguments that can be passed to the test method, including mock objects.
        5. If the endpoint requires additional parameters to be passed to the `convert_args` method, add the parameters to the `other_mappings` & `reverse_non_slug_mappings` dictionaries.
        6. For assertations, use the `assert_conversion` method to compare the results of the `convert_args` method. This is for endpoints that use RPC objects instead of the actual objects or generally don't return the same object.
            6a. Pass reverse_non_slug_mappings if the endpoint.convert_args has additional parameters that need to be compared.
            6b. Pass use_id=True if you want to compare the ids of the objects instead of the objects themselves.


    Take a look at `sentry_app_token_test` for an example of how to add a new endpoint to the test.
    """

    databases: set[str] | str = "__all__"

    def setUp(self):
        super().setUp()

        # Step 1: Add new endpoints to the registry
        # If a new `convert_args` method is created for an endpoint, add the endpoint to the registry and create/assign a test method
        self.convert_args_setup_registry: dict[Any, Callable] = {
            Endpoint.convert_args: self.ignore_test,
            BaseView.convert_args: self.ignore_test,
            DocIntegrationBaseEndpoint.convert_args: self.doc_integration_test,
            SentryAppBaseEndpoint.convert_args: self.sentry_app_test,
            RegionSentryAppBaseEndpoint.convert_args: self.region_sentry_app_test,
            SentryInternalAppTokenDetailsEndpoint.convert_args: self.sentry_app_token_test,
            OrganizationEndpoint.convert_args: self.organization_test,
            OrganizationSearchDetailsEndpoint.convert_args: self.organization_search_details_test,
            OrganizationMemberEndpoint.convert_args: self.organization_member_test,
            GroupEndpoint.convert_args: self.group_test,
        }

        self.doc_integration = self.create_doc_integration()
        self.sentry_app = self.create_sentry_app(organization=self.organization)
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)
        self.group = self.create_group(project=self.project)

        # Step 2: Add new slugs to the mappings
        # Add slug mappings for the test methods
        self.slug_mappings = {
            "doc_integration_slug": self.doc_integration,
            "sentry_app_slug": self.sentry_app,
            "organization_slug": self.organization,
        }

        # Map values in kwargs to the actual objects
        self.reverse_slug_mappings = {
            "doc_integration": self.doc_integration,
            "sentry_app": self.sentry_app,
            "organization": self.organization,
        }

        # Step 3: Add endpoints to the allowlist
        # Some endpoints don't properly handle all slugs in kwargs, and pass them to the base class without converting them
        # Add the endpoint's `convert_args` method to this list to skip the check for slugs in kwargs
        self.no_slugs_in_kwargs_allowlist = {}

    def assert_objects(
        self, converted_slugs, converted_ids, reverse_non_slug_mappings=None
    ) -> None:
        if reverse_non_slug_mappings:
            assert all(
                converted_slugs[key] == self.reverse_slug_mappings.get(key)
                or converted_slugs[key] == reverse_non_slug_mappings[key]
                for key in converted_slugs
            )
            assert all(
                converted_ids[key] == self.reverse_slug_mappings.get(key)
                or converted_slugs[key] == reverse_non_slug_mappings[key]
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

    def assert_ids(self, converted_slugs, converted_ids, reverse_non_slug_mappings=None) -> None:
        if reverse_non_slug_mappings:
            for key, value in converted_slugs.items():
                correct_mapping = self.reverse_slug_mappings.get(
                    key, reverse_non_slug_mappings[key]
                )
                assert value.id == correct_mapping.id

            for key, value in converted_ids.items():
                correct_mapping = self.reverse_slug_mappings.get(
                    key, reverse_non_slug_mappings[key]
                )
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
        reverse_non_slug_mappings=None,
        use_id=False,
    ) -> None:
        check_no_slugs_in_kwargs = (
            endpoint_class.convert_args not in self.no_slugs_in_kwargs_allowlist
        )
        if check_no_slugs_in_kwargs:
            assert not any(str.endswith(param, "_slug") for param in converted_ids)

        assert converted_slugs == converted_ids

        if use_id:
            self.assert_ids(converted_slugs, converted_ids, reverse_non_slug_mappings)
        else:
            self.assert_objects(converted_slugs, converted_ids, reverse_non_slug_mappings)

    def ignore_test(self, *args):
        pass

    @patch("sentry.api.bases.doc_integrations.DocIntegrationBaseEndpoint.check_object_permissions")
    @override_options({"api.id-or-slug-enabled": True})
    def doc_integration_test(self, endpoint_class, slug_params, *args):

        slug_kwargs = {param: self.slug_mappings[param].slug for param in slug_params}
        id_kwargs = {param: self.slug_mappings[param].id for param in slug_params}

        _, converted_slugs = endpoint_class().convert_args(request=None, **slug_kwargs)
        _, converted_ids = endpoint_class().convert_args(request=None, **id_kwargs)

        self.assert_conversion(endpoint_class, converted_slugs, converted_ids)

    @patch("sentry.api.bases.sentryapps.SentryAppBaseEndpoint.check_object_permissions")
    @patch("sentry.api.bases.sentryapps.RegionSentryAppBaseEndpoint.check_object_permissions")
    @override_options({"api.id-or-slug-enabled": True})
    def sentry_app_test(self, endpoint_class, slug_params, *args):

        slug_kwargs = {param: self.slug_mappings[param].slug for param in slug_params}
        id_kwargs = {param: self.slug_mappings[param].id for param in slug_params}

        _, converted_slugs = endpoint_class().convert_args(request=None, **slug_kwargs)
        _, converted_ids = endpoint_class().convert_args(request=None, **id_kwargs)

        self.assert_conversion(endpoint_class, converted_slugs, converted_ids, use_id=False)

    @patch("sentry.api.bases.sentryapps.SentryAppBaseEndpoint.check_object_permissions")
    @override_options({"api.id-or-slug-enabled": True})
    def sentry_app_token_test(self, endpoint_class, slug_params, *args):

        slug_kwargs = {param: self.slug_mappings[param].slug for param in slug_params}
        id_kwargs = {param: self.slug_mappings[param].id for param in slug_params}

        api_token = self.create_user_auth_token(user=self.user)

        # Step 5: Add extra params to the mappings
        # mapping extra params required for the endpoint
        non_slug_mappings: dict[str, Any] = {
            "api_token_id": api_token.id,
        }

        # mapping kwargs to the actual objects
        reverse_non_slug_mappings: dict[str, Any] = {
            "api_token": api_token,
        }

        # convert both slugs and ids
        _, converted_slugs = endpoint_class().convert_args(
            request=None, **slug_kwargs, **non_slug_mappings
        )
        _, converted_ids = endpoint_class().convert_args(
            request=None, **id_kwargs, **non_slug_mappings
        )

        # Step 6: Assert the conversion
        self.assert_conversion(
            endpoint_class, converted_slugs, converted_ids, reverse_non_slug_mappings, use_id=False
        )

    @patch("sentry.api.bases.sentryapps.RegionSentryAppBaseEndpoint.check_object_permissions")
    @override_options({"api.id-or-slug-enabled": True})
    def region_sentry_app_test(self, endpoint_class, slug_params, *args):
        slug_kwargs = {param: self.slug_mappings[param].slug for param in slug_params}
        id_kwargs = {param: self.slug_mappings[param].id for param in slug_params}

        _, converted_slugs = endpoint_class().convert_args(request=None, **slug_kwargs)
        _, converted_ids = endpoint_class().convert_args(request=None, **id_kwargs)

        assert converted_slugs == converted_ids

        # Need to check if a RPC Sentry App is created instead of a Sentry App
        # Because we can't check for equality between the two, we check the ids
        self.assert_conversion(endpoint_class, converted_slugs, converted_ids, use_id=True)

    @patch("sentry.api.bases.organization.OrganizationEndpoint.check_object_permissions")
    @patch("sentry.types.region.subdomain_is_region")
    @override_options({"api.id-or-slug-enabled": True})
    def organization_test(self, endpoint_class, slug_params, *args):
        slug_kwargs = {param: self.slug_mappings[param].slug for param in slug_params}
        id_kwargs = {param: self.slug_mappings[param].id for param in slug_params}

        request = Request(request=self.make_request())

        _, converted_slugs = endpoint_class().convert_args(request=request, **slug_kwargs)
        _, converted_ids = endpoint_class().convert_args(request=request, **id_kwargs)

        self.assert_conversion(endpoint_class, converted_slugs, converted_ids)

    @patch(
        "sentry.api.endpoints.organization_search_details.OrganizationSearchDetailsEndpoint.check_object_permissions"
    )
    @override_options({"api.id-or-slug-enabled": True})
    def organization_search_details_test(self, endpoint_class, slug_params, *args):
        slug_kwargs = {param: self.slug_mappings[param].slug for param in slug_params}
        id_kwargs = {param: self.slug_mappings[param].id for param in slug_params}

        request = Request(request=self.make_request())
        search = self.create_saved_search(name="test", organization=self.organization)

        non_slug_mappings: dict[str, Any] = {
            "search_id": search.id,
        }

        # mapping kwargs to the actual objects
        reverse_non_slug_mappings: dict[str, Any] = {
            "search": search,
        }

        _, converted_slugs = endpoint_class().convert_args(
            request=request, **slug_kwargs, **non_slug_mappings
        )
        _, converted_ids = endpoint_class().convert_args(
            request=request, **id_kwargs, **non_slug_mappings
        )

        self.assert_conversion(
            endpoint_class, converted_slugs, converted_ids, reverse_non_slug_mappings
        )

    @patch("sentry.api.bases.organizationmember.OrganizationMemberEndpoint._get_member")
    @patch(
        "sentry.api.endpoints.organization_member.requests.invite.details.OrganizationInviteRequestDetailsEndpoint._get_member"
    )
    @patch("sentry.api.bases.organization.OrganizationEndpoint.check_object_permissions")
    @patch("sentry.types.region.subdomain_is_region")
    @override_options({"api.id-or-slug-enabled": True})
    def organization_member_test(self, endpoint_class, slug_params, *args):
        slug_kwargs = {param: self.slug_mappings[param].slug for param in slug_params}
        id_kwargs = {param: self.slug_mappings[param].id for param in slug_params}

        request = Request(request=self.make_request(user=self.user))

        non_slug_mappings: dict[str, Any] = {
            "member_id": self.user.id,
        }

        _, converted_slugs = endpoint_class().convert_args(
            request=request, **slug_kwargs, **non_slug_mappings
        )
        _, converted_ids = endpoint_class().convert_args(
            request=request, **id_kwargs, **non_slug_mappings
        )

        # Remove member from the converted slugs and ids, we don't need to compare it b/c its mocked
        converted_slugs.pop("member")
        converted_ids.pop("member")

        self.assert_conversion(endpoint_class, converted_slugs, converted_ids)

    @patch("sentry.api.bases.group.GroupEndpoint.check_object_permissions")
    @override_options({"api.id-or-slug-enabled": True})
    def group_test(self, endpoint_class, slug_params, *args):
        slug_kwargs = {param: self.slug_mappings[param].slug for param in slug_params}
        id_kwargs = {param: self.slug_mappings[param].id for param in slug_params}

        request = Request(request=self.make_request())

        non_slug_mappings: dict[str, Any] = {
            "issue_id": self.group.id,
        }

        reverse_non_slug_mappings: dict[str, Any] = {
            "group": self.group,
        }

        _, converted_slugs = endpoint_class().convert_args(
            request=request, **slug_kwargs, **non_slug_mappings
        )
        _, converted_ids = endpoint_class().convert_args(
            request=request, **id_kwargs, **non_slug_mappings
        )

        self.assert_conversion(
            endpoint_class, converted_slugs, converted_ids, reverse_non_slug_mappings
        )

    def test_if_endpoints_work_with_id_or_slug(self):
        """
        Extract all path parameters, split between slugs and other params, and call the convert_args method for each endpoint.
        """
        root_resolver = get_resolver()
        all_url_patterns = extract_all_url_patterns(root_resolver.url_patterns)

        for pattern, callback in all_url_patterns:
            if hasattr(callback, "convert_args"):
                slug_path_params = extract_slug_path_params(pattern)
                if slug_path_params:
                    if slug_path_params == ["doc_integration_slug"] or slug_path_params == [
                        "sentry_app_slug"
                    ]:
                        self.convert_args_setup_registry[callback.convert_args](
                            callback, slug_path_params
                        )
                    elif slug_path_params == ["organization_slug"]:
                        if convert_args := self.convert_args_setup_registry.get(
                            callback.convert_args
                        ):
                            convert_args(callback, slug_path_params)
