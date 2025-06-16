import pytest

from sentry.hybridcloud.models.outbox import outbox_context
from sentry.models.dashboard_widget import (
    DashboardWidgetDisplayTypes,
    DashboardWidgetTypes,
    DatasetSourcesTypes,
)
from sentry.models.organization import Organization
from sentry.testutils.cases import SnubaTestCase, TestMigrations
from sentry.testutils.helpers.datetime import before_now
from sentry.utils.samples import load_data


@pytest.mark.skip("Skipping test b/c it breaks tests for 0068_migrate_anomaly_detection_alerts")
class SplitDiscoverDatasetDashboardsSelfHostedTest(TestMigrations, SnubaTestCase):
    migrate_from = "0912_make_organizationmemberteam_replica_is_active_true"
    migrate_to = "0913_split_discover_dataset_dashboards_self_hosted"

    def setup_before_migration(self, apps):
        User = apps.get_model("sentry", "User")
        Dashboard = apps.get_model("sentry", "Dashboard")
        DashboardWidget = apps.get_model("sentry", "DashboardWidget")
        DashboardWidgetQuery = apps.get_model("sentry", "DashboardWidgetQuery")

        with outbox_context(flush=False):
            self.organization = Organization.objects.create(name="test", slug="test")
            self.user = User.objects.create(email="test@test.com", is_superuser=False)
            self.project = self.create_project(
                name="test_project", slug="test_project", organization=self.organization
            )
            self.environment = self.create_environment(
                name="test_environment", project=self.project, organization=self.organization
            )

            self.dashboard = Dashboard.objects.create(
                title="test",
                organization_id=self.organization.id,
                created_by_id=self.user.id,
            )

            self.discover_error_widget = DashboardWidget.objects.create(
                dashboard_id=self.dashboard.id,
                title="test discover widget",
                widget_type=DashboardWidgetTypes.DISCOVER,
                dataset_source=DatasetSourcesTypes.UNKNOWN.value,
                display_type=DashboardWidgetDisplayTypes.LINE_CHART,
                interval="1d",
                order=0,
            )

            self.discover_error_widget_query = DashboardWidgetQuery.objects.create(
                widget_id=self.discover_error_widget.id,
                name="test discover widget query",
                fields=["count()"],
                aggregates=["count()"],
                columns=[],
                conditions="environment:foo",
                orderby=["-count()"],
                order=0,
            )

            self.migrated_discover_widget = DashboardWidget.objects.create(
                dashboard_id=self.dashboard.id,
                title="test migrated discover widget",
                widget_type=DashboardWidgetTypes.DISCOVER,
                dataset_source=DatasetSourcesTypes.UNKNOWN.value,
                discover_widget_split=DashboardWidgetTypes.TRANSACTION_LIKE,
                display_type=DashboardWidgetDisplayTypes.LINE_CHART,
                interval="1d",
                order=1,
            )

            self.migrated_discover_widget_query = DashboardWidgetQuery.objects.create(
                widget_id=self.migrated_discover_widget.id,
                name="test migrated discover widget query",
                fields=["count()"],
                aggregates=["count()"],
                columns=[],
                conditions="environment:foo",
                orderby=["-count()"],
                order=1,
            )

            self.discover_transaction_widget = DashboardWidget.objects.create(
                dashboard_id=self.dashboard.id,
                title="test discover transaction widget",
                widget_type=DashboardWidgetTypes.DISCOVER,
                dataset_source=DatasetSourcesTypes.UNKNOWN.value,
                display_type=DashboardWidgetDisplayTypes.LINE_CHART,
                interval="1d",
                order=2,
            )

            self.discover_transaction_widget_query = DashboardWidgetQuery.objects.create(
                widget_id=self.discover_transaction_widget.id,
                name="test discover transaction widget query",
                fields=["count()", "transaction.duration"],
                aggregates=["count()"],
                columns=[],
                conditions="environment:foo",
                orderby=["-count()"],
                order=2,
            )

            self.discover_ambiguous_widget = DashboardWidget.objects.create(
                dashboard_id=self.dashboard.id,
                title="test discover ambiguous widget",
                widget_type=DashboardWidgetTypes.DISCOVER,
                dataset_source=DatasetSourcesTypes.UNKNOWN.value,
                display_type=DashboardWidgetDisplayTypes.LINE_CHART,
                interval="1d",
                order=3,
            )

            self.discover_ambiguous_widget_query = DashboardWidgetQuery.objects.create(
                widget_id=self.discover_ambiguous_widget.id,
                name="test discover ambiguous widget query",
                fields=["count()", "transaction"],
                aggregates=["count()"],
                columns=[],
                conditions="environment:test_environment",
                orderby=["-count()"],
                order=3,
            )

            # Now store test data that should only affect the ambiguous widget
            self.nine_mins_ago = before_now(minutes=9)
            self.ten_mins_ago = before_now(minutes=10)

            data = load_data("transaction", timestamp=self.ten_mins_ago)
            data["transaction"] = "/to_other/"
            data["environment"] = self.environment.name
            data["transaction.duration"] = 1000
            self.store_event(data, project_id=self.project.id, assert_no_errors=False)

            data = load_data("transaction", timestamp=self.ten_mins_ago)
            data["transaction"] = "/to_other/2"
            data["environment"] = self.environment.name
            data["transaction.duration"] = 2000
            self.store_event(data, project_id=self.project.id, assert_no_errors=False)

    def test(self):
        self.discover_error_widget.refresh_from_db()
        self.migrated_discover_widget.refresh_from_db()
        self.discover_transaction_widget.refresh_from_db()
        self.discover_ambiguous_widget.refresh_from_db()

        assert self.discover_error_widget.discover_widget_split == DashboardWidgetTypes.ERROR_EVENTS
        assert (
            self.migrated_discover_widget.discover_widget_split
            == DashboardWidgetTypes.TRANSACTION_LIKE
        )
        assert (
            self.discover_transaction_widget.discover_widget_split
            == DashboardWidgetTypes.TRANSACTION_LIKE
        )
        assert (
            self.discover_ambiguous_widget.discover_widget_split
            == DashboardWidgetTypes.TRANSACTION_LIKE
        )
