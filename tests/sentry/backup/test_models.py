from __future__ import annotations

from datetime import datetime, timedelta
from typing import Literal, Type
from uuid import uuid4

from django.utils import timezone
from sentry_relay.auth import generate_key_pair

from sentry.backup.helpers import get_exportable_final_derivations_of
from sentry.db.models import BaseModel
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
from sentry.models.email import Email
from sentry.models.environment import Environment, EnvironmentProject
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
from sentry.models.rule import Rule, RuleActivity, RuleActivityType
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
from sentry.monitors.models import (
    CheckInStatus,
    Monitor,
    MonitorCheckIn,
    MonitorEnvironment,
    MonitorLocation,
    MonitorType,
    ScheduleType,
)
from sentry.sentry_apps.apps import SentryAppUpdater
from sentry.snuba.models import QuerySubscription, SnubaQuery, SnubaQueryEventType
from sentry.testutils.cases import TransactionTestCase
from sentry.testutils.helpers.backups import import_export_then_validate
from sentry.utils.json import JSONData
from tests.sentry.backup import run_backup_tests_only_on_single_db, targets

UNIT_TESTED_MODELS = set()


def mark(*marking: Type | Literal["__all__"]):
    """A function that runs at module load time (which is why this logic can't be folded into the
    `targets` decorator) and marks all models that appear in at least one test. This is then used by
    test_coverage.py to ensure that all final derivations of django's "Model" that set
    `__relocation_scope__ != RelocationScope.Excluded` are exercised by at least one test here.

    Use the sentinel string "__all__" to indicate that all models are expected."""

    all: Literal["__all__"] = "__all__"
    for model in marking:
        if model == all:
            all_models = get_exportable_final_derivations_of(BaseModel)
            UNIT_TESTED_MODELS.update({c.__name__ for c in all_models})
            return list(all_models)

        UNIT_TESTED_MODELS.add(model.__name__)
    return marking


