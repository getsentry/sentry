from __future__ import annotations

import tempfile
from datetime import datetime, timedelta
from functools import lru_cache
from pathlib import Path
from uuid import uuid4

from django.apps import apps
from django.core.management import call_command
from django.db import connections, router, transaction
from django.utils import timezone
from sentry_relay.auth import generate_key_pair

from sentry.backup.comparators import ComparatorMap
from sentry.backup.dependencies import sorted_dependencies
from sentry.backup.exports import OldExportConfig, exports
from sentry.backup.findings import ComparatorFindings
from sentry.backup.imports import OldImportConfig, imports
from sentry.backup.validate import validate
from sentry.incidents.models import (
    IncidentActivity,
    IncidentSnapshot,
    IncidentSubscription,
    IncidentTrigger,
    PendingIncidentSnapshot,
    TimeSeriesSnapshot,
)
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
from sentry.models.environment import EnvironmentProject
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
from sentry.models.repository import Repository
from sentry.models.rule import RuleActivity, RuleActivityType
from sentry.models.savedsearch import SavedSearch, Visibility
from sentry.models.search_common import SearchType
from sentry.models.user import User
from sentry.models.userip import UserIP
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


def export_to_file(path: Path) -> JSONData:
    """Helper function that exports the current state of the database to the specified file."""

    json_file_path = str(path)
    with open(json_file_path, "w+") as tmp_file:
        exports(tmp_file, OldExportConfig(), 2, NOOP_PRINTER)

    with open(json_file_path) as tmp_file:
        output = json.load(tmp_file)
    return output


# No arguments, so we lazily cache the result after the first calculation.
@lru_cache(maxsize=1)
def reversed_dependencies():
    sorted = list(sorted_dependencies())
    sorted.reverse()
    return sorted


def clear_database_but_keep_sequences():
    """Deletes all models we care about from the database, in a sequence that ensures we get no
    foreign key errors."""

    with unguarded_write(using="default"), transaction.atomic(using="default"):
        reversed = reversed_dependencies()
        for model in reversed:
            # For some reason, the tables for `SentryApp*` models don't get deleted properly here
            # when using `model.objects.all().delete()`, so we have to call out to Postgres
            # manually.
            connection = connections[router.db_for_write(SentryApp)]
            with connection.cursor() as cursor:
                table = model._meta.db_table
                cursor.execute(f"DELETE FROM {table:s};")

        # Clear remaining tables that are not explicitly in Sentry's own model dependency graph.
        for model in set(apps.get_models()) - set(reversed):
            model.objects.all().delete()


def import_export_then_validate(method_name: str, *, reset_pks: bool = True) -> JSONData:
    """Test helper that validates that dat imported from an export of the current state of the test
    database correctly matches the actual outputted export data."""

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_expect = Path(tmpdir).joinpath(f"{method_name}.expect.json")
        tmp_actual = Path(tmpdir).joinpath(f"{method_name}.actual.json")

        # Export the current state of the database into the "expected" temporary file, then
        # parse it into a JSON object for comparison.
        expect = export_to_file(tmp_expect)

        # Write the contents of the "expected" JSON file into the now clean database.
        # TODO(Hybrid-Cloud): Review whether this is the correct route to apply in this case.
        with unguarded_write(using="default"):
            if reset_pks:
                call_command("flush", verbosity=0, interactive=False)
            else:
                clear_database_but_keep_sequences()

            with open(tmp_expect) as tmp_file:
                imports(tmp_file, OldImportConfig(), NOOP_PRINTER)

        # Validate that the "expected" and "actual" JSON matches.
        actual = export_to_file(tmp_actual)
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

    # TODO(Hybrid-Cloud): Review whether this is the correct route to apply in this case.
    with unguarded_write(using="default"), open(fixture_file_path) as fixture_file:
        imports(fixture_file, OldImportConfig(), NOOP_PRINTER)

    res = validate(expect, export_to_file(tmp_path.joinpath("tmp_test_file.json")), map)
    if res.findings:
        raise ValidationError(res)


