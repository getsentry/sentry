from datetime import timedelta
from unittest.mock import patch

import pytest

from sentry.exceptions import InvalidSearchQuery
from sentry.models.transaction_threshold import ProjectTransactionThreshold, TransactionMetric
from sentry.search.events.types import EventsResponse, SnubaParams
from sentry.snuba import transactions
from sentry.snuba.dataset import Dataset
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.utils.samples import load_data

ARRAY_COLUMNS = ["measurements", "span_op_breakdowns"]


class TimeseriesBase(SnubaTestCase, TestCase):
    def setUp(self):
        super().setUp()

        self.one_min_ago = before_now(minutes=1)
        self.day_ago = before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0)

        # transaction event
        data = load_data("transaction", timestamp=self.day_ago + timedelta(hours=1))
        data["event_id"] = "a" * 32
        data["transaction"] = "very bad"
        data["user"] = {"id": 1}
        data["tags"] = {"important": "yes"}
        self.store_event(data=data, project_id=self.project.id)

        data = load_data("transaction", timestamp=self.day_ago + timedelta(hours=1, minutes=1))
        data["event_id"] = "b" * 32
        data["transaction"] = "oh my"
        data["user"] = {}
        data["tags"] = {"important": "no"}
        self.store_event(data=data, project_id=self.project.id)

        data = load_data("transaction", timestamp=self.day_ago + timedelta(hours=2, minutes=1))
        data["event_id"] = "c" * 32
        data["transaction"] = "very bad"
        data["user"] = {}
        data["tags"] = {"important": "yes"}
        self.store_event(data=data, project_id=self.project.id)


