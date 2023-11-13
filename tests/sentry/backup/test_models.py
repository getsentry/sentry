from __future__ import annotations

import tempfile
from datetime import datetime, timedelta
from pathlib import Path
from uuid import uuid4

from django.utils import timezone
from sentry_relay.auth import generate_key_pair

from sentry.backup.dependencies import NormalizedModelName
from sentry.backup.scopes import ExportScope, RelocationScope
from sentry.incidents.models import (
    AlertRule,
    AlertRuleActivity,
    AlertRuleExcludedProjects,
    AlertRuleTrigger,
    AlertRuleTriggerAction,
    AlertRuleTriggerExclusion,
    Incident,
    IncidentActivity,
    IncidentSnapshot,
    IncidentSubscription,
    IncidentTrigger,
    PendingIncidentSnapshot,
    TimeSeriesSnapshot,
)
from sentry.models.actor import Actor
from sentry.models.apiapplication import ApiApplication
from sentry.models.apiauthorization import ApiAuthorization
from sentry.models.apigrant import ApiGrant
from sentry.models.apikey import ApiKey
from sentry.models.apitoken import ApiToken
from sentry.models.authenticator import Authenticator
from sentry.models.authidentity import AuthIdentity
from sentry.models.authprovider import AuthProvider
from sentry.models.counter import Counter
from sentry.models.dashboard import Dashboard, DashboardTombstone
from sentry.models.dashboard_widget import (
    DashboardWidget,
    DashboardWidgetQuery,
    DashboardWidgetTypes,
)
from sentry.models.dynamicsampling import (
    CustomDynamicSamplingRule,
    CustomDynamicSamplingRuleProject,
)
from sentry.models.email import Email
from sentry.models.environment import Environment, EnvironmentProject
from sentry.models.integrations.integration import Integration
from sentry.models.integrations.organization_integration import OrganizationIntegration
from sentry.models.integrations.project_integration import ProjectIntegration
from sentry.models.integrations.sentry_app import SentryApp
from sentry.models.integrations.sentry_app_component import SentryAppComponent
from sentry.models.integrations.sentry_app_installation import SentryAppInstallation
from sentry.models.notificationaction import NotificationAction, NotificationActionProject
from sentry.models.options.option import ControlOption, Option
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.options.project_option import ProjectOption
from sentry.models.options.user_option import UserOption
from sentry.models.organization import Organization
from sentry.models.organizationaccessrequest import OrganizationAccessRequest
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.orgauthtoken import OrgAuthToken
from sentry.models.project import Project
from sentry.models.projectbookmark import ProjectBookmark
from sentry.models.projectkey import ProjectKey
from sentry.models.projectownership import ProjectOwnership
from sentry.models.projectredirect import ProjectRedirect
from sentry.models.projectteam import ProjectTeam
from sentry.models.recentsearch import RecentSearch
from sentry.models.relay import Relay, RelayUsage
from sentry.models.repository import Repository
from sentry.models.rule import NeglectedRule, Rule, RuleActivity, RuleActivityType
from sentry.models.rulesnooze import RuleSnooze
from sentry.models.savedsearch import SavedSearch, Visibility
from sentry.models.search_common import SearchType
from sentry.models.servicehook import ServiceHook
from sentry.models.team import Team
from sentry.models.user import User
from sentry.models.useremail import UserEmail
from sentry.models.userip import UserIP
from sentry.models.userpermission import UserPermission
from sentry.models.userrole import UserRole, UserRoleUser
from sentry.monitors.models import Monitor, MonitorType, ScheduleType
from sentry.sentry_apps.apps import SentryAppUpdater
from sentry.silo.base import SiloMode
from sentry.snuba.models import QuerySubscription, SnubaQuery, SnubaQueryEventType
from sentry.testutils.cases import TransactionTestCase
from sentry.testutils.helpers.backups import export_to_file, import_export_then_validate
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test
from sentry.utils.json import JSONData
from tests.sentry.backup import mark, targets