class BackupTestCase(TransactionTestCase):
    """Instruments a database state that includes an instance of every Sentry model with every field
    set to a non-default, non-null value. This is useful for exhaustive conformance testing."""

    def create_exhaustive_user(
        self,
        username: str,
        *,
        is_admin: bool = False,
        is_staff: bool = False,
        is_superuser: bool = False,
    ) -> User:
        user = self.create_user(username, is_staff=is_staff, is_superuser=is_superuser)
        UserOption.objects.create(user=user, key="timezone", value="Europe/Vienna")
        UserIP.objects.create(
            user=user,
            ip_address="127.0.0.2",
            first_seen=datetime(2012, 4, 5, 3, 29, 45, tzinfo=timezone.utc),
            last_seen=datetime(2012, 4, 5, 3, 29, 45, tzinfo=timezone.utc),
        )

        if is_admin:
            self.add_user_permission(user, "users.admin")
            role = UserRole.objects.create(name="test-admin-role")
            UserRoleUser.objects.create(user=user, role=role)

        return user

    def create_exhaustive_organization(self, slug: str, owner: User, invitee: User) -> Organization:
        org = self.create_organization(name=f"test_org_for_{slug}", owner=owner)
        membership = self.create_member(organization=org, user=invitee, role="member")

        OrganizationOption.objects.create(
            organization=org, key="sentry:account-rate-limit", value=0
        )

        # Auth*
        OrgAuthToken.objects.create(
            organization_id=org.id,
            name=f"token 1 for {slug}",
            token_hashed=f"ABCDEF{slug}",
            token_last_characters="xyz1",
            scope_list=["org:ci"],
            date_last_used=None,
        )
        ApiKey.objects.create(key=uuid4().hex, organization_id=org.id)
        auth_provider = AuthProvider.objects.create(organization_id=org.id, provider="sentry")
        Authenticator.objects.create(user=owner, type=1)
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

        # Project*
        project = self.create_project()
        self.create_project_key(project)
        self.create_project_bookmark(project=project, user=owner)
        project = self.create_project()
        ProjectOwnership.objects.create(
            project=project, raw='{"hello":"hello"}', schema={"hello": "hello"}
        )
        ProjectRedirect.record(project, f"project_slug_in_{slug}")

        # Team
        team = self.create_team(name=f"test_team_in_{slug}", organization=org)
        self.create_team_membership(user=owner, team=team)
        OrganizationAccessRequest.objects.create(member=membership, team=team)

        # Rule*
        rule = self.create_project_rule(project=project)
        RuleActivity.objects.create(rule=rule, type=RuleActivityType.CREATED.value)
        self.snooze_rule(user_id=owner.id, owner_id=owner.id, rule=rule)

        # Environment*
        env = self.create_environment()
        EnvironmentProject.objects.create(project=project, environment=env, is_hidden=False)

        # Monitor*
        monitor = Monitor.objects.create(
            organization_id=project.organization.id,
            project_id=project.id,
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *", "schedule_type": ScheduleType.CRONTAB},
        )
        mon_env = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment=env,
        )
        location = MonitorLocation.objects.create(guid=uuid4(), name=f"test_location_in_{slug}")
        MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=mon_env,
            location=location,
            project_id=monitor.project_id,
            status=CheckInStatus.IN_PROGRESS,
        )

        # AlertRule*
        alert = self.create_alert_rule(include_all_projects=True, excluded_projects=[project])
        trigger = self.create_alert_rule_trigger(alert_rule=alert, excluded_projects=[self.project])
        self.create_alert_rule_trigger_action(alert_rule_trigger=trigger)

        # Incident*
        incident = self.create_incident()
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
        IncidentSubscription.objects.create(incident=incident, user_id=owner.id)
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
            title=f"Dashboard 1 for {slug}", created_by_id=owner.id, organization=org
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
            user_id=owner.id,
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
        Repository.objects.create(
            name=f"test_repo_for_{slug}",
            organization_id=org.id,
            # TODO(getsentry/issue#187): Re-activate once we add `Integration` model to exports.
            # integration_id=self.integration.id,
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

    def create_exhaustive_globals(self):
        # *Options
        Option.objects.create(key="foo", value="a")
        ControlOption.objects.create(key="bar", value="b")

        # Relay*
        _, public_key = generate_key_pair()
        relay = str(uuid4())
        Relay.objects.create(relay_id=relay, public_key=str(public_key), is_internal=True)
        RelayUsage.objects.create(relay_id=relay, version="0.0.1", public_key=public_key)

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
        self.create_exhaustive_globals()

    def import_export_then_validate(self, out_name, *, reset_pks: bool = True) -> JSONData:
        return import_export_then_validate(out_name, reset_pks=reset_pks)
