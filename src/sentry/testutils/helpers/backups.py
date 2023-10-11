from __future__ import annotations

import tempfile
from datetime import datetime, timedelta
from functools import lru_cache
from pathlib import Path
from uuid import uuid4

from django.apps import apps
from django.conf import settings
from django.core.management import call_command
from django.db import connections, router
from django.utils import timezone
from sentry_relay.auth import generate_key_pair

from sentry.backup.comparators import ComparatorMap
from sentry.backup.dependencies import sorted_dependencies
from sentry.backup.exports import (
    export_in_config_scope,
    export_in_global_scope,
    export_in_organization_scope,
    export_in_user_scope,
)
from sentry.backup.findings import ComparatorFindings
from sentry.backup.imports import import_in_global_scope
from sentry.backup.scopes import ExportScope
from sentry.backup.validate import validate
from sentry.db.models.fields.bounded import BoundedBigAutoField
from sentry.incidents.models import (
    IncidentActivity,
    IncidentSnapshot,
    IncidentSubscription,
    IncidentTrigger,
    PendingIncidentSnapshot,
    TimeSeriesSnapshot,
)
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
from sentry.models.dynamicsampling import CustomDynamicSamplingRule
from sentry.models.integrations.integration import Integration
from sentry.models.integrations.organization_integration import OrganizationIntegration
from sentry.models.integrations.project_integration import ProjectIntegration
from sentry.models.integrations.sentry_app import SentryApp
from sentry.models.options.option import ControlOption, Option
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.options.user_option import UserOption
from sentry.models.organization import Organization
from sentry.models.organizationaccessrequest import OrganizationAccessRequest
from sentry.models.orgauthtoken import OrgAuthToken
from sentry.models.project import Project
from sentry.models.projectownership import ProjectOwnership
from sentry.models.projectredirect import ProjectRedirect
from sentry.models.recentsearch import RecentSearch
from sentry.models.relay import Relay, RelayUsage
from sentry.models.rule import NeglectedRule, RuleActivity, RuleActivityType
from sentry.models.savedsearch import SavedSearch, Visibility
from sentry.models.search_common import SearchType
from sentry.models.team import Team
from sentry.models.user import User
from sentry.models.userip import UserIP
from sentry.models.userrole import UserRole, UserRoleUser
from sentry.monitors.models import Monitor, MonitorType, ScheduleType
from sentry.sentry_apps.apps import SentryAppUpdater
from sentry.silo import unguarded_write
from sentry.testutils.cases import TransactionTestCase
from sentry.testutils.factories import get_fixture_path
from sentry.utils import json
from sentry.utils.json import JSONData

__all__ = [
    "export_to_file",
    "import_export_then_validate",
    "import_export_from_fixture_then_validate",
    "ValidationError",
]

NOOP_PRINTER = lambda *args, **kwargs: None


class ValidationError(Exception):
    def __init__(self, info: ComparatorFindings):
        super().__init__(info.pretty())
        self.info = info


def export_to_file(path: Path, scope: ExportScope, filter_by: set[str] | None = None) -> JSONData:
    """Helper function that exports the current state of the database to the specified file."""

    json_file_path = str(path)
    with open(json_file_path, "w+") as tmp_file:
        # These functions are just thin wrappers, but its best to exercise them directly anyway in
        # case that ever changes.
        if scope == ExportScope.Global:
            export_in_global_scope(tmp_file, printer=NOOP_PRINTER)
        elif scope == ExportScope.Config:
            export_in_config_scope(tmp_file, printer=NOOP_PRINTER)
        elif scope == ExportScope.Organization:
            export_in_organization_scope(tmp_file, org_filter=filter_by, printer=NOOP_PRINTER)
        elif scope == ExportScope.User:
            export_in_user_scope(tmp_file, user_filter=filter_by, printer=NOOP_PRINTER)
        else:
            raise AssertionError(f"Unknown `ExportScope`: `{scope.name}`")

    with open(json_file_path) as tmp_file:
        output = json.load(tmp_file)
    return output


# No arguments, so we lazily cache the result after the first calculation.
@lru_cache(maxsize=1)
def reversed_dependencies():
    sorted = list(sorted_dependencies())
    sorted.reverse()
    return sorted


