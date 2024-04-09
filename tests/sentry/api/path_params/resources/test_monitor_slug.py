from typing import Any

from rest_framework.request import Request

from sentry.testutils.cases import TestCase

from .test_id_or_slug_path_params_mixin import APIIdOrSlugTestMixin


class MonitorSlugTests(TestCase, APIIdOrSlugTestMixin):
    def monitor_test(self, endpoint_class, slug_params, *args):
        slug_kwargs = {param: self.slug_mappings[param].slug for param in slug_params}
        id_kwargs = {param: self.slug_mappings[param].id for param in slug_params}

        request = Request(self.make_request(user=self.user))

        _, converted_slugs = endpoint_class().convert_args(request=request, **slug_kwargs)
        _, converted_ids = endpoint_class().convert_args(request=request, **id_kwargs)

        self.assert_conversion(endpoint_class, converted_slugs, converted_ids)

    def project_monitor_test(self, endpoint_class, slug_params, *args):
        slug_kwargs = {param: self.slug_mappings[param].slug for param in slug_params}
        id_kwargs = {param: self.slug_mappings[param].id for param in slug_params}

        request = Request(self.make_request(user=self.user))

        _, converted_slugs = endpoint_class().convert_args(request=request, **slug_kwargs)
        _, converted_ids = endpoint_class().convert_args(request=request, **id_kwargs)

        self.assert_conversion(endpoint_class, converted_slugs, converted_ids)

    def project_monitor_checkin_test(self, endpoint_class, slug_params, *args):
        slug_kwargs = {param: self.slug_mappings[param].slug for param in slug_params}
        id_kwargs = {param: self.slug_mappings[param].id for param in slug_params}

        request = Request(self.make_request(user=self.user))

        non_slug_mappings: dict[str, Any] = {
            "checkin_id": self.monitor_checkin.guid,
        }
        reverse_non_slug_mappings: dict[str, Any] = {
            "checkin": self.monitor_checkin,
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

    def project_monitor_environment_test(self, endpoint_class, slug_params, *args):
        slug_kwargs = {param: self.slug_mappings[param].slug for param in slug_params}
        id_kwargs = {param: self.slug_mappings[param].id for param in slug_params}

        request = Request(self.make_request(user=self.user))

        non_slug_mappings: dict[str, Any] = {
            "environment": self.environment.name,
        }
        reverse_non_slug_mappings: dict[str, Any] = {
            "monitor_environment": self.monitor_environment,
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

    def monitor_ingest_checkin_attachment_test(self, endpoint_class, slug_params, *args):
        slug_kwargs = {param: self.slug_mappings[param].slug for param in slug_params}
        id_kwargs = {param: self.slug_mappings[param].id for param in slug_params}

        request = Request(self.make_request(user=self.user))

        # We can do this because the code path for when checkin_id is not "latest" has no logic for slug/id
        non_slug_mappings: dict[str, Any] = {
            "checkin_id": "latest",
        }
        reverse_non_slug_mappings: dict[str, Any] = {
            "checkin": self.monitor_checkin,
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
