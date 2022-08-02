from sentry.models.dashboard_widget import (
    DashboardWidgetDisplayTypes,
    DashboardWidgetQuery,
    DashboardWidgetTypes,
)
from sentry.testutils.cases import TestMigrations


class TestConvertDashboardWidgetQueryOrderby(TestMigrations):
    migrate_from = "0288_fix_savedsearch_state"
    migrate_to = "0289_dashboardwidgetquery_convert_orderby_to_field"

    def setup_before_migration(self, apps):
        Dashboard = apps.get_model("sentry", "Dashboard")
        # User = apps.get_model("sentry", "User")
        DashboardWidget = apps.get_model("sentry", "DashboardWidget")
        DashboardWidgetQuery = apps.get_model("sentry", "DashboardWidgetQuery")
        dashboard = Dashboard.objects.create(
            title="Dashboard 1", created_by_id=self.user.id, organization_id=self.organization.id
        )
        widget = DashboardWidget.objects.create(
            dashboard=dashboard,
            order=0,
            title="Existing Widget",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.DISCOVER,
            interval="1d",
        )
        self.simple_aggregate = DashboardWidgetQuery.objects.create(
            widget=widget,
            fields=["count()"],
            columns=[],
            aggregates=["count()"],
            order=0,
            orderby="count",
        )

        self.field = DashboardWidgetQuery.objects.create(
            widget=widget,
            fields=["count()", "project"],
            columns=["project"],
            aggregates=["count()"],
            order=1,
            orderby="-project",
        )

        self.complex_aggregate = DashboardWidgetQuery.objects.create(
            widget=widget,
            fields=["count_miserable(user,300)"],
            columns=[],
            aggregates=["count_miserable(user,300)"],
            order=2,
            orderby="-count_miserable_user_300",
        )

        self.complex_aggregate_2 = DashboardWidgetQuery.objects.create(
            widget=widget,
            fields=["count_unique(device.locale)"],
            columns=[],
            aggregates=["count_unique(device.locale)"],
            order=3,
            orderby="-count_unique_device_locale",
        )

        self.function_format = DashboardWidgetQuery.objects.create(
            widget=widget,
            fields=["count()"],
            columns=[],
            aggregates=["count()"],
            order=4,
            orderby="-count()",
        )

    def tearDown(self):
        super().tearDown()

    def test(self):
        assert DashboardWidgetQuery.objects.get(id=self.simple_aggregate.id).orderby == "count()"
        assert DashboardWidgetQuery.objects.get(id=self.field.id).orderby == "-project"
        assert (
            DashboardWidgetQuery.objects.get(id=self.complex_aggregate.id).orderby
            == "-count_miserable(user,300)"
        )
        assert (
            DashboardWidgetQuery.objects.get(id=self.complex_aggregate_2.id).orderby
            == "-count_unique(device.locale)"
        )
        assert DashboardWidgetQuery.objects.get(id=self.function_format.id).orderby == "-count()"