def clear_database(*, reset_pks: bool = False):
    """Deletes all models we care about from the database, in a sequence that ensures we get no
    foreign key errors."""

    if reset_pks:
        for db in settings.DATABASES.keys():
            call_command("flush", database=db, verbosity=0, interactive=False)
        return

    # TODO(hybrid-cloud): actor refactor. Remove this kludge when done.
    with unguarded_write(using=router.db_for_write(Team)):
        Team.objects.update(actor=None)

    reversed = reversed_dependencies()
    for model in reversed:
        with unguarded_write(using=router.db_for_write(model)):
            # For some reason, the tables for `SentryApp*` models don't get deleted properly here
            # when using `model.objects.all().delete()`, so we have to call out to Postgres
            # manually.
            connection = connections[router.db_for_write(model)]
            with connection.cursor() as cursor:
                table = model._meta.db_table
                cursor.execute(f"DELETE FROM {table:s};")

    # Clear remaining tables that are not explicitly in Sentry's own model dependency graph.
    for model in set(apps.get_models()) - set(reversed):
        with unguarded_write(using=router.db_for_write(model)):
            model.objects.all().delete()


def import_export_then_validate(method_name: str, *, reset_pks: bool = True) -> JSONData:
    """
    Test helper that validates that data imported from an export of the current state of the test
    database correctly matches the actual outputted export data.
    """

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_expect = Path(tmpdir).joinpath(f"{method_name}.expect.json")
        tmp_actual = Path(tmpdir).joinpath(f"{method_name}.actual.json")

        # Export the current state of the database into the "expected" temporary file, then
        # parse it into a JSON object for comparison.
        expect = export_to_file(tmp_expect, ExportScope.Global)
        clear_database(reset_pks=reset_pks)

        # Write the contents of the "expected" JSON file into the now clean database.
        with open(tmp_expect) as tmp_file:
            import_in_global_scope(tmp_file, printer=NOOP_PRINTER)

        # Validate that the "expected" and "actual" JSON matches.
        actual = export_to_file(tmp_actual, ExportScope.Global)
        res = validate(expect, actual)
        if res.findings:
            raise ValidationError(res)

        # Ensure that the "reset" behavior was tested in the manner we expect.
        for i, expect_entry in enumerate(expect):
            model_name = expect_entry["model"]
            expect_pk = expect_entry["pk"]
            actual_pk = actual[i]["pk"]
            if reset_pks and expect_pk != actual_pk:
                expect_pk
                AssertionError(
                    f"At model `{model_name}`, the expected `pk` of `{expect_pk}` was not equal to the actual `pk` of `{actual_pk}`, even though `reset_pks = True`"
                )
            elif not reset_pks and expect_pk == actual_pk:
                expect_pk
                AssertionError(
                    f"At model `{model_name}`, the expected `pk` of `{expect_pk}` was equal to the actual `pk` of `{actual_pk}`, even though `reset_pks = False`"
                )

    return actual


EMPTY_COMPARATORS_FOR_TESTING: ComparatorMap = {}


def import_export_from_fixture_then_validate(
    tmp_path: Path,
    fixture_file_name: str,
    map: ComparatorMap = EMPTY_COMPARATORS_FOR_TESTING,
) -> None:
    """Test helper that validates that data imported from a fixture `.json` file correctly matches
    the actual outputted export data."""

    fixture_file_path = get_fixture_path("backup", fixture_file_name)
    with open(fixture_file_path) as backup_file:
        expect = json.load(backup_file)
    with open(fixture_file_path) as fixture_file:
        import_in_global_scope(fixture_file, printer=NOOP_PRINTER)

    res = validate(
        expect, export_to_file(tmp_path.joinpath("tmp_test_file.json"), ExportScope.Global), map
    )
    if res.findings:
        raise ValidationError(res)


