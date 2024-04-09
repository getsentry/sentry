import re
from collections.abc import Callable, Generator
from typing import Any
from unittest.mock import patch
from uuid import uuid4

from django.urls import URLPattern, URLResolver
from django.urls.resolvers import get_resolver
from pytest import fixture

from sentry.api.base import Endpoint
from sentry.api.bases.doc_integrations import DocIntegrationBaseEndpoint
from sentry.api.bases.group import GroupEndpoint
from sentry.api.bases.incident import IncidentEndpoint
from sentry.api.bases.organization import ControlSiloOrganizationEndpoint, OrganizationEndpoint
from sentry.api.bases.organization_integrations import RegionOrganizationIntegrationBaseEndpoint
from sentry.api.bases.organizationmember import OrganizationMemberEndpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.bases.rule import RuleEndpoint
from sentry.api.bases.sentryapps import (
    RegionSentryAppBaseEndpoint,
    SentryAppBaseEndpoint,
    SentryAppInstallationBaseEndpoint,
    SentryAppInstallationsBaseEndpoint,
)
from sentry.api.bases.team import TeamEndpoint
from sentry.api.endpoints.broadcast_index import BroadcastIndexEndpoint
from sentry.api.endpoints.codeowners.details import ProjectCodeOwnersDetailsEndpoint
from sentry.api.endpoints.codeowners.external_actor.team_details import ExternalTeamDetailsEndpoint
from sentry.api.endpoints.codeowners.external_actor.user_details import ExternalUserDetailsEndpoint
from sentry.api.endpoints.integrations.sentry_apps import SentryInternalAppTokenDetailsEndpoint
from sentry.api.endpoints.notifications.notification_actions_details import (
    NotificationActionsDetailsEndpoint,
)
from sentry.api.endpoints.organization_code_mapping_codeowners import (
    OrganizationCodeMappingCodeOwnersEndpoint,
)
from sentry.api.endpoints.organization_code_mapping_details import (
    OrganizationCodeMappingDetailsEndpoint,
)
from sentry.api.endpoints.organization_dashboard_details import OrganizationDashboardDetailsEndpoint
from sentry.api.endpoints.organization_region import OrganizationRegionEndpoint
from sentry.api.endpoints.organization_search_details import OrganizationSearchDetailsEndpoint
from sentry.api.endpoints.organization_sentry_function_details import (
    OrganizationSentryFunctionDetailsEndpoint,
)
from sentry.api.endpoints.release_thresholds.release_threshold_details import (
    ReleaseThresholdDetailsEndpoint,
)
from sentry.incidents.endpoints.bases import OrganizationAlertRuleEndpoint, ProjectAlertRuleEndpoint
from sentry.incidents.endpoints.organization_incident_comment_details import CommentDetailsEndpoint
from sentry.incidents.models.incident import IncidentActivityType
from sentry.models.repository import Repository
from sentry.monitors.endpoints.base import (
    MonitorEndpoint,
    ProjectMonitorCheckinEndpoint,
    ProjectMonitorEndpoint,
    ProjectMonitorEnvironmentEndpoint,
)
from sentry.monitors.endpoints.monitor_ingest_checkin_attachment import (
    MonitorIngestCheckinAttachmentEndpoint,
)
from sentry.monitors.models import Monitor, MonitorCheckIn, MonitorEnvironment
from sentry.scim.endpoints.members import OrganizationSCIMMemberDetails
from sentry.scim.endpoints.teams import OrganizationSCIMTeamDetails
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import no_silo_test
from sentry.web.frontend.base import AbstractOrganizationView, BaseView, ProjectView

from .resources.test_doc_integration_slug import DocIntegrationSlugTests
from .resources.test_function_slug import FunctionSlugTests
from .resources.test_monitor_slug import MonitorSlugTests
from .resources.test_organization_slug import OrganizationSlugTests
from .resources.test_project_slug import ProjectSlugTests
from .resources.test_sentry_app_slug import SentryAppSlugTests
from .resources.test_team_slug import TeamSlugTests


def extract_slug_path_params(path: str) -> list[str]:
    return re.findall(r"<(\w+_slug)>", path)


def extract_all_url_patterns(
    urlpatterns, base: str = ""
) -> Generator[Any | tuple[str, Any], Any, None]:
    for pattern in urlpatterns:
        if isinstance(pattern, URLResolver):
            yield from extract_all_url_patterns(pattern.url_patterns, base + str(pattern.pattern))
        elif isinstance(pattern, URLPattern):
            url_pattern = base + str(pattern.pattern).replace("^", "").replace("$", "")
            callback = pattern.callback
            if hasattr(callback, "view_class"):
                yield (url_pattern, callback.view_class)
            elif hasattr(callback, "dispatch_mapping"):
                for view_func in callback.dispatch_mapping.keys():
                    if callable(view_func):
                        yield (url_pattern, view_func.cls)


