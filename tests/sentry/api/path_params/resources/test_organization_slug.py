from typing import Any
from unittest.mock import MagicMock, patch

from pytest import fixture
from rest_framework.request import Request

from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature

from .test_id_or_slug_path_params_mixin import APIIdOrSlugTestMixin


class OrganizationSlugTests(TestCase, APIIdOrSlugTestMixin):
    @fixture(autouse=True)
    def _mock_subdomain_is_region(self):
        with patch("sentry.api.bases.organization.subdomain_is_region"):
            yield

    @patch("sentry.types.region.subdomain_is_region")
    def organization_test(self, endpoint_class, slug_params, *args):
        slug_kwargs = {param: self.slug_mappings[param].slug for param in slug_params}
        id_kwargs = {param: self.slug_mappings[param].id for param in slug_params}

        request = Request(request=self.make_request())

        _, converted_slugs = endpoint_class().convert_args(request=request, **slug_kwargs)
        _, converted_ids = endpoint_class().convert_args(request=request, **id_kwargs)

        self.assert_conversion(endpoint_class, converted_slugs, converted_ids)

    def region_organization_integration_test(self, endpoint_class, slug_params, *args):
        slug_kwargs = {param: self.slug_mappings[param].slug for param in slug_params}
        id_kwargs = {param: self.slug_mappings[param].id for param in slug_params}

        non_slug_mappings: dict[str, Any] = {
            "integration_id": 1,
        }

        request = Request(request=self.make_request())

        _, converted_slugs = endpoint_class().convert_args(
            request=request, **slug_kwargs, **non_slug_mappings
        )
        _, converted_ids = endpoint_class().convert_args(
            request=request, **id_kwargs, **non_slug_mappings
        )

        # pass non_slug mapping in reverse because the convert_args method doesn't change the non_slug_mappings
        self.assert_conversion(
            endpoint_class,
            converted_slugs,
            converted_ids,
            reverse_non_slug_mappings=non_slug_mappings,
        )

    def organization_code_mapping_codeowners_test(self, endpoint_class, slug_params, *args):
        slug_kwargs = {param: self.slug_mappings[param].slug for param in slug_params}
        id_kwargs = {param: self.slug_mappings[param].id for param in slug_params}

        request = Request(request=self.make_request())

        non_slug_mappings: dict[str, Any] = {
            "config_id": self.code_mapping.id,
        }

        reverse_non_slug_mappings: dict[str, Any] = {
            "config": self.code_mapping,
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

    def organization_team_test(self, endpoint_class, slug_params, *args):
        slug_kwargs = {param: self.slug_mappings[param].slug for param in slug_params}
        id_kwargs = {param: self.slug_mappings[param].id for param in slug_params}

        request = Request(request=self.make_request())

        non_slug_mappings: dict[str, Any] = {
            "team_id": self.team.id,
        }

        reverse_non_slug_mappings: dict[str, Any] = {
            "team": self.team,
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

    def external_user_details_test(self, endpoint_class, slug_params, *args):
        slug_kwargs = {param: self.slug_mappings[param].slug for param in slug_params}
        id_kwargs = {param: self.slug_mappings[param].id for param in slug_params}

        request = Request(request=self.make_request())

        external_user = self.create_external_user(organization=self.organization)

        non_slug_mappings: dict[str, Any] = {
            "external_user_id": external_user.id,
        }

        reverse_non_slug_mappings: dict[str, Any] = {
            "external_user": external_user,
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

    @patch(
        "sentry.api.endpoints.organization_dashboard_details.OrganizationDashboardBase._get_dashboard"
    )
    def organization_dashboard_details_test(self, endpoint_class, slug_params, *args):
        slug_kwargs = {param: self.slug_mappings[param].slug for param in slug_params}
        id_kwargs = {param: self.slug_mappings[param].id for param in slug_params}

        request = Request(request=self.make_request())

        non_slug_mappings: dict[str, Any] = {
            "dashboard_id": "dashboard.id",
        }

        _, converted_slugs = endpoint_class().convert_args(
            request=request, **slug_kwargs, **non_slug_mappings
        )
        _, converted_ids = endpoint_class().convert_args(
            request=request, **id_kwargs, **non_slug_mappings
        )

        converted_slugs.pop("dashboard")
        converted_ids.pop("dashboard")

        self.assert_conversion(endpoint_class, converted_slugs, converted_ids)

    @with_feature("organizations:incidents")
    def incident_test(self, endpoint_class, slug_params, *args):
        slug_kwargs = {param: self.slug_mappings[param].slug for param in slug_params}
        id_kwargs = {param: self.slug_mappings[param].id for param in slug_params}

        request = MagicMock()
        request.configure_mock(
            **{
                "access.has_project_access.return_value": True,
                "_access.organization": MagicMock(),
                "user.is_authenticated": True,
                "user.id": self.user.id,
            }
        )

        non_slug_mappings: dict[str, Any] = {
            "incident_identifier": str(self.incident.id),
        }

        reverse_non_slug_mappings: dict[str, Any] = {
            "incident": self.incident,
            # "activity": self.incident_activity,
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

    @with_feature("organizations:incidents")
    def comment_details_test(self, endpoint_class, slug_params, *args):
        slug_kwargs = {param: self.slug_mappings[param].slug for param in slug_params}
        id_kwargs = {param: self.slug_mappings[param].id for param in slug_params}

        request = MagicMock()
        request.configure_mock(
            **{
                "access.has_project_access.return_value": True,
                "_access.organization": MagicMock(),
                "user.is_authenticated": True,
                "user.is_superuser": True,
            }
        )

        non_slug_mappings: dict[str, Any] = {
            "incident_identifier": str(self.incident.id),
            "activity_id": self.incident_activity.id,
        }

        reverse_non_slug_mappings: dict[str, Any] = {
            "incident": self.incident,
            "activity": self.incident_activity,
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

    def notification_actions_details_test(self, endpoint_class, slug_params, *args):
        slug_kwargs = {param: self.slug_mappings[param].slug for param in slug_params}
        id_kwargs = {param: self.slug_mappings[param].id for param in slug_params}

        request = MagicMock()
        request.configure_mock(
            **{
                "access.has_scope.return_value": True,
                "_access.organization": MagicMock(),
                "user.is_authenticated": True,
                "user.is_superuser": True,
            }
        )

        notification_action = self.create_notification_action(
            organization=self.organization, projects=[self.project]
        )

        non_slug_mappings: dict[str, Any] = {
            "action_id": notification_action.id,
        }

        reverse_non_slug_mappings: dict[str, Any] = {
            "action": notification_action,
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

    @with_feature("organizations:incidents")
    def organization_alert_rule_test(self, endpoint_class, slug_params, *args):
        slug_kwargs = {param: self.slug_mappings[param].slug for param in slug_params}
        id_kwargs = {param: self.slug_mappings[param].id for param in slug_params}

        request = MagicMock()
        request.configure_mock(
            **{
                "access.has_project_access.return_value": True,
                "_access.organization": MagicMock(),
                "user.is_authenticated": True,
                "user.is_superuser": True,
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
