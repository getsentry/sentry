from typing import Any

from rest_framework.request import Request

from sentry.testutils.cases import TestCase

from .test_id_or_slug_path_params_mixin import APIIdOrSlugTestMixin


class TeamSlugTests(TestCase, APIIdOrSlugTestMixin):
    def team_test(self, endpoint_class, slug_params, *args):
        slug_kwargs = {param: self.slug_mappings[param].slug for param in slug_params}
        id_kwargs = {param: self.slug_mappings[param].id for param in slug_params}

        request = Request(self.make_request(user=self.user))

        _, converted_slugs = endpoint_class().convert_args(request=request, **slug_kwargs)
        _, converted_ids = endpoint_class().convert_args(request=request, **id_kwargs)

        self.assert_conversion(endpoint_class, converted_slugs, converted_ids)

    def external_team_details_test(self, endpoint_class, slug_params, *args):
        slug_kwargs = {param: self.slug_mappings[param].slug for param in slug_params}
        id_kwargs = {param: self.slug_mappings[param].id for param in slug_params}

        request = Request(self.make_request(user=self.user))

        external_team = self.create_external_team(team=self.team)

        non_slug_mappings: dict[str, Any] = {
            "external_team_id": external_team.id,
        }
        reverse_non_slug_mappings: dict[str, Any] = {
            "external_team": external_team,
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
