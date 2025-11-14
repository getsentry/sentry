from typing import int
from datetime import datetime

import pytest

from sentry.explore.translation.dashboards_translation import (
    restore_transaction_widget,
    translate_dashboard_widget,
)
from sentry.models.dashboard import Dashboard
from sentry.models.dashboard_widget import (
    DashboardWidget,
    DashboardWidgetDisplayTypes,
    DashboardWidgetQuery,
    DashboardWidgetTypes,
    DatasetSourcesTypes,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.silo import assume_test_silo_mode_of
from sentry.users.models.user import User

pytestmark = pytest.mark.sentry_metrics


class DashboardTranslationTestCase(TestCase):
    @property
    def now(self) -> datetime:
        return before_now(minutes=10)

    def setUp(self) -> None:
        super().setUp()
        self.org = self.create_organization()
        with assume_test_silo_mode_of(User):
            self.user = User.objects.create(email="test@sentry.io")
        self.project_2 = self.create_project(organization=self.org)
        self.project_3 = self.create_project(organization=self.org)

        self.dashboard = Dashboard.objects.create(
            title="Dashboard With Split Widgets",
            created_by_id=self.user.id,
            organization=self.organization,
        )
        self.dashboard.projects.set([self.project, self.project_2])

    def test_simple_case(self) -> None:
        transaction_widget = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            order=0,
            title="transaction widget",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.TRANSACTION_LIKE,
            interval="1d",
            detail={"layout": {"x": 0, "y": 0, "w": 1, "h": 1, "minH": 2}},
        )
        query = DashboardWidgetQuery.objects.create(
            widget=transaction_widget,
            fields=["release", "count()", "count_unique(user)"],
            columns=["release"],
            aggregates=["count()", "count_unique(user)"],
            conditions="transaction:foo",
            order=0,
        )

        translate_dashboard_widget(transaction_widget)
        transaction_widget.refresh_from_db()

        assert transaction_widget.widget_snapshot
        assert transaction_widget.changed_reason is not None
        assert isinstance(transaction_widget.changed_reason, list)
        assert len(transaction_widget.changed_reason) == 1
        dropped_fields = transaction_widget.changed_reason[0]
        assert dropped_fields["selected_columns"] == []
        assert dropped_fields["equations"] == []
        assert dropped_fields["orderby"] is None

        snapshot_queries = transaction_widget.widget_snapshot["queries"]
        assert len(snapshot_queries) == 1
        original_snapshot_query = snapshot_queries[0]
        assert original_snapshot_query["fields"] == ["release", "count()", "count_unique(user)"]
        assert original_snapshot_query["conditions"] == "transaction:foo"
        assert original_snapshot_query["aggregates"] == ["count()", "count_unique(user)"]
        assert original_snapshot_query["columns"] == ["release"]

        new_queries = DashboardWidgetQuery.objects.filter(widget=transaction_widget)
        assert new_queries.count() == 1

        new_query = new_queries.first()
        assert new_query is not None
        assert new_query.widget_id == transaction_widget.id
        assert new_query.order == 0
        assert new_query.fields == ["release", "count(span.duration)", "count_unique(user)"]
        assert new_query.conditions == "(transaction:foo) AND is_transaction:1"
        assert new_query.aggregates == ["count(span.duration)", "count_unique(user)"]
        assert new_query.columns == ["release"]

        # Assert widget type and dataset source are set correctly
        assert transaction_widget.widget_type == DashboardWidgetTypes.SPANS
        assert (
            transaction_widget.dataset_source == DatasetSourcesTypes.SPAN_MIGRATION_VERSION_5.value
        )

        assert not DashboardWidgetQuery.objects.filter(id=query.id).exists()

    def test_field_order_preserved(self) -> None:
        transaction_widget = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            order=0,
            title="transaction widget",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.TRANSACTION_LIKE,
            interval="1d",
            detail={"layout": {"x": 0, "y": 0, "w": 1, "h": 1, "minH": 2}},
        )
        query = DashboardWidgetQuery.objects.create(
            widget=transaction_widget,
            fields=["release", "count()", "total.count", "count_unique(user)"],
            columns=["release", "total.count"],
            field_aliases=["Release", "Count", "Total Count", "Unique User"],
            aggregates=["count()", "count_unique(user)"],
            conditions="transaction:foo",
            orderby="total.count",
            order=0,
        )

        translate_dashboard_widget(transaction_widget)
        transaction_widget.refresh_from_db()

        assert transaction_widget.widget_snapshot
        assert transaction_widget.changed_reason is not None
        assert isinstance(transaction_widget.changed_reason, list)
        assert len(transaction_widget.changed_reason) == 1
        dropped_fields = transaction_widget.changed_reason[0]
        assert "total.count" in dropped_fields["selected_columns"]
        assert dropped_fields["equations"] == []
        assert len(dropped_fields["orderby"]) == 1
        assert dropped_fields["orderby"][0]["orderby"] == "total.count"

        snapshot_queries = transaction_widget.widget_snapshot["queries"]
        assert len(snapshot_queries) == 1
        original_snapshot_query = snapshot_queries[0]
        assert original_snapshot_query["fields"] == [
            "release",
            "count()",
            "total.count",
            "count_unique(user)",
        ]
        assert original_snapshot_query["conditions"] == "transaction:foo"
        assert original_snapshot_query["aggregates"] == ["count()", "count_unique(user)"]
        assert original_snapshot_query["columns"] == ["release", "total.count"]
        assert original_snapshot_query["fieldAliases"] == [
            "Release",
            "Count",
            "Total Count",
            "Unique User",
        ]
        assert original_snapshot_query["orderby"] == "total.count"

        new_queries = DashboardWidgetQuery.objects.filter(widget=transaction_widget)
        assert new_queries.count() == 1

        new_query = new_queries.first()
        assert new_query is not None
        assert new_query.widget_id == transaction_widget.id
        assert new_query.order == 0

        assert new_query.fields == ["release", "count(span.duration)", "count_unique(user)"]
        assert new_query.conditions == "(transaction:foo) AND is_transaction:1"
        assert new_query.aggregates == ["count(span.duration)", "count_unique(user)"]
        assert new_query.columns == ["release"]
        assert new_query.field_aliases == ["Release", "Count", "Unique User"]
        assert new_query.orderby == ""

        assert not DashboardWidgetQuery.objects.filter(id=query.id).exists()

    def test_equations_index_notation_orderby(self) -> None:
        transaction_widget = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            order=0,
            title="transaction widget",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.TRANSACTION_LIKE,
            interval="1d",
            detail={"layout": {"x": 0, "y": 0, "w": 1, "h": 1, "minH": 2}},
        )
        query = DashboardWidgetQuery.objects.create(
            widget=transaction_widget,
            fields=[
                "transaction",
                "equation|count_if(transaction.duration,less,300)",
                "equation|count_if(transaction.duration,greater,300)",
                "count_unique(user)",
            ],
            columns=["transaction"],
            field_aliases=["Txn", "Count Fast Txn", "Count Slow Txn", "Unique User"],
            aggregates=[
                "equation|count_if(transaction.duration,less,300)",
                "equation|count_if(transaction.duration,greater,300)",
                "count_unique(user)",
            ],
            conditions="",
            orderby="-equation[1]",
            order=0,
        )

        translate_dashboard_widget(transaction_widget)
        transaction_widget.refresh_from_db()

        assert transaction_widget.widget_snapshot
        assert transaction_widget.changed_reason is not None
        assert isinstance(transaction_widget.changed_reason, list)
        assert len(transaction_widget.changed_reason) == 1
        dropped_fields = transaction_widget.changed_reason[0]
        assert dropped_fields["selected_columns"] == []
        assert dropped_fields["equations"] == []
        assert dropped_fields["orderby"] == []

        snapshot_queries = transaction_widget.widget_snapshot["queries"]
        assert len(snapshot_queries) == 1
        original_snapshot_query = snapshot_queries[0]
        assert original_snapshot_query["fields"] == [
            "transaction",
            "equation|count_if(transaction.duration,less,300)",
            "equation|count_if(transaction.duration,greater,300)",
            "count_unique(user)",
        ]
        assert original_snapshot_query["conditions"] == ""
        assert original_snapshot_query["aggregates"] == [
            "equation|count_if(transaction.duration,less,300)",
            "equation|count_if(transaction.duration,greater,300)",
            "count_unique(user)",
        ]
        assert original_snapshot_query["columns"] == ["transaction"]
        assert original_snapshot_query["fieldAliases"] == [
            "Txn",
            "Count Fast Txn",
            "Count Slow Txn",
            "Unique User",
        ]
        assert original_snapshot_query["orderby"] == "-equation[1]"

        new_queries = DashboardWidgetQuery.objects.filter(widget=transaction_widget)
        assert new_queries.count() == 1

        new_query = new_queries.first()
        assert new_query is not None
        assert new_query.widget_id == transaction_widget.id
        assert new_query.order == 0

        assert new_query.fields == [
            "transaction",
            "equation|count_if(span.duration,less,300)",
            "equation|count_if(span.duration,greater,300)",
            "count_unique(user)",
        ]
        assert new_query.conditions == "is_transaction:1"
        assert new_query.aggregates == [
            "equation|count_if(span.duration,less,300)",
            "equation|count_if(span.duration,greater,300)",
            "count_unique(user)",
        ]
        assert new_query.columns == ["transaction"]
        assert new_query.field_aliases == ["Txn", "Count Fast Txn", "Count Slow Txn", "Unique User"]
        assert new_query.orderby == "-equation[1]"

        assert not DashboardWidgetQuery.objects.filter(id=query.id).exists()

    def test_equations_alias_notation_orderby(self) -> None:
        transaction_widget = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            order=0,
            title="transaction widget",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.TRANSACTION_LIKE,
            interval="1d",
            detail={"layout": {"x": 0, "y": 0, "w": 1, "h": 1, "minH": 2}},
        )
        query = DashboardWidgetQuery.objects.create(
            widget=transaction_widget,
            fields=[
                "transaction",
                "equation|count_if(transaction.duration,less,300)",
                "equation|count_if(transaction.duration,greater,300)",
                "count_unique(user)",
            ],
            columns=["transaction"],
            field_aliases=["Txn", "Count Fast Txn", "Count Slow Txn", "Unique User"],
            aggregates=[
                "equation|count_if(transaction.duration,less,300)",
                "equation|count_if(transaction.duration,greater,300)",
                "count_unique(user)",
            ],
            conditions="",
            orderby="-equation|count() / 100",
            order=0,
        )

        translate_dashboard_widget(transaction_widget)
        transaction_widget.refresh_from_db()

        assert transaction_widget.widget_snapshot
        assert transaction_widget.changed_reason is not None
        assert isinstance(transaction_widget.changed_reason, list)
        assert len(transaction_widget.changed_reason) == 1
        dropped_fields = transaction_widget.changed_reason[0]
        assert dropped_fields["selected_columns"] == []
        assert dropped_fields["equations"] == []
        assert dropped_fields["orderby"] == []

        snapshot_queries = transaction_widget.widget_snapshot["queries"]
        assert len(snapshot_queries) == 1
        original_snapshot_query = snapshot_queries[0]
        assert original_snapshot_query["orderby"] == "-equation|count() / 100"

        new_queries = DashboardWidgetQuery.objects.filter(widget=transaction_widget)
        assert new_queries.count() == 1

        new_query = new_queries.first()
        assert new_query is not None
        assert new_query.widget_id == transaction_widget.id
        assert new_query.order == 0
        assert new_query.fields == [
            "transaction",
            "equation|count_if(span.duration,less,300)",
            "equation|count_if(span.duration,greater,300)",
            "count_unique(user)",
        ]
        assert new_query.orderby == "-equation|count(span.duration) / 100"

        assert not DashboardWidgetQuery.objects.filter(id=query.id).exists()

    def test_drop_equations_alias_notation_orderby(self) -> None:
        transaction_widget = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            order=0,
            title="transaction widget",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.TRANSACTION_LIKE,
            interval="1d",
            detail={"layout": {"x": 0, "y": 0, "w": 1, "h": 1, "minH": 2}},
        )
        query = DashboardWidgetQuery.objects.create(
            widget=transaction_widget,
            fields=[
                "transaction",
                "equation|count_if(transaction.duration,less,300)",
                "equation|count_if(transaction.duration,greater,300)",
                "count_unique(user)",
            ],
            columns=["transaction"],
            field_aliases=["Txn", "Count Fast Txn", "Count Slow Txn", "Unique User"],
            aggregates=[
                "equation|count_if(transaction.duration,less,300)",
                "equation|count_if(transaction.duration,greater,300)",
                "count_unique(user)",
            ],
            conditions="",
            orderby="-equation|count() / total.count",
            order=0,
        )

        translate_dashboard_widget(transaction_widget)
        transaction_widget.refresh_from_db()

        assert transaction_widget.widget_snapshot
        assert transaction_widget.changed_reason is not None
        assert isinstance(transaction_widget.changed_reason, list)
        assert len(transaction_widget.changed_reason) == 1
        dropped_fields = transaction_widget.changed_reason[0]
        assert dropped_fields["selected_columns"] == []
        assert dropped_fields["equations"] == []
        assert len(dropped_fields["orderby"]) == 1
        assert "total.count" in dropped_fields["orderby"][0]["reason"]
        assert dropped_fields["orderby"][0]["orderby"] == "-equation|count() / total.count"

        snapshot_queries = transaction_widget.widget_snapshot["queries"]
        assert len(snapshot_queries) == 1
        original_snapshot_query = snapshot_queries[0]
        assert original_snapshot_query["orderby"] == "-equation|count() / total.count"

        new_queries = DashboardWidgetQuery.objects.filter(widget=transaction_widget)
        assert new_queries.count() == 1

        new_query = new_queries.first()
        assert new_query is not None
        assert new_query.widget_id == transaction_widget.id
        assert new_query.order == 0
        assert new_query.orderby == ""

        assert not DashboardWidgetQuery.objects.filter(id=query.id).exists()

    def test_selected_aggregate_index(self) -> None:
        transaction_widget = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            order=0,
            title="transaction widget",
            display_type=DashboardWidgetDisplayTypes.BIG_NUMBER,
            widget_type=DashboardWidgetTypes.TRANSACTION_LIKE,
            interval="1d",
            detail={"layout": {"x": 0, "y": 0, "w": 1, "h": 1, "minH": 2}},
        )
        query = DashboardWidgetQuery.objects.create(
            widget=transaction_widget,
            fields=["count()", "count_web_vitals(lcp,300)", "count_unique(user)"],
            columns=[],
            aggregates=["count()", "count_web_vitals(lcp,300)", "count_unique(user)"],
            conditions="transaction:foo",
            selected_aggregate=1,
            order=0,
        )

        translate_dashboard_widget(transaction_widget)
        transaction_widget.refresh_from_db()

        assert transaction_widget.widget_snapshot
        assert transaction_widget.changed_reason is not None
        assert isinstance(transaction_widget.changed_reason, list)
        assert len(transaction_widget.changed_reason) == 1
        dropped_fields = transaction_widget.changed_reason[0]
        assert "count_web_vitals(lcp,300)" in dropped_fields["selected_columns"]
        assert dropped_fields["equations"] == []
        assert dropped_fields["orderby"] is None

        snapshot_queries = transaction_widget.widget_snapshot["queries"]
        assert len(snapshot_queries) == 1
        original_snapshot_query = snapshot_queries[0]
        assert original_snapshot_query["fields"] == [
            "count()",
            "count_web_vitals(lcp,300)",
            "count_unique(user)",
        ]
        assert original_snapshot_query["conditions"] == "transaction:foo"
        assert original_snapshot_query["aggregates"] == [
            "count()",
            "count_web_vitals(lcp,300)",
            "count_unique(user)",
        ]
        assert original_snapshot_query["columns"] == []
        assert original_snapshot_query["selectedAggregate"] == 1

        new_queries = DashboardWidgetQuery.objects.filter(widget=transaction_widget)
        assert new_queries.count() == 1

        new_query = new_queries.first()
        assert new_query is not None
        assert new_query.widget_id == transaction_widget.id
        assert new_query.order == 0
        assert new_query.fields == ["count(span.duration)", "count_unique(user)"]
        assert new_query.conditions == "(transaction:foo) AND is_transaction:1"
        assert new_query.aggregates == ["count(span.duration)", "count_unique(user)"]
        assert new_query.columns == []
        assert new_query.selected_aggregate == 0

        assert not DashboardWidgetQuery.objects.filter(id=query.id).exists()

    def test_equations_dropped(self) -> None:
        transaction_widget = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            order=0,
            title="transaction widget",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.TRANSACTION_LIKE,
            interval="1d",
            detail={"layout": {"x": 0, "y": 0, "w": 1, "h": 1, "minH": 2}},
        )
        query = DashboardWidgetQuery.objects.create(
            widget=transaction_widget,
            fields=[
                "equation|count_if(transaction.duration,less,300)",
                "equation|count_if(transaction.duration,greater,300)",
                "equation|count_if(transaction.duration,greater,300) / total.count",
            ],
            columns=[],
            field_aliases=["Count Fast Txn", "Count Slow Txn", "Pct"],
            aggregates=[
                "equation|count_if(transaction.duration,less,300)",
                "equation|count_if(transaction.duration,greater,300)",
                "equation|count_if(transaction.duration,greater,300) / total.count",
            ],
            conditions="",
            orderby="-equation[2]",
            order=0,
        )

        translate_dashboard_widget(transaction_widget)
        transaction_widget.refresh_from_db()

        assert transaction_widget.widget_snapshot
        assert transaction_widget.changed_reason is not None
        assert isinstance(transaction_widget.changed_reason, list)
        assert len(transaction_widget.changed_reason) == 1
        dropped_fields = transaction_widget.changed_reason[0]
        assert dropped_fields["selected_columns"] == []
        assert len(dropped_fields["equations"]) == 1
        assert (
            dropped_fields["equations"][0]["equation"]
            == "equation|count_if(transaction.duration,greater,300) / total.count"
        )
        assert "total.count" in dropped_fields["equations"][0]["reason"]
        assert len(dropped_fields["orderby"]) == 1
        assert (
            dropped_fields["orderby"][0]["orderby"]
            == "-equation|count_if(transaction.duration,greater,300) / total.count"
        )

        snapshot_queries = transaction_widget.widget_snapshot["queries"]
        assert len(snapshot_queries) == 1
        original_snapshot_query = snapshot_queries[0]
        assert original_snapshot_query["fields"] == [
            "equation|count_if(transaction.duration,less,300)",
            "equation|count_if(transaction.duration,greater,300)",
            "equation|count_if(transaction.duration,greater,300) / total.count",
        ]
        assert original_snapshot_query["conditions"] == ""
        assert original_snapshot_query["aggregates"] == [
            "equation|count_if(transaction.duration,less,300)",
            "equation|count_if(transaction.duration,greater,300)",
            "equation|count_if(transaction.duration,greater,300) / total.count",
        ]
        assert original_snapshot_query["columns"] == []
        assert original_snapshot_query["fieldAliases"] == [
            "Count Fast Txn",
            "Count Slow Txn",
            "Pct",
        ]
        assert original_snapshot_query["orderby"] == "-equation[2]"

        new_queries = DashboardWidgetQuery.objects.filter(widget=transaction_widget)
        assert new_queries.count() == 1

        new_query = new_queries.first()
        assert new_query is not None
        assert new_query.widget_id == transaction_widget.id
        assert new_query.order == 0

        assert new_query.fields == [
            "equation|count_if(span.duration,less,300)",
            "equation|count_if(span.duration,greater,300)",
        ]
        assert new_query.conditions == "is_transaction:1"
        assert new_query.aggregates == [
            "equation|count_if(span.duration,less,300)",
            "equation|count_if(span.duration,greater,300)",
        ]
        assert new_query.columns == []
        assert new_query.field_aliases == ["Count Fast Txn", "Count Slow Txn"]
        assert new_query.orderby == ""

        assert not DashboardWidgetQuery.objects.filter(id=query.id).exists()

    def test_widget_with_translatable_dropped_fields(self) -> None:
        transaction_widget = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            order=0,
            title="transaction widget",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.TRANSACTION_LIKE,
            interval="1d",
            detail={"layout": {"x": 0, "y": 0, "w": 1, "h": 1, "minH": 2}},
        )

        DashboardWidgetQuery.objects.create(
            widget=transaction_widget,
            # any(transaction.duration) has transaction.duration that could be translated to span.duration but shouldn't
            fields=["transaction", "any(transaction.duration)"],
            columns=["transaction"],
            field_aliases=[""],
            aggregates=["any(transaction.duration)"],
            conditions="title:*whatsapp*",
            orderby="-transaction",
            order=0,
        )

        translate_dashboard_widget(transaction_widget)
        transaction_widget.refresh_from_db()

        assert transaction_widget.widget_snapshot
        assert transaction_widget.changed_reason is not None
        assert isinstance(transaction_widget.changed_reason, list)
        assert len(transaction_widget.changed_reason) == 1
        dropped_fields = transaction_widget.changed_reason[0]
        assert "any(transaction.duration)" in dropped_fields["selected_columns"]
        assert dropped_fields["equations"] == []
        assert len(dropped_fields["orderby"]) == 0

        snapshot_queries = transaction_widget.widget_snapshot["queries"]
        assert len(snapshot_queries) == 1

        new_queries = DashboardWidgetQuery.objects.filter(widget=transaction_widget)
        assert new_queries.count() == 1

        new_query = new_queries.first()

        assert new_query is not None
        assert new_query.fields == ["transaction"]
        assert new_query.conditions == "(transaction:*whatsapp*) AND is_transaction:1"
        assert new_query.aggregates == []
        assert new_query.columns == ["transaction"]

    def test_selected_aggregate_out_of_range(self) -> None:
        transaction_widget = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            order=0,
            title="transaction widget",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.TRANSACTION_LIKE,
            interval="1d",
        )
        DashboardWidgetQuery.objects.create(
            widget=transaction_widget,
            fields=["count()", "count_unique(user)"],
            columns=[],
            aggregates=["count()", "count_unique(user)"],
            conditions="transaction:foo",
            selected_aggregate=14,
            order=0,
        )

        translate_dashboard_widget(transaction_widget)
        transaction_widget.refresh_from_db()

        assert transaction_widget.widget_snapshot
        assert transaction_widget.changed_reason is not None

        snapshot_queries = transaction_widget.widget_snapshot["queries"]
        assert len(snapshot_queries) == 1
        original_snapshot_query = snapshot_queries[0]
        assert original_snapshot_query["fields"] == ["count()", "count_unique(user)"]
        assert original_snapshot_query["conditions"] == "transaction:foo"
        assert original_snapshot_query["aggregates"] == ["count()", "count_unique(user)"]
        assert original_snapshot_query["columns"] == []
        assert original_snapshot_query["selectedAggregate"] == 14

        new_queries = DashboardWidgetQuery.objects.filter(widget=transaction_widget)
        assert new_queries.count() == 1
        new_query = new_queries.first()
        assert new_query is not None
        assert new_query.widget_id == transaction_widget.id
        assert new_query.fields == ["count(span.duration)", "count_unique(user)"]
        assert new_query.conditions == "(transaction:foo) AND is_transaction:1"
        assert new_query.aggregates == ["count(span.duration)", "count_unique(user)"]
        assert new_query.columns == []
        assert new_query.selected_aggregate is None

    def test_query_with_orderby_not_in_selected_fields(self) -> None:
        transaction_widget = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            order=0,
            title="transaction widget",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.TRANSACTION_LIKE,
            interval="1d",
            limit=2,
        )
        DashboardWidgetQuery.objects.create(
            widget=transaction_widget,
            fields=["title", "count()"],
            columns=["title"],
            aggregates=["count()"],
            orderby="-p50(transaction.duration)",
            conditions="transaction:foo",
            order=0,
        )

        translate_dashboard_widget(transaction_widget)
        transaction_widget.refresh_from_db()

        assert transaction_widget.widget_snapshot

        new_queries = DashboardWidgetQuery.objects.filter(widget=transaction_widget)
        assert new_queries.count() == 1
        new_query = new_queries.first()
        assert new_query is not None
        assert new_query.widget_id == transaction_widget.id
        assert new_query.fields == ["transaction", "count(span.duration)"]
        assert new_query.conditions == "(transaction:foo) AND is_transaction:1"
        assert new_query.aggregates == ["count(span.duration)"]
        assert new_query.columns == ["transaction"]
        assert new_query.orderby == "-p50(span.duration)"
        assert new_query.selected_aggregate is None


