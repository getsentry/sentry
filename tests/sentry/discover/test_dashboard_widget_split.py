from datetime import datetime, timezone

import pytest

from sentry.discover.dashboard_widget_split import (
    _get_and_save_split_decision_for_dashboard_widget,
    _get_snuba_dataclass_for_dashboard_widget,
)
from sentry.models.dashboard import Dashboard
from sentry.models.dashboard_widget import (
    DashboardWidget,
    DashboardWidgetDisplayTypes,
    DashboardWidgetQuery,
    DashboardWidgetTypes,
)
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time, iso_format
from sentry.testutils.silo import assume_test_silo_mode_of
from sentry.users.models.user import User
from sentry.utils.samples import load_data

pytestmark = pytest.mark.sentry_metrics


class DashboardWidgetDatasetSplitTestCase(TestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.org = self.create_organization()
        with assume_test_silo_mode_of(User):
            self.user = User.objects.create(email="test@sentry.io")
        self.project_2 = self.create_project(organization=self.org)
        self.project_3 = self.create_project(organization=self.org)
        self.project_ids = [
            self.project.id,
            self.project_2.id,
            self.project_3.id,
        ]
        self.projects = [
            self.project,
            self.project_2,
            self.project_3,
        ]
        self.query = {"fields": ["test"], "conditions": [], "limit": 10}

        self.nine_mins_ago = before_now(minutes=9)
        self.ten_mins_ago = before_now(minutes=10)
        self.ten_mins_ago_iso = iso_format(self.ten_mins_ago)
        self.dry_run = False

        self.dashboard = Dashboard.objects.create(
            title="Dashboard With Split Widgets",
            created_by_id=self.user.id,
            organization=self.organization,
        )
        self.dashboard.projects.set([self.project, self.project_2])

    def test_errors_widget(self):
        error_widget = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            order=0,
            title="error widget",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.DISCOVER,
            interval="1d",
            detail={"layout": {"x": 0, "y": 0, "w": 1, "h": 1, "minH": 2}},
        )
        errors_widget_query = DashboardWidgetQuery.objects.create(
            widget=error_widget,
            fields=["title", "issue", "project", "release", "count()", "count_unique(user)"],
            columns=[],
            aggregates=["count_unique(user)"],
            conditions="stack.filename:'../../sentry/scripts/views.js'",
            order=0,
        )

        _get_and_save_split_decision_for_dashboard_widget(errors_widget_query, self.dry_run)
        error_widget.refresh_from_db()
        assert (
            error_widget.discover_widget_split is None
            if self.dry_run
            else error_widget.discover_widget_split == 100
        )

    def test_metrics_compatible_query(self):
        metrics_widget = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            order=0,
            title="widget",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.DISCOVER,
            interval="1d",
            detail={"layout": {"x": 0, "y": 0, "w": 1, "h": 1, "minH": 2}},
        )
        metrics_query = DashboardWidgetQuery.objects.create(
            widget=metrics_widget,
            fields=["transaction", "count()"],
            columns=[],
            aggregates=[],
            conditions="transaction:'/sentry/scripts/views.js'",
            order=0,
        )

        with self.feature({"organizations:dynamic-sampling": True}):
            _, queried_snuba = _get_and_save_split_decision_for_dashboard_widget(
                metrics_query, self.dry_run
            )
        metrics_widget.refresh_from_db()
        assert (
            metrics_widget.discover_widget_split is None
            if self.dry_run
            else metrics_widget.discover_widget_split == 101
        )
        assert queried_snuba

    def test_metrics_query_with_no_dynamic_sampling(self):
        metrics_widget = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            order=0,
            title="widget",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.DISCOVER,
            interval="1d",
            detail={"layout": {"x": 0, "y": 0, "w": 1, "h": 1, "minH": 2}},
        )
        metrics_query = DashboardWidgetQuery.objects.create(
            widget=metrics_widget,
            fields=["transaction", "count()"],
            columns=[],
            aggregates=[],
            conditions="transaction:'/sentry/scripts/views.js'",
            order=0,
        )

        with self.feature({"organizations:dynamic-sampling": False}):
            _, queried_snuba = _get_and_save_split_decision_for_dashboard_widget(
                metrics_query, self.dry_run
            )
        metrics_widget.refresh_from_db()
        assert (
            metrics_widget.discover_widget_split is None
            if self.dry_run
            else metrics_widget.discover_widget_split == 100
        )
        assert queried_snuba

    def test_ambiguous_widget_with_error_data(self):
        data = load_data("javascript", timestamp=self.ten_mins_ago)
        data["transaction"] = "/to_other/"
        self.store_event(data, project_id=self.project.id, assert_no_errors=False)

        data = load_data("javascript", timestamp=self.ten_mins_ago)
        data["transaction"] = "/to_other/2"
        self.store_event(data, project_id=self.project.id, assert_no_errors=False)

        error_widget = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            order=0,
            title="error widget",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.DISCOVER,
            interval="1d",
            detail={"layout": {"x": 0, "y": 0, "w": 1, "h": 1, "minH": 2}},
        )
        errors_widget_query = DashboardWidgetQuery.objects.create(
            widget=error_widget,
            fields=["title", "org_slug", "project", "release", "count()", "count_unique(user)"],
            columns=[],
            aggregates=["count_unique(user)"],
            conditions="",
            order=0,
        )

        _, queried_snuba = _get_and_save_split_decision_for_dashboard_widget(
            errors_widget_query, self.dry_run
        )
        error_widget.refresh_from_db()
        assert (
            error_widget.discover_widget_split is None
            if self.dry_run
            else error_widget.discover_widget_split == 100
        )
        assert queried_snuba

    def test_ambiguous_widget_with_transactions_data(self):
        data = load_data("transaction", timestamp=self.ten_mins_ago)
        data["transaction"] = "/to_other/"
        self.store_event(data, project_id=self.project.id, assert_no_errors=False)

        data = load_data("transaction", timestamp=self.ten_mins_ago)
        data["transaction"] = "/to_other/2"
        self.store_event(data, project_id=self.project.id, assert_no_errors=False)

        error_widget = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            order=0,
            title="error widget",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.DISCOVER,
            interval="1d",
            detail={"layout": {"x": 0, "y": 0, "w": 1, "h": 1, "minH": 2}},
        )
        errors_widget_query = DashboardWidgetQuery.objects.create(
            widget=error_widget,
            fields=["title", "org_slug", "project", "release", "count()", "count_unique(user)"],
            columns=[],
            aggregates=["count_unique(user)"],
            conditions="",
            order=0,
        )

        _, queried_snuba = _get_and_save_split_decision_for_dashboard_widget(
            errors_widget_query, self.dry_run
        )
        error_widget.refresh_from_db()
        assert (
            error_widget.discover_widget_split is None
            if self.dry_run
            else error_widget.discover_widget_split == 101
        )
        assert queried_snuba

    @freeze_time("2024-05-01 12:00:00")
    def test_out_of_range_defaults_to_seven_days(self):
        dashboard = Dashboard.objects.create(
            title="test 2",
            created_by_id=self.user.id,
            organization=self.organization,
            filters={"start": "2024-01-01T10:00:00", "end": "2024-01-02T10:00:00"},
        )
        dashboard.projects.set([self.project, self.project_2])
        error_widget = DashboardWidget.objects.create(
            dashboard=dashboard,
            order=0,
            title="error widget",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.DISCOVER,
            interval="1d",
            detail={"layout": {"x": 0, "y": 0, "w": 1, "h": 1, "minH": 2}},
        )

        with self.options({"system.event-retention-days": 90}):
            snuba_dataclass = _get_snuba_dataclass_for_dashboard_widget(error_widget, self.projects)

        assert snuba_dataclass.start == datetime(2024, 4, 24, 12, 0, tzinfo=timezone.utc)
        assert snuba_dataclass.end == datetime(2024, 5, 1, 12, 0, tzinfo=timezone.utc)

    @freeze_time("2024-05-01 12:00:00")
    def test_respects_range_date_and_environment_params(self):
        environment = self.environment
        dashboard = Dashboard.objects.create(
            title="test 3",
            created_by_id=self.user.id,
            organization=self.organization,
            filters={"period": "1h", "environment": [environment.name]},
        )
        dashboard.projects.set([self.project, self.project_2])
        error_widget = DashboardWidget.objects.create(
            dashboard=dashboard,
            order=0,
            title="error widget",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.DISCOVER,
            interval="1d",
            detail={"layout": {"x": 0, "y": 0, "w": 1, "h": 1, "minH": 2}},
        )

        snuba_dataclass = _get_snuba_dataclass_for_dashboard_widget(error_widget, self.projects)

        assert snuba_dataclass.start == datetime(2024, 5, 1, 11, 0, tzinfo=timezone.utc)
        assert snuba_dataclass.end == datetime(2024, 5, 1, 12, 0, tzinfo=timezone.utc)
        assert snuba_dataclass.environments == [environment]


class DashboardWidgetDatasetSplitDryRunTestCase(DashboardWidgetDatasetSplitTestCase):
    def setUp(self):
        super().setUp()
        self.dry_run = True
