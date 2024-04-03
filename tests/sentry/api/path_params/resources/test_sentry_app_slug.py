from typing import Any

from sentry.testutils.cases import TestCase

from .test_id_or_slug_path_params_mixin import APIIdOrSlugTestMixin


class SentryAppSlugTests(TestCase, APIIdOrSlugTestMixin):
    def sentry_app_test(self, endpoint_class, slug_params, *args):
        slug_kwargs = {param: self.slug_mappings[param].slug for param in slug_params}
        id_kwargs = {param: self.slug_mappings[param].id for param in slug_params}

        _, converted_slugs = endpoint_class().convert_args(request=None, **slug_kwargs)
        _, converted_ids = endpoint_class().convert_args(request=None, **id_kwargs)

        self.assert_conversion(endpoint_class, converted_slugs, converted_ids, use_id=False)

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

    def region_sentry_app_test(self, endpoint_class, slug_params, *args):
        slug_kwargs = {param: self.slug_mappings[param].slug for param in slug_params}
        id_kwargs = {param: self.slug_mappings[param].id for param in slug_params}

        _, converted_slugs = endpoint_class().convert_args(request=None, **slug_kwargs)
        _, converted_ids = endpoint_class().convert_args(request=None, **id_kwargs)

        # Need to check if a RPC Sentry App is created instead of a Sentry App
        # Because we can't check for equality between the two, we check the ids
        self.assert_conversion(endpoint_class, converted_slugs, converted_ids, use_id=True)
