from datetime import timedelta
from unittest.mock import patch

import pytest

from sentry.exceptions import InvalidSearchQuery
from sentry.models.transaction_threshold import ProjectTransactionThreshold, TransactionMetric
from sentry.snuba import discover
from sentry.snuba.dataset import Dataset
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.utils.samples import load_data

ARRAY_COLUMNS = ["measurements", "span_op_breakdowns"]


class TimeseriesBase(SnubaTestCase, TestCase):
    def setUp(self):
        super().setUp()

        self.one_min_ago = before_now(minutes=1)
        self.day_ago = before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0)

        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "very bad",
                "timestamp": iso_format(self.day_ago + timedelta(hours=1)),
                "fingerprint": ["group1"],
                "tags": {"important": "yes"},
                "user": {"id": 1},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "oh my",
                "timestamp": iso_format(self.day_ago + timedelta(hours=1, minutes=1)),
                "fingerprint": ["group2"],
                "tags": {"important": "no"},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "c" * 32,
                "message": "very bad",
                "timestamp": iso_format(self.day_ago + timedelta(hours=2, minutes=1)),
                "fingerprint": ["group2"],
                "tags": {"important": "yes"},
            },
            project_id=self.project.id,
        )


class TimeseriesQueryTest(TimeseriesBase):
    def test_invalid_field_in_function(self):
        with pytest.raises(InvalidSearchQuery):
            discover.timeseries_query(
                selected_columns=["min(transaction)"],
                query="transaction:api.issue.delete",
                referrer="test_discover_query",
                params={"project_id": [self.project.id]},
                rollup=1800,
            )

    def test_missing_start_and_end(self):
        with pytest.raises(InvalidSearchQuery):
            discover.timeseries_query(
                selected_columns=["count()"],
                query="transaction:api.issue.delete",
                referrer="test_discover_query",
                params={"project_id": [self.project.id]},
                rollup=1800,
            )

    def test_no_aggregations(self):
        with pytest.raises(InvalidSearchQuery):
            discover.timeseries_query(
                selected_columns=["transaction", "title"],
                query="transaction:api.issue.delete",
                referrer="test_discover_query",
                params={
                    "start": self.day_ago,
                    "end": self.day_ago + timedelta(hours=2),
                    "project_id": [self.project.id],
                },
                rollup=1800,
            )

    def test_field_alias(self):
        result = discover.timeseries_query(
            selected_columns=["p95()"],
            query="event.type:transaction transaction:api.issue.delete",
            referrer="test_discover_query",
            params={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2),
                "project_id": [self.project.id],
            },
            rollup=3600,
        )
        assert len(result.data["data"]) == 3

    def test_failure_rate_field_alias(self):
        result = discover.timeseries_query(
            selected_columns=["failure_rate()"],
            query="event.type:transaction transaction:api.issue.delete",
            referrer="test_discover_query",
            params={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2),
                "project_id": [self.project.id],
            },
            rollup=3600,
        )
        assert len(result.data["data"]) == 3

    def test_aggregate_function(self):
        result = discover.timeseries_query(
            selected_columns=["count()"],
            query="",
            referrer="test_discover_query",
            params={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2),
                "project_id": [self.project.id],
            },
            rollup=3600,
        )
        assert len(result.data["data"]) == 3
        assert [2] == [val["count"] for val in result.data["data"] if "count" in val]

        result = discover.timeseries_query(
            selected_columns=["count_unique(user)"],
            query="",
            referrer="test_discover_query",
            params={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2),
                "project_id": [self.project.id],
            },
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
            discover.timeseries_query(
                selected_columns=["count()", "count_unique(user)"],
                query="",
                referrer="test_discover_query",
                params={
                    "start": self.day_ago,
                    "end": self.day_ago + timedelta(hours=2),
                    "project_id": [self.project.id],
                },
                rollup=3600,
                comparison_delta=timedelta(days=1),
            )

    def test_comparison_aggregate_function(self):
        self.store_event(
            data={
                "timestamp": iso_format(self.day_ago + timedelta(hours=1)),
                "user": {"id": 1},
            },
            project_id=self.project.id,
        )

        result = discover.timeseries_query(
            selected_columns=["count()"],
            query="",
            referrer="test_discover_query",
            params={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2),
                "project_id": [self.project.id],
            },
            rollup=3600,
            comparison_delta=timedelta(days=1),
        )
        assert len(result.data["data"]) == 3
        # Values should all be 0, since there is no comparison period data at all.
        assert [(0, 0), (3, 0), (0, 0)] == [
            (val.get("count", 0), val.get("comparisonCount", 0)) for val in result.data["data"]
        ]

        self.store_event(
            data={
                "timestamp": iso_format(self.day_ago + timedelta(days=-1, hours=1)),
                "user": {"id": 1},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "timestamp": iso_format(self.day_ago + timedelta(days=-1, hours=1, minutes=2)),
                "user": {"id": 2},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "timestamp": iso_format(self.day_ago + timedelta(days=-1, hours=2, minutes=1)),
            },
            project_id=self.project.id,
        )

        result = discover.timeseries_query(
            selected_columns=["count()"],
            query="",
            referrer="test_discover_query",
            params={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2, minutes=1),
                "project_id": [self.project.id],
            },
            rollup=3600,
            comparison_delta=timedelta(days=1),
        )
        assert len(result.data["data"]) == 3
        # In the second bucket we have 3 events in the current period and 2 in the comparison, so
        # we get a result of 50% increase
        assert [(0, 0), (3, 2), (0, 0)] == [
            (val.get("count", 0), val.get("comparisonCount", 0)) for val in result.data["data"]
        ]

        result = discover.timeseries_query(
            selected_columns=["count_unique(user)"],
            query="",
            params={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2, minutes=2),
                "project_id": [self.project.id],
            },
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
        # Half of duration so we don't get weird rounding differences when comparing the results
        event_data["breakdowns"]["span_ops"]["ops.http"]["value"] = 300
        event_data["start_timestamp"] = iso_format(self.day_ago + timedelta(minutes=30))
        event_data["timestamp"] = iso_format(self.day_ago + timedelta(minutes=30, seconds=3))
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

        result = discover.timeseries_query(
            selected_columns=["count_miserable(user)"],
            referrer="test_discover_query",
            query="",
            params={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2),
                "project_id": [self.project.id, project2.id],
                "organization_id": self.organization.id,
            },
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
        # Half of duration so we don't get weird rounding differences when comparing the results
        event_data["breakdowns"]["span_ops"]["ops.http"]["value"] = 300
        event_data["start_timestamp"] = iso_format(self.day_ago + timedelta(minutes=30))
        event_data["timestamp"] = iso_format(self.day_ago + timedelta(minutes=30, seconds=3))
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

        result = discover.timeseries_query(
            selected_columns=["equation|count_miserable(user) - 100"],
            referrer="test_discover_query",
            query="",
            params={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2),
                "project_id": [self.project.id, project2.id],
                "organization_id": self.organization.id,
            },
            rollup=3600,
        )
        assert len(result.data["data"]) == 3
        assert [1 - 100] == [
            val["equation[0]"] for val in result.data["data"] if "equation[0]" in val
        ]

    def test_equation_function(self):
        result = discover.timeseries_query(
            selected_columns=["equation|count() / 100"],
            query="",
            referrer="test_discover_query",
            params={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2),
                "project_id": [self.project.id],
            },
            rollup=3600,
        )
        assert len(result.data["data"]) == 3
        assert [0.02] == [val["equation[0]"] for val in result.data["data"] if "equation[0]" in val]

        result = discover.timeseries_query(
            selected_columns=["equation|count_unique(user) / 100"],
            query="",
            params={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2),
                "project_id": [self.project.id],
            },
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
        result = discover.timeseries_query(
            selected_columns=["count()"],
            query="",
            referrer="test_discover_query",
            params={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=3),
                "project_id": [self.project.id],
            },
            rollup=3600,
        )
        assert len(result.data["data"]) == 4, "Should have empty results"
        assert [2, 1] == [
            val["count"] for val in result.data["data"] if "count" in val
        ], result.data["data"]

    def test_conditional_filter(self):
        project2 = self.create_project(organization=self.organization)
        project3 = self.create_project(organization=self.organization)

        self.store_event(
            data={"message": "hello", "timestamp": iso_format(self.one_min_ago)},
            project_id=project2.id,
        )
        self.store_event(
            data={"message": "hello", "timestamp": iso_format(self.one_min_ago)},
            project_id=project3.id,
        )

        result = discover.timeseries_query(
            selected_columns=["count()"],
            query=f"project:{self.project.slug} OR project:{project2.slug}",
            params={
                "start": before_now(minutes=5),
                "end": before_now(seconds=1),
                "project_id": [self.project.id, project2.id, project3.id],
            },
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
        self.store_event(
            data={"release": "a" * 32, "timestamp": iso_format(self.one_min_ago)},
            project_id=self.project.id,
        )
        self.event = self.store_event(
            data={"release": "b" * 32, "timestamp": iso_format(self.one_min_ago)},
            project_id=self.project.id,
        )
        self.event = self.store_event(
            data={"release": "c" * 32, "timestamp": iso_format(self.one_min_ago)},
            project_id=self.project.id,
        )
        self.event = self.store_event(
            data={"release": "a" * 32, "timestamp": iso_format(self.one_min_ago)},
            project_id=project2.id,
        )

        result = discover.timeseries_query(
            selected_columns=["release", "count()"],
            query="(release:{} OR release:{}) AND project:{}".format(
                "a" * 32, "b" * 32, self.project.slug
            ),
            params={
                "start": before_now(minutes=5),
                "end": before_now(seconds=1),
                "project_id": [self.project.id, project2.id],
            },
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
        top_events = {
            "data": [
                {
                    "project": self.project.slug,
                    "project.id": self.project.id,
                }
            ]
        }
        start = before_now(minutes=5)
        end = before_now(seconds=1)
        discover.top_events_timeseries(
            selected_columns=["project", "count()"],
            params={
                "start": start,
                "end": end,
                "project_id": [self.project.id, project2.id],
            },
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
        top_events = {
            "data": [
                {
                    "timestamp": iso_format(timestamp1),
                    "timestamp.to_hour": iso_format(timestamp1.replace(minute=0, second=0)),
                    "timestamp.to_day": iso_format(timestamp1.replace(hour=0, minute=0, second=0)),
                },
                {
                    "timestamp": iso_format(timestamp2),
                    "timestamp.to_hour": iso_format(timestamp2.replace(minute=0, second=0)),
                    "timestamp.to_day": iso_format(timestamp2.replace(hour=0, minute=0, second=0)),
                },
            ]
        }
        start = before_now(days=3, minutes=10)
        end = before_now(minutes=1)
        discover.top_events_timeseries(
            selected_columns=["timestamp", "timestamp.to_day", "timestamp.to_hour", "count()"],
            params={
                "start": start,
                "end": end,
                "project_id": [self.project.id],
            },
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
                    ["timestamp", "=", iso_format(timestamp1)],
                    ["timestamp", "=", iso_format(timestamp2)],
                ],
                [
                    [
                        to_day,
                        "=",
                        iso_format(timestamp1.replace(hour=0, minute=0, second=0)),
                    ],
                    [
                        to_day,
                        "=",
                        iso_format(timestamp2.replace(hour=0, minute=0, second=0)),
                    ],
                ],
                [
                    [to_hour, "=", iso_format(timestamp1.replace(minute=0, second=0))],
                    [to_hour, "=", iso_format(timestamp2.replace(minute=0, second=0))],
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
        discover.top_events_timeseries(
            selected_columns=["count()"],
            equations=["equation|count_unique(user) * 2"],
            params={"start": start, "end": end, "project_id": [self.project.id]},
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
            params={"start": start, "end": end, "project_id": [self.project.id]},
            equations=["equation|count_unique(user) * 2"],
            orderby=["equation[0]"],
            referrer=None,
            limit=10000,
            auto_aggregations=True,
            use_aggregate_conditions=True,
            include_equation_fields=True,
        )
