from sentry.discover.models import DiscoverSavedQuery, DiscoverSavedQueryTypes
from sentry.explore.models import ExploreSavedQuery, ExploreSavedQueryDataset
from sentry.explore.translation.discover_translation import (
    translate_discover_query_to_explore_query,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now


class DiscoverToExploreTranslationTest(TestCase):
    def create_discover_query(self, name: str, query: dict, explore_query=None):
        discover_saved_query = DiscoverSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name=name,
            version=2,
            query=query,
            date_created=before_now(minutes=10),
            date_updated=before_now(minutes=10),
            visits=1,
            last_visited=before_now(minutes=5),
            dataset=DiscoverSavedQueryTypes.TRANSACTION_LIKE,
            explore_query=explore_query,
        )
        discover_saved_query.set_projects([self.project1.id, self.project2.id])

        return discover_saved_query

    def setUp(self):
        super().setUp()
        self.user = self.create_user()
        self.org = self.create_organization(owner=self.user)
        self.project1 = self.create_project(organization=self.org)
        self.project2 = self.create_project(organization=self.org)

        self.env = self.create_environment(project=self.project1)

        self.existing_explore_query = {
            "query": "is_transaction:1",
            "range": "14d",
            "aggregateField": [
                {"groupBy": "id"},
                {"groupBy": "title"},
                {"groupBy": "timestamp"},
                {"yAxes": ["count()"], "chartType": 2},
            ],
            "fields": ["id", "title", "timestamp"],
            "orderby": "-timestamp",
            "display": "default",
            "environment": [],
        }

        self.existing_explore_query_saved_query = ExploreSavedQuery.objects.create(
            id=12345,
            organization=self.org,
            created_by_id=self.user.id,
            name="Existing explore query",
            query=self.existing_explore_query,
        )

    def test_translate_simple_discover_to_explore_query(self):
        self.simple_query = {
            "query": "event.type:transaction",
            "range": "14d",
            "yAxis": ["count()"],
            "fields": ["id", "title", "timestamp"],
            "orderby": "-timestamp",
            "display": "default",
            "environment": [],
        }
        self.simple_saved_query = self.create_discover_query("Simple query", self.simple_query)

        new_explore_query = translate_discover_query_to_explore_query(self.simple_saved_query)
        assert new_explore_query.organization == self.org
        assert new_explore_query.created_by_id == self.user.id
        assert new_explore_query.name == "Simple query"
        assert new_explore_query.dataset == ExploreSavedQueryDataset.SEGMENT_SPANS
        assert new_explore_query.is_multi_query is False
        assert new_explore_query.organization == self.org
        assert new_explore_query.created_by_id == self.user.id

        base_query = new_explore_query.query
        assert base_query["environment"] == []
        assert base_query["range"] == "14d"

        query = base_query["query"][0]
        assert query["fields"] == ["id", "transaction", "timestamp"]
        assert query["query"] == "(is_transaction:1) AND is_transaction:1"
        assert query["mode"] == "samples"
        assert query["aggregateField"] == [
            {"yAxes": ["count(span.duration)"], "chartType": 2},
        ]
        assert query["aggregateOrderby"] is None
        assert query["orderby"] == "-timestamp"

    def test_translate_multiple_axis_discover_to_explore_query(self):
        self.multiple_axis_query = {
            "query": "",
            "range": "14d",
            "yAxis": ["count()", "percentile(transaction.duration,0.45)"],
            "fields": ["id", "title", "timestamp", "percentile(transaction.duration,0.45)"],
            "orderby": "-timestamp",
            "display": "default",
            "environment": [],
        }
        self.multiple_axis_saved_query = self.create_discover_query(
            "Multiple axis query", self.multiple_axis_query
        )

        new_explore_query = translate_discover_query_to_explore_query(
            self.multiple_axis_saved_query
        )
        assert new_explore_query.name == "Multiple axis query"

        query = new_explore_query.query["query"][0]
        assert query["fields"] == ["id", "transaction", "timestamp"]
        assert query["query"] == "is_transaction:1"
        assert query["mode"] == "samples"
        assert query["aggregateField"] == [
            {"yAxes": ["p50(span.duration)"], "chartType": 2},
            {"yAxes": ["count(span.duration)"], "chartType": 2},
        ]
        assert query["aggregateOrderby"] is None
        assert query["orderby"] == "-timestamp"

    def test_translate_function_orderby_discover_to_explore_query(self):
        self.function_orderby_query = {
            "query": "",
            "range": "14d",
            "yAxis": ["count()", "percentile(transaction.duration,0.45)"],
            "fields": ["id", "title", "timestamp", "percentile(transaction.duration,0.45)"],
            "orderby": "-percentile_transaction_duration_0_45",
            "display": "default",
            "environment": [],
        }

        self.function_orderby_saved_query = self.create_discover_query(
            "Function orderby query", self.function_orderby_query
        )

        new_explore_query = translate_discover_query_to_explore_query(
            self.function_orderby_saved_query
        )
        assert new_explore_query.name == "Function orderby query"

        query = new_explore_query.query["query"][0]
        assert query["fields"] == ["id", "transaction", "timestamp"]
        assert query["query"] == "is_transaction:1"
        assert query["mode"] == "samples"
        assert query["aggregateField"] == [
            {"yAxes": ["p50(span.duration)"], "chartType": 2},
            {"yAxes": ["count(span.duration)"], "chartType": 2},
        ]
        assert query["aggregateOrderby"] == "-p50(span.duration)"
        assert query["orderby"] is None

    def test_translate_filter_swap_discover_to_explore_query(self):
        self.filter_swap_query = {
            "query": "geo.country_code:CA AND geo.city:Toronto",
            "range": "14d",
            "yAxis": ["count()"],
            "fields": ["id", "timestamp"],
            "orderby": "-timestamp",
            "display": "bar",
            "environment": [],
        }
        self.filter_swap_saved_query = self.create_discover_query(
            "Filter swap query", self.filter_swap_query
        )

        new_explore_query = translate_discover_query_to_explore_query(self.filter_swap_saved_query)
        assert new_explore_query.name == "Filter swap query"

        query = new_explore_query.query["query"][0]
        assert query["fields"] == ["id", "timestamp"]
        assert (
            query["query"]
            == "(user.geo.country_code:CA AND user.geo.city:Toronto) AND is_transaction:1"
        )
        assert query["mode"] == "samples"
        assert query["aggregateField"] == [
            {"yAxes": ["count(span.duration)"], "chartType": 0},
        ]
        assert query["aggregateOrderby"] is None
        assert query["orderby"] == "-timestamp"

    def test_translate_drop_swap_function_field_orderby_filter_discover_to_explore_query(self):
        self.drop_swap_function_field_orderby_filter_query = {
            "query": "platform.name:python AND count_miserable(users):>100",
            "range": "14d",
            "yAxis": ["apdex()", "count_miserable(users)", "max(measurements.cls)"],
            "fields": [
                "id",
                "title",
                "http.url",
                "total.count",
                "apdex()",
                "count_miserable(users)",
                "max(measurements.cls)",
            ],
            "orderby": "-count_miserable_users",
            "display": "top5",
            "environment": [],
        }
        self.drop_swap_function_field_orderby_filter_saved_query = self.create_discover_query(
            "Query with lots of drops+swaps", self.drop_swap_function_field_orderby_filter_query
        )

        new_explore_query = translate_discover_query_to_explore_query(
            self.drop_swap_function_field_orderby_filter_saved_query
        )
        assert new_explore_query.name == "Query with lots of drops+swaps"
        assert new_explore_query.changed_reason is not None
        assert new_explore_query.changed_reason["columns"] == [
            "total.count",
            "count_miserable(users)",
        ]
        assert new_explore_query.changed_reason["equations"] == []
        assert new_explore_query.changed_reason["orderby"] == [
            {
                "orderby": "-count_miserable(users)",
                "reason": ["count_miserable(users)"],
            }
        ]

        query = new_explore_query.query["query"][0]
        assert query["fields"] == ["id", "transaction", "request.url"]
        assert (
            query["query"]
            == "(platform:python AND count_miserable(users):>100) AND is_transaction:1"
        )
        assert query["mode"] == "aggregate"
        assert query["aggregateField"] == [
            {"groupBy": "transaction"},
            {"groupBy": "request.url"},
            {"yAxes": ["equation|apdex(span.duration,300)"], "chartType": 2},
            {"yAxes": ["max(measurements.cls)"], "chartType": 2},
        ]
        assert query["aggregateOrderby"] is None
        assert query["orderby"] is None

    def test_translate_non_default_display_discover_to_explore_query(self):
        self.non_default_display_query = {
            "query": "",
            "range": "14d",
            "yAxis": ["count()"],
            "fields": ["id", "timestamp"],
            "orderby": "-timestamp",
            "display": "daily",
            "environment": [],
        }
        self.non_default_display_saved_query = self.create_discover_query(
            "Non default display query", self.non_default_display_query
        )

        new_explore_query = translate_discover_query_to_explore_query(
            self.non_default_display_saved_query
        )
        assert new_explore_query.name == "Non default display query"
        assert new_explore_query.query["interval"] == "1d"

        query = new_explore_query.query["query"][0]
        assert query["fields"] == ["id", "timestamp"]
        assert query["query"] == "is_transaction:1"
        assert query["mode"] == "samples"
        assert query["aggregateField"] == [
            {"yAxes": ["count(span.duration)"], "chartType": 0},
        ]
        assert query["aggregateOrderby"] is None
        assert query["orderby"] == "-timestamp"

    def test_translate_start_end_time_discover_to_explore_query(self):
        self.start_end_time_query = {
            "query": "",
            "start": "2025-01-01",
            "end": "2025-01-20",
            "yAxis": ["count()"],
            "fields": ["id", "timestamp"],
            "orderby": "-timestamp",
            "display": "default",
            "environment": [self.env.name],
        }
        self.start_end_time_saved_query = self.create_discover_query(
            "Start end time query", self.start_end_time_query
        )

        new_explore_query = translate_discover_query_to_explore_query(
            self.start_end_time_saved_query
        )
        assert new_explore_query.name == "Start end time query"
        assert new_explore_query.query["start"] == "2025-01-01"
        assert new_explore_query.query["end"] == "2025-01-20"
        assert new_explore_query.query["environment"] == [self.env.name]

    def test_translate_equation_indexed_orderby_discover_to_explore_query(self):
        self.equation_indexed_orderby_query = {
            "query": "",
            "range": "14d",
            "yAxis": ["count()"],
            "fields": ["id", "timestamp", "equation|count() + 5"],
            "orderby": "-equation[0]",
            "display": "default",
            "environment": [],
        }
        self.equation_indexed_orderby_saved_query = self.create_discover_query(
            "Equation indexed orderby query", self.equation_indexed_orderby_query
        )

        new_explore_query = translate_discover_query_to_explore_query(
            self.equation_indexed_orderby_saved_query
        )
        assert new_explore_query.name == "Equation indexed orderby query"

        query = new_explore_query.query["query"][0]
        assert query["aggregateOrderby"] == "-equation|count(span.duration) + 5"
        assert query["orderby"] is None

    def test_translate_discover_query_to_explore_query_with_existing_explore_query(self):
        self.existing_explore_discover_query = {
            "query": "event.type:transaction",
            "range": "14d",
            "yAxis": ["count()"],
            "fields": ["id", "title", "timestamp"],
            "orderby": "-timestamp",
            "display": "default",
            "environment": [],
        }
        self.existing_explore_discover_query_saved_query = self.create_discover_query(
            "Existing explore query",
            self.existing_explore_discover_query,
            self.existing_explore_query_saved_query,
        )

        new_explore_query = translate_discover_query_to_explore_query(
            self.existing_explore_discover_query_saved_query
        )
        assert new_explore_query.name == "Existing explore query"
        assert new_explore_query.id == self.existing_explore_query_saved_query.id

        query = new_explore_query.query["query"][0]
        assert query["fields"] == ["id", "transaction", "timestamp"]
        assert query["query"] == "(is_transaction:1) AND is_transaction:1"
        assert query["aggregateField"] == [
            {"yAxes": ["count(span.duration)"], "chartType": 2},
        ]
        assert query["aggregateOrderby"] is None
        assert query["orderby"] == "-timestamp"

    def test_translate_dicover_query_with_count_web_vitals_orderby(self):
        self.count_web_vitals_query = {
            "query": "",
            "range": "14d",
            "yAxis": ["count_web_vitals(measurements.lcp,good)"],
            "fields": ["title", "project", "timestamp", "count_web_vitals(measurements.lcp,good)"],
            "orderby": "-count_web_vitals_measurements_lcp_good",
            "display": "default",
        }
        self.count_web_vitals_saved_query = self.create_discover_query(
            "Count web vitals query", self.count_web_vitals_query
        )

        new_explore_query = translate_discover_query_to_explore_query(
            self.count_web_vitals_saved_query
        )
        assert new_explore_query.name == "Count web vitals query"

        query = new_explore_query.query["query"][0]
        assert query["fields"] == ["id", "transaction", "project", "timestamp"]
        assert query["query"] == "is_transaction:1"
        assert query["mode"] == "samples"
        assert query["aggregateOrderby"] is None
        assert query["orderby"] is None
