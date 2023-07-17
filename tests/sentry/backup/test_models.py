from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Type
from uuid import uuid4

from click.testing import CliRunner
from django.core.management import call_command

from sentry.incidents.models import (
    AlertRule,
    AlertRuleActivity,
    AlertRuleExcludedProjects,
    AlertRuleTrigger,
    AlertRuleTriggerAction,
    AlertRuleTriggerExclusion,
)
from sentry.models import (
    Actor,
    ApiApplication,
    ApiAuthorization,
    ApiKey,
    ApiToken,
    Authenticator,
    AuthIdentity,
    AuthProvider,
)
from sentry.models.dashboard import Dashboard, DashboardTombstone
from sentry.models.dashboard_widget import (
    DashboardWidget,
    DashboardWidgetQuery,
    DashboardWidgetTypes,
)
from sentry.models.environment import Environment
from sentry.models.organization import Organization
from sentry.monitors.models import Monitor, MonitorEnvironment, MonitorType, ScheduleType
from sentry.runner.commands.backup import import_, validate
from sentry.silo import unguarded_write
from sentry.snuba.models import QuerySubscription, SnubaQuery, SnubaQueryEventType
from sentry.testutils import TransactionTestCase
from sentry.utils.json import JSONData
from tests.sentry.backup import ValidationError, tmp_export_to_file


def targets_models(*expected_models: Type):
    """A helper decorator that checks that every model that a test "targeted" was actually seen in
    the output, ensuring that we're actually testing the thing we think we are. Additionally, this
    decorator is easily legible to static analysis, which allows for static checks to ensure that
    all `__include_in_export__ = True` models are being tested."""

    def decorator(func):
        def wrapped(*args, **kwargs):
            ret = func(*args, **kwargs)
            if ret is None:
                return AssertionError(f"The test {func.__name__} did not return its actual JSON")
            actual_model_names = {entry["model"] for entry in ret}
            expected_model_names = {"sentry." + model.__name__.lower() for model in expected_models}
            notfound = sorted(expected_model_names - actual_model_names)
            if len(notfound) > 0:
                raise AssertionError(f"Some `@targets_models` entries were not used: {notfound}")
            return ret

        return wrapped

    return decorator


