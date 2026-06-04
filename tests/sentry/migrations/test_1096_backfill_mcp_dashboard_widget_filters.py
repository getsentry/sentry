from sentry.testutils.cases import TestMigrations


class BackfillMcpDashboardWidgetFiltersTest(TestMigrations):
    migrate_from = "1095_make_project_repository_fk_notnull"
    migrate_to = "1096_backfill_mcp_dashboard_widget_filters"

    def setup_before_migration(self, apps):
        Dashboard = apps.get_model("sentry", "Dashboard")
        DashboardWidget = apps.get_model("sentry", "DashboardWidget")
        DashboardWidgetQuery = apps.get_model("sentry", "DashboardWidgetQuery")

        org = self.create_organization()
        user = self.create_user()
        dashboard = Dashboard.objects.create(
            title="mcp", organization_id=org.id, created_by_id=user.id
        )

        def make_widget_query(order: int, conditions: str):
            widget = DashboardWidget.objects.create(
                dashboard_id=dashboard.id,
                title=f"widget {order}",
                widget_type=102,
                display_type=1,
                interval="1h",
                order=order,
            )
            return DashboardWidgetQuery.objects.create(
                widget_id=widget.id,
                name="",
                fields=["count()"],
                aggregates=["count()"],
                columns=[],
                conditions=conditions,
                orderby="",
                order=0,
            )

        self.bare = make_widget_query(0, "span.name:mcp.server")
        self.with_has = make_widget_query(1, "span.name:mcp.server has:mcp.tool.name")
        self.with_extra = make_widget_query(2, "release:1.0 span.name:mcp.server environment:prod")
        self.already_op = make_widget_query(3, "span.op:mcp.server")
        self.unrelated = make_widget_query(4, "span.name:other transaction:foo")

    def test(self) -> None:
        from sentry.models.dashboard_widget import DashboardWidgetQuery

        def conditions_for(pk: int) -> str:
            return DashboardWidgetQuery.objects.get(id=pk).conditions

        assert conditions_for(self.bare.id) == "span.op:mcp.server"
        assert conditions_for(self.with_has.id) == "span.op:mcp.server has:mcp.tool.name"
        assert (
            conditions_for(self.with_extra.id) == "release:1.0 span.op:mcp.server environment:prod"
        )
        assert conditions_for(self.already_op.id) == "span.op:mcp.server"
        assert conditions_for(self.unrelated.id) == "span.name:other transaction:foo"