class BackupTestCase(TransactionTestCase):
    """Instruments a database state that includes an instance of every Sentry model with every field
    set to a non-default, non-null value. This is useful for exhaustive conformance testing."""

    def create_exhaustive_user(
        self,
        username: str,
        *,
        email: str | None = None,
        is_admin: bool = False,
        is_staff: bool = False,
        is_superuser: bool = False,
    ) -> User:
        email = username if email is None else email
        user = self.create_user(
            email, username=username, is_staff=is_staff, is_superuser=is_superuser
        )
        UserOption.objects.create(user=user, key="timezone", value="Europe/Vienna")
        UserIP.objects.create(
            user=user,
            ip_address="127.0.0.2",
            first_seen=datetime(2012, 4, 5, 3, 29, 45, tzinfo=timezone.utc),
            last_seen=datetime(2012, 4, 5, 3, 29, 45, tzinfo=timezone.utc),
        )
        Authenticator.objects.create(user=user, type=1)

        if is_admin:
            self.add_user_permission(user, "users.admin")
            (role, _) = UserRole.objects.get_or_create(name="test-admin-role")
            UserRoleUser.objects.create(user=user, role=role)

        return user

    def create_exhaustive_organization(
        self, slug: str, owner: User, invitee: User, other: list[User] | None = None
    ) -> Organization:
        org = self.create_organization(name=slug, owner=owner)
        owner_id: BoundedBigAutoField = owner.id
        invited = self.create_member(organization=org, user=invitee, role="member")
        if other:
            for o in other:
                self.create_member(organization=org, user=o, role="member")

        OrganizationOption.objects.create(
            organization=org, key="sentry:account-rate-limit", value=0
        )

        # Auth*
        ApiKey.objects.create(key=uuid4().hex, organization_id=org.id)
        auth_provider = AuthProvider.objects.create(organization_id=org.id, provider="sentry")
        AuthIdentity.objects.create(
            user=owner,
            auth_provider=auth_provider,
            ident=f"123456789{slug}",
            data={
                "key1": "value1",
                "key2": 42,
                "key3": [1, 2, 3],
                "key4": {"nested_key": "nested_value"},
            },
        )

        # Team
        team = self.create_team(name=f"test_team_in_{slug}", organization=org)
        self.create_team_membership(user=owner, team=team)
        OrganizationAccessRequest.objects.create(member=invited, team=team)

        # Project*
        project = self.create_project(name=f"project-{slug}", teams=[team])
        self.create_project_key(project)
        self.create_project_bookmark(project=project, user=owner)
        ProjectOwnership.objects.create(
            project=project, raw='{"hello":"hello"}', schema={"hello": "hello"}
        )
        ProjectRedirect.record(project, f"project_slug_in_{slug}")
        self.create_notification_action(organization=org, projects=[project])

        # OrgAuthToken
        OrgAuthToken.objects.create(
            organization_id=org.id,
            name=f"token 1 for {slug}",
            token_hashed=f"ABCDEF{slug}",
            token_last_characters="xyz1",
            scope_list=["org:ci"],
            date_last_used=None,
            project_last_used_id=project.id,
        )

        # Integration*
        integration = Integration.objects.create(
            provider="slack", name=f"Slack for {slug}", external_id=f"slack:{slug}"
        )
        OrganizationIntegration.objects.create(
            organization_id=org.id, integration=integration, config='{"hello":"hello"}'
        )
        # Note: this model is deprecated, and can safely be removed from this test when it is finally removed. Until then, it is included for completeness.
        ProjectIntegration.objects.create(
            project=project, integration_id=integration.id, config='{"hello":"hello"}'
        )

        # Rule*
        rule = self.create_project_rule(project=project)
        RuleActivity.objects.create(rule=rule, type=RuleActivityType.CREATED.value)
        self.snooze_rule(user_id=owner_id, owner_id=owner_id, rule=rule)
        NeglectedRule.objects.create(
            rule=rule,
            organization=org,
            disable_date=datetime.now(),
            sent_initial_email_date=datetime.now(),
            sent_final_email_date=datetime.now(),
        )
        CustomDynamicSamplingRule.update_or_create(
            condition={"op": "equals", "name": "environment", "value": "prod"},
            start=timezone.now(),
            end=timezone.now() + timedelta(hours=1),
            project_ids=[project.id],
            organization_id=org.id,
            num_samples=100,
            sample_rate=0.5,
        )

        # Environment*
        self.create_environment(project=project)

        # Monitor
        Monitor.objects.create(
            organization_id=project.organization.id,
            project_id=project.id,
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *", "schedule_type": ScheduleType.CRONTAB},
        )

        # AlertRule*
        other_project = self.create_project(name=f"other-project-{slug}", teams=[team])
        alert = self.create_alert_rule(
            organization=org,
            projects=[project],
            include_all_projects=True,
            excluded_projects=[other_project],
        )
        trigger = self.create_alert_rule_trigger(alert_rule=alert, excluded_projects=[project])
        self.create_alert_rule_trigger_action(alert_rule_trigger=trigger)

        # Incident*
        incident = self.create_incident(org, [project])
        IncidentActivity.objects.create(
            incident=incident,
            type=1,
            comment=f"hello {slug}",
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
        IncidentSubscription.objects.create(incident=incident, user_id=owner_id)
        IncidentTrigger.objects.create(
            incident=incident,
            alert_rule_trigger=trigger,
            status=1,
        )

        # *Snapshot
        PendingIncidentSnapshot.objects.create(
            incident=incident, target_run_date=datetime.utcnow() + timedelta(hours=4)
        )

        # Dashboard
        dashboard = Dashboard.objects.create(
            title=f"Dashboard 1 for {slug}", created_by_id=owner_id, organization=org
        )
        widget = DashboardWidget.objects.create(
            dashboard=dashboard,
            order=1,
            title=f"Test Widget for {slug}",
            display_type=0,
            widget_type=DashboardWidgetTypes.DISCOVER,
        )
        DashboardWidgetQuery.objects.create(widget=widget, order=1, name=f"Test Query for {slug}")
        DashboardTombstone.objects.create(organization=org, slug=f"test-tombstone-in-{slug}")

        # *Search
        RecentSearch.objects.create(
            organization=org,
            user_id=owner_id,
            type=SearchType.ISSUE.value,
            query=f"some query for {slug}",
        )
        SavedSearch.objects.create(
            organization=org,
            name=f"Saved query for {slug}",
            query=f"saved query for {slug}",
            visibility=Visibility.ORGANIZATION,
        )

        # misc
        Counter.increment(project, 1)
        self.create_repo(
            project=project,
            name="getsentry/getsentry",
            provider="integrations:github",
            integration_id=integration.id,
            url="https://github.com/getsentry/getsentry",
        )

        return org

    def create_exhaustive_sentry_app(self, name: str, owner: User, org: Organization) -> SentryApp:
        # SentryApp*
        app = self.create_sentry_app(name=name, organization=org)
        install = self.create_sentry_app_installation(slug=app.slug, organization=org, user=owner)
        updater = SentryAppUpdater(sentry_app=app)
        updater.schema = {"elements": [self.create_alert_rule_action_schema()]}
        updater.run(owner)

        # Api*
        ApiAuthorization.objects.create(application=app.application, user=owner)
        ApiToken.objects.create(
            application=app.application, user=owner, token=uuid4().hex, expires_at=None
        )
        ApiGrant.objects.create(
            user=owner,
            application=app.application,
            expires_at="2022-01-01 11:11",
            redirect_uri="https://example.com",
            scope_list=["openid", "profile", "email"],
        )

        # ServiceHook
        self.create_service_hook(
            application_id=app.application.id,
            actor_id=app.proxy_user.id,
            installation_id=install.id,
            org=org,
        )

        # NotificationAction
        project = Project.objects.filter(organization=org).first()
        self.create_notification_action(organization=org, sentry_app_id=app.id, projects=[project])

        return app

    def create_exhaustive_global_configs(self, owner: User):
        # *Options
        Option.objects.create(key="foo", value="a")
        ControlOption.objects.create(key="bar", value="b")

        # Relay*
        _, public_key = generate_key_pair()
        relay = str(uuid4())
        Relay.objects.create(relay_id=relay, public_key=str(public_key), is_internal=True)
        RelayUsage.objects.create(relay_id=relay, version="0.0.1", public_key=public_key)

        # Global Api*
        ApiAuthorization.objects.create(user=owner)
        ApiToken.objects.create(user=owner, token=uuid4().hex, expires_at=None)

    def create_exhaustive_instance(self, *, is_superadmin: bool = False):
        """
        Takes an empty Sentry instance's database, and populates it with an "exhaustive" version of every model. The end result is two users, in one organization, with one full set of extensions, and all global flags set.
        """

        owner = self.create_exhaustive_user(
            "owner", is_admin=is_superadmin, is_superuser=is_superadmin, is_staff=is_superadmin
        )
        invitee = self.create_exhaustive_user("invitee")
        org = self.create_exhaustive_organization("test-org", owner, invitee)
        self.create_exhaustive_sentry_app("test app", owner, org)
        self.create_exhaustive_global_configs(owner)

    def import_export_then_validate(self, out_name, *, reset_pks: bool = True) -> JSONData:
        return import_export_then_validate(out_name, reset_pks=reset_pks)
