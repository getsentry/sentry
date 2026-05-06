from sentry.models.dashboard_widget import DashboardWidget, DashboardWidgetDisplayTypes
from sentry.testutils.cases import TestMigrations


class BackfillDeprecatedDashboardWidgetDisplayTypesTest(TestMigrations):
    migrate_from = "1079_purge_scm_legacy_org_options"
    migrate_to = "1080_backfill_deprecated_dashboard_widget_display_types"

    def setup_before_migration(self, apps):
        Dashboard = apps.get_model("sentry", "Dashboard")
        DashboardWidget = apps.get_model("sentry", "DashboardWidget")

        dashboard = Dashboard.objects.create(title="test", organization_id=self.organization.id)

        self.top_n_null_limit = DashboardWidget.objects.create(
            dashboard=dashboard,
            title="top_n null limit",
            display_type=DashboardWidgetDisplayTypes.TOP_N,
            order=0,
            limit=None,
        )
        self.top_n_explicit_limit = DashboardWidget.objects.create(
            dashboard=dashboard,
            title="top_n explicit limit",
            display_type=DashboardWidgetDisplayTypes.TOP_N,
            order=1,
            limit=3,
        )
        self.stacked_area_null_limit = DashboardWidget.objects.create(
            dashboard=dashboard,
            title="stacked_area null limit",
            display_type=DashboardWidgetDisplayTypes.STACKED_AREA_CHART,
            order=2,
            limit=None,
        )
        self.stacked_area_explicit_limit = DashboardWidget.objects.create(
            dashboard=dashboard,
            title="stacked_area explicit limit",
            display_type=DashboardWidgetDisplayTypes.STACKED_AREA_CHART,
            order=3,
            limit=8,
        )
        self.table_widget = DashboardWidget.objects.create(
            dashboard=dashboard,
            title="table",
            display_type=DashboardWidgetDisplayTypes.TABLE,
            order=4,
            limit=None,
        )

    def test_backfills(self) -> None:
        top_n_null_limit = DashboardWidget.objects.get(id=self.top_n_null_limit.id)
        assert top_n_null_limit.display_type == DashboardWidgetDisplayTypes.AREA_CHART
        assert top_n_null_limit.limit == 5

        top_n_explicit_limit = DashboardWidget.objects.get(id=self.top_n_explicit_limit.id)
        assert top_n_explicit_limit.display_type == DashboardWidgetDisplayTypes.AREA_CHART
        assert top_n_explicit_limit.limit == 3

        stacked_area_null_limit = DashboardWidget.objects.get(id=self.stacked_area_null_limit.id)
        assert stacked_area_null_limit.display_type == DashboardWidgetDisplayTypes.AREA_CHART
        assert stacked_area_null_limit.limit is None

        stacked_area_explicit_limit = DashboardWidget.objects.get(
            id=self.stacked_area_explicit_limit.id
        )
        assert stacked_area_explicit_limit.display_type == DashboardWidgetDisplayTypes.AREA_CHART
        assert stacked_area_explicit_limit.limit == 8

        table_widget = DashboardWidget.objects.get(id=self.table_widget.id)
        assert table_widget.display_type == DashboardWidgetDisplayTypes.TABLE
        assert table_widget.limit is None
