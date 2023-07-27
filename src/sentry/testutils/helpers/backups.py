from __future__ import annotations

import tempfile
from datetime import datetime, timedelta
from pathlib import Path
from typing import Type
from uuid import uuid4

from click.testing import CliRunner
from django.core.management import call_command
from django.utils import timezone
from sentry_relay.auth import generate_key_pair

from sentry.incidents.models import (
    IncidentActivity,
    IncidentSnapshot,
    IncidentSubscription,
    IncidentTrigger,
    PendingIncidentSnapshot,
    TimeSeriesSnapshot,
)
from sentry.models.actor import ACTOR_TYPES, Actor
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
from sentry.models.environment import EnvironmentProject
from sentry.models.options.option import ControlOption, Option
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.options.user_option import UserOption
from sentry.models.organizationaccessrequest import OrganizationAccessRequest
from sentry.models.orgauthtoken import OrgAuthToken
from sentry.models.projectownership import ProjectOwnership
from sentry.models.projectredirect import ProjectRedirect
from sentry.models.recentsearch import RecentSearch
from sentry.models.relay import Relay, RelayUsage
from sentry.models.repository import Repository
from sentry.models.rule import RuleActivity, RuleActivityType
from sentry.models.savedsearch import SavedSearch, Visibility
from sentry.models.search_common import SearchType
from sentry.models.servicehook import ServiceHook
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
from sentry.runner.commands.backup import (
    ComparatorFindings,
    ComparatorMap,
    export,
    import_,
    validate,
)
from sentry.sentry_apps.apps import SentryAppUpdater
from sentry.silo import unguarded_write
from sentry.testutils import TransactionTestCase
from sentry.testutils.factories import get_fixture_path
from sentry.utils import json
from sentry.utils.json import JSONData

__all__ = [
    "ValidationError",
    "export_to_file",
    "get_final_derivations_of",
    "get_exportable_final_derivations_of",
    "import_export_then_validate",
    "import_export_from_fixture_then_validate",
]


class ValidationError(Exception):
    def __init__(self, info: ComparatorFindings):
        super().__init__(info.pretty())
        self.info = info


def export_to_file(path: Path) -> JSONData:
    """Helper function that exports the current state of the database to the specified file."""

    json_file_path = str(path)
    rv = CliRunner().invoke(
        export, [json_file_path], obj={"silent": True, "indent": 2, "exclude": None}
    )
    assert rv.exit_code == 0, rv.output

    with open(json_file_path) as tmp_file:
        # print("\n\n\nOUT: \n\n\n" + tmp_file.read())
        output = json.load(tmp_file)
    return output


def get_final_derivations_of(model: Type):
    """A "final" derivation of the given `model` base class is any non-abstract class for the
    "sentry" app with `BaseModel` as an ancestor. Top-level calls to this class should pass in
    `BaseModel` as the argument."""

    out = set()
    for sub in model.__subclasses__():
        subs = sub.__subclasses__()
        if subs:
            out.update(get_final_derivations_of(sub))
        if not sub._meta.abstract and sub._meta.db_table and sub._meta.app_label == "sentry":
            out.add(sub)
    return out


def get_exportable_final_derivations_of(model: Type):
    """Like `get_final_derivations_of`, except that it further filters the results to include only
    `__include_in_export__ = True`."""

    return set(
        filter(
            lambda c: getattr(c, "__include_in_export__") is True,
            get_final_derivations_of(model),
        )
    )


def import_export_then_validate(method_name: str) -> JSONData:
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
            # Reset the Django database.
            call_command("flush", verbosity=0, interactive=False)

            rv = CliRunner().invoke(import_, [str(tmp_expect)])
            assert rv.exit_code == 0, rv.output

        # Validate that the "expected" and "actual" JSON matches.
        actual = export_to_file(tmp_actual)
        res = validate(expect, actual)
        if res.findings:
            raise ValidationError(res)

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
    with unguarded_write(using="default"):
        rv = CliRunner().invoke(import_, [str(fixture_file_path)])
        assert rv.exit_code == 0, rv.output

    actual = export_to_file(tmp_path.joinpath("tmp_test_file.json"))
    res = validate(expect, actual, map)
    if res.findings:
        raise ValidationError(res)

    return actual


