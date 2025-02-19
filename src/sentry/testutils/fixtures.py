from __future__ import annotations

from collections.abc import Mapping
from datetime import datetime, timedelta
from typing import Any

import pytest
from django.utils import timezone
from django.utils.functional import cached_property

from sentry.constants import ObjectStatus
from sentry.eventstore.models import Event
from sentry.grouping.grouptype import ErrorGroupType
from sentry.incidents.models.alert_rule import AlertRule
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.models.activity import Activity
from sentry.models.environment import Environment
from sentry.models.grouprelease import GroupRelease
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.project import Project
from sentry.models.projecttemplate import ProjectTemplate
from sentry.models.rule import Rule
from sentry.models.team import Team
from sentry.monitors.models import (
    Monitor,
    MonitorCheckIn,
    MonitorEnvironment,
    MonitorIncident,
    MonitorType,
    ScheduleType,
)
from sentry.organizations.services.organization import RpcOrganization
from sentry.silo.base import SiloMode
from sentry.tempest.models import TempestCredentials
from sentry.testutils.factories import Factories
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.silo import assume_test_silo_mode

# XXX(dcramer): this is a compatibility layer to transition to pytest-based fixtures
# all of the memoized fixtures are copypasta due to our inability to use pytest fixtures
# on a per-class method basis
from sentry.types.activity import ActivityType
from sentry.types.actor import Actor
from sentry.uptime.models import (
    ProjectUptimeSubscription,
    ProjectUptimeSubscriptionMode,
    UptimeStatus,
    UptimeSubscription,
)
from sentry.users.models.identity import Identity, IdentityProvider
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser
from sentry.workflow_engine.models import DataSource, Detector, DetectorState, Workflow
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel


