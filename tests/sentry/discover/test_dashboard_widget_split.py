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
from sentry.models.dashboard_widget import DatasetSourcesTypes as DashboardDatasetSourcesTypes
from sentry.snuba.metrics.naming_layer.mri import TransactionMRI
from sentry.testutils.cases import BaseMetricsLayerTestCase, SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.silo import assume_test_silo_mode_of
from sentry.users.models.user import User
from sentry.utils.samples import load_data

pytestmark = pytest.mark.sentry_metrics


class DashboardWidgetDatasetSplitTestCase(BaseMetricsLayerTestCase, TestCase, SnubaTestCase):
    @property
    def now(self):
        return before_now(minutes=10)

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
            conditions="",
            order=0,
        )

        self.store_performance_metric(
            name=TransactionMRI.DURATION.value,
            project_id=self.project.id,
            tags={"transaction": "/sentry/scripts/views.js"},
            value=30,
            org_id=self.dashboard.organization.id,
            hours_before_now=2,
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

    def test_metrics_compatible_query_no_data(self):
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
            else metrics_widget.discover_widget_split == 100
        )
        assert queried_snuba

    def test_metrics_compatible_query_no_data_only_aggregates(self):
        metrics_widget = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            order=0,
            title="widget",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.DISCOVER,
            interval="1d",
            detail={"layout": {"x": 0, "y": 0, "w": 1, "h": 1, "minH": 2}},
        )

        # When only aggregates are requested, the response has a row but it's
        # completely empty.
        metrics_query = DashboardWidgetQuery.objects.create(
            widget=metrics_widget,
            fields=["count()", "count_unique(user)"],
            columns=[],
            aggregates=[],
            conditions=f"project:[{self.project_2.slug}]",
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
            else metrics_widget.discover_widget_split == 100
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

    def test_alias_with_user_misery_widget(self):
        data = load_data("transaction", timestamp=self.ten_mins_ago)
        data["transaction"] = "/to_other/"
        self.store_event(data, project_id=self.project.id, assert_no_errors=False)

        data = load_data("transaction", timestamp=self.ten_mins_ago)
        data["transaction"] = "/to_other/2"
        self.store_event(data, project_id=self.project.id, assert_no_errors=False)

        user_misery_widget = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            order=0,
            title="user misery",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.DISCOVER,
            interval="1d",
            detail={"layout": {"x": 0, "y": 0, "w": 1, "h": 1, "minH": 2}},
        )
        user_misery_widget_query = DashboardWidgetQuery.objects.create(
            widget=user_misery_widget,
            fields=["title", "user_misery(300)"],
            columns=[],
            aggregates=["user_misery(300)"],
            conditions="",
            order=0,
        )

        _, queried_snuba = _get_and_save_split_decision_for_dashboard_widget(
            user_misery_widget_query, self.dry_run
        )
        user_misery_widget.refresh_from_db()
        assert not queried_snuba

        assert (
            user_misery_widget.discover_widget_split is None
            if self.dry_run
            else user_misery_widget.discover_widget_split == 101
        )

    def test_alias_with_last_seen_widget(self):
        data = load_data("python", timestamp=self.ten_mins_ago)
        self.store_event(data, project_id=self.project.id, assert_no_errors=False)

        last_seen_widget = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            order=0,
            title="last seen",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.DISCOVER,
            interval="1d",
            detail={"layout": {"x": 0, "y": 0, "w": 1, "h": 1, "minH": 2}},
        )
        last_seen_widget_query = DashboardWidgetQuery.objects.create(
            widget=last_seen_widget,
            fields=["title", "last_seen()"],
            columns=[],
            aggregates=["last_seen()"],
            conditions="",
            order=0,
        )

        _, queried_snuba = _get_and_save_split_decision_for_dashboard_widget(
            last_seen_widget_query, self.dry_run
        )
        last_seen_widget.refresh_from_db()
        assert not queried_snuba

        assert (
            last_seen_widget.discover_widget_split is None
            if self.dry_run
            else last_seen_widget.discover_widget_split == 100
        )

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

    def test_errors_widget_unhandled_in_conditions(self):
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
            conditions="(error.unhandled:true message:testing) OR message:test",
            order=0,
        )

        _get_and_save_split_decision_for_dashboard_widget(errors_widget_query, self.dry_run)
        error_widget.refresh_from_db()
        assert (
            error_widget.discover_widget_split is None
            if self.dry_run
            else error_widget.discover_widget_split == 100
        )
        if not self.dry_run:
            assert error_widget.dataset_source == DashboardDatasetSourcesTypes.FORCED.value

    def test_dashboard_projects_empty(self):
        # Dashboard belonging to an org with no projects
        self.organization = self.create_organization()
        self.dashboard = Dashboard.objects.create(
            title="Dashboard With Split Widgets",
            created_by_id=self.user.id,
            organization=self.organization,
        )
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
            conditions="(error.unhandled:true message:testing) OR message:test",
            order=0,
        )

        _get_and_save_split_decision_for_dashboard_widget(errors_widget_query, self.dry_run)
        error_widget.refresh_from_db()
        assert (
            error_widget.discover_widget_split is None
            if self.dry_run
            else error_widget.discover_widget_split == 100
        )
        if not self.dry_run:
            assert error_widget.dataset_source == DashboardDatasetSourcesTypes.FORCED.value

    def test_dashboard_split_equation_without_aggregates(self):
        transaction_widget = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            order=0,
            title="transaction widget",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.DISCOVER,
            interval="1d",
            detail={"layout": {"x": 0, "y": 0, "w": 1, "h": 1, "minH": 2}},
        )
        transaction_widget_query = DashboardWidgetQuery.objects.create(
            widget=transaction_widget,
            fields=[
                "equation|count_if(blah-key-set,equals,True) / count()",
            ],
            columns=[],
            aggregates=[
                "equation|count_if(blah-key-set,equals,True) / count()",
            ],
            conditions="event.type:transaction transaction:foo",
            order=0,
        )

        _get_and_save_split_decision_for_dashboard_widget(transaction_widget_query, self.dry_run)
        transaction_widget.refresh_from_db()
        assert (
            transaction_widget.discover_widget_split is None
            if self.dry_run
            else transaction_widget.discover_widget_split == 101
        )
        if not self.dry_run:
            assert (
                transaction_widget.dataset_source
                == DashboardDatasetSourcesTypes.SPLIT_VERSION_2.value
            )

    def test_dashboard_split_transaction_status_error_events_dataset(self):
        transaction_widget = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            order=0,
            title="transaction widget",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.DISCOVER,
            interval="1d",
            detail={"layout": {"x": 0, "y": 0, "w": 1, "h": 1, "minH": 2}},
        )
        transaction_widget_query = DashboardWidgetQuery.objects.create(
            widget=transaction_widget,
            fields=["transaction", "p75(transaction.duration)", "total.count"],
            columns=["transaction"],
            aggregates=["p75(transaction.duration)", "total.count"],
            conditions="event.type:transaction transaction.status:ok",
            order=0,
        )

        _get_and_save_split_decision_for_dashboard_widget(transaction_widget_query, self.dry_run)
        transaction_widget.refresh_from_db()
        assert (
            transaction_widget.discover_widget_split is None
            if self.dry_run
            else transaction_widget.discover_widget_split == 101
        )
        if not self.dry_run:
            assert transaction_widget.dataset_source == DashboardDatasetSourcesTypes.FORCED.value

    def test_unhandled_filter_sets_error_events_dataset(self):
        error_widget = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            order=0,
            title="error widget",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.DISCOVER,
            interval="1d",
            detail={"layout": {"x": 0, "y": 0, "w": 1, "h": 1, "minH": 2}},
        )
        error_widget_query = DashboardWidgetQuery.objects.create(
            widget=error_widget,
            fields=[
                "equation|count() / total.count * 100",
                "release",
                "error_event",
                "count()",
                "total.count",
            ],
            columns=["release"],
            aggregates=["equation|count() / total.count * 100", "count()", "total.count"],
            conditions="error.unhandled:false",
            order=0,
        )

        _get_and_save_split_decision_for_dashboard_widget(error_widget_query, self.dry_run)
        error_widget.refresh_from_db()
        assert (
            error_widget.discover_widget_split is None
            if self.dry_run
            else error_widget.discover_widget_split == 100
        )
        if not self.dry_run:
            assert error_widget.dataset_source == DashboardDatasetSourcesTypes.FORCED.value

    def test_empty_equation_is_filtered_out(self):
        error_widget = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            order=0,
            title="error widget",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.DISCOVER,
            interval="1d",
            detail={"layout": {"x": 0, "y": 0, "w": 1, "h": 1, "minH": 2}},
        )
        error_widget_query = DashboardWidgetQuery.objects.create(
            widget=error_widget,
            fields=[
                "count()",
                "equation|",
            ],
            columns=[],
            aggregates=["count()", "equation|"],
            conditions='message:"Testing"',
            order=0,
        )

        _get_and_save_split_decision_for_dashboard_widget(error_widget_query, self.dry_run)
        error_widget.refresh_from_db()
        assert (
            error_widget.discover_widget_split is None
            if self.dry_run
            else error_widget.discover_widget_split == 100
        )
        if not self.dry_run:
            assert error_widget.dataset_source == DashboardDatasetSourcesTypes.SPLIT_VERSION_2.value


class DashboardWidgetDatasetSplitDryRunTestCase(DashboardWidgetDatasetSplitTestCase):
    def setUp(self):
        super().setUp()
        self.dry_run = True