class TransactionsTimeseriesQueryTest(TimeseriesBase):
    def test_invalid_field_in_function(self):
        with pytest.raises(InvalidSearchQuery):
            transactions.timeseries_query(
                selected_columns=["min(transaction)"],
                query="transaction:api.issue.delete",
                referrer="test_discover_query",
                snuba_params=SnubaParams(
                    start=self.day_ago,
                    end=self.day_ago + timedelta(hours=2),
                    projects=[self.project],
                ),
                rollup=1800,
            )

    def test_missing_start_and_end(self):
        with pytest.raises(InvalidSearchQuery):
            transactions.timeseries_query(
                selected_columns=["count()"],
                query="transaction:api.issue.delete",
                referrer="test_discover_query",
                snuba_params=SnubaParams(start=self.day_ago),
                rollup=1800,
            )

    def test_no_aggregations(self):
        with pytest.raises(InvalidSearchQuery):
            transactions.timeseries_query(
                selected_columns=["transaction", "title"],
                query="transaction:api.issue.delete",
                referrer="test_discover_query",
                snuba_params=SnubaParams(
                    start=self.day_ago,
                    end=self.day_ago + timedelta(hours=2),
                    projects=[self.project],
                ),
                rollup=1800,
            )

    def test_field_alias(self):
        result = transactions.timeseries_query(
            selected_columns=["p95()"],
            query="event.type:transaction transaction:api.issue.delete",
            referrer="test_discover_query",
            snuba_params=SnubaParams(
                start=self.day_ago,
                end=self.day_ago + timedelta(hours=2),
                projects=[self.project],
            ),
            rollup=3600,
        )
        assert len(result.data["data"]) == 3

    def test_failure_rate_field_alias(self):
        result = transactions.timeseries_query(
            selected_columns=["failure_rate()"],
            query="event.type:transaction transaction:api.issue.delete",
            referrer="test_discover_query",
            snuba_params=SnubaParams(
                start=self.day_ago,
                end=self.day_ago + timedelta(hours=2),
                projects=[self.project],
            ),
            rollup=3600,
        )
        assert len(result.data["data"]) == 3

    def test_aggregate_function(self):
        result = transactions.timeseries_query(
            selected_columns=["count()"],
            query="",
            referrer="test_discover_query",
            snuba_params=SnubaParams(
                start=self.day_ago,
                end=self.day_ago + timedelta(hours=2),
                projects=[self.project],
            ),
            rollup=3600,
        )
        assert len(result.data["data"]) == 3
        assert [2] == [val["count"] for val in result.data["data"] if "count" in val]

        result = transactions.timeseries_query(
            selected_columns=["count_unique(user)"],
            query="",
            referrer="test_discover_query",
            snuba_params=SnubaParams(
                start=self.day_ago,
                end=self.day_ago + timedelta(hours=2),
                projects=[self.project],
            ),
            rollup=3600,
        )
        assert len(result.data["data"]) == 3
        keys = set()
        for row in result.data["data"]:
            keys.update(list(row.keys()))
        assert "count_unique_user" in keys
        assert "time" in keys

    def test_comparison_aggregate_function_invalid(self):
        with pytest.raises(
            InvalidSearchQuery, match="Only one column can be selected for comparison queries"
        ):
            transactions.timeseries_query(
                selected_columns=["count()", "count_unique(user)"],
                query="",
                referrer="test_discover_query",
                snuba_params=SnubaParams(
                    start=self.day_ago,
                    end=self.day_ago + timedelta(hours=2),
                    projects=[self.project],
                ),
                rollup=3600,
                comparison_delta=timedelta(days=1),
            )

    def test_comparison_aggregate_function(self):
        data = load_data("transaction", timestamp=self.day_ago + timedelta(hours=1))
        data["user"] = {"id": 1}
        self.store_event(data=data, project_id=self.project.id)

        result = transactions.timeseries_query(
            selected_columns=["count()"],
            query="",
            referrer="test_discover_query",
            snuba_params=SnubaParams(
                start=self.day_ago,
                end=self.day_ago + timedelta(hours=2),
                projects=[self.project],
            ),
            rollup=3600,
            comparison_delta=timedelta(days=1),
        )
        assert len(result.data["data"]) == 3
        # Values should all be 0, since there is no comparison period data at all.
        assert [(0, 0), (3, 0), (0, 0)] == [
            (val.get("count", 0), val.get("comparisonCount", 0)) for val in result.data["data"]
        ]

        data = load_data("transaction", timestamp=self.day_ago + timedelta(days=-1, hours=1))
        data["user"] = {"id": 1}
        self.store_event(data=data, project_id=self.project.id)

        data = load_data(
            "transaction", timestamp=self.day_ago + timedelta(days=-1, hours=1, minutes=2)
        )
        data["user"] = {"id": 2}
        self.store_event(data=data, project_id=self.project.id)

        data = load_data(
            "transaction", timestamp=self.day_ago + timedelta(days=-1, hours=2, minutes=1)
        )
        data["user"] = {}
        self.store_event(data=data, project_id=self.project.id)

        result = transactions.timeseries_query(
            selected_columns=["count()"],
            query="",
            referrer="test_discover_query",
            snuba_params=SnubaParams(
                start=self.day_ago,
                end=self.day_ago + timedelta(hours=2, minutes=1),
                projects=[self.project],
            ),
            rollup=3600,
            comparison_delta=timedelta(days=1),
        )
        assert len(result.data["data"]) == 3
        # In the second bucket we have 3 events in the current period and 2 in the comparison, so
        # we get a result of 50% increase
        assert [(0, 0), (3, 2), (0, 0)] == [
            (val.get("count", 0), val.get("comparisonCount", 0)) for val in result.data["data"]
        ]

        result = transactions.timeseries_query(
            selected_columns=["count_unique(user)"],
            query="",
            snuba_params=SnubaParams(
                start=self.day_ago,
                end=self.day_ago + timedelta(hours=2, minutes=2),
                projects=[self.project],
            ),
            rollup=3600,
            referrer="test_discover_query",
            comparison_delta=timedelta(days=1),
        )
        assert len(result.data["data"]) == 3
        # In the second bucket we have 1 unique user in the current period and 2 in the comparison, so
        # we get a result of -50%
        assert [(0, 0), (1, 2), (0, 0)] == [
            (val.get("count_unique_user", 0), val.get("comparisonCount", 0))
            for val in result.data["data"]
        ]

    def test_count_miserable(self):
        event_data = load_data("transaction")
        event_data["transaction"] = "api/foo/"
        # Half of duration so we don't get weird rounding differences when comparing the results
        event_data["breakdowns"]["span_ops"]["ops.http"]["value"] = 300
        event_data["start_timestamp"] = (self.day_ago + timedelta(minutes=30)).isoformat()
        event_data["timestamp"] = (self.day_ago + timedelta(minutes=30, seconds=3)).isoformat()
        self.store_event(data=event_data, project_id=self.project.id)
        ProjectTransactionThreshold.objects.create(
            project=self.project,
            organization=self.project.organization,
            threshold=100,
            metric=TransactionMetric.DURATION.value,
        )

        project2 = self.create_project()
        ProjectTransactionThreshold.objects.create(
            project=project2,
            organization=project2.organization,
            threshold=100,
            metric=TransactionMetric.DURATION.value,
        )

        result = transactions.timeseries_query(
            selected_columns=["count_miserable(user)"],
            referrer="test_discover_query",
            query="transaction:api/foo/",
            snuba_params=SnubaParams(
                start=self.day_ago,
                end=self.day_ago + timedelta(hours=2),
                projects=[self.project, project2],
                organization=self.organization,
            ),
            rollup=3600,
        )
        assert len(result.data["data"]) == 3
        assert [1] == [
            val["count_miserable_user"]
            for val in result.data["data"]
            if "count_miserable_user" in val
        ]

    def test_count_miserable_with_arithmetic(self):
        event_data = load_data("transaction")
        event_data["transaction"] = "api/foo/"
        # Half of duration so we don't get weird rounding differences when comparing the results
        event_data["breakdowns"]["span_ops"]["ops.http"]["value"] = 300
        event_data["start_timestamp"] = (self.day_ago + timedelta(minutes=30)).isoformat()
        event_data["timestamp"] = (self.day_ago + timedelta(minutes=30, seconds=3)).isoformat()
        self.store_event(data=event_data, project_id=self.project.id)
        ProjectTransactionThreshold.objects.create(
            project=self.project,
            organization=self.project.organization,
            threshold=100,
            metric=TransactionMetric.DURATION.value,
        )

        project2 = self.create_project()
        ProjectTransactionThreshold.objects.create(
            project=project2,
            organization=project2.organization,
            threshold=100,
            metric=TransactionMetric.DURATION.value,
        )

        result = transactions.timeseries_query(
            selected_columns=["equation|count_miserable(user) - 100"],
            referrer="test_discover_query",
            query="transaction:api/foo/",
            snuba_params=SnubaParams(
                start=self.day_ago,
                end=self.day_ago + timedelta(hours=2),
                projects=[self.project, project2],
                organization=self.organization,
            ),
            rollup=3600,
        )
        assert len(result.data["data"]) == 3
        assert [1 - 100] == [
            val["equation[0]"] for val in result.data["data"] if "equation[0]" in val
        ]

    def test_equation_function(self):
        result = transactions.timeseries_query(
            selected_columns=["equation|count() / 100"],
            query="",
            referrer="test_discover_query",
            snuba_params=SnubaParams(
                start=self.day_ago,
                end=self.day_ago + timedelta(hours=2),
                projects=[self.project],
            ),
            rollup=3600,
        )
        assert len(result.data["data"]) == 3
        assert [0.02] == [val["equation[0]"] for val in result.data["data"] if "equation[0]" in val]

        result = transactions.timeseries_query(
            selected_columns=["equation|count_unique(user) / 100"],
            query="",
            snuba_params=SnubaParams(
                start=self.day_ago,
                end=self.day_ago + timedelta(hours=2),
                projects=[self.project],
            ),
            rollup=3600,
            referrer="test_discover_query",
        )
        assert len(result.data["data"]) == 3
        keys = set()
        for row in result.data["data"]:
            keys.update(list(row.keys()))
        assert "equation[0]" in keys
        assert "time" in keys

    def test_zerofilling(self):
        result = transactions.timeseries_query(
            selected_columns=["count()"],
            query="",
            referrer="test_discover_query",
            snuba_params=SnubaParams(
                start=self.day_ago,
                end=self.day_ago + timedelta(hours=3),
                projects=[self.project],
            ),
            rollup=3600,
        )
        assert len(result.data["data"]) == 4, "Should have empty results"
        assert [2, 1] == [
            val["count"] for val in result.data["data"] if "count" in val
        ], result.data["data"]

    def test_conditional_filter(self):
        project2 = self.create_project(organization=self.organization)
        project3 = self.create_project(organization=self.organization)

        data = load_data("transaction", timestamp=self.one_min_ago)
        self.store_event(data=data, project_id=project2.id)

        data = load_data("transaction", timestamp=self.one_min_ago)
        self.store_event(data=data, project_id=project3.id)

        result = transactions.timeseries_query(
            selected_columns=["count()"],
            query=f"project:{self.project.slug} OR project:{project2.slug}",
            snuba_params=SnubaParams(
                start=before_now(minutes=5),
                end=before_now(seconds=1),
                projects=[self.project, project2, project3],
            ),
            rollup=3600,
            referrer="test_discover_query",
        )

        data = result.data["data"]
        assert len([d for d in data if "count" in d]) == 1
        for d in data:
            if "count" in d:
                assert d["count"] == 1

    def test_nested_conditional_filter(self):
        project2 = self.create_project(organization=self.organization)

        data = load_data("transaction", timestamp=self.one_min_ago)
        data["release"] = "a" * 32
        self.store_event(data=data, project_id=self.project.id)

        data = load_data("transaction", timestamp=self.one_min_ago)
        data["release"] = "b" * 32
        self.store_event(data=data, project_id=self.project.id)

        data = load_data("transaction", timestamp=self.one_min_ago)
        data["release"] = "c" * 32
        self.store_event(data=data, project_id=project2.id)

        data = load_data("transaction", timestamp=self.one_min_ago)
        data["release"] = "a" * 32
        self.store_event(data=data, project_id=project2.id)

        result = transactions.timeseries_query(
            selected_columns=["release", "count()"],
            query="(release:{} OR release:{}) AND project:{}".format(
                "a" * 32, "b" * 32, self.project.slug
            ),
            snuba_params=SnubaParams(
                start=before_now(minutes=5),
                end=before_now(seconds=1),
                projects=[self.project, project2],
            ),
            rollup=3600,
            referrer="test_discover_query",
        )

        data = result.data["data"]
        data = result.data["data"]
        assert len([d for d in data if "count" in d]) == 1
        for d in data:
            if "count" in d:
                assert d["count"] == 2