@run_backup_tests_only_on_single_db
class ModelBackupTests(TransactionTestCase):
    """
    Test the JSON-ification of models marked `__relocation_scope__ != RelocationScope.Excluded`.
    Each test here creates a fresh database, performs some writes to it, then exports that data into
    a temporary file (called the "expected" JSON). It then imports the "expected" JSON and
    re-exports it into the "actual" JSON file, and diffs the two to ensure that they match per the
    specified comparators.
    """

    def import_export_then_validate(self) -> JSONData:
        return import_export_then_validate(self._testMethodName, reset_pks=False)

    def create_dashboard(self):
        """Re-usable dashboard object for test cases."""

        user = self.create_user()
        org = self.create_organization(owner=user)
        project = self.create_project(organization=org)
        dashboard = Dashboard.objects.create(
            title="Dashboard 1", created_by_id=user.id, organization=org
        )
        dashboard.projects.add(project)
        return dashboard

    def create_monitor(self):
        """Re-usable monitor object for test cases."""

        user = self.create_user()
        org = self.create_organization(owner=user)
        project = self.create_project(organization=org)
        return Monitor.objects.create(
            organization_id=project.organization.id,
            project_id=project.id,
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *", "schedule_type": ScheduleType.CRONTAB},
        )

    @targets(mark(Actor))
    def test_actor(self):
        self.create_user(email="test@example.com")
        self.create_team(name="pre save team", organization=self.organization)
        return self.import_export_then_validate()

    @targets(mark(AlertRule, QuerySubscription, SnubaQuery, SnubaQueryEventType))
    def test_alert_rule(self):
        self.create_alert_rule()
        return self.import_export_then_validate()

    @targets(mark(AlertRuleActivity, AlertRuleExcludedProjects))
    def test_alert_rule_excluded_projects(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        excluded = self.create_project(organization=org)
        self.create_alert_rule(include_all_projects=True, excluded_projects=[excluded])
        return self.import_export_then_validate()

    @targets(mark(AlertRuleTrigger, AlertRuleTriggerAction, AlertRuleTriggerExclusion))
    def test_alert_rule_trigger(self):
        excluded = self.create_project()
        rule = self.create_alert_rule(include_all_projects=True)
        trigger = self.create_alert_rule_trigger(alert_rule=rule, excluded_projects=[excluded])
        self.create_alert_rule_trigger_action(alert_rule_trigger=trigger)
        return self.import_export_then_validate()

    @targets(mark(ApiAuthorization, ApiApplication))
    def test_api_authorization_application(self):
        user = self.create_user()
        app = ApiApplication.objects.create(name="test", owner=user)
        ApiAuthorization.objects.create(
            application=app, user=self.create_user("example@example.com")
        )
        return self.import_export_then_validate()

    @targets(mark(ApiToken))
    def test_api_token(self):
        user = self.create_user()
        app = ApiApplication.objects.create(
            owner=user, redirect_uris="http://example.com\nhttp://sub.example.com/path"
        )
        ApiToken.objects.create(application=app, user=user, token=uuid4().hex, expires_at=None)
        return self.import_export_then_validate()

    @targets(mark(ApiKey))
    def test_api_key(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        ApiKey.objects.create(key=uuid4().hex, organization_id=org.id)
        return self.import_export_then_validate()

    @targets(mark(Authenticator))
    def test_authenticator(self):
        user = self.create_user()
        Authenticator.objects.create(user=user, type=1)
        return self.import_export_then_validate()

    @targets(mark(AuthIdentity, AuthProvider))
    def test_auth_identity_provider(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        test_data = {
            "key1": "value1",
            "key2": 42,
            "key3": [1, 2, 3],
            "key4": {"nested_key": "nested_value"},
        }
        AuthIdentity.objects.create(
            user=user,
            auth_provider=AuthProvider.objects.create(organization_id=org.id, provider="sentry"),
            ident="123456789",
            data=test_data,
        )
        return self.import_export_then_validate()

    @targets(mark(ControlOption))
    def test_control_option(self):
        ControlOption.objects.create(key="foo", value="bar")
        return self.import_export_then_validate()

    @targets(mark(Counter))
    def test_counter(self):
        project = self.create_project()
        Counter.increment(project, 1)
        return self.import_export_then_validate()

    @targets(mark(Dashboard))
    def test_dashboard(self):
        self.create_dashboard()
        return self.import_export_then_validate()

    @targets(mark(DashboardTombstone))
    def test_dashboard_tombstone(self):
        DashboardTombstone.objects.create(organization=self.organization, slug="test-tombstone")
        return self.import_export_then_validate()

    @targets(mark(DashboardWidget, DashboardWidgetQuery))
    def test_dashboard_widget(self):
        dashboard = self.create_dashboard()
        widget = DashboardWidget.objects.create(
            dashboard=dashboard,
            order=1,
            title="Test Widget",
            display_type=0,
            widget_type=DashboardWidgetTypes.DISCOVER,
        )
        DashboardWidgetQuery.objects.create(widget=widget, order=1, name="Test Query")
        return self.import_export_then_validate()

    @targets(mark(Email))
    def test_email(self):
        Email.objects.create(email="email@example.com")
        return self.import_export_then_validate()

    @targets(mark(Environment))
    def test_environment(self):
        self.create_environment()
        return self.import_export_then_validate()

    @targets(mark(EnvironmentProject))
    def test_environment_project(self):
        env = self.create_environment()
        project = self.create_project()
        EnvironmentProject.objects.create(project=project, environment=env, is_hidden=False)
        return self.import_export_then_validate()

    @targets(mark(Incident))
    def test_incident(self):
        self.create_incident()
        return self.import_export_then_validate()

    @targets(mark(IncidentActivity))
    def test_incident_activity(self):
        IncidentActivity.objects.create(
            incident=self.create_incident(),
            type=1,
            comment="hello",
        )
        return self.import_export_then_validate()

    @targets(mark(IncidentSnapshot, TimeSeriesSnapshot))
    def test_incident_snapshot(self):
        IncidentSnapshot.objects.create(
            incident=self.create_incident(),
            event_stats_snapshot=TimeSeriesSnapshot.objects.create(
                start=datetime.utcnow() - timedelta(hours=24),
                end=datetime.utcnow(),
                values=[[1.0, 2.0, 3.0], [1.5, 2.5, 3.5]],
                period=1,
            ),
            unique_users=1,
            total_events=1,
        )
        return self.import_export_then_validate()

    @targets(mark(IncidentSubscription))
    def test_incident_subscription(self):
        user_id = self.create_user().id
        IncidentSubscription.objects.create(incident=self.create_incident(), user_id=user_id)
        return self.import_export_then_validate()

    @targets(mark(IncidentTrigger))
    def test_incident_trigger(self):
        excluded = self.create_project()
        rule = self.create_alert_rule(include_all_projects=True)
        trigger = self.create_alert_rule_trigger(alert_rule=rule, excluded_projects=[excluded])
        self.create_alert_rule_trigger_action(alert_rule_trigger=trigger)
        IncidentTrigger.objects.create(
            incident=self.create_incident(),
            alert_rule_trigger=trigger,
            status=1,
        )
        return self.import_export_then_validate()

    @targets(mark(Monitor))
    def test_monitor(self):
        self.create_monitor()
        return self.import_export_then_validate()

    @targets(mark(MonitorEnvironment, MonitorLocation))
    def test_monitor_environment(self):
        monitor = self.create_monitor()
        env = Environment.objects.create(organization_id=monitor.organization_id, name="test_env")
        mon_env = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment=env,
        )
        location = MonitorLocation.objects.create(guid=uuid4(), name="test_location")
        MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=mon_env,
            location=location,
            project_id=monitor.project_id,
            status=CheckInStatus.IN_PROGRESS,
        )
        return self.import_export_then_validate()

    @targets(mark(NotificationAction, NotificationActionProject))
    def test_notification_action(self):
        self.create_notification_action(organization=self.organization, projects=[self.project])
        return self.import_export_then_validate()

    @targets(mark(Option))
    def test_option(self):
        Option.objects.create(key="foo", value="bar")
        return self.import_export_then_validate()

    @targets(mark(OrgAuthToken))
    def test_org_auth_token(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        OrgAuthToken.objects.create(
            organization_id=org.id,
            name="token 1",
            token_hashed="ABCDEF",
            token_last_characters="xyz1",
            scope_list=["org:ci"],
            date_last_used=None,
        )
        return self.import_export_then_validate()

    @targets(mark(Organization))
    def test_organization(self):
        user = self.create_user()
        self.create_organization(owner=user)
        return self.import_export_then_validate()

    @targets(mark(OrganizationAccessRequest, OrganizationMember, OrganizationMemberTeam, Team))
    def test_organization_membership(self):
        organization = self.create_organization(name="test_org", owner=self.user)
        user = self.create_user("other@example.com")
        member = self.create_member(organization=organization, user=user, role="member")
        team = self.create_team(name="foo", organization=organization)

        self.create_team_membership(user=user, team=team)
        OrganizationAccessRequest.objects.create(member=member, team=team)
        return self.import_export_then_validate()

    @targets(mark(OrganizationOption))
    def test_organization_option(self):
        organization = self.create_organization(name="test_org", owner=self.user)
        OrganizationOption.objects.create(
            organization=organization, key="sentry:account-rate-limit", value=0
        )
        return self.import_export_then_validate()

    @targets(mark(Project, ProjectKey, ProjectOption, ProjectTeam))
    def test_project(self):
        self.create_project()
        return self.import_export_then_validate()

    @targets(mark(ProjectBookmark))
    def test_project_bookmark(self):
        user = self.create_user()
        project = self.create_project()
        self.create_project_bookmark(project=project, user=user)
        return self.import_export_then_validate()

    @targets(mark(ProjectKey))
    def test_project_key(self):
        project = self.create_project()
        self.create_project_key(project)
        return self.import_export_then_validate()

    @targets(mark(ProjectOwnership))
    def test_project_ownership(self):
        project = self.create_project()
        ProjectOwnership.objects.create(
            project=project, raw='{"hello":"hello"}', schema={"hello": "hello"}
        )
        return self.import_export_then_validate()

    @targets(mark(ProjectRedirect))
    def test_project_redirect(self):
        project = self.create_project()
        ProjectRedirect.record(project, "old_slug")
        return self.import_export_then_validate()

    @targets(mark(Relay, RelayUsage))
    def test_relay(self):
        _, public_key = generate_key_pair()
        relay_id = str(uuid4())
        Relay.objects.create(relay_id=relay_id, public_key=str(public_key), is_internal=True)
        RelayUsage.objects.create(relay_id=relay_id, version="0.0.1", public_key=public_key)
        return self.import_export_then_validate()

    @targets(mark(Repository))
    def test_repository(self):
        Repository.objects.create(
            name="test_repo",
            organization_id=self.organization.id,
            # TODO(getsentry/issue#187): Re-activate once we add `Integration` model to exports.
            # integration_id=self.integration.id,
        )
        return self.import_export_then_validate()

    @targets(mark(Rule, RuleActivity, RuleSnooze))
    def test_rule(self):
        rule = self.create_project_rule(project=self.project)
        RuleActivity.objects.create(rule=rule, type=RuleActivityType.CREATED.value)
        self.snooze_rule(user_id=self.user.id, owner_id=self.user.id, rule=rule)
        return self.import_export_then_validate()

    @targets(mark(RecentSearch, SavedSearch))
    def test_search(self):
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

    @targets(mark(SentryApp, SentryAppComponent, SentryAppInstallation))
    def test_sentry_app(self):
        app = self.create_sentry_app(name="test_app", organization=self.organization)
        self.create_sentry_app_installation(slug=app.slug, organization=self.organization)
        updater = SentryAppUpdater(sentry_app=app)
        updater.schema = {"elements": [self.create_alert_rule_action_schema()]}
        updater.run(self.user)
        return self.import_export_then_validate()

    @targets(mark(PendingIncidentSnapshot))
    def test_snapshot(self):
        incident = self.create_incident()
        PendingIncidentSnapshot.objects.create(
            incident=incident, target_run_date=datetime.utcnow() + timedelta(hours=4)
        )
        return self.import_export_then_validate()

    @targets(mark(ServiceHook))
    def test_service_hook(self):
        app = self.create_sentry_app()
        install = self.create_sentry_app_installation(organization=self.organization, slug=app.slug)
        self.create_service_hook(
            application_id=app.application.id,
            actor_id=app.proxy_user.id,
            installation_id=install.id,
            project=self.project,
            org=self.project.organization,
        )
        return self.import_export_then_validate()

    @targets(mark(User, UserEmail, UserOption, UserPermission))
    def test_user(self):
        user = self.create_user()
        self.add_user_permission(user, "users.admin")
        UserOption.objects.create(user=user, key="timezone", value="Europe/Vienna")
        return self.import_export_then_validate()

    @targets(mark(UserIP))
    def test_user_ip(self):
        user = self.create_user()
        UserIP.objects.create(
            user=user,
            ip_address="127.0.0.2",
            first_seen=datetime(2012, 4, 5, 3, 29, 45, tzinfo=timezone.utc),
            last_seen=datetime(2012, 4, 5, 3, 29, 45, tzinfo=timezone.utc),
        )
        return self.import_export_then_validate()

    @targets(mark(UserRole, UserRoleUser))
    def test_user_role(self):
        user = self.create_user()
        role = UserRole.objects.create(name="test-role")
        UserRoleUser.objects.create(user=user, role=role)
        return self.import_export_then_validate()