class Fixtures:
    @cached_property
    def session(self):
        return Factories.create_session()

    @cached_property
    def projectkey(self):
        return self.create_project_key(project=self.project)

    @cached_property
    def user(self) -> User:
        return self.create_user(
            "admin@localhost",
            is_superuser=True,
            is_staff=True,
            is_sentry_app=False,
        )

    @cached_property
    def organization(self):
        # XXX(dcramer): ensure that your org slug doesnt match your team slug
        # and the same for your project slug
        return self.create_organization(name="baz", slug="baz", owner=self.user)

    @cached_property
    @assume_test_silo_mode(SiloMode.REGION)
    def team(self):
        team = self.create_team(organization=self.organization, name="foo", slug="foo")
        # XXX: handle legacy team fixture
        queryset = OrganizationMember.objects.filter(organization=self.organization)
        for om in queryset:
            OrganizationMemberTeam.objects.create(team=team, organizationmember=om, is_active=True)
        return team

    @cached_property
    def project(self):
        return self.create_project(
            name="Bar", slug="bar", teams=[self.team], fire_project_created=True
        )

    @cached_property
    def release(self):
        return self.create_release(project=self.project, version="foo-1.0")

    @cached_property
    def environment(self):
        return self.create_environment(name="development", project=self.project)

    @cached_property
    def group(self):
        return self.create_group(message="\u3053\u3093\u306b\u3061\u306f")

    @cached_property
    def event(self):
        return self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "\u3053\u3093\u306b\u3061\u306f",
                "timestamp": before_now(seconds=1).isoformat(),
            },
            project_id=self.project.id,
        )

    @cached_property
    @assume_test_silo_mode(SiloMode.REGION)
    def activity(self):
        return Activity.objects.create(
            group=self.group,
            project=self.project,
            type=ActivityType.NOTE.value,
            user_id=self.user.id,
            data={},
        )

    @cached_property
    @assume_test_silo_mode(SiloMode.CONTROL)
    def integration(self):
        integration = Integration.objects.create(
            provider="github",
            name="GitHub",
            external_id="github:1",
            metadata={
                "access_token": "xxxxx-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
                "expires_at": (timezone.now() + timedelta(days=14)).isoformat(),
            },
        )
        integration.add_organization(self.organization, self.user)
        return integration

    @cached_property
    @assume_test_silo_mode(SiloMode.CONTROL)
    def organization_integration(self):
        return self.integration.add_organization(self.organization, self.user)

    def create_organization(self, *args, **kwargs):
        return Factories.create_organization(*args, **kwargs)

    def create_member(self, *args, **kwargs):
        return Factories.create_member(*args, **kwargs)

    def create_api_key(self, *args, **kwargs):
        return Factories.create_api_key(*args, **kwargs)

    def create_auth_provider(self, *args, **kwargs):
        return Factories.create_auth_provider(*args, **kwargs)

    def create_auth_identity(self, *args, **kwargs):
        return Factories.create_auth_identity(*args, **kwargs)

    def create_user_auth_token(self, *args, **kwargs):
        return Factories.create_user_auth_token(*args, **kwargs)

    def create_org_auth_token(self, *args, **kwargs):
        return Factories.create_org_auth_token(*args, **kwargs)

    def create_team_membership(self, *args, **kwargs):
        return Factories.create_team_membership(*args, **kwargs)

    def create_team(self, organization=None, **kwargs):
        if organization is None:
            organization = self.organization

        return Factories.create_team(organization=organization, **kwargs)

    def create_environment(self, project=None, **kwargs):
        if project is None:
            project = self.project
        return Factories.create_environment(project=project, **kwargs)

    def create_project(self, **kwargs) -> Project:
        if "teams" not in kwargs:
            kwargs["teams"] = [self.team]
        return Factories.create_project(**kwargs)

    def create_project_template(self, **kwargs) -> ProjectTemplate:
        return Factories.create_project_template(**kwargs)

    def create_project_bookmark(self, project=None, *args, **kwargs):
        if project is None:
            project = self.project
        return Factories.create_project_bookmark(project, *args, **kwargs)

    def create_project_key(self, project=None, *args, **kwargs):
        if project is None:
            project = self.project
        return Factories.create_project_key(project, *args, **kwargs)

    def create_project_rule(self, project=None, *args, **kwargs) -> Rule:
        if project is None:
            project = self.project
        return Factories.create_project_rule(project, *args, **kwargs)

    def create_slack_project_rule(self, project=None, *args, **kwargs):
        if project is None:
            project = self.project
        return Factories.create_slack_project_rule(project, *args, **kwargs)

    def create_release(self, project=None, *args, **kwargs):
        if project is None:
            project = self.project
        return Factories.create_release(project, *args, **kwargs)

    def create_group_release(self, project: Project | None = None, *args, **kwargs) -> GroupRelease:
        if project is None:
            project = self.project
        return Factories.create_group_release(project, *args, **kwargs)

    def create_release_file(self, release_id=None, file=None, name=None, dist_id=None):
        if release_id is None:
            release_id = self.release.id
        return Factories.create_release_file(release_id, file, name, dist_id)

    def create_artifact_bundle_zip(self, org=None, release=None, *args, **kwargs):
        return Factories.create_artifact_bundle_zip(org, release, *args, **kwargs)

    def create_release_archive(self, org=None, release=None, *args, **kwargs):
        if org is None:
            org = self.organization.slug
        if release is None:
            release = self.release.version
        return Factories.create_release_archive(org, release, *args, **kwargs)

    def create_artifact_bundle(self, org=None, *args, **kwargs):
        if org is None:
            org = self.organization
        return Factories.create_artifact_bundle(org, *args, **kwargs)

    def create_code_mapping(self, project=None, repo=None, organization_integration=None, **kwargs):
        if project is None:
            project = self.project
        if organization_integration is None:
            organization_integration = self.organization_integration
        return Factories.create_code_mapping(project, repo, organization_integration, **kwargs)

    def create_repo(self, project=None, *args, **kwargs):
        if project is None:
            project = self.project
        return Factories.create_repo(project, *args, **kwargs)

    def create_commit(self, *args, **kwargs):
        return Factories.create_commit(*args, **kwargs)

    def create_commit_author(self, *args, **kwargs):
        return Factories.create_commit_author(*args, **kwargs)

    def create_commit_file_change(self, *args, **kwargs):
        return Factories.create_commit_file_change(*args, **kwargs)

    def create_user(self, *args, **kwargs) -> User:
        return Factories.create_user(*args, **kwargs)

    def create_useremail(self, *args, **kwargs):
        return Factories.create_useremail(*args, **kwargs)

    def create_user_avatar(self, *args, **kwargs):
        return Factories.create_user_avatar(*args, **kwargs)

    def create_user_role(self, *args, **kwargs):
        return Factories.create_user_role(*args, **kwargs)

    def create_usersocialauth(
        self,
        user: User | None = None,
        provider: str | None = None,
        uid: str | None = None,
        extra_data: dict[str, Any] | None = None,
    ):
        if not user:
            user = self.user
        return Factories.create_usersocialauth(
            user=user, provider=provider, uid=uid, extra_data=extra_data
        )

    def store_event(self, *args, **kwargs) -> Event:
        return Factories.store_event(*args, **kwargs)

    def create_tempest_credentials(self, project: Project, *args, **kwargs) -> TempestCredentials:
        return Factories.create_tempest_credentials(project, *args, **kwargs)

    def create_group(self, project=None, *args, **kwargs):
        if project is None:
            project = self.project
        return Factories.create_group(project, *args, **kwargs)

    def create_file(self, **kwargs):
        return Factories.create_file(**kwargs)

    def create_file_from_path(self, *args, **kwargs):
        return Factories.create_file_from_path(*args, **kwargs)

    def create_event_attachment(self, event=None, *args, **kwargs):
        if event is None:
            event = self.event
        return Factories.create_event_attachment(event, *args, **kwargs)

    def create_dif_file(self, project: Project | None = None, *args, **kwargs):
        if project is None:
            project = self.project
        return Factories.create_dif_file(project, *args, **kwargs)

    def create_dif_from_path(self, project=None, *args, **kwargs):
        if project is None:
            project = self.project
        return Factories.create_dif_from_path(project=project, *args, **kwargs)

    def add_user_permission(self, *args, **kwargs):
        return Factories.add_user_permission(*args, **kwargs)

    def create_sentry_app(self, *args, **kwargs):
        return Factories.create_sentry_app(*args, **kwargs)

    def create_sentry_app_avatar(self, *args, **kwargs):
        return Factories.create_sentry_app_avatar(*args, **kwargs)

    def create_internal_integration(self, *args, **kwargs):
        return Factories.create_internal_integration(*args, **kwargs)

    def create_internal_integration_token(self, *args, **kwargs):
        return Factories.create_internal_integration_token(*args, **kwargs)

    def create_sentry_app_installation(self, *args, **kwargs):
        return Factories.create_sentry_app_installation(*args, **kwargs)

    def create_sentry_app_installation_for_provider(self, *args, **kwargs):
        return Factories.create_sentry_app_installation_for_provider(*args, **kwargs)

    def create_stacktrace_link_schema(self, *args, **kwargs):
        return Factories.create_stacktrace_link_schema(*args, **kwargs)

    def create_issue_link_schema(self, *args, **kwargs):
        return Factories.create_issue_link_schema(*args, **kwargs)

    def create_alert_rule_action_schema(self, *args, **kwargs):
        return Factories.create_alert_rule_action_schema(*args, **kwargs)

    def create_sentry_app_feature(self, *args, **kwargs):
        return Factories.create_sentry_app_feature(*args, **kwargs)

    def create_doc_integration(self, *args, **kwargs):
        return Factories.create_doc_integration(*args, **kwargs)

    def create_doc_integration_features(self, *args, **kwargs):
        return Factories.create_doc_integration_features(*args, **kwargs)

    def create_doc_integration_avatar(self, *args, **kwargs):
        return Factories.create_doc_integration_avatar(*args, **kwargs)

    def create_service_hook(self, *args, **kwargs):
        return Factories.create_service_hook(*args, **kwargs)

    def create_userreport(self, *args, **kwargs):
        return Factories.create_userreport(*args, **kwargs)

    def create_platform_external_issue(self, *args, **kwargs):
        return Factories.create_platform_external_issue(*args, **kwargs)

    def create_integration_external_issue(self, *args, **kwargs):
        return Factories.create_integration_external_issue(*args, **kwargs)

    def create_integration_external_project(self, *args, **kwargs):
        return Factories.create_integration_external_project(*args, **kwargs)

    def create_incident(self, organization=None, projects=None, *args, **kwargs):
        if not organization:
            organization = self.organization
        if projects is None:
            projects = [self.project]

        return Factories.create_incident(organization, projects, *args, **kwargs)

    def create_incident_activity(self, *args, **kwargs):
        return Factories.create_incident_activity(*args, **kwargs)

    def create_incident_trigger(self, incident, alert_rule_trigger, status):
        return Factories.create_incident_trigger(incident, alert_rule_trigger, status=status)

    def create_alert_rule(self, organization=None, projects=None, *args, **kwargs) -> AlertRule:
        if not organization:
            organization = self.organization
        if projects is None:
            projects = [self.project]
        return Factories.create_alert_rule(organization, projects, *args, **kwargs)

    def create_alert_rule_trigger(self, alert_rule=None, *args, **kwargs):
        if not alert_rule:
            alert_rule = self.create_alert_rule()
        return Factories.create_alert_rule_trigger(alert_rule, *args, **kwargs)

    def create_alert_rule_trigger_action(
        self,
        alert_rule_trigger=None,
        target_identifier=None,
        triggered_for_incident=None,
        *args,
        **kwargs,
    ):
        if not alert_rule_trigger:
            alert_rule_trigger = self.create_alert_rule_trigger()

        if not target_identifier:
            target_identifier = str(self.user.id)

        if triggered_for_incident is not None:
            Factories.create_incident_trigger(triggered_for_incident, alert_rule_trigger)

        return Factories.create_alert_rule_trigger_action(
            alert_rule_trigger, target_identifier=target_identifier, **kwargs
        )

    def create_notification_action(self, organization=None, projects=None, **kwargs):
        return Factories.create_notification_action(
            organization=organization, projects=projects, **kwargs
        )

    def create_notification_settings_provider(self, *args, **kwargs):
        return Factories.create_notification_settings_provider(*args, **kwargs)

    def create_user_option(self, *args, **kwargs):
        return Factories.create_user_option(*args, **kwargs)

    def create_monitor(self, **kwargs):
        if "owner_user_id" not in kwargs:
            kwargs["owner_user_id"] = self.user.id

        if "project" not in kwargs:
            project_id = self.project.id
        else:
            project_id = kwargs.pop("project").id

        return Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=project_id,
            type=MonitorType.CRON_JOB,
            config={
                "schedule": "* * * * *",
                "schedule_type": ScheduleType.CRONTAB,
                "checkin_margin": None,
                "max_runtime": None,
            },
            **kwargs,
        )

    def create_monitor_environment(self, **kwargs):
        return MonitorEnvironment.objects.create(**kwargs)

    def create_monitor_incident(self, **kwargs):
        return MonitorIncident.objects.create(**kwargs)

    def create_monitor_checkin(self, **kwargs):
        return MonitorCheckIn.objects.create(**kwargs)

    def create_external_user(self, user=None, organization=None, integration=None, **kwargs):
        if not user:
            user = self.user
        if not organization:
            organization = self.organization  # Force creation.
        if not integration:
            integration = self.integration

        return Factories.create_external_user(
            user=user, organization=organization, integration_id=integration.id, **kwargs
        )

    def create_external_team(self, team=None, integration=None, **kwargs):
        if not team:
            team = self.team
        if not integration:
            integration = self.integration

        return Factories.create_external_team(
            team=team, organization=team.organization, integration_id=integration.id, **kwargs
        )

    def create_codeowners(self, project=None, code_mapping=None, **kwargs):
        if not project:
            project = self.project
        if not code_mapping:
            self.repo = self.create_repo(self.project)
            code_mapping = self.create_code_mapping(self.project, self.repo)

        return Factories.create_codeowners(project=project, code_mapping=code_mapping, **kwargs)

    def create_slack_integration(
        self,
        organization: Organization,
        external_id: str = "TXXXXXXX1",
        user: RpcUser | User | None = None,
        identity_external_id: str = "UXXXXXXX1",
        **kwargs: Any,
    ):
        if user is None:
            with assume_test_silo_mode(SiloMode.REGION):
                user = organization.get_default_owner()

        integration = Factories.create_slack_integration(
            organization=organization, external_id=external_id, **kwargs
        )
        idp = Factories.create_identity_provider(integration=integration)
        Factories.create_identity(user, idp, identity_external_id)

        return integration

    def create_integration(
        self,
        organization: Organization,
        external_id: str,
        oi_params: Mapping[str, Any] | None = None,
        **kwargs: Any,
    ) -> Integration:
        """Create an integration and add an organization."""
        return Factories.create_integration(organization, external_id, oi_params, **kwargs)

    def create_provider_integration(self, **integration_params: Any) -> Integration:
        """Create an integration tied to a provider but no particular organization."""
        return Factories.create_provider_integration(**integration_params)

    def create_provider_integration_for(
        self,
        organization: Organization | RpcOrganization,
        user: User | RpcUser | None,
        **integration_params: Any,
    ) -> tuple[Integration, OrganizationIntegration]:
        """Create an integration tied to a provider, then add an organization."""
        return Factories.create_provider_integration_for(organization, user, **integration_params)

    def create_identity_integration(
        self,
        user: User | RpcUser,
        organization: Organization | RpcOrganization,
        integration_params: Mapping[Any, Any],
        identity_params: Mapping[Any, Any],
    ) -> tuple[Integration, OrganizationIntegration, Identity, IdentityProvider]:
        return Factories.create_identity_integration(
            user, organization, integration_params, identity_params
        )

    def create_organization_integration(self, **integration_params: Any) -> OrganizationIntegration:
        """Create an OrganizationIntegration entity."""
        return Factories.create_organization_integration(**integration_params)

    def create_identity(self, *args, **kwargs):
        return Factories.create_identity(*args, **kwargs)

    def create_identity_provider(
        self,
        integration: Integration | None = None,
        config: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> IdentityProvider:
        return Factories.create_identity_provider(integration=integration, config=config, **kwargs)

    def create_group_history(self, *args, **kwargs):
        if "user_id" not in kwargs and "team" not in kwargs and "team_id" not in kwargs:
            kwargs["user_id"] = self.user.id
        return Factories.create_group_history(*args, **kwargs)

    def create_comment(self, *args, **kwargs):
        return Factories.create_comment(*args, **kwargs)

    def create_saved_search(self, *args, **kwargs):
        return Factories.create_saved_search(*args, **kwargs)

    def create_organization_mapping(self, *args, **kwargs):
        return Factories.create_org_mapping(*args, **kwargs)

    def create_basic_auth_header(self, *args, **kwargs) -> bytes:
        return Factories.create_basic_auth_header(*args, **kwargs)

    def snooze_rule(self, *args, **kwargs):
        return Factories.snooze_rule(*args, **kwargs)

    def create_request_access(self, *args, **kwargs):
        return Factories.create_request_access(*args, **kwargs)

    def create_webhook_payload(self, *args, **kwargs):
        return Factories.create_webhook_payload(*args, **kwargs)

    def create_dashboard(self, *args, **kwargs):
        return Factories.create_dashboard(*args, **kwargs)

    def create_dashboard_widget(self, *args, **kwargs):
        return Factories.create_dashboard_widget(*args, **kwargs)

    def create_dashboard_widget_query(self, *args, **kwargs):
        return Factories.create_dashboard_widget_query(*args, **kwargs)

    def create_workflow(self, *args, **kwargs) -> Workflow:
        return Factories.create_workflow(*args, **kwargs)

    def create_data_source(self, *args, **kwargs) -> DataSource:
        return Factories.create_data_source(*args, **kwargs)

    def create_data_condition(
        self,
        comparison="10",
        type=Condition.EQUAL,
        condition_result=None,
        condition_group=None,
        **kwargs,
    ):
        if condition_result is None:
            condition_result = str(DetectorPriorityLevel.HIGH.value)
        if condition_group is None:
            condition_group = self.create_data_condition_group()

        return Factories.create_data_condition(
            comparison=comparison,
            type=type,
            condition_result=condition_result,
            condition_group=condition_group,
            **kwargs,
        )

    def create_detector(
        self,
        *args,
        project=None,
        type=ErrorGroupType.slug,
        **kwargs,
    ) -> Detector:
        if project is None:
            project = self.create_project(organization=self.organization)

        return Factories.create_detector(*args, project=project, type=type, **kwargs)

    def create_detector_state(self, *args, **kwargs) -> DetectorState:
        return Factories.create_detector_state(*args, **kwargs)

    def create_data_source_detector(self, *args, **kwargs):
        return Factories.create_data_source_detector(*args, **kwargs)

    def create_data_condition_group(self, *args, organization=None, **kwargs):
        if organization is None:
            organization = self.organization

        return Factories.create_data_condition_group(*args, organization=organization, **kwargs)

    def create_data_condition_group_action(self, *args, **kwargs):
        return Factories.create_data_condition_group_action(*args, **kwargs)

    def create_detector_workflow(self, *args, **kwargs):
        return Factories.create_detector_workflow(*args, **kwargs)

    def create_workflow_data_condition_group(self, *args, **kwargs):
        return Factories.create_workflow_data_condition_group(*args, **kwargs)

    # workflow_engine.models.action
    def create_action(self, *args, **kwargs):
        return Factories.create_action(*args, **kwargs)

    def create_uptime_subscription(
        self,
        type: str = "test",
        subscription_id: str | None = None,
        status: UptimeSubscription.Status = UptimeSubscription.Status.ACTIVE,
        url: str | None = None,
        host_provider_id="TEST",
        host_provider_name="TEST",
        url_domain="sentry",
        url_domain_suffix="io",
        interval_seconds=60,
        timeout_ms=100,
        method="GET",
        headers=None,
        body=None,
        date_updated: None | datetime = None,
        trace_sampling: bool = False,
        region_slugs: list[str] | None = None,
    ) -> UptimeSubscription:
        if date_updated is None:
            date_updated = timezone.now()
        if headers is None:
            headers = []
        if region_slugs is None:
            region_slugs = []

        subscription = Factories.create_uptime_subscription(
            type=type,
            subscription_id=subscription_id,
            status=status,
            url=url,
            url_domain=url_domain,
            url_domain_suffix=url_domain_suffix,
            host_provider_id=host_provider_id,
            host_provider_name=host_provider_name,
            interval_seconds=interval_seconds,
            timeout_ms=timeout_ms,
            date_updated=date_updated,
            method=method,
            headers=headers,
            body=body,
            trace_sampling=trace_sampling,
        )
        for region_slug in region_slugs:
            Factories.create_uptime_subscription_region(subscription, region_slug)

        return subscription

    def create_project_uptime_subscription(
        self,
        project: Project | None = None,
        env: Environment | None = None,
        uptime_subscription: UptimeSubscription | None = None,
        status: int = ObjectStatus.ACTIVE,
        mode=ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE,
        name: str | None = None,
        owner: User | Team | None = None,
        uptime_status=UptimeStatus.OK,
    ) -> ProjectUptimeSubscription:
        if project is None:
            project = self.project
        if env is None:
            env = self.environment

        if uptime_subscription is None:
            uptime_subscription = self.create_uptime_subscription()
        return Factories.create_project_uptime_subscription(
            project,
            env,
            uptime_subscription,
            status,
            mode,
            name,
            Actor.from_object(owner) if owner else None,
            uptime_status,
        )

    @pytest.fixture(autouse=True)
    def _init_insta_snapshot(self, insta_snapshot):
        self.insta_snapshot = insta_snapshot
