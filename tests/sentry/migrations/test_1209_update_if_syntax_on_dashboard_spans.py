from sentry.testutils.cases import SnubaTestCase, TestMigrations


class UpdateIfSyntaxOnDashboardSpansTest(TestMigrations, SnubaTestCase):
    app = "sentry"
    migrate_from = "1208_sentryappinstallation_uuid_index"
    migrate_to = "1209_update_if_syntax_on_dashboard_spans"

    def setup_before_migration(self, apps):
        Dashboard = apps.get_model("sentry", "Dashboard")
        DashboardWidget = apps.get_model("sentry", "DashboardWidget")
        DashboardWidgetQuery = apps.get_model("sentry", "DashboardWidgetQuery")
        DashboardFieldLink = apps.get_model("sentry", "DashboardFieldLink")

        self.dashboard = Dashboard.objects.create(
            organization_id=self.organization.id, title="if syntax dashboard"
        )
        self.linked_dashboard = Dashboard.objects.create(
            organization_id=self.organization.id, title="linked dashboard"
        )

        # Spans widget with old _if syntax in fields, aggregates, and orderby
        self.spans_widget = DashboardWidget.objects.create(
            dashboard_id=self.dashboard.id,
            title="Spans if combinators",
            display_type=4,
            widget_type=102,  # SPANS
        )
        self.spans_query = DashboardWidgetQuery.objects.create(
            widget_id=self.spans_widget.id,
            order=0,
            name="Spans Query",
            fields=[
                "span.op",
                "count_if(span.duration,greater,100)",
                "count_if(span.duration,notEquals,100)",
                "count_if(span.duration,between,100,199)",
                "avg_if(span.duration,span.duration,lessOrEquals,100)",
                "equation|avg_if(span.duration,span.duration,lessOrEquals,100) + count_if(span.duration,greaterOrEquals,100)",
                "failure_count_if(span.duration,lessOrEquals,100)",
            ],
            columns=["span.op"],
            aggregates=[
                "count_if(span.duration,greater,100)",
                "count_if(span.duration,notEquals,100)",
                "count_if(span.duration,between,100,199)",
                "avg_if(span.duration,span.duration,lessOrEquals,100)",
                "equation|avg_if(span.duration,span.duration,lessOrEquals,100) + count_if(span.duration,greaterOrEquals,100)",
                "failure_count_if(span.duration,lessOrEquals,100)",
            ],
            conditions="",
            orderby="-count_if(span.duration,greater,100)",
        )
        self.field_link = DashboardFieldLink.objects.create(
            dashboard_widget_query_id=self.spans_query.id,
            field="count_if(span.duration,greater,100)",
            dashboard_id=self.linked_dashboard.id,
        )

        # Already on new syntax — must stay unchanged
        self.migrated_widget = DashboardWidget.objects.create(
            dashboard_id=self.dashboard.id,
            title="Already migrated",
            display_type=0,
            widget_type=102,
        )
        self.migrated_query = DashboardWidgetQuery.objects.create(
            widget_id=self.migrated_widget.id,
            order=0,
            name="Migrated Query",
            fields=[
                "count_if(`span.description:/api/0/organizations/{organization_id_or_slug}/events/`,span.duration)"
            ],
            columns=[],
            aggregates=[
                "count_if(`span.description:/api/0/organizations/{organization_id_or_slug}/events/`,span.duration)"
            ],
            conditions="",
            orderby="-count_if(`span.description:*/events/`,span.duration)",
        )

        # Non-spans widget must not be rewritten (Discover still uses equals form)
        self.discover_widget = DashboardWidget.objects.create(
            dashboard_id=self.dashboard.id,
            title="Discover if combinators",
            display_type=4,
            widget_type=0,  # DISCOVER
        )
        self.discover_query = DashboardWidgetQuery.objects.create(
            widget_id=self.discover_widget.id,
            order=0,
            name="Discover Query",
            fields=["count_if(transaction.duration,greater,100)"],
            columns=[],
            aggregates=["count_if(transaction.duration,greater,100)"],
            conditions="",
            orderby="-count_if(transaction.duration,greater,100)",
        )

        # Malformed 2-arg count_if — skip without aborting the row
        self.malformed_widget = DashboardWidget.objects.create(
            dashboard_id=self.dashboard.id,
            title="Malformed if combinator",
            display_type=4,
            widget_type=102,
        )
        self.malformed_query = DashboardWidgetQuery.objects.create(
            widget_id=self.malformed_widget.id,
            order=0,
            name="Malformed Query",
            fields=[
                "transaction",
                "equation|(count() - count_if(span.status,notEquals) ) / count() * 100",
                "count_if(span.status,equals,internal_error)",
            ],
            columns=["transaction"],
            aggregates=[
                "equation|(count() - count_if(span.status,notEquals) ) / count() * 100",
                "count_if(span.status,equals,internal_error)",
            ],
            conditions="",
            orderby="",
        )

    def test_rewrites_spans_widget_queries(self):
        self.spans_query.refresh_from_db()
        self.field_link.refresh_from_db()
        self.migrated_query.refresh_from_db()
        self.discover_query.refresh_from_db()

        assert self.spans_query.fields == [
            "span.op",
            "count_if(`span.duration:>100`)",
            "count_if(`!span.duration:100`)",
            "count_if(`span.duration:>=100 and span.duration:<=199`)",
            "avg_if(`span.duration:<=100`,span.duration)",
            "equation|avg_if(`span.duration:<=100`,span.duration) + count_if(`span.duration:>=100`)",
            # Untouched — failure_count_if is skipped
            "failure_count_if(span.duration,lessOrEquals,100)",
        ]
        assert self.spans_query.aggregates == [
            "count_if(`span.duration:>100`)",
            "count_if(`!span.duration:100`)",
            "count_if(`span.duration:>=100 and span.duration:<=199`)",
            "avg_if(`span.duration:<=100`,span.duration)",
            "equation|avg_if(`span.duration:<=100`,span.duration) + count_if(`span.duration:>=100`)",
            "failure_count_if(span.duration,lessOrEquals,100)",
        ]
        assert self.spans_query.orderby == "-count_if(`span.duration:>100`)"
        assert self.field_link.field == "count_if(`span.duration:>100`)"

        assert self.migrated_query.fields == [
            "count_if(`span.description:/api/0/organizations/{organization_id_or_slug}/events/`,span.duration)"
        ]
        assert self.migrated_query.aggregates == [
            "count_if(`span.description:/api/0/organizations/{organization_id_or_slug}/events/`,span.duration)"
        ]
        assert (
            self.migrated_query.orderby == "-count_if(`span.description:*/events/`,span.duration)"
        )

        assert self.discover_query.fields == ["count_if(transaction.duration,greater,100)"]
        assert self.discover_query.aggregates == ["count_if(transaction.duration,greater,100)"]
        assert self.discover_query.orderby == "-count_if(transaction.duration,greater,100)"

        self.malformed_query.refresh_from_db()
        assert self.malformed_query.fields == [
            "transaction",
            # Invalid arity left alone
            "equation|(count() - count_if(span.status,notEquals) ) / count() * 100",
            "count_if(`span.status:internal_error`)",
        ]
        assert self.malformed_query.aggregates == [
            "equation|(count() - count_if(span.status,notEquals) ) / count() * 100",
            "count_if(`span.status:internal_error`)",
        ]
