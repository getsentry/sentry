from sentry.hybridcloud.models.outbox import outbox_context
from sentry.models.dashboard_widget import DashboardWidgetTypes, DatasetSourcesTypes
from sentry.testutils.cases import SnubaTestCase, TestMigrations


class SplitDiscoverDatasetDashboardsSelfHostedTest(TestMigrations, SnubaTestCase):
    migrate_from = "0904_onboarding_task_project_id_idx"
    migrate_to = "0905_split_discover_dataset_dashboards_self_hosted"

    def setup_before_migration(self, apps):
        Organization = apps.get_model("sentry", "Organization")
        User = apps.get_model("sentry", "User")
        Dashboard = apps.get_model("sentry", "Dashboard")
        DashboardWidget = apps.get_model("sentry", "DashboardWidget")
        DashboardWidgetQuery = apps.get_model("sentry", "DashboardWidgetQuery")

        with outbox_context(flush=False):
            self.organization = Organization.objects.create(name="test", slug="test")
            self.user = User.objects.create(email="test@test.com", is_superuser=False)

            self.dashboard = Dashboard.objects.create(
                title="test",
                organization=self.organization,
                created_by=self.user,
            )

            self.discover_widget = DashboardWidget.objects.create(
                dashboard=self.dashboard,
                title="test discover widget",
                widget_type=DashboardWidgetTypes.DISCOVER,
                dataset_source=DatasetSourcesTypes.UNKNOWN,
            )
            self.discover_widget_query = DashboardWidgetQuery.objects.create(
                widget=self.discover_widget,
                name="test discover widget query",
                fields=["count()"],
                aggregates=["count()"],
                columns=[],
                conditions=[],
                limit=10,
                orderby=["-count()"],
                order=0,
            )

            self.migrated_discover_widget = DashboardWidget.objects.create(
                dashboard=self.dashboard,
                title="test migrated discover widget",
                widget_type=DashboardWidgetTypes.DISCOVER,
                dataset_source=DatasetSourcesTypes.UNKNOWN,
                discover_widget_split=DashboardWidgetTypes.TRANSACTION_LIKE,
            )

            self.migrated_discover_widget_query = DashboardWidgetQuery.objects.create(
                widget=self.migrated_discover_widget,
                name="test migrated discover widget query",
                fields=["count()"],
                aggregates=["count()"],
                columns=[],
                conditions=[],
                limit=10,
                orderby=["-count()"],
                order=0,
            )

    def test(self):
        self.discover_widget.refresh_from_db()
        self.migrated_discover_widget.refresh_from_db()

        assert self.discover_widget.discover_widget_split == DashboardWidgetTypes.ERROR_EVENTS
        assert self.discover_widget.widget_type == DashboardWidgetTypes.ERROR_EVENTS
        assert self.discover_widget.dataset_source == DatasetSourcesTypes.FORCED

        assert (
            self.migrated_discover_widget.discover_widget_split
            == DashboardWidgetTypes.TRANSACTION_LIKE
        )
        assert self.migrated_discover_widget.widget_type == DashboardWidgetTypes.DISCOVER
        assert self.migrated_discover_widget.dataset_source == DatasetSourcesTypes.UNKNOWN