@pytest.mark.skip("These tests are specific to json which we no longer use")
class TopEventsTimeseriesQueryTest(TimeseriesBase):
    @patch("sentry.snuba.discover.raw_query")
    def test_project_filter_adjusts_filter(self, mock_query):
        """While the function is called with 2 project_ids, we should limit it down to the 1 in top_events"""
        project2 = self.create_project(organization=self.organization)
        top_events: EventsResponse = {
            "data": [
                {
                    "project": self.project.slug,
                    "project.id": self.project.id,
                }
            ],
            "meta": {"fields": {}, "tips": {}},
        }
        start = before_now(minutes=5)
        end = before_now(seconds=1)
        transactions.top_events_timeseries(
            selected_columns=["project", "count()"],
            snuba_params=SnubaParams(
                start=start,
                end=end,
                projects=[self.project, project2],
            ),
            rollup=3600,
            top_events=top_events,
            timeseries_columns=["count()"],
            user_query="",
            orderby=["count()"],
            limit=10000,
            organization=self.organization,
        )
        mock_query.assert_called_with(
            aggregations=[["count", None, "count"]],
            conditions=[],
            # Should be limited to the project in top_events
            filter_keys={"project_id": [self.project.id]},
            selected_columns=[
                "project_id",
                [
                    "transform",
                    [
                        ["toString", ["project_id"]],
                        ["array", [f"'{project.id}'" for project in [self.project, project2]]],
                        ["array", [f"'{project.slug}'" for project in [self.project, project2]]],
                        "''",
                    ],
                    "project",
                ],
            ],
            start=start,
            end=end,
            rollup=3600,
            orderby=["time", "project_id"],
            groupby=["time", "project_id"],
            dataset=Dataset.Discover,
            limit=10000,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_timestamp_fields(self, mock_query):
        timestamp1 = before_now(days=2, minutes=5)
        timestamp2 = before_now(minutes=2)
        top_events: EventsResponse = {
            "data": [
                {
                    "timestamp": timestamp1,
                    "timestamp.to_hour": timestamp1.replace(minute=0, second=0),
                    "timestamp.to_day": timestamp1.replace(hour=0, minute=0, second=0),
                },
                {
                    "timestamp": timestamp2,
                    "timestamp.to_hour": timestamp2.replace(minute=0, second=0),
                    "timestamp.to_day": timestamp2.replace(hour=0, minute=0, second=0),
                },
            ],
            "meta": {"fields": {}, "tips": {}},
        }
        start = before_now(days=3, minutes=10)
        end = before_now(minutes=1)
        transactions.top_events_timeseries(
            selected_columns=["timestamp", "timestamp.to_day", "timestamp.to_hour", "count()"],
            snuba_params=SnubaParams(
                start=start,
                end=end,
                projects=[self.project],
            ),
            rollup=3600,
            top_events=top_events,
            timeseries_columns=["count()"],
            user_query="",
            orderby=["count()"],
            limit=10000,
            organization=self.organization,
        )
        to_hour = ["toStartOfHour", ["timestamp"], "timestamp.to_hour"]
        to_day = ["toStartOfDay", ["timestamp"], "timestamp.to_day"]
        mock_query.assert_called_with(
            aggregations=[["count", None, "count"]],
            conditions=[
                # Each timestamp field should generated a nested condition.
                # Within each, the conditions will be ORed together.
                [
                    ["timestamp", "=", timestamp1],
                    ["timestamp", "=", timestamp2],
                ],
                [
                    [
                        to_day,
                        "=",
                        timestamp1.replace(hour=0, minute=0, second=0),
                    ],
                    [
                        to_day,
                        "=",
                        timestamp2.replace(hour=0, minute=0, second=0),
                    ],
                ],
                [
                    [to_hour, "=", timestamp1.replace(minute=0, second=0)],
                    [to_hour, "=", timestamp2.replace(minute=0, second=0)],
                ],
            ],
            filter_keys={"project_id": [self.project.id]},
            selected_columns=[
                "timestamp",
                to_day,
                to_hour,
            ],
            start=start,
            end=end,
            rollup=3600,
            orderby=["time", "timestamp", "timestamp.to_day", "timestamp.to_hour"],
            groupby=["time", "timestamp", "timestamp.to_day", "timestamp.to_hour"],
            dataset=Dataset.Discover,
            limit=10000,
            referrer=None,
        )

    @patch("sentry.snuba.discover.query")
    def test_equation_fields_are_auto_added(self, mock_query):
        start = before_now(minutes=5)
        end = before_now(seconds=1)
        transactions.top_events_timeseries(
            selected_columns=["count()"],
            equations=["equation|count_unique(user) * 2"],
            snuba_params=SnubaParams(
                start=start,
                end=end,
                projects=[self.project],
            ),
            rollup=3600,
            timeseries_columns=[],
            user_query="",
            orderby=["equation[0]"],
            limit=10000,
            organization=self.organization,
        )

        mock_query.assert_called_with(
            ["count()"],
            query="",
            snuba_params=SnubaParams(
                start=start,
                end=end,
                projects=[self.project],
            ),
            equations=["equation|count_unique(user) * 2"],
            orderby=["equation[0]"],
            referrer=None,
            limit=10000,
            auto_aggregations=True,
            use_aggregate_conditions=True,
            include_equation_fields=True,
        )
