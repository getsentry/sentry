from sentry.models.dashboard_widget import DashboardWidgetDisplayTypes
from sentry.testutils.cases import TestMigrations


class RenamePrioritySortToTrendsTest(TestMigrations):
    migrate_from = "0674_monitor_clear_missed_timeout_as_error"
    migrate_to = "0675_dashboard_widget_query_rename_priority_sort_to_trends"

    def setup_before_migration(self, apps):
        Dashboard = apps.get_model("sentry", "Dashboard")
        DashboardWidget = apps.get_model("sentry", "DashboardWidget")
        DashboardWidgetQuery = apps.get_model("sentry", "DashboardWidgetQuery")

        self.dashboard = Dashboard.objects.create(
            organization_id=self.organization.id,
            title="Dashboard",
            created_by_id=self.user.id,
        )

        self.queries_with_priority_sort = []
        self.other_queries = []

        for i, title in enumerate(["Widget 1", "Widget 2", "Widget 3"]):
            widget = DashboardWidget.objects.create(
                dashboard=self.dashboard,
                order=i,
                title=title,
                display_type=DashboardWidgetDisplayTypes.TABLE,
            )
            widget_query = DashboardWidgetQuery.objects.create(
                widget=widget,
                name="query",
                fields=["assignee", "issue", "title"],
                order=1,
                orderby="priority",
            )
            self.queries_with_priority_sort.append(widget_query)

        for i, title in enumerate(["Widget 1", "Widget 2", "Widget 3"]):
            widget = DashboardWidget.objects.create(
                dashboard=self.dashboard,
                order=i + 3,
                title=title,
                display_type=DashboardWidgetDisplayTypes.TABLE,
            )
            widget_query = DashboardWidgetQuery.objects.create(
                widget=widget,
                name="query",
                fields=["assignee", "issue", "title"],
                order=1,
                orderby="last_seen",
            )
            self.other_queries.append(widget_query)

    def test(self):
        for query in self.queries_with_priority_sort:
            query.refresh_from_db()
            assert query.orderby == "trends"

        for query in self.other_queries:
            query.refresh_from_db()
            assert query.orderby == "last_seen"