class DashboardRestoreTransactionWidgetTestCase(TestCase):
    @property
    def now(self) -> datetime:
        return before_now(minutes=10)

    def setUp(self) -> None:
        super().setUp()
        self.org = self.create_organization()
        with assume_test_silo_mode_of(User):
            self.user = User.objects.create(email="test@sentry.io")
        self.project_2 = self.create_project(organization=self.org)
        self.project_3 = self.create_project(organization=self.org)

        self.dashboard = Dashboard.objects.create(
            title="Dashboard With Split Widgets",
            created_by_id=self.user.id,
            organization=self.organization,
        )
        self.dashboard.projects.set([self.project, self.project_2])

    def test_simple_case_restore(self) -> None:
        transaction_widget = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            order=0,
            title="transaction widget",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.TRANSACTION_LIKE,
            interval="1d",
            detail={"layout": {"x": 0, "y": 0, "w": 1, "h": 1, "minH": 2}},
        )
        original_query = DashboardWidgetQuery.objects.create(
            widget=transaction_widget,
            name="Test Query",
            fields=["release", "count()", "count_unique(user)"],
            columns=["release"],
            aggregates=["count()", "count_unique(user)"],
            conditions="transaction:foo",
            field_aliases=["Release", "Count", "Unique Users"],
            orderby="count()",
            is_hidden=False,
            selected_aggregate=1,
            order=0,
        )

        original_widget_type = transaction_widget.widget_type
        original_query_name = original_query.name
        original_query_fields = original_query.fields
        original_query_conditions = original_query.conditions
        original_query_aggregates = original_query.aggregates
        original_query_columns = original_query.columns
        original_query_field_aliases = original_query.field_aliases
        original_query_orderby = original_query.orderby
        original_query_is_hidden = original_query.is_hidden
        original_query_selected_aggregate = original_query.selected_aggregate
        original_query_order = original_query.order

        translate_dashboard_widget(transaction_widget)
        transaction_widget.refresh_from_db()

        # Verify translation occurred
        assert transaction_widget.widget_type == DashboardWidgetTypes.SPANS
        assert (
            transaction_widget.dataset_source == DatasetSourcesTypes.SPAN_MIGRATION_VERSION_5.value
        )
        assert transaction_widget.widget_snapshot is not None

        restore_transaction_widget(transaction_widget)
        transaction_widget.refresh_from_db()

        assert transaction_widget.widget_type == original_widget_type
        assert (
            transaction_widget.dataset_source
            == DatasetSourcesTypes.RESTORED_SPAN_MIGRATION_VERSION_1.value
        )
        assert transaction_widget.changed_reason is None

        restored_queries = DashboardWidgetQuery.objects.filter(widget=transaction_widget)
        assert restored_queries.count() == 1

        restored_query = restored_queries.first()
        assert restored_query is not None
        assert restored_query.widget_id == transaction_widget.id
        assert restored_query.name == original_query_name
        assert restored_query.fields == original_query_fields
        assert restored_query.conditions == original_query_conditions
        assert restored_query.aggregates == original_query_aggregates
        assert restored_query.columns == original_query_columns
        assert restored_query.field_aliases == original_query_field_aliases
        assert restored_query.orderby == original_query_orderby
        assert restored_query.is_hidden == original_query_is_hidden
        assert restored_query.selected_aggregate == original_query_selected_aggregate
        assert restored_query.order == original_query_order

    def test_widget_with_not_all_fields(self) -> None:
        transaction_widget = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            order=0,
            title="transaction widget",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.TRANSACTION_LIKE,
            interval="1d",
            detail={"layout": {"x": 0, "y": 0, "w": 1, "h": 1, "minH": 2}},
        )
        query = DashboardWidgetQuery.objects.create(
            widget=transaction_widget,
            fields=["release", "total.count"],
            columns=["release", "total.count"],
            field_aliases=[],
            aggregates=["count()", "count_unique(user)"],
            conditions="transaction:foo",
            orderby="total.count",
            order=0,
        )

        translate_dashboard_widget(transaction_widget)
        transaction_widget.refresh_from_db()

        assert transaction_widget.widget_snapshot
        assert transaction_widget.changed_reason is not None
        assert isinstance(transaction_widget.changed_reason, list)
        assert len(transaction_widget.changed_reason) == 1
        dropped_fields = transaction_widget.changed_reason[0]
        assert "total.count" in dropped_fields["selected_columns"]
        assert dropped_fields["equations"] == []
        assert len(dropped_fields["orderby"]) == 1
        assert dropped_fields["orderby"][0]["orderby"] == "total.count"

        snapshot_queries = transaction_widget.widget_snapshot["queries"]
        assert len(snapshot_queries) == 1
        original_snapshot_query = snapshot_queries[0]
        assert original_snapshot_query["fields"] == [
            "release",
            "total.count",
        ]
        assert original_snapshot_query["conditions"] == "transaction:foo"
        assert original_snapshot_query["aggregates"] == ["count()", "count_unique(user)"]
        assert original_snapshot_query["columns"] == ["release", "total.count"]
        assert original_snapshot_query["fieldAliases"] == []
        assert original_snapshot_query["orderby"] == "total.count"

        new_queries = DashboardWidgetQuery.objects.filter(widget=transaction_widget)
        assert new_queries.count() == 1

        new_query = new_queries.first()
        assert new_query is not None
        assert new_query.widget_id == transaction_widget.id
        assert new_query.order == 0

        assert new_query.fields == ["release"]
        assert new_query.conditions == "(transaction:foo) AND is_transaction:1"
        assert new_query.aggregates == ["count(span.duration)", "count_unique(user)"]
        assert new_query.columns == ["release"]
        assert new_query.field_aliases == []
        assert new_query.orderby == ""

        assert not DashboardWidgetQuery.objects.filter(id=query.id).exists()
