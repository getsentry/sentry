from __future__ import annotations

import tempfile
from datetime import datetime, timedelta
from pathlib import Path
from typing import Type

from click.testing import CliRunner
from django.core.management import call_command

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
    TimeSeriesSnapshot,
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

    @targets_models(Incident, Organization, AlertRule)
    def test_incident(self):
        self.create_incident()
        return self.import_export_then_validate()

    @targets_models(Incident, IncidentActivity)
    def test_incidentActivity(self):
        IncidentActivity.objects.create(
            incident=self.create_incident(),
            type=1,
            comment="hello",
        )
        return self.import_export_then_validate()

    @targets_models(IncidentSnapshot, Incident, TimeSeriesSnapshot)
    def test_incidentSnapshot(self):
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

    @targets_models(IncidentSubscription, Incident)
    def test_incidentSubscription(self):
        user_id = self.create_user().id
        IncidentSubscription.objects.create(incident=self.create_incident(), user_id=user_id)
        return self.import_export_then_validate()

    @targets_models(
        IncidentTrigger, AlertRuleTrigger, AlertRuleTriggerAction, AlertRuleTriggerExclusion
    )
    def test_incidentTrigger(self):
        excluded = self.create_project()
        rule = self.create_alert_rule(include_all_projects=True)
        trigger = self.create_alert_rule_trigger(alert_rule=rule, excluded_projects=[excluded])
        self.create_alert_rule_trigger_action(alert_rule_trigger=trigger)
        IncidentTrigger.objects.create(
            incident=self.create_incident(), alert_rule_trigger=trigger, status=1
        )
        return self.import_export_then_validate()
