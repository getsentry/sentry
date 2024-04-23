from typing import Any
from unittest.mock import MagicMock, PropertyMock, patch

from rest_framework.request import Request

from sentry.models.release_threshold import ReleaseThreshold
from sentry.models.rule import Rule
from sentry.testutils.cases import TestCase
from sentry.web.frontend.base import ProjectView

from .test_id_or_slug_path_params_mixin import APIIdOrSlugTestMixin


class ProjectSlugTests(TestCase, APIIdOrSlugTestMixin):
    def project_test(self, endpoint_class, slug_params, *args):
        slug_kwargs = {param: self.slug_mappings[param].slug for param in slug_params}
        id_kwargs = {param: self.slug_mappings[param].id for param in slug_params}

        request = Request(self.make_request(user=self.user))

        _, converted_slugs = endpoint_class().convert_args(request=request, **slug_kwargs)
        _, converted_ids = endpoint_class().convert_args(request=request, **id_kwargs)

        self.assert_conversion(endpoint_class, converted_slugs, converted_ids)

        # rename the project_slug
        from sentry.models.projectredirect import ProjectRedirect

        old_slug = self.project.slug

        self.project.slug = "new-slug"
        ProjectRedirect.record(self.project, old_slug)
        slug_kwargs["project_slug"] = old_slug

        _, converted_slugs = endpoint_class().convert_args(request=request, **slug_kwargs)

        self.assert_conversion(endpoint_class, converted_slugs, converted_ids)

        self.project.slug = old_slug

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

        codeowners = self.create_codeowners(project=self.project, code_mapping=self.code_mapping)

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

    def release_threshold_details_test(self, endpoint_class, slug_params, *args):
        slug_kwargs = {param: self.slug_mappings[param].slug for param in slug_params}
        id_kwargs = {param: self.slug_mappings[param].id for param in slug_params}

        request = Request(self.make_request(user=self.user))

        release_threshold = ReleaseThreshold.objects.create(
            threshold_type=0,
            trigger_type=0,
            value=1,
            window_in_seconds=1,
            project=self.project,
        )

        non_slug_mappings: dict[str, Any] = {
            "release_threshold": release_threshold.id,
        }
        reverse_non_slug_mappings: dict[str, Any] = {
            "release_threshold": release_threshold,
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

    def rule_test(self, endpoint_class, slug_params, *args):
        slug_kwargs = {param: self.slug_mappings[param].slug for param in slug_params}
        id_kwargs = {param: self.slug_mappings[param].id for param in slug_params}

        request = Request(self.make_request(user=self.user))

        rule = Rule.objects.create(
            project=self.project,
            label="test",
            data={},
            environment_id=None,
        )

        non_slug_mappings: dict[str, Any] = {
            "rule_id": str(rule.id),
        }
        reverse_non_slug_mappings: dict[str, Any] = {
            "rule": rule,
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

    @patch.object(ProjectView, "active_organization", create=True, new_callable=PropertyMock)
    @patch("sentry.web.frontend.base.ProjectView._get_organization")
    def project_view_test(self, endpoint_class, slug_params, *args):
        slug_kwargs = {param: self.slug_mappings[param].slug for param in slug_params}
        id_kwargs = {param: self.slug_mappings[param].id for param in slug_params}

        active_organization_mock = args[1]
        active_organization_mock.return_value = True

        _get_organization_mock = args[0]
        _get_organization_mock.return_value = self.organization

        request = Request(self.make_request(user=self.user))

        # Even though there is 1 endpoint for this convert_args that doesn't need organization_slug, we need to pass it
        slug_kwargs["organization_slug"] = self.slug_mappings["organization_slug"].slug
        id_kwargs["organization_slug"] = self.slug_mappings["organization_slug"].id

        request = Request(self.make_request(user=self.user))

        _, converted_slugs = endpoint_class().convert_args(request=request, **slug_kwargs)
        _, converted_ids = endpoint_class().convert_args(request=request, **id_kwargs)

        self.assert_conversion(endpoint_class, converted_slugs, converted_ids)