class ModelBackupTests(TransactionTestCase):
    """Test the JSON-ification of models marked `__include_in_export__ = True`. Each test here
    creates a fresh database, performs some writes to it, then exports that data into a temporary
    file (called the "expected" JSON). It then imports the "expected" JSON and re-exports it into
    the "actual" JSON file, and diffs the two to ensure that they match per the specified
    comparators."""

    def setUp(self):
        with unguarded_write():
            # Reset the Django database.
            call_command("flush", verbosity=0, interactive=False)

    def import_export_then_validate(self) -> JSONData:
        """Test helper that validates that data imported from a temporary `.json` file correctly
        matches the actual outputted export data.

        Return the actual JSON, so that we may use the `@targets_models` decorator to ensure that
        we have at least one instance of all the "tested for" models in the actual output."""

        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_expect = Path(tmpdir).joinpath(f"{self._testMethodName}.expect.json")
            tmp_actual = Path(tmpdir).joinpath(f"{self._testMethodName}.actual.json")

            # Export the current state of the database into the "expected" temporary file, then
            # parse it into a JSON object for comparison.
            expect = tmp_export_to_file(tmp_expect)

            # Write the contents of the "expected" JSON file into the now clean database.
            with unguarded_write():
                # Reset the Django database.
                call_command("flush", verbosity=0, interactive=False)

                rv = CliRunner().invoke(import_, [str(tmp_expect)])
                assert rv.exit_code == 0, rv.output

            # Validate that the "expected" and "actual" JSON matches.
            actual = tmp_export_to_file(tmp_actual)
            res = validate(expect, actual)
            if res.findings:
                raise ValidationError(res)

        return actual

    def create_dashboard(self):
        """Re-usable dashboard object for test cases."""

        user = self.create_user()
        org = self.create_organization(owner=user)
        return Dashboard.objects.create(
            title="Dashboard 1", created_by_id=user.id, organization=org
        )

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

    @targets_models(AlertRule, QuerySubscription, SnubaQuery, SnubaQueryEventType)
    def test_alert_rule(self):
        self.create_alert_rule()
        return self.import_export_then_validate()

    @targets_models(AlertRuleActivity, AlertRuleExcludedProjects)
    def test_alert_rule_excluded_projects(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        excluded = self.create_project(organization=org)
        self.create_alert_rule(include_all_projects=True, excluded_projects=[excluded])
        return self.import_export_then_validate()

    @targets_models(AlertRuleTrigger, AlertRuleTriggerAction, AlertRuleTriggerExclusion)
    def test_alert_rule_trigger(self):
        excluded = self.create_project()
        rule = self.create_alert_rule(include_all_projects=True)
        trigger = self.create_alert_rule_trigger(alert_rule=rule, excluded_projects=[excluded])
        self.create_alert_rule_trigger_action(alert_rule_trigger=trigger)
        return self.import_export_then_validate()

    @targets_models(Dashboard)
    def test_dashboard(self):
        self.create_dashboard()
        return self.import_export_then_validate()

    @targets_models(DashboardTombstone)
    def test_dashboard_tombstone(self):
        DashboardTombstone.objects.create(organization=self.organization, slug="test-tombstone")
        return self.import_export_then_validate()

    @targets_models(DashboardWidget, DashboardWidgetQuery)
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

    @targets_models(Environment)
    def test_environment(self):
        self.create_environment()
        return self.import_export_then_validate()

    @targets_models(Monitor)
    def test_monitor(self):
        self.create_monitor()
        return self.import_export_then_validate()

    @targets_models(MonitorEnvironment)
    def test_monitor_environment(self):
        monitor = self.create_monitor()
        env = Environment.objects.create(organization_id=monitor.organization_id, name="test_env")
        MonitorEnvironment.objects.create(
            monitor=monitor,
            environment=env,
        )
        return self.import_export_then_validate()

    @targets_models(Organization)
    def test_organization(self):
        user = self.create_user()
        self.create_organization(owner=user)
        return self.import_export_then_validate()

    @targets_models(Actor)
    def test_actor(self):
        self.create_user(email="test@example.com")
        self.create_team(name="pre save team", organization=self.organization)
        return self.import_export_then_validate()

    @targets_models(ApiAuthorization)
    def test_apiAuthorization(self):
        user = self.create_user()
        app = ApiApplication.objects.create(name="test", owner=user)
        ApiAuthorization.objects.create(
            application=app, user=self.create_user("example@example.com")
        )
        return self.import_export_then_validate()

    @targets_models(ApiApplication)
    def test_apiApplication(self):
        user = self.create_user()
        ApiApplication.objects.create(
            owner=user, redirect_uris="http://example.com\nhttp://sub.example.com/path"
        )
        return self.import_export_then_validate()

    @targets_models(ApiToken, ApiApplication)
    def test_apitoken(self):
        user = self.create_user()
        app = ApiApplication.objects.create(
            owner=user, redirect_uris="http://example.com\nhttp://sub.example.com/path"
        )
        ApiToken.objects.create(
            application=app, user=user, token=uuid4().hex + uuid4().hex, expires_at=None
        )
        return self.import_export_then_validate()

    @targets_models(ApiKey)
    def test_apikey(self):
        user = self.create_user()
        self.create_organization(owner=user)
        ApiKey.objects.create(key=uuid4().hex, organization_id=1)
        return self.import_export_then_validate()

    @targets_models(Authenticator)
    def test_authenticator(self):
        user = self.create_user()
        Authenticator.objects.create(id=1, user=user, type=1)
        return self.import_export_then_validate()

    @targets_models(AuthIdentity, AuthProvider)
    def test_authIdentity(self):
        user = self.create_user()
        test_data = {
            "key1": "value1",
            "key2": 42,
            "key3": [1, 2, 3],
            "key4": {"nested_key": "nested_value"},
        }
        AuthIdentity.objects.create(
            user=user,
            auth_provider=AuthProvider.objects.create(organization_id=1, provider="sentry"),
            ident="123456789",
            data=test_data,
        )
        return self.import_export_then_validate()

    @targets_models(AuthProvider)
    def test_authProvider(self):
        AuthProvider.objects.create(organization_id=1, provider="sentry")
        return self.import_export_then_validate()