class ReleaseFixtureGenerator(TransactionTestCase):
    """Creates a fixture JSON file that includes a fully populated version of every exportable model
    in the repository."""

    def __call__(self, out_name):
        # User*
        user = self.create_user("user@example.com")
        self.add_user_permission(user, "users.admin")
        role = UserRole.objects.create(name="test-role")
        UserRoleUser.objects.create(user=user, role=role)
        UserOption.objects.create(user=user, key="timezone", value="Europe/Vienna")
        UserIP.objects.create(
            user=user,
            ip_address="127.0.0.2",
            first_seen=datetime(2012, 4, 5, 3, 29, 45, tzinfo=timezone.utc),
            last_seen=datetime(2012, 4, 5, 3, 29, 45, tzinfo=timezone.utc),
        )

        # Organization*
        org = self.create_organization(name="test_org", owner=user)
        member = self.create_member(organization=org, user=self.user, role="member")
        OrganizationOption.objects.create(
            organization=org, key="sentry:account-rate-limit", value=0
        )
        OrgAuthToken.objects.create(
            organization_id=org.id,
            name="token 1",
            token_hashed="ABCDEF",
            token_last_characters="xyz1",
            scope_list=["org:ci"],
            date_last_used=None,
        )

        # SentryApp*
        app = self.create_sentry_app(name="test_app", organization=org)
        install = self.create_sentry_app_installation(slug=app.slug, organization=org, user=user)
        updater = SentryAppUpdater(sentry_app=app)
        updater.schema = {"elements": [self.create_alert_rule_action_schema()]}
        updater.run(user)

        # Api*
        api_app = ApiApplication.objects.create(
            name="test", owner=user, redirect_uris="http://example.com\nhttp://sub.example.com/path"
        )
        ApiAuthorization.objects.create(application=api_app, user=user)
        ApiToken.objects.create(application=api_app, user=user, token=uuid4().hex, expires_at=None)
        ApiKey.objects.create(key=uuid4().hex, organization_id=org.id)

        # Auth*
        Authenticator.objects.create(user=user, type=1)
        AuthIdentity.objects.create(
            user=user,
            auth_provider=AuthProvider.objects.create(organization_id=1, provider="sentry"),
            ident="123456789",
            data={
                "key1": "value1",
                "key2": 42,
                "key3": [1, 2, 3],
                "key4": {"nested_key": "nested_value"},
            },
        )

        # *Options
        Option.objects.create(key="foo", value="a")
        ControlOption.objects.create(key="bar", value="b")

        # Team
        team = self.create_team(name="test_team", organization=org)
        self.create_team_membership(user=user, team=team)
        OrganizationAccessRequest.objects.create(member=member, team=team)
        actor = Actor.objects.create(type=ACTOR_TYPES["team"])

        # Project*
        project = self.create_project()
        self.create_project_key(project)
        self.create_project_bookmark(project=project, user=user)
        project = self.create_project()
        ProjectOwnership.objects.create(
            project=project, raw='{"hello":"hello"}', schema={"hello": "hello"}
        )
        ProjectRedirect.record(project, "old_slug")

        # ServiceHook
        ServiceHook.objects.create(
            application_id=app.id,
            actor_id=actor.id,
            project_id=project.id,
            organization_id=org.id,
            events=[],
            installation_id=install.id,
            url="https://example.com",
        )

        # Rule*
        rule = self.create_project_rule(project=project)
        RuleActivity.objects.create(rule=rule, type=RuleActivityType.CREATED.value)
        self.snooze_rule(user_id=user.id, owner_id=user.id, rule=rule)

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
        location = MonitorLocation.objects.create(guid=uuid4(), name="test_location")
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
        IncidentSubscription.objects.create(incident=incident, user_id=user.id)
        IncidentTrigger.objects.create(
            incident=incident,
            alert_rule_trigger=trigger,
            status=1,
        )

        # *Snapshot
        PendingIncidentSnapshot.objects.create(
            incident=incident, target_run_date=datetime.utcnow() + timedelta(hours=4)
        )
        TimeSeriesSnapshot.objects.create(
            start=datetime.utcnow() - timedelta(hours=24),
            end=datetime.utcnow(),
            values=[[1.0, 2.0, 3.0], [1.5, 2.5, 3.5]],
            period=1,
        )

        # Relay*
        _, public_key = generate_key_pair()
        relay = str(uuid4())
        Relay.objects.create(relay_id=relay, public_key=str(public_key), is_internal=True)
        RelayUsage.objects.create(relay_id=relay, version="0.0.1", public_key=public_key)

        # Dashboard
        dashboard = Dashboard.objects.create(
            title="Dashboard 1", created_by_id=user.id, organization=org
        )
        widget = DashboardWidget.objects.create(
            dashboard=dashboard,
            order=1,
            title="Test Widget",
            display_type=0,
            widget_type=DashboardWidgetTypes.DISCOVER,
        )
        DashboardWidgetQuery.objects.create(widget=widget, order=1, name="Test Query")
        DashboardTombstone.objects.create(organization=org, slug="test-tombstone")

        # *Search
        RecentSearch.objects.create(
            organization=org,
            user_id=user.id,
            type=SearchType.ISSUE.value,
            query="some query",
        )
        SavedSearch.objects.create(
            organization=org,
            name="Saved query",
            query="saved query",
            visibility=Visibility.ORGANIZATION,
        )

        # misc
        Counter.increment(project, 1)
        Email.objects.create(email="other@example.com")
        self.create_notification_action(organization=org, projects=[project])
        Repository.objects.create(
            name="test_repo",
            organization_id=org.id,
            integration_id=self.integration.id,
        )

        return import_export_then_validate(out_name)
