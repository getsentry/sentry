from sentry.hybridcloud.models.outbox import outbox_context
from sentry.models.dashboard import Dashboard
from sentry.models.dashboard_widget import DashboardWidget, DashboardWidgetQuery
from sentry.models.organization import Organization
from sentry.testutils.cases import SnubaTestCase, TestMigrations


class MigrateDiscoverQueriesToExploreQueriesSelfHostedTest(TestMigrations, SnubaTestCase):
    migrate_from = "1013_add_repositorysettings_table"
    migrate_to = "1014_transactions_to_spans_widgets_self_hosted"

    def setup_before_migration(self, apps):

        with outbox_context(flush=False):
            self.org = Organization.objects.create(name="test", slug="test")
            self.dashboard = Dashboard.objects.create(
                organization_id=self.org.id, title="test dashboard"
            )

            self.transaction_widget = DashboardWidget.objects.create(
                dashboard_id=self.dashboard.id, widget_type=101, display_type=4
            )  # TRANSACTION_LIKE and TABLE
            self.transaction_widget_query = DashboardWidgetQuery.objects.create(
                order=0,
                widget_id=self.transaction_widget.id,
                name="Test Query",
                fields=["title", "count()", "count_unique(user)"],
                columns=["title"],
                aggregates=["count()", "count_unique(user)"],
                conditions="transaction:foo",
                field_aliases=["Title", "Count", "Unique Users"],
                orderby="count()",
            )

            self.transaction_widget_2 = DashboardWidget.objects.create(
                dashboard_id=self.dashboard.id, widget_type=101, display_type=0
            )  # TRANSACTION_LIKE and LINE CHART
            self.transaction_widget_query_2 = DashboardWidgetQuery.objects.create(
                order=0,
                widget_id=self.transaction_widget_2.id,
                name="Test Query 2",
                fields=["apdex(300)"],
                columns=[],
                aggregates=["apdex(300)"],
                conditions="transaction:foo",
                field_aliases=[],
            )

            self.discover_split_transaction_widget = DashboardWidget.objects.create(
                dashboard_id=self.dashboard.id,
                widget_type=0,
                display_type=0,
                discover_widget_split=101,
            )  # DISCOVER and TRANSACTION_LIKE and LINE CHART
            self.discover_split_transaction_widget_query = DashboardWidgetQuery.objects.create(
                order=0,
                widget_id=self.discover_split_transaction_widget.id,
                name="Test Query 3",
                fields=["transaction", "sum(transaction.duration)"],
                columns=["transaction"],
                aggregates=["sum(transaction.duration)"],
                conditions="",
                field_aliases=[],
            )

            self.error_widget = DashboardWidget.objects.create(
                dashboard_id=self.dashboard.id, widget_type=100, display_type=4
            )  # ERROR_EVENTS and TABLE
            self.error_widget_query = DashboardWidgetQuery.objects.create(
                order=0,
                widget_id=self.error_widget.id,
                name="Test Query 4",
                fields=["title", "count()"],
                columns=["title"],
                aggregates=["count()"],
                conditions="transaction:foo",
                field_aliases=["Title", "Count"],
                orderby="count()",
            )

            self.spans_widget = DashboardWidget.objects.create(
                dashboard_id=self.dashboard.id, widget_type=102, display_type=4
            )  # SPANS and TABLE
            self.spans_widget_query = DashboardWidgetQuery.objects.create(
                order=0,
                widget_id=self.spans_widget.id,
                name="Test Query 5",
                fields=["transaction", "count(span.duration)"],
                columns=["transaction"],
                aggregates=["count(span.duration)"],
                conditions="",
                field_aliases=[],
            )

    def test(self):
        self.transaction_widget.refresh_from_db()
        transaction_widget_query = DashboardWidgetQuery.objects.get(
            widget_id=self.transaction_widget.id
        )
        self.transaction_widget_2.refresh_from_db()
        transaction_widget_query_2 = DashboardWidgetQuery.objects.get(
            widget_id=self.transaction_widget_2.id
        )
        self.discover_split_transaction_widget.refresh_from_db()
        discover_split_transaction_widget_query = DashboardWidgetQuery.objects.get(
            widget_id=self.discover_split_transaction_widget.id
        )
        self.error_widget.refresh_from_db()
        error_widget_query = DashboardWidgetQuery.objects.get(widget_id=self.error_widget.id)
        self.spans_widget.refresh_from_db()
        spans_widget_query = DashboardWidgetQuery.objects.get(widget_id=self.spans_widget.id)

        # all tranasaction widgets should be spans widgets and have snapshots
        assert self.transaction_widget.widget_type == 102
        assert self.transaction_widget.widget_snapshot is not None
        assert self.transaction_widget_2.widget_type == 102
        assert self.transaction_widget_2.widget_snapshot is not None
        assert self.discover_split_transaction_widget.widget_type == 102
        assert self.discover_split_transaction_widget.widget_snapshot is not None

        # all other widgets should not be changed
        assert self.error_widget.widget_type == 100
        assert self.error_widget.widget_snapshot is None
        assert error_widget_query.id == self.error_widget_query.id
        assert self.spans_widget.widget_type == 102
        assert self.spans_widget.widget_snapshot is None
        assert spans_widget_query.id == self.spans_widget_query.id

        # all transaction widget queries should be translated appropriately
        assert transaction_widget_query.fields == [
            "transaction",
            "count(span.duration)",
            "count_unique(user)",
        ]
        assert transaction_widget_query.conditions == "(transaction:foo) AND is_transaction:1"
        assert transaction_widget_query.orderby == "count(span.duration)"

        assert transaction_widget_query_2.fields == ["equation|apdex(span.duration,300)"]
        assert transaction_widget_query_2.conditions == "(transaction:foo) AND is_transaction:1"
        assert transaction_widget_query_2.orderby == ""

        assert discover_split_transaction_widget_query.fields == [
            "transaction",
            "sum(span.duration)",
        ]
        assert discover_split_transaction_widget_query.conditions == "is_transaction:1"
        assert discover_split_transaction_widget_query.orderby == ""
