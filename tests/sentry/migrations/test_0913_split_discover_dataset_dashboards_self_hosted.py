from sentry.hybridcloud.models.outbox import outbox_context
from sentry.models.dashboard_widget import (
    DashboardWidgetDisplayTypes,
    DashboardWidgetTypes,
    DatasetSourcesTypes,
)
from sentry.models.organization import Organization
from sentry.testutils.cases import SnubaTestCase, TestMigrations


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

            self.dashboard = Dashboard.objects.create(
                title="test",
                organization_id=self.organization.id,
                created_by_id=self.user.id,
            )

            self.discover_widget = DashboardWidget.objects.create(
                dashboard_id=self.dashboard.id,
                title="test discover widget",
                widget_type=DashboardWidgetTypes.DISCOVER,
                dataset_source=DatasetSourcesTypes.UNKNOWN.value,
                display_type=DashboardWidgetDisplayTypes.LINE_CHART,
                interval="1d",
                order=0,
            )

            self.discover_widget_query = DashboardWidgetQuery.objects.create(
                widget_id=self.discover_widget.id,
                name="test discover widget query",
                fields=["count()"],
                aggregates=["count()"],
                columns=[],
                conditions=[],
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
                conditions=[],
                orderby=["-count()"],
                order=1,
            )

    def test(self):
        self.discover_widget.refresh_from_db()
        self.migrated_discover_widget.refresh_from_db()

        assert self.discover_widget.discover_widget_split == DashboardWidgetTypes.ERROR_EVENTS
        assert self.discover_widget.widget_type == DashboardWidgetTypes.DISCOVER
        assert self.discover_widget.dataset_source == DatasetSourcesTypes.FORCED.value

        assert (
            self.migrated_discover_widget.discover_widget_split
            == DashboardWidgetTypes.TRANSACTION_LIKE
        )
        assert self.migrated_discover_widget.widget_type == DashboardWidgetTypes.DISCOVER
        assert self.migrated_discover_widget.dataset_source == DatasetSourcesTypes.UNKNOWN.value
