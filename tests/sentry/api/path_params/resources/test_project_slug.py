from typing import Any
from unittest.mock import MagicMock

from rest_framework.request import Request

from sentry.testutils.cases import TestCase

from .test_id_or_slug_path_params_mixin import APIIdOrSlugTestMixin


class ProjectSlugTests(TestCase, APIIdOrSlugTestMixin):
    def project_test(self, endpoint_class, slug_params, *args):
        slug_kwargs = {param: self.slug_mappings[param].slug for param in slug_params}
        id_kwargs = {param: self.slug_mappings[param].id for param in slug_params}

        request = Request(self.make_request(user=self.user))

        _, converted_slugs = endpoint_class().convert_args(request=request, **slug_kwargs)
        _, converted_ids = endpoint_class().convert_args(request=request, **id_kwargs)

        self.assert_conversion(endpoint_class, converted_slugs, converted_ids)

    def project_alert_rule_endpoint_test(self, endpoint_class, slug_params, *args):
        slug_kwargs = {param: self.slug_mappings[param].slug for param in slug_params}
        id_kwargs = {param: self.slug_mappings[param].id for param in slug_params}

        request = MagicMock()
        request.configure_mock(
            **{
                "access.has_project_access.return_value": True,
                "method": "DELETE",
            }
        )

        alert_rule = self.create_alert_rule(organization=self.organization, projects=[self.project])

        non_slug_mappings: dict[str, Any] = {
            "alert_rule_id": alert_rule.id,
        }

        reverse_non_slug_mappings: dict[str, Any] = {
            "alert_rule": alert_rule,
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

    def project_codeowners_details_test(self, endpoint_class, slug_params, *args):
        slug_kwargs = {param: self.slug_mappings[param].slug for param in slug_params}
        id_kwargs = {param: self.slug_mappings[param].id for param in slug_params}

        request = Request(self.make_request(user=self.user))

        codeowners = self.create_codeowners(project=self.project)

        non_slug_mappings: dict[str, Any] = {
            "codeowners_id": codeowners.id,
        }

        reverse_non_slug_mappings: dict[str, Any] = {
            "codeowners": codeowners,
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