UNIT_TESTED: set[NormalizedModelName] = set()
DYNAMIC_RELOCATION_SCOPE_TESTED: set[NormalizedModelName] = set()


# There is no need to in both monolith and region mode for model-level unit tests - region mode
# testing along should suffice.
@region_silo_test
class ModelUnitTests(TransactionTestCase):
    """
    Test the JSON-ification of models marked `__relocation_scope__ != RelocationScope.Excluded`.
    Each test here creates a fresh database, performs some writes to it, then exports that data into
    a temporary file (called the "expected" JSON). It then imports the "expected" JSON and
    re-exports it into the "actual" JSON file, and diffs the two to ensure that they match per the
    specified comparators.
    """

    def import_export_then_validate(self) -> JSONData:
        return import_export_then_validate(self._testMethodName, reset_pks=False)

    @targets(
        mark(
            UNIT_TESTED,
            AlertRule,
            AlertRuleActivity,
            AlertRuleExcludedProjects,
            AlertRuleTrigger,
            AlertRuleTriggerAction,
            AlertRuleTriggerExclusion,
            QuerySubscription,
            SnubaQuery,
            SnubaQueryEventType,
        )
    )
    def test_alert_rule(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        excluded = self.create_project(organization=org)
        self.create_alert_rule(include_all_projects=True, excluded_projects=[excluded])

        rule2 = self.create_alert_rule(include_all_projects=True)
        excluded2 = self.create_project()
        trigger = self.create_alert_rule_trigger(alert_rule=rule2, excluded_projects=[excluded2])
        self.create_alert_rule_trigger_action(alert_rule_trigger=trigger)
        return self.import_export_then_validate()

    @targets(
        mark(
            UNIT_TESTED,
            ApiAuthorization,
            ApiApplication,
            ApiGrant,
            ApiKey,
            ApiToken,
            Authenticator,
            AuthIdentity,
            AuthProvider,
            OrgAuthToken,
        )
    )
    def test_api_and_auth(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        test_data = {
            "key1": "value1",
            "key2": 42,
            "key3": [1, 2, 3],
            "key4": {"nested_key": "nested_value"},
        }

        with assume_test_silo_mode(SiloMode.CONTROL):
            app = ApiApplication.objects.create(name="test", owner=user)
            ApiAuthorization.objects.create(
                application=app, user=self.create_user("example@example.com")
            )
            ApiGrant.objects.create(
                user=self.user,
                application=app,
                expires_at="2022-01-01 11:11",
                redirect_uri="https://example.com",
                scope_list=["openid", "profile", "email"],
            )

            redirect_app = ApiApplication.objects.create(
                owner=user, redirect_uris="http://example.com\nhttp://sub.example.com/path"
            )
            ApiToken.objects.create(
                application=redirect_app, user=user, expires_at=None, name="test_api_token"
            )
            ApiKey.objects.create(key=uuid4().hex, organization_id=org.id)

            Authenticator.objects.create(user=user, type=1)
            AuthIdentity.objects.create(
                user=user,
                auth_provider=AuthProvider.objects.create(
                    organization_id=org.id, provider="sentry"
                ),
                ident="123456789",
                data=test_data,
            )

            OrgAuthToken.objects.create(
                organization_id=org.id,
                name="token 1",
                token_hashed="ABCDEF",
                token_last_characters="xyz1",
                scope_list=["org:ci"],
                date_last_used=None,
            )

        return self.import_export_then_validate()

    @targets(mark(UNIT_TESTED, ControlOption, Option, OrganizationOption, Relay, RelayUsage))
    def test_configs(self):
        organization = self.create_organization(name="test_org", owner=self.user)
        OrganizationOption.objects.create(
            organization=organization, key="sentry:account-rate-limit", value=0
        )

        Option.objects.create(key="foo", value="bar")

        _, public_key = generate_key_pair()
        relay_id = str(uuid4())
        Relay.objects.create(relay_id=relay_id, public_key=str(public_key), is_internal=True)
        RelayUsage.objects.create(relay_id=relay_id, version="0.0.1", public_key=public_key)

        with assume_test_silo_mode(SiloMode.CONTROL):
            ControlOption.objects.create(key="foo", value="bar")

        return self.import_export_then_validate()

    @targets(
        mark(UNIT_TESTED, Dashboard, DashboardTombstone, DashboardWidget, DashboardWidgetQuery)
    )
    def test_dashboard(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        project = self.create_project(organization=org)

        dashboard = Dashboard.objects.create(
            title="Dashboard 1", created_by_id=user.id, organization=org
        )
        dashboard.projects.add(project)

        widget = DashboardWidget.objects.create(
            dashboard=dashboard,
            order=1,
            title="Test Widget",
            display_type=0,
            widget_type=DashboardWidgetTypes.DISCOVER,
        )
        DashboardWidgetQuery.objects.create(widget=widget, order=1, name="Test Query")

        DashboardTombstone.objects.create(organization=self.organization, slug="test-tombstone")
        return self.import_export_then_validate()

    @targets(
        mark(
            UNIT_TESTED,
            Incident,
            IncidentActivity,
            IncidentSnapshot,
            IncidentSubscription,
            IncidentTrigger,
            PendingIncidentSnapshot,
            TimeSeriesSnapshot,
        )
    )
    def test_incident(self):
        user_id = self.create_user().id

        incident = self.create_incident()
        IncidentActivity.objects.create(
            incident=self.create_incident(),
            type=1,
            comment="hello",
        )

        IncidentSnapshot.objects.create(
            incident=incident,
            event_stats_snapshot=TimeSeriesSnapshot.objects.create(
                start=datetime.utcnow() - timedelta(hours=24),
                end=datetime.utcnow(),
                values=[[1.0, 2.0, 3.0], [1.5, 2.5, 3.5]],
                period=1,
            ),
            unique_users=1,
            total_events=1,
        )
        IncidentSubscription.objects.create(incident=self.create_incident(), user_id=user_id)

        excluded = self.create_project()
        rule = self.create_alert_rule(include_all_projects=True)
        trigger = self.create_alert_rule_trigger(alert_rule=rule, excluded_projects=[excluded])
        self.create_alert_rule_trigger_action(alert_rule_trigger=trigger)
        IncidentTrigger.objects.create(
            incident=self.create_incident(),
            alert_rule_trigger=trigger,
            status=1,
        )

        PendingIncidentSnapshot.objects.create(
            incident=incident, target_run_date=datetime.utcnow() + timedelta(hours=4)
        )
        return self.import_export_then_validate()

    @targets(
        mark(UNIT_TESTED, Integration, OrganizationIntegration, ProjectIntegration, Repository)
    )
    def test_integration(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        project = self.create_project()
        integration = self.create_integration(
            org, provider="slack", name="Slack 1", external_id="slack:1"
        )

        # Note: this model is deprecated, and can safely be removed from this test when it is
        # finally removed. Until then, it is included for completeness.
        ProjectIntegration.objects.create(
            project=project, integration_id=integration.id, config='{"hello":"hello"}'
        )

        self.create_repo(
            project=self.project,
            name="getsentry/getsentry",
            provider="integrations:github",
            integration_id=self.integration.id,
            url="https://github.com/getsentry/getsentry",
        )
        return self.import_export_then_validate()

    @targets(
        mark(
            UNIT_TESTED,
            Actor,
            Organization,
            OrganizationAccessRequest,
            OrganizationMember,
            OrganizationMemberTeam,
            Team,
        )
    )
    def test_organization(self):
        organization = self.create_organization(name="test_org", owner=self.user)
        user = self.create_user("other@example.com")
        member = self.create_member(organization=organization, user=user, role="member")
        team = self.create_team(name="foo", organization=organization)

        self.create_team_membership(user=user, team=team)
        OrganizationAccessRequest.objects.create(member=member, team=team)
        return self.import_export_then_validate()

    @targets(
        mark(
            UNIT_TESTED,
            Environment,
            EnvironmentProject,
            Counter,
            Monitor,
            Project,
            ProjectBookmark,
            ProjectKey,
            ProjectOption,
            ProjectOwnership,
            ProjectTeam,
            ProjectRedirect,
        )
    )
    def test_project(self):
        user = self.create_user()
        project = self.create_project()
        self.create_project_bookmark(project=project, user=user)
        ProjectOwnership.objects.create(
            project=project, raw='{"hello":"hello"}', schema={"hello": "hello"}
        )
        ProjectRedirect.record(project, "old_slug")
        Counter.increment(project, 1)

        env = self.create_environment()
        EnvironmentProject.objects.create(project=project, environment=env, is_hidden=False)

        Monitor.objects.create(
            organization_id=project.organization.id,
            project_id=project.id,
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *", "schedule_type": ScheduleType.CRONTAB},
        )
        return self.import_export_then_validate()

    @targets(
        mark(
            UNIT_TESTED,
            CustomDynamicSamplingRule,
            CustomDynamicSamplingRuleProject,
            Rule,
            RuleActivity,
            RuleSnooze,
            NeglectedRule,
        )
    )
    def test_rule(self):
        rule = self.create_project_rule(project=self.project)
        RuleActivity.objects.create(rule=rule, type=RuleActivityType.CREATED.value)
        self.snooze_rule(user_id=self.user.id, owner_id=self.user.id, rule=rule)

        NeglectedRule.objects.create(
            rule=rule,
            organization=self.organization,
            disable_date=datetime.now(),
            sent_initial_email_date=datetime.now(),
            sent_final_email_date=datetime.now(),
        )

        CustomDynamicSamplingRule.update_or_create(
            condition={"op": "equals", "name": "environment", "value": "prod"},
            start=timezone.now(),
            end=timezone.now() + timedelta(hours=1),
            project_ids=[self.project.id],
            organization_id=self.project.organization.id,
            num_samples=100,
            sample_rate=0.5,
            query="environment:prod",
        )
        return self.import_export_then_validate()

    @targets(mark(UNIT_TESTED, SentryApp, SentryAppComponent, SentryAppInstallation, ServiceHook))
    def test_sentry_app(self):
        app = self.create_sentry_app(name="test_app", organization=self.organization)
        self.create_sentry_app_installation(slug=app.slug, organization=self.organization)

        with assume_test_silo_mode(SiloMode.CONTROL):
            updater = SentryAppUpdater(sentry_app=app)
            updater.schema = {"elements": [self.create_alert_rule_action_schema()]}
            updater.run(self.user)

        other_app = self.create_sentry_app()
        install = self.create_sentry_app_installation(
            organization=self.organization, slug=other_app.slug
        )
        self.create_service_hook(
            application_id=other_app.application.id,
            actor_id=other_app.proxy_user.id,
            installation_id=install.id,
            project=self.project,
            org=self.project.organization,
        )

        return self.import_export_then_validate()

    @targets(
        mark(
            UNIT_TESTED,
            Email,
            User,
            UserEmail,
            UserIP,
            UserOption,
            UserPermission,
            UserRole,
            UserRoleUser,
        )
    )
    def test_user(self):
        user = self.create_user()
        self.add_user_permission(user, "users.admin")

        with assume_test_silo_mode(SiloMode.CONTROL):
            role = UserRole.objects.create(name="test-role")
            UserRoleUser.objects.create(user=user, role=role)
            UserOption.objects.create(user=user, key="timezone", value="Europe/Vienna")
            UserIP.objects.create(
                user=user,
                ip_address="127.0.0.2",
                first_seen=datetime(2012, 4, 5, 3, 29, 45, tzinfo=timezone.utc),
                last_seen=datetime(2012, 4, 5, 3, 29, 45, tzinfo=timezone.utc),
            )

        return self.import_export_then_validate()

    @targets(
        mark(UNIT_TESTED, NotificationAction, NotificationActionProject, RecentSearch, SavedSearch)
    )
    def test_user_state(self):
        self.create_notification_action(organization=self.organization, projects=[self.project])

        RecentSearch.objects.create(
            organization=self.organization,
            user_id=self.user.id,
            type=SearchType.ISSUE.value,
            query="some query",
        )
        SavedSearch.objects.create(
            organization=self.organization,
            name="Saved query",
            query="saved query",
            visibility=Visibility.ORGANIZATION,
        )
        return self.import_export_then_validate()


# There is no need to in both monolith and region mode for model-level unit tests - region mode
# testing along should suffice.
@region_silo_test
class DynamicRelocationScopeTests(TransactionTestCase):
    """
    For models that support different relocation scopes depending on properties of the model instance itself (ie, they have a set for their `__relocation_scope__`, rather than a single value), make sure that this dynamic deduction works correctly.
    """

    def export(self) -> JSONData:
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir).joinpath(f"{self._testMethodName}.expect.json")
            return export_to_file(tmp_path, ExportScope.Global)

    @targets(mark(DYNAMIC_RELOCATION_SCOPE_TESTED, ApiAuthorization, ApiToken))
    def test_api_auth(self):
        user = self.create_user()

        # Bound to an app == global scope.
        with assume_test_silo_mode(SiloMode.CONTROL):
            app = ApiApplication.objects.create(name="test", owner=user)
            auth = ApiAuthorization.objects.create(
                application=app, user=self.create_user("api_app@example.com")
            )
            token = ApiToken.objects.create(
                application=app, user=user, expires_at=None, name="test_api_auth_application_bound"
            )

        # TODO(getsentry/team-ospo#188): this should be extension scope once that gets added.
        assert auth.get_relocation_scope() == RelocationScope.Global
        assert token.get_relocation_scope() == RelocationScope.Global

        # Unbound to an app == config scope.
        with assume_test_silo_mode(SiloMode.CONTROL):
            auth = ApiAuthorization.objects.create(user=self.create_user("api_auth@example.com"))
            token = ApiToken.objects.create(
                user=user, expires_at=None, name="test_api_auth_not_bound"
            )

        assert auth.get_relocation_scope() == RelocationScope.Config
        assert token.get_relocation_scope() == RelocationScope.Config
        return self.export()

    @targets(mark(DYNAMIC_RELOCATION_SCOPE_TESTED, NotificationAction, NotificationActionProject))
    def test_notification_action(self):
        # Bound to an app == global scope.
        app = self.create_sentry_app(name="test_app", organization=self.organization)
        action = self.create_notification_action(
            organization=self.organization, projects=[self.project], sentry_app_id=app.id
        )
        action_project = NotificationActionProject.objects.get(action=action)

        # TODO(getsentry/team-ospo#188): this should be extension scope once that gets added.
        assert action.get_relocation_scope() == RelocationScope.Global
        assert action_project.get_relocation_scope() == RelocationScope.Global

        # Bound to an integration == global scope.
        integration = self.create_integration(
            self.organization, provider="slack", name="Slack 1", external_id="slack:1"
        )
        action = self.create_notification_action(
            organization=self.organization, projects=[self.project], integration_id=integration.id
        )
        action_project = NotificationActionProject.objects.get(action=action)

        # TODO(getsentry/team-ospo#188): this should be extension scope once that gets added.
        assert action.get_relocation_scope() == RelocationScope.Global
        assert action_project.get_relocation_scope() == RelocationScope.Global

        # Unbound to an app or integration == organization scope.
        action = self.create_notification_action(
            organization=self.organization, projects=[self.project]
        )
        action_project = NotificationActionProject.objects.get(action=action)

        assert action.get_relocation_scope() == RelocationScope.Organization
        assert action_project.get_relocation_scope() == RelocationScope.Organization
        return self.export()