@no_silo_test
class APIIdOrSlugPathParamTest(
    DocIntegrationSlugTests,
    FunctionSlugTests,
    OrganizationSlugTests,
    MonitorSlugTests,
    ProjectSlugTests,
    SentryAppSlugTests,
    TeamSlugTests,
):
    """
    This test class is used to test if all endpoints work with both slugs and ids as path parameters.
    Ex: /api/0/organizations/{organization_slug}/integrations/{doc_integration_slug}/ &
        /api/0/organizations/{organization_id}/integrations/{doc_integration_id}/

    The test works by recursively searching through all Django URL patterns and checking if the endpoint has a `convert_args` method.
    If the endpoint has a `convert_args` method, the test will call the method with both slugs and ids as path parameters and compare the results.

    If the endpoint that is created uses an existing `convert_args` method thats in the test, DO NOTHING.

    To add a new endpoint that creates a new `convert_args`  to the test, complete the following steps:
        1. If the endpoint creates a new `convert_args` method, you will need to creatre a new entry in the `convert_args_setup_registry` dictionary in the appropriate file (or create a new one if needed).
            1a. The key should be the new `convert_args` method.
            1b. The value should be the test method that will be called with the endpoint. You can either reuse an existing test method or create a new one.
        2. If you are introducing a new slug parameter, add the slug to the `slug_mappings` dictionary & `reverse_slug_mappings` dictionary.
        3. Some of our endpoints don't properly handle all slugs in kwargs, and pass them to the base endpoint without converting them. If the endpoint is one of these,
            add the endpoint method to the `no_slugs_in_kwargs_allowlist` in the APIIdOrSlugTestUtils class.
        4. Each test method should have the following signature: `def test_method(self, endpoint_class, slug_params, non_slug_params, *args):`
            4a. `endpoint_class` is the endpoint class that is being tested.
            4b. `slug_params` is a list of path parameters that end with `_slug`.
            4c. `non_slug_params` is a list of path parameters that do not end with `_slug`.
            4d. `*args` is a list of additional arguments that can be passed to the test method, including mock objects.
        5. If the endpoint requires additional parameters to be passed to the `convert_args` method, add the parameters to the `other_mappings` & `reverse_non_slug_mappings` dictionaries.
        6. For assertations, use the `assert_conversion` method to compare the results of the `convert_args` method. This is for endpoints that use RPC objects instead of the actual objects or generally don't return the same object.
            6a. Pass reverse_non_slug_mappings if the endpoint.convert_args has additional parameters that need to be compared.
            6b. Pass use_id=True if you want to compare the ids of the objects instead of the objects themselves.


    NOTE: If the API callback is a method dispatch mechanism that dynamically selects a view based on the request method, you must add to the manual test.

    Take a look at `sentry_app_token_test` in sentry_app_slug_test.py for an example of how to add a new endpoint to the test.
    """

    @fixture(autouse=True)
    def _mock_check_object_permissions(self):
        with patch("rest_framework.views.APIView.check_object_permissions"), override_options(
            {"api.id-or-slug-enabled": True}
        ):
            yield

    def create_models(self):
        self.doc_integration = self.create_doc_integration()
        self.sentry_app = self.create_sentry_app(organization=self.organization)
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=self.organization)
        self.project = self.create_project(organization=self.organization)
        self.group = self.create_group(project=self.project)
        self.incident = self.create_incident(organization=self.organization)
        self.incident_activity = self.create_incident_activity(
            incident=self.incident, type=IncidentActivityType.COMMENT.value, user_id=self.user.id
        )
        self.function = self.create_sentry_function(
            name="test", code="test", organization_id=self.organization.id
        )

        self.repo = Repository.objects.create(
            name="example", organization_id=self.organization.id, integration_id=self.integration.id
        )

        self.code_mapping = self.create_code_mapping(
            repo=self.repo,
            project=self.project,
        )

        self.monitor = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            name="Test Monitor",
        )

        self.monitor_checkin = MonitorCheckIn.objects.create(
            guid=uuid4().hex,
            project_id=self.project.id,
            monitor_id=self.monitor.id,
            status=3,
        )

        self.environment = self.create_environment(
            organization=self.organization, project=self.project, name="test"
        )

        self.monitor_environment = MonitorEnvironment.objects.create(
            monitor_id=self.monitor.id,
            environment_id=self.environment.id,
        )

    def setUp(self, *args, **kwargs):
        super().setUp(*args, **kwargs)

        # Step 1: Add new endpoints to the registry
        # If a new `convert_args` method is created for an endpoint, add the endpoint to the registry and create/assign a test method
        self.convert_args_setup_registry: dict[Any, Callable] = {
            AbstractOrganizationView.convert_args: self.ignore_test,
            BaseView.convert_args: self.ignore_test,
            BroadcastIndexEndpoint.convert_args: self.control_silo_organization_endpoint_test,
            CommentDetailsEndpoint.convert_args: self.comment_details_test,
            ControlSiloOrganizationEndpoint.convert_args: self.control_silo_organization_endpoint_test,
            DocIntegrationBaseEndpoint.convert_args: self.doc_integration_test,
            Endpoint.convert_args: self.ignore_test,
            ExternalTeamDetailsEndpoint.convert_args: self.external_team_details_test,
            ExternalUserDetailsEndpoint.convert_args: self.external_user_details_test,
            GroupEndpoint.convert_args: self.group_test,
            IncidentEndpoint.convert_args: self.incident_test,
            MonitorEndpoint.convert_args: self.monitor_test,
            MonitorIngestCheckinAttachmentEndpoint.convert_args: self.monitor_ingest_checkin_attachment_test,
            NotificationActionsDetailsEndpoint.convert_args: self.notification_actions_details_test,
            OrganizationAlertRuleEndpoint.convert_args: self.organization_alert_rule_test,
            OrganizationCodeMappingCodeOwnersEndpoint.convert_args: self.organization_code_mapping_codeowners_test,
            OrganizationCodeMappingDetailsEndpoint.convert_args: self.organization_code_mapping_codeowners_test,
            OrganizationDashboardDetailsEndpoint.convert_args: self.organization_dashboard_details_test,
            OrganizationEndpoint.convert_args: self.organization_test,
            OrganizationMemberEndpoint.convert_args: self.organization_member_test,
            OrganizationRegionEndpoint.convert_args: self.organization_region_test,
            OrganizationSCIMMemberDetails.convert_args: self.organization_member_test,
            OrganizationSCIMTeamDetails.convert_args: self.organization_team_test,
            OrganizationSearchDetailsEndpoint.convert_args: self.organization_search_details_test,
            OrganizationSentryFunctionDetailsEndpoint.convert_args: self.organization_sentry_function_details_test,
            ProjectAlertRuleEndpoint.convert_args: self.project_alert_rule_endpoint_test,
            ProjectEndpoint.convert_args: self.project_test,
            ProjectCodeOwnersDetailsEndpoint.convert_args: self.project_codeowners_details_test,
            ProjectMonitorCheckinEndpoint.convert_args: self.project_monitor_checkin_test,
            ProjectMonitorEndpoint.convert_args: self.project_monitor_test,
            ProjectMonitorEnvironmentEndpoint.convert_args: self.project_monitor_environment_test,
            ProjectView.convert_args: self.project_view_test,
            RegionOrganizationIntegrationBaseEndpoint.convert_args: self.region_organization_integration_test,
            RegionSentryAppBaseEndpoint.convert_args: self.region_sentry_app_test,
            ReleaseThresholdDetailsEndpoint.convert_args: self.release_threshold_details_test,
            RuleEndpoint.convert_args: self.rule_test,
            SentryAppBaseEndpoint.convert_args: self.sentry_app_test,
            SentryAppInstallationBaseEndpoint.convert_args: self.ignore_test,
            SentryAppInstallationsBaseEndpoint.convert_args: self.sentry_app_installations_base_test,
            SentryInternalAppTokenDetailsEndpoint.convert_args: self.sentry_app_token_test,
            TeamEndpoint.convert_args: self.team_test,
        }

        self.create_models()

        # Step 2: Add new slugs to the mappings
        # Add slug mappings for the test methods
        self.slug_mappings = {
            "doc_integration_slug": self.doc_integration,
            "sentry_app_slug": self.sentry_app,
            "organization_slug": self.organization,
            "project_slug": self.project,
            "team_slug": self.team,
            "monitor_slug": self.monitor,
            "function_slug": self.function,
        }

        # Map values in kwargs to the actual objects
        self.reverse_slug_mappings = {
            "doc_integration": self.doc_integration,
            "sentry_app": self.sentry_app,
            "organization": self.organization,
            "project": self.project,
            "team": self.team,
            "monitor": self.monitor,
            "function": self.function,
        }

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
                    if convert_args := self.convert_args_setup_registry.get(callback.convert_args):
                        convert_args(callback, slug_path_params)
                    else:
                        self.fail(f"Missing test method for {callback}.")
