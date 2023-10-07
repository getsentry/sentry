from datetime import datetime
from unittest.mock import patch

import pytest

from sentry.exceptions import InvalidSearchQuery
from sentry.models.transaction_threshold import (
    ProjectTransactionThreshold,
    ProjectTransactionThresholdOverride,
    TransactionMetric,
)
from sentry.search.events.constants import (
    PROJECT_THRESHOLD_CONFIG_INDEX_ALIAS,
    PROJECT_THRESHOLD_OVERRIDE_CONFIG_INDEX_ALIAS,
)
from sentry.search.events.types import HistogramParams
from sentry.snuba import discover
from sentry.snuba.dataset import Dataset
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.utils.snuba import get_array_column_alias

ARRAY_COLUMNS = ["measurements", "span_op_breakdowns"]


# TODO: convert these to QueryBuilder tests
@pytest.mark.skip("These tests are specific to json which we no longer use")
class QueryTransformTest(TestCase):
    """
    This test mocks snuba.raw_query to let us isolate column transformations.
    """

    @patch("sentry.snuba.discover.raw_query")
    def test_query_parse_error(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "duration"}],
            "data": [{"transaction": "api.do_things", "duration": 200}],
        }
        with pytest.raises(InvalidSearchQuery):
            discover.query(
                selected_columns=[],
                query="foo(id):<1dino",
                params={"project_id": [self.project.id]},
            )
        assert mock_query.call_count == 0

    @patch("sentry.snuba.discover.raw_query")
    def test_query_no_fields(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "duration"}],
            "data": [{"transaction": "api.do_things", "duration": 200}],
        }
        with pytest.raises(InvalidSearchQuery) as err:
            discover.query(
                selected_columns=[],
                query="event.type:transaction",
                params={"project_id": [self.project.id]},
            )
        assert "No columns selected" in str(err)
        assert mock_query.call_count == 0

    @patch("sentry.snuba.discover.raw_query")
    def test_selected_columns_field_alias_macro(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "user"}, {"name": "project_id"}],
            "data": [{"user": "a@example.org", "project_id": self.project.id}],
        }
        discover.query(
            selected_columns=["user", "project"], query="", params={"project_id": [self.project.id]}
        )
        mock_query.assert_called_with(
            selected_columns=[
                "user",
                "project_id",
                [
                    "transform",
                    [
                        ["toString", ["project_id"]],
                        ["array", [f"'{self.project.id}'"]],
                        ["array", [f"'{self.project.slug}'"]],
                        "''",
                    ],
                    "project",
                ],
            ],
            aggregations=[],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            end=None,
            start=None,
            conditions=[],
            groupby=[],
            having=[],
            orderby=None,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_project_filter_limits_automatic_fields(self, mock_query):
        project2 = self.create_project(organization=self.organization)
        mock_query.return_value = {
            "meta": [{"name": "title"}, {"name": "project_id"}],
            "data": [{"title": "stuff", "project_id": project2.id}],
        }
        discover.query(
            selected_columns=["title", "project"],
            query=f"project:{project2.slug}",
            params={"project_id": [self.project.id, project2.id]},
        )
        mock_query.assert_called_with(
            selected_columns=[
                "title",
                "project_id",
                [
                    "transform",
                    [
                        ["toString", ["project_id"]],
                        ["array", [f"'{project2.id}'"]],
                        ["array", [f"'{project2.slug}'"]],
                        "''",
                    ],
                    "project",
                ],
            ],
            aggregations=[],
            filter_keys={"project_id": [project2.id]},
            dataset=Dataset.Discover,
            end=None,
            start=None,
            conditions=[["project_id", "=", project2.id]],
            groupby=[],
            having=[],
            orderby=None,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_project_with_aggregate_grouping(self, mock_query):
        project2 = self.create_project(organization=self.organization)
        mock_query.return_value = {
            "meta": [{"name": "title"}, {"name": "project_id"}],
            "data": [{"title": "stuff", "project_id": project2.id}],
        }
        discover.query(
            selected_columns=["title", "project", "p99()"],
            query=f"project:{project2.slug}",
            params={"project_id": [self.project.id, project2.id]},
        )
        mock_query.assert_called_with(
            selected_columns=[
                "title",
                "project_id",
                [
                    "transform",
                    [
                        ["toString", ["project_id"]],
                        ["array", [f"'{project2.id}'"]],
                        ["array", [f"'{project2.slug}'"]],
                        "''",
                    ],
                    "project",
                ],
            ],
            aggregations=[["quantile(0.99)", "duration", "p99"]],
            filter_keys={"project_id": [project2.id]},
            dataset=Dataset.Discover,
            end=None,
            start=None,
            conditions=[["project_id", "=", project2.id]],
            groupby=["title", "project_id"],
            having=[],
            orderby=None,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_selected_columns_no_auto_fields(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "count"}],
            "data": [{"count": 1}],
        }
        discover.query(
            selected_columns=["count()"],
            query="",
            params={"project_id": [self.project.id]},
            auto_fields=False,
        )
        mock_query.assert_called_with(
            selected_columns=[],
            aggregations=[["count", None, "count"]],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            end=None,
            start=None,
            conditions=[],
            groupby=[],
            having=[],
            orderby=None,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_selected_columns_aliasing_in_function(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "duration"}],
            "data": [{"transaction": "api.do_things", "duration": 200}],
        }
        discover.query(
            selected_columns=[
                "transaction",
                "transaction.duration",
                "count_unique(transaction.duration)",
            ],
            query="",
            params={"project_id": [self.project.id]},
            auto_fields=True,
        )
        mock_query.assert_called_with(
            selected_columns=["transaction", "duration"],
            aggregations=[["uniq", "duration", "count_unique_transaction_duration"]],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            end=None,
            start=None,
            conditions=[],
            groupby=["transaction", "duration"],
            having=[],
            orderby=None,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_selected_columns_aggregate_alias(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "p95"}],
            "data": [{"transaction": "api.do_things", "p95": 200}],
        }
        discover.query(
            selected_columns=["transaction", "p95()", "count_unique(transaction)"],
            query="",
            params={"project_id": [self.project.id]},
            auto_fields=True,
        )
        mock_query.assert_called_with(
            selected_columns=["transaction"],
            aggregations=[
                ["quantile(0.95)", "duration", "p95"],
                ["uniq", "transaction", "count_unique_transaction"],
            ],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            groupby=["transaction"],
            conditions=[],
            end=None,
            start=None,
            orderby=None,
            having=[],
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_selected_columns_failure_rate_alias(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "failure_rate"}],
            "data": [{"transaction": "api.do_things", "failure_rate": 0.314159}],
        }
        discover.query(
            selected_columns=["transaction", "failure_rate()"],
            query="",
            params={"project_id": [self.project.id]},
            auto_fields=True,
        )
        mock_query.assert_called_with(
            selected_columns=["transaction"],
            aggregations=[["failure_rate()", None, "failure_rate"]],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            groupby=["transaction"],
            conditions=[],
            end=None,
            start=None,
            orderby=None,
            having=[],
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_selected_columns_apdex_new_alias(self, mock_query):
        mock_query.return_value = {
            "meta": [
                {"name": "transaction"},
                {"name": "project_threshold_config"},
                {"name": "apdex"},
            ],
            "data": [
                {
                    "transaction": "api.do_things",
                    "project_threshold_config": ("duration", 300),
                    "apdex": 0.15,
                }
            ],
        }

        discover.query(
            selected_columns=[
                "transaction",
                "apdex()",
            ],
            query="",
            params={"project_id": [self.project.id], "organization_id": self.organization.id},
            auto_fields=True,
        )
        mock_query.assert_called_with(
            start=None,
            end=None,
            groupby=["transaction", "project_threshold_config"],
            conditions=[],
            aggregations=[
                [
                    "apdex(multiIf(equals(tupleElement(project_threshold_config,1),'lcp'),if(has(measurements.key,'lcp'),arrayElement(measurements.value,indexOf(measurements.key,'lcp')),NULL),duration),tupleElement(project_threshold_config,2))",
                    None,
                    "apdex",
                ]
            ],
            selected_columns=[
                "transaction",
                [
                    "tuple",
                    ["'duration'", 300],
                    "project_threshold_config",
                ],
            ],
            filter_keys={"project_id": [self.project.id]},
            having=[],
            orderby=None,
            dataset=Dataset.Discover,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_selected_columns_user_misery_alias(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "user_misery_300"}],
            "data": [{"transaction": "api.do_things", "user_misery_300": 0.15}],
        }
        discover.query(
            selected_columns=["transaction", "user_misery(300)"],
            query="",
            params={"project_id": [self.project.id]},
            auto_fields=True,
        )
        mock_query.assert_called_with(
            selected_columns=["transaction"],
            aggregations=[
                [
                    "ifNull(divide(plus(uniqIf(user, greater(duration, 1200)), 5.8875), plus(uniq(user), 117.75)), 0)",
                    None,
                    "user_misery_300",
                ]
            ],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            groupby=["transaction"],
            conditions=[],
            end=None,
            start=None,
            orderby=None,
            having=[],
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_selected_columns_user_misery_new_alias(self, mock_query):
        mock_query.return_value = {
            "meta": [
                {"name": "transaction"},
                {"name": "project_threshold_config"},
                {"name": "user_misery"},
            ],
            "data": [
                {
                    "transaction": "api.do_things",
                    "project_threshold_config": ("duration", 300),
                    "user_misery": 0.15,
                }
            ],
        }

        discover.query(
            selected_columns=[
                "transaction",
                "user_misery()",
            ],
            query="",
            params={"project_id": [self.project.id], "organization_id": self.organization.id},
            auto_fields=True,
        )
        mock_query.assert_called_with(
            start=None,
            end=None,
            groupby=["transaction", "project_threshold_config"],
            conditions=[],
            aggregations=[
                [
                    "ifNull(divide(plus(uniqIf(user,greater(multiIf(equals(tupleElement(project_threshold_config,1),'lcp'),if(has(measurements.key,'lcp'),arrayElement(measurements.value,indexOf(measurements.key,'lcp')),NULL),duration),multiply(tupleElement(project_threshold_config,2),4))),5.8875),plus(uniq(user),117.75)),0)",
                    None,
                    "user_misery",
                ]
            ],
            selected_columns=[
                "transaction",
                [
                    "tuple",
                    ["'duration'", 300],
                    "project_threshold_config",
                ],
            ],
            filter_keys={"project_id": [self.project.id]},
            having=[],
            orderby=None,
            dataset=Dataset.Discover,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_selected_columns_count_miserable_alias(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "count_miserable_user_300"}],
            "data": [{"transaction": "api.do_things", "count_miserable_user_300": 15}],
        }
        discover.query(
            selected_columns=["transaction", "count_miserable(user, 300)"],
            query="",
            params={"project_id": [self.project.id]},
            auto_fields=True,
        )
        mock_query.assert_called_with(
            selected_columns=["transaction"],
            aggregations=[
                [
                    "uniqIf(user, greater(duration, 1200))",
                    None,
                    "count_miserable_user_300",
                ],
            ],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            groupby=["transaction"],
            conditions=[],
            end=None,
            start=None,
            orderby=None,
            having=[],
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_selected_columns_count_miserable_allows_zero_threshold(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "count_miserable_user_0"}],
            "data": [{"transaction": "api.do_things", "count_miserable_user_0": 15}],
        }
        discover.query(
            selected_columns=["transaction", "count_miserable(user,0)"],
            query="",
            params={"project_id": [self.project.id]},
            auto_fields=True,
        )
        mock_query.assert_called_with(
            selected_columns=["transaction"],
            aggregations=[
                [
                    "uniqIf(user, greater(duration, 0))",
                    None,
                    "count_miserable_user_0",
                ],
            ],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            groupby=["transaction"],
            conditions=[],
            end=None,
            start=None,
            orderby=None,
            having=[],
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_apdex_allows_zero_threshold(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "apdex_0"}],
            "data": [{"transaction": "api.do_things", "apdex_0": 15}],
        }
        discover.query(
            selected_columns=["transaction", "apdex(0)"],
            query="",
            params={"project_id": [self.project.id]},
            auto_fields=True,
        )
        mock_query.assert_called_with(
            selected_columns=["transaction"],
            aggregations=[
                [
                    "apdex(duration, 0)",
                    None,
                    "apdex_0",
                ],
            ],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            groupby=["transaction"],
            conditions=[],
            end=None,
            start=None,
            orderby=None,
            having=[],
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_selected_columns_project_threshold_config_alias_no_configured_thresholds(
        self, mock_query
    ):
        mock_query.return_value = {
            "meta": [
                {"name": "transaction"},
                {"name": "project_threshold_config"},
            ],
            "data": [
                {
                    "transaction": "api.do_things",
                    "project_threshold_config": ("duration", 300),
                }
            ],
        }

        discover.query(
            selected_columns=[
                "transaction",
                "project_threshold_config",
            ],
            query="",
            params={"project_id": [self.project.id], "organization_id": self.organization.id},
            auto_fields=True,
        )

        mock_query.assert_called_with(
            start=None,
            end=None,
            groupby=[],
            conditions=[],
            aggregations=[],
            selected_columns=[
                "transaction",
                [
                    "tuple",
                    ["'duration'", 300],
                    "project_threshold_config",
                ],
                "event_id",
                "project_id",
                [
                    "transform",
                    [
                        ["toString", ["project_id"]],
                        ["array", [f"'{self.project.id}'"]],
                        ["array", ["'bar'"]],
                        "''",
                    ],
                    "`project.name`",
                ],
            ],
            filter_keys={"project_id": [self.project.id]},
            having=[],
            orderby=None,
            dataset=Dataset.Discover,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_threshold_config_selected_with_project_threshold_configured(self, mock_query):
        mock_query.return_value = {
            "meta": [
                {"name": "transaction"},
                {"name": "project_threshold_config"},
            ],
            "data": [
                {
                    "transaction": "api.do_things",
                    "project_threshold_config": ("duration", 400),
                }
            ],
        }

        ProjectTransactionThreshold.objects.create(
            project_id=self.project.id,
            organization_id=self.organization.id,
            threshold=200,
            metric=TransactionMetric.DURATION.value,
        )

        discover.query(
            selected_columns=[
                "transaction",
                "project_threshold_config",
            ],
            query="",
            params={"project_id": [self.project.id], "organization_id": self.organization.id},
            auto_fields=True,
        )

        mock_query.assert_called_with(
            start=None,
            end=None,
            groupby=[],
            conditions=[],
            aggregations=[],
            selected_columns=[
                "transaction",
                [
                    "if",
                    [
                        [
                            "equals",
                            [
                                [
                                    "indexOf",
                                    [["array", [["toUInt64", [self.project.id]]]], "project_id"],
                                    PROJECT_THRESHOLD_CONFIG_INDEX_ALIAS,
                                ],
                                0,
                            ],
                        ],
                        ["tuple", ["'duration'", 300]],
                        [
                            "arrayElement",
                            [
                                ["array", [["tuple", ["'duration'", 200]]]],
                                [
                                    "indexOf",
                                    [["array", [["toUInt64", [self.project.id]]]], "project_id"],
                                    PROJECT_THRESHOLD_CONFIG_INDEX_ALIAS,
                                ],
                            ],
                        ],
                    ],
                    "project_threshold_config",
                ],
                "event_id",
                "project_id",
                [
                    "transform",
                    [
                        ["toString", ["project_id"]],
                        ["array", [f"'{self.project.id}'"]],
                        ["array", ["'bar'"]],
                        "''",
                    ],
                    "`project.name`",
                ],
            ],
            filter_keys={"project_id": [self.project.id]},
            having=[],
            orderby=None,
            dataset=Dataset.Discover,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_threshold_config_selected_with_txn_threshold_configured(self, mock_query):
        mock_query.return_value = {
            "meta": [
                {"name": "transaction"},
                {"name": "project_threshold_config"},
            ],
            "data": [
                {
                    "transaction": "api.do_things",
                    "project_threshold_config": ("duration", 400),
                }
            ],
        }

        ProjectTransactionThresholdOverride.objects.create(
            transaction="transaction/threshold",
            project_id=self.project.id,
            organization_id=self.organization.id,
            threshold=200,
            metric=TransactionMetric.DURATION.value,
        )

        discover.query(
            selected_columns=[
                "transaction",
                "project_threshold_config",
            ],
            query="",
            params={"project_id": [self.project.id], "organization_id": self.organization.id},
            auto_fields=True,
        )

        mock_query.assert_called_with(
            start=None,
            end=None,
            groupby=[],
            conditions=[],
            aggregations=[],
            selected_columns=[
                "transaction",
                [
                    "if",
                    [
                        [
                            "equals",
                            [
                                [
                                    "indexOf",
                                    [
                                        [
                                            "array",
                                            [
                                                [
                                                    "tuple",
                                                    [
                                                        ["toUInt64", [self.project.id]],
                                                        "'transaction/threshold'",
                                                    ],
                                                ],
                                            ],
                                        ],
                                        ["tuple", ["project_id", "transaction"]],
                                    ],
                                    PROJECT_THRESHOLD_OVERRIDE_CONFIG_INDEX_ALIAS,
                                ],
                                0,
                            ],
                        ],
                        ["tuple", ["'duration'", 300]],
                        [
                            "arrayElement",
                            [
                                ["array", [["tuple", ["'duration'", 200]]]],
                                [
                                    "indexOf",
                                    [
                                        [
                                            "array",
                                            [
                                                [
                                                    "tuple",
                                                    [
                                                        ["toUInt64", [self.project.id]],
                                                        "'transaction/threshold'",
                                                    ],
                                                ],
                                            ],
                                        ],
                                        ["tuple", ["project_id", "transaction"]],
                                    ],
                                    PROJECT_THRESHOLD_OVERRIDE_CONFIG_INDEX_ALIAS,
                                ],
                            ],
                        ],
                    ],
                    "project_threshold_config",
                ],
                "event_id",
                "project_id",
                [
                    "transform",
                    [
                        ["toString", ["project_id"]],
                        ["array", [f"'{self.project.id}'"]],
                        ["array", ["'bar'"]],
                        "''",
                    ],
                    "`project.name`",
                ],
            ],
            filter_keys={"project_id": [self.project.id]},
            having=[],
            orderby=None,
            dataset=Dataset.Discover,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_threshold_config_selected_with_project_and_txn_thresholds_configured(self, mock_query):
        mock_query.return_value = {
            "meta": [
                {"name": "transaction"},
                {"name": "project_threshold_config"},
            ],
            "data": [
                {
                    "transaction": "api.do_things",
                    "project_threshold_config": ("duration", 400),
                }
            ],
        }

        ProjectTransactionThresholdOverride.objects.create(
            transaction="transaction/threshold",
            project_id=self.project.id,
            organization_id=self.organization.id,
            threshold=200,
            metric=TransactionMetric.DURATION.value,
        )

        ProjectTransactionThreshold.objects.create(
            project_id=self.project.id,
            organization_id=self.organization.id,
            threshold=200,
            metric=TransactionMetric.DURATION.value,
        )

        discover.query(
            selected_columns=[
                "transaction",
                "project_threshold_config",
            ],
            query="",
            params={"project_id": [self.project.id], "organization_id": self.organization.id},
            auto_fields=True,
        )

        mock_query.assert_called_with(
            start=None,
            end=None,
            groupby=[],
            conditions=[],
            aggregations=[],
            selected_columns=[
                "transaction",
                [
                    "if",
                    [
                        [
                            "equals",
                            [
                                [
                                    "indexOf",
                                    [
                                        [
                                            "array",
                                            [
                                                [
                                                    "tuple",
                                                    [
                                                        ["toUInt64", [self.project.id]],
                                                        "'transaction/threshold'",
                                                    ],
                                                ],
                                            ],
                                        ],
                                        ["tuple", ["project_id", "transaction"]],
                                    ],
                                    PROJECT_THRESHOLD_OVERRIDE_CONFIG_INDEX_ALIAS,
                                ],
                                0,
                            ],
                        ],
                        [
                            "if",
                            [
                                [
                                    "equals",
                                    [
                                        [
                                            "indexOf",
                                            [
                                                ["array", [["toUInt64", [self.project.id]]]],
                                                "project_id",
                                            ],
                                            PROJECT_THRESHOLD_CONFIG_INDEX_ALIAS,
                                        ],
                                        0,
                                    ],
                                ],
                                ["tuple", ["'duration'", 300]],
                                [
                                    "arrayElement",
                                    [
                                        ["array", [["tuple", ["'duration'", 200]]]],
                                        [
                                            "indexOf",
                                            [
                                                ["array", [["toUInt64", [self.project.id]]]],
                                                "project_id",
                                            ],
                                            PROJECT_THRESHOLD_CONFIG_INDEX_ALIAS,
                                        ],
                                    ],
                                ],
                            ],
                        ],
                        [
                            "arrayElement",
                            [
                                ["array", [["tuple", ["'duration'", 200]]]],
                                [
                                    "indexOf",
                                    [
                                        [
                                            "array",
                                            [
                                                [
                                                    "tuple",
                                                    [
                                                        ["toUInt64", [self.project.id]],
                                                        "'transaction/threshold'",
                                                    ],
                                                ],
                                            ],
                                        ],
                                        ["tuple", ["project_id", "transaction"]],
                                    ],
                                    PROJECT_THRESHOLD_OVERRIDE_CONFIG_INDEX_ALIAS,
                                ],
                            ],
                        ],
                    ],
                    "project_threshold_config",
                ],
                "event_id",
                "project_id",
                [
                    "transform",
                    [
                        ["toString", ["project_id"]],
                        ["array", [f"'{self.project.id}'"]],
                        ["array", ["'bar'"]],
                        "''",
                    ],
                    "`project.name`",
                ],
            ],
            filter_keys={"project_id": [self.project.id]},
            having=[],
            orderby=None,
            dataset=Dataset.Discover,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_selected_columns_count_miserable_new_alias(self, mock_query):
        mock_query.return_value = {
            "meta": [
                {"name": "transaction"},
                {"name": "project_threshold_config"},
                {"name": "count_miserable_user_project_threshold_config"},
            ],
            "data": [
                {
                    "transaction": "api.do_things",
                    "project_threshold_config": ("duration", 400),
                    "count_miserable_user": 15,
                }
            ],
        }
        discover.query(
            selected_columns=[
                "transaction",
                "count_miserable(user)",
            ],
            query="",
            params={"project_id": [self.project.id], "organization_id": self.organization.id},
            auto_fields=True,
        )

        mock_query.assert_called_with(
            start=None,
            end=None,
            groupby=["transaction", "project_threshold_config"],
            conditions=[],
            aggregations=[
                [
                    """
                    uniqIf(user, greater(
                        multiIf(
                            equals(tupleElement(project_threshold_config, 1), 'lcp'),
                            if(has(measurements.key, 'lcp'), arrayElement(measurements.value, indexOf(measurements.key, 'lcp')), NULL),
                            duration
                        ),
                        multiply(tupleElement(project_threshold_config, 2), 4)
                    ))
                    """.replace(
                        "\n", ""
                    ).replace(
                        " ", ""
                    ),
                    None,
                    "count_miserable_user",
                ]
            ],
            selected_columns=[
                "transaction",
                [
                    "tuple",
                    ["'duration'", 300],
                    "project_threshold_config",
                ],
            ],
            filter_keys={"project_id": [self.project.id]},
            having=[],
            orderby=None,
            limit=50,
            dataset=Dataset.Discover,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_selected_columns_percentile_range_function(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "firstPercentile"}],
            "data": [{"transaction": "api.do_things", "firstPercentile": 15}],
        }
        discover.query(
            selected_columns=[
                "transaction",
                "percentile_range(transaction.duration, 0.5, greater, 2020-05-02T14:45:01) as percentile_range_1",
            ],
            query="",
            params={"project_id": [self.project.id]},
            auto_fields=True,
        )
        mock_query.assert_called_with(
            selected_columns=["transaction"],
            aggregations=[
                [
                    "quantileIf(0.50)",
                    [
                        "duration",
                        ["greater", [["toDateTime", ["'2020-05-02T14:45:01'"]], "timestamp"]],
                    ],
                    "percentile_range_1",
                ]
            ],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            groupby=["transaction"],
            conditions=[],
            end=None,
            start=None,
            orderby=None,
            having=[],
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_selected_columns_avg_range_function(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "firstAverage"}],
            "data": [{"transaction": "api.do_things", "firstAverage": 15}],
        }
        discover.query(
            selected_columns=[
                "transaction",
                "avg_range(transaction.duration, greater, 2020-05-02T14:45:01) as avg_range_1",
            ],
            query="",
            params={"project_id": [self.project.id]},
            auto_fields=True,
        )
        mock_query.assert_called_with(
            selected_columns=["transaction"],
            aggregations=[
                [
                    "avgIf",
                    [
                        "duration",
                        ["greater", [["toDateTime", ["'2020-05-02T14:45:01'"]], "timestamp"]],
                    ],
                    "avg_range_1",
                ]
            ],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            groupby=["transaction"],
            conditions=[],
            end=None,
            start=None,
            orderby=None,
            having=[],
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_percentile_function(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "percentile_transaction_duration_0_75"}],
            "data": [
                {"transaction": "api.do_things", "percentile_transaction_duration_0_75": 1123}
            ],
        }
        discover.query(
            selected_columns=["transaction", "percentile(transaction.duration, 0.75)"],
            query="",
            params={"project_id": [self.project.id]},
            auto_fields=True,
        )
        mock_query.assert_called_with(
            selected_columns=["transaction"],
            aggregations=[["quantile(0.75)", "duration", "percentile_transaction_duration_0_75"]],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            groupby=["transaction"],
            conditions=[],
            end=None,
            start=None,
            orderby=None,
            having=[],
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_orderby_limit_offset(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "title"}, {"name": "project.id"}],
            "data": [{"project.id": "tester", "title": "test title"}],
        }
        discover.query(
            selected_columns=["project.id", "title"],
            query="",
            params={"project_id": [self.project.id]},
            orderby=["project.id"],
            offset=100,
            limit=200,
        )
        mock_query.assert_called_with(
            selected_columns=["project_id", "title"],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            orderby=["project_id"],
            aggregations=[],
            end=None,
            start=None,
            conditions=[],
            groupby=[],
            having=[],
            limit=200,
            offset=100,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_orderby_must_be_selected_if_aggregate(self, mock_query):
        with pytest.raises(InvalidSearchQuery):
            discover.query(
                selected_columns=["transaction", "transaction.duration"],
                query="",
                params={"project_id": [self.project.id]},
                orderby=["count()"],
            )
        assert mock_query.call_count == 0

    @patch("sentry.snuba.discover.raw_query")
    def test_orderby_aggregate_alias(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "count_id"}, {"name": "project.id"}],
            "data": [{"project.id": "tester", "count_id": 10}],
        }
        discover.query(
            selected_columns=["count(id)", "project.id", "id"],
            query="",
            params={"project_id": [self.project.id]},
            orderby=["count_id"],
        )
        mock_query.assert_called_with(
            selected_columns=["project_id", "event_id"],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            orderby=["count_id"],
            aggregations=[["count", None, "count_id"]],
            end=None,
            start=None,
            conditions=[],
            groupby=["project_id", "event_id"],
            having=[],
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_conditions_order_and_groupby_aliasing(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "duration"}],
            "data": [{"transaction": "api.do_things", "duration": 200}],
        }
        discover.query(
            selected_columns=["timestamp", "transaction", "transaction.duration", "count()"],
            query="transaction.op:ok transaction.duration:200 sdk.name:python tags[projectid]:123",
            params={"project_id": [self.project.id]},
            orderby=["-timestamp", "-count"],
        )
        mock_query.assert_called_with(
            selected_columns=["timestamp", "transaction", "duration"],
            aggregations=[["count", None, "count"]],
            conditions=[
                ["transaction_op", "=", "ok"],
                ["duration", "=", 200],
                ["sdk_name", "=", "python"],
                [["ifNull", ["tags[projectid]", "''"]], "=", "123"],
            ],
            filter_keys={"project_id": [self.project.id]},
            groupby=["timestamp", "transaction", "duration"],
            having=[],
            orderby=["-timestamp", "-count"],
            dataset=Dataset.Discover,
            end=None,
            start=None,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_conditions_nested_function_aliasing(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}],
            "data": [{"transaction": "api.do_things"}],
        }
        discover.query(
            selected_columns=["transaction", "count()"],
            query="event.type:transaction user.email:*@sentry.io message:recent-searches",
            params={"project_id": [self.project.id]},
        )
        mock_query.assert_called_with(
            selected_columns=["transaction"],
            conditions=[
                ["type", "=", "transaction"],
                [["match", ["email", r"'(?i)^.*@sentry\.io$'"]], "=", 1],
                [["positionCaseInsensitive", ["message", "'recent-searches'"]], "!=", 0],
            ],
            aggregations=[["count", None, "count"]],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            groupby=["transaction"],
            having=[],
            orderby=None,
            end=None,
            start=None,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_condition_transform(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "duration"}],
            "data": [{"transaction": "api.do_things", "duration": 200}],
        }
        discover.query(
            selected_columns=["transaction", "transaction.duration"],
            query="http.method:GET",
            params={"project_id": [self.project.id]},
        )
        mock_query.assert_called_with(
            selected_columns=["transaction", "duration"],
            conditions=[["http_method", "=", "GET"]],
            filter_keys={"project_id": [self.project.id]},
            groupby=[],
            dataset=Dataset.Discover,
            aggregations=[],
            having=[],
            orderby=None,
            end=None,
            start=None,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_condition_projectid_transform(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "duration"}],
            "data": [{"transaction": "api.do_things", "duration": 200}],
        }
        # The project_id column is not a public column, but we
        # have to let it through in conditions to ensure project.name works.
        discover.query(
            selected_columns=["transaction", "transaction.duration"],
            query="project_id:1",
            params={"project_id": [self.project.id]},
        )
        mock_query.assert_called_with(
            selected_columns=["transaction", "duration"],
            conditions=[["project_id", "=", 1]],
            filter_keys={"project_id": [self.project.id]},
            groupby=[],
            dataset=Dataset.Discover,
            aggregations=[],
            having=[],
            orderby=None,
            end=None,
            start=None,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_condition_projectname_transform(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "duration"}],
            "data": [{"transaction": "api.do_things", "duration": 200}],
        }
        project2 = self.create_project(organization=self.organization)

        # project.name is in the public schema and should be converted to a
        # project_id condition.
        discover.query(
            selected_columns=["transaction", "transaction.duration"],
            query=f"project.name:{project2.slug}",
            params={"project_id": [self.project.id, project2.id]},
        )
        mock_query.assert_called_with(
            selected_columns=["transaction", "duration"],
            conditions=[["project_id", "=", project2.id]],
            filter_keys={"project_id": [project2.id]},
            groupby=[],
            dataset=Dataset.Discover,
            aggregations=[],
            having=[],
            orderby=None,
            end=None,
            start=None,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_params_forward(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "duration"}],
            "data": [{"transaction": "api.do_things", "duration": 200}],
        }
        start_time = before_now(minutes=10)
        end_time = before_now(minutes=1)
        discover.query(
            selected_columns=["transaction", "transaction.duration"],
            query="http.method:GET",
            params={"project_id": [self.project.id], "start": start_time, "end": end_time},
        )
        mock_query.assert_called_with(
            selected_columns=["transaction", "duration"],
            conditions=[["http_method", "=", "GET"]],
            filter_keys={"project_id": [self.project.id]},
            groupby=[],
            dataset=Dataset.Discover,
            aggregations=[],
            having=[],
            end=end_time,
            start=start_time,
            orderby=None,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_aggregate_conditions(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "duration"}],
            "data": [{"transaction": "api.do_things", "duration": 200}],
        }
        start_time = before_now(minutes=10)
        end_time = before_now(minutes=1)
        discover.query(
            selected_columns=["transaction", "avg(transaction.duration)"],
            query="http.method:GET avg(transaction.duration):>5",
            params={"project_id": [self.project.id], "start": start_time, "end": end_time},
            use_aggregate_conditions=True,
        )
        mock_query.assert_called_with(
            selected_columns=["transaction"],
            conditions=[["http_method", "=", "GET"]],
            filter_keys={"project_id": [self.project.id]},
            groupby=["transaction"],
            dataset=Dataset.Discover,
            aggregations=[["avg", "duration", "avg_transaction_duration"]],
            having=[["avg_transaction_duration", ">", 5]],
            end=end_time,
            start=start_time,
            orderby=None,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_alias_aggregate_conditions(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "duration"}],
            "data": [{"transaction": "api.do_things", "duration": 200}],
        }
        start_time = before_now(minutes=10)
        end_time = before_now(minutes=1)
        discover.query(
            selected_columns=["transaction", "p95()"],
            query="http.method:GET p95():>5",
            params={"project_id": [self.project.id], "start": start_time, "end": end_time},
            use_aggregate_conditions=True,
        )

        mock_query.assert_called_with(
            selected_columns=["transaction"],
            conditions=[["http_method", "=", "GET"]],
            filter_keys={"project_id": [self.project.id]},
            groupby=["transaction"],
            dataset=Dataset.Discover,
            aggregations=[["quantile(0.95)", "duration", "p95"]],
            having=[["p95", ">", 5]],
            end=end_time,
            start=start_time,
            orderby=None,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_duration_aliases(self, mock_query):
        start_time = before_now(minutes=10)
        end_time = before_now(minutes=1)
        test_cases = [
            ("1ms", 1),
            ("1.5s", 1500),
            ("23.4m", 1000 * 60 * 23.4),
            ("1.00min", 1000 * 60),
            ("3.45hr", 1000 * 60 * 60 * 3.45),
            ("1.23h", 1000 * 60 * 60 * 1.23),
            ("3wk", 1000 * 60 * 60 * 24 * 7 * 3),
            ("2.1w", 1000 * 60 * 60 * 24 * 7 * 2.1),
        ]
        for query_string, value in test_cases:
            mock_query.return_value = {
                "meta": [{"name": "transaction"}, {"name": "duration"}],
                "data": [{"transaction": "api.do_things", "duration": 200}],
            }
            discover.query(
                selected_columns=["transaction", "p95()"],
                query=f"http.method:GET p95():>{query_string}",
                params={"project_id": [self.project.id], "start": start_time, "end": end_time},
                use_aggregate_conditions=True,
            )

            mock_query.assert_called_with(
                selected_columns=["transaction"],
                conditions=[["http_method", "=", "GET"]],
                filter_keys={"project_id": [self.project.id]},
                groupby=["transaction"],
                dataset=Dataset.Discover,
                aggregations=[["quantile(0.95)", "duration", "p95"]],
                having=[["p95", ">", value]],
                end=end_time,
                start=start_time,
                orderby=None,
                limit=50,
                offset=None,
                referrer=None,
            )

    @patch("sentry.snuba.discover.raw_query")
    def test_alias_aggregate_conditions_with_brackets(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "duration"}],
            "data": [{"transaction": "api.do_things", "duration": 200}],
        }
        start_time = before_now(minutes=10)
        end_time = before_now(minutes=1)
        discover.query(
            selected_columns=["transaction", "p95()"],
            query="http.method:GET p95():>5",
            params={"project_id": [self.project.id], "start": start_time, "end": end_time},
            use_aggregate_conditions=True,
        )

        mock_query.assert_called_with(
            selected_columns=["transaction"],
            conditions=[["http_method", "=", "GET"]],
            filter_keys={"project_id": [self.project.id]},
            groupby=["transaction"],
            dataset=Dataset.Discover,
            aggregations=[["quantile(0.95)", "duration", "p95"]],
            having=[["p95", ">", 5]],
            end=end_time,
            start=start_time,
            orderby=None,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_aggregate_date_conditions(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "duration"}],
            "data": [{"transaction": "api.do_things", "duration": 200}],
        }
        start_time = before_now(minutes=10)
        end_time = before_now(minutes=1)

        discover.query(
            selected_columns=[
                "transaction",
                "avg(transaction.duration)",
                "stddev(transaction.duration)",
                "max(timestamp)",
            ],
            query="http.method:GET max(timestamp):>2019-12-01",
            params={"project_id": [self.project.id], "start": start_time, "end": end_time},
            use_aggregate_conditions=True,
        )
        mock_query.assert_called_with(
            selected_columns=["transaction"],
            conditions=[["http_method", "=", "GET"]],
            filter_keys={"project_id": [self.project.id]},
            groupby=["transaction"],
            dataset=Dataset.Discover,
            aggregations=[
                ["avg", "duration", "avg_transaction_duration"],
                ["stddevSamp", "duration", "stddev_transaction_duration"],
                ["max", "timestamp", "max_timestamp"],
            ],
            having=[["max_timestamp", ">", 1575158400]],
            end=end_time,
            start=start_time,
            orderby=None,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_aggregate_duration_alias(self, mock_query):
        start_time = before_now(minutes=10)
        end_time = before_now(minutes=1)

        test_cases = [
            ("1ms", 1),
            ("1.5s", 1500),
            ("1.00min", 1000 * 60),
            ("3.45hr", 1000 * 60 * 60 * 3.45),
        ]
        for query_string, value in test_cases:
            mock_query.return_value = {
                "meta": [{"name": "transaction"}, {"name": "duration"}],
                "data": [{"transaction": "api.do_things", "duration": 200}],
            }
            discover.query(
                selected_columns=[
                    "transaction",
                    "avg(transaction.duration)",
                    "stddev(transaction.duration)",
                    "max(timestamp)",
                ],
                query=f"http.method:GET avg(transaction.duration):>{query_string}",
                params={"project_id": [self.project.id], "start": start_time, "end": end_time},
                use_aggregate_conditions=True,
            )
            mock_query.assert_called_with(
                selected_columns=["transaction"],
                conditions=[["http_method", "=", "GET"]],
                filter_keys={"project_id": [self.project.id]},
                groupby=["transaction"],
                dataset=Dataset.Discover,
                aggregations=[
                    ["avg", "duration", "avg_transaction_duration"],
                    ["stddevSamp", "duration", "stddev_transaction_duration"],
                    ["max", "timestamp", "max_timestamp"],
                ],
                having=[["avg_transaction_duration", ">", value]],
                end=end_time,
                start=start_time,
                orderby=None,
                limit=50,
                offset=None,
                referrer=None,
            )

    @patch("sentry.snuba.discover.raw_query")
    def test_aggregate_condition_missing_selected_column(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "duration"}],
            "data": [{"transaction": "api.do_things", "duration": 200}],
        }
        start_time = before_now(minutes=10)
        end_time = before_now(minutes=1)

        with pytest.raises(InvalidSearchQuery):
            discover.query(
                selected_columns=["transaction"],
                query="http.method:GET max(timestamp):>5",
                params={"project_id": [self.project.id], "start": start_time, "end": end_time},
                use_aggregate_conditions=True,
            )

    @patch("sentry.snuba.discover.raw_query")
    def test_aggregate_condition_missing_with_auto(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "duration"}],
            "data": [{"transaction": "api.do_things", "duration": 200}],
        }
        start_time = before_now(minutes=10)
        end_time = before_now(minutes=1)

        with pytest.raises(InvalidSearchQuery):
            discover.query(
                selected_columns=["transaction"],
                query="http.method:GET max(timestamp):>5",
                params={"project_id": [self.project.id], "start": start_time, "end": end_time},
                use_aggregate_conditions=True,
                auto_aggregations=True,
            )

    @patch("sentry.snuba.discover.raw_query")
    def test_no_aggregate_conditions_with_auto(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "duration"}],
            "data": [{"transaction": "api.do_things", "duration": 200}],
        }
        start_time = before_now(minutes=10)
        end_time = before_now(minutes=1)

        with pytest.raises(AssertionError):
            discover.query(
                selected_columns=["transaction"],
                query="http.method:GET max(timestamp):>5",
                params={"project_id": [self.project.id], "start": start_time, "end": end_time},
                use_aggregate_conditions=False,
                auto_aggregations=True,
            )

    @patch("sentry.snuba.discover.raw_query")
    def test_auto_aggregation(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "duration"}],
            "data": [{"transaction": "api.do_things", "duration": 200}],
        }
        start_time = before_now(minutes=10)
        end_time = before_now(minutes=1)

        discover.query(
            selected_columns=["transaction", "p95()"],
            query="http.method:GET max(timestamp):>5",
            params={"project_id": [self.project.id], "start": start_time, "end": end_time},
            use_aggregate_conditions=True,
            auto_aggregations=True,
        )
        mock_query.assert_called_with(
            selected_columns=["transaction"],
            aggregations=[
                ["quantile(0.95)", "duration", "p95"],
                ["max", "timestamp", "max_timestamp"],
            ],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            groupby=["transaction"],
            conditions=[["http_method", "=", "GET"]],
            start=start_time,
            end=end_time,
            orderby=None,
            having=[["max_timestamp", ">", 5.0]],
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_auto_aggregation_with_boolean_conditions(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "duration"}],
            "data": [{"transaction": "api.do_things", "duration": 200}],
        }
        start_time = before_now(minutes=10)
        end_time = before_now(minutes=1)

        discover.query(
            selected_columns=["transaction", "min(timestamp)"],
            query="max(timestamp):>5 AND min(timestamp):<10",
            params={"project_id": [self.project.id], "start": start_time, "end": end_time},
            use_aggregate_conditions=True,
            auto_aggregations=True,
        )
        mock_query.assert_called_with(
            selected_columns=["transaction"],
            aggregations=[
                ["min", "timestamp", "min_timestamp"],
                ["max", "timestamp", "max_timestamp"],
            ],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            groupby=["transaction"],
            conditions=[],
            start=start_time,
            end=end_time,
            orderby=None,
            having=[["max_timestamp", ">", 5.0], ["min_timestamp", "<", 10.0]],
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_function_conditions(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "percentile_transaction_duration_0_75"}],
            "data": [
                {"transaction": "api.do_things", "percentile_transaction_duration_0_75": 1123}
            ],
        }
        discover.query(
            selected_columns=["transaction", "percentile(transaction.duration, 0.75)"],
            query="percentile(transaction.duration, 0.75):>100",
            params={"project_id": [self.project.id]},
            auto_fields=True,
            use_aggregate_conditions=True,
        )
        mock_query.assert_called_with(
            selected_columns=["transaction"],
            aggregations=[["quantile(0.75)", "duration", "percentile_transaction_duration_0_75"]],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            groupby=["transaction"],
            conditions=[],
            end=None,
            start=None,
            orderby=None,
            having=[["percentile_transaction_duration_0_75", ">", 100]],
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_find_histogram_min_max(self, mock_query):
        for array_column in ARRAY_COLUMNS:
            alias = get_array_column_alias(array_column)
            # no rows returned from snuba
            mock_query.side_effect = [{"meta": [], "data": []}]
            values = discover.find_histogram_min_max(
                [f"{alias}.foo"], None, None, "", {"project_id": [self.project.id]}
            )
            assert values == (None, None), f"failing for {array_column}"

            # more than 2 rows returned snuba
            mock_query.side_effect = [{"meta": [], "data": [{}, {}]}]
            values = discover.find_histogram_min_max(
                [f"{alias}.foo"], None, None, "", {"project_id": [self.project.id]}
            )
            assert values == (None, None), f"failing for {array_column}"

            # None rows are returned from snuba
            mock_query.side_effect = [
                {
                    "meta": [
                        {"name": f"min_{alias}_foo"},
                        {"name": f"max_{alias}_foo"},
                    ],
                    "data": [{f"min_{alias}_foo": None, f"max_{alias}_foo": None}],
                },
            ]
            values = discover.find_histogram_min_max(
                [f"{alias}.foo"], None, None, "", {"project_id": [self.project.id]}
            )
            assert values == (None, None), f"failing for {array_column}"

            # use the given min/max
            values = discover.find_histogram_min_max(
                [f"{alias}.foo"], 1, 2, "", {"project_id": [self.project.id]}
            )
            assert values == (1, 2), f"failing for {array_column}"

            # use the given min, but query for max
            mock_query.side_effect = [
                {
                    "meta": [{"name": f"max_{alias}_foo"}],
                    "data": [{f"max_{alias}_foo": 3.45}],
                },
            ]
            values = discover.find_histogram_min_max(
                [f"{alias}.foo"], 1.23, None, "", {"project_id": [self.project.id]}
            )
            assert values == (
                1.23,
                3.45,
            ), f"failing for {array_column}"

            # use the given min, but query for max. the given min will be above
            # the queried max
            mock_query.side_effect = [
                {
                    "meta": [{"name": f"max_{alias}_foo"}],
                    "data": [{f"max_{alias}_foo": 3.45}],
                },
            ]
            values = discover.find_histogram_min_max(
                [f"{alias}.foo"], 3.5, None, "", {"project_id": [self.project.id]}
            )
            assert values == (
                3.5,
                3.5,
            ), f"failing for {array_column}"

            # use the given max, but query for min. the given max will be below
            # the queried min
            mock_query.side_effect = [
                {
                    "meta": [{"name": f"min_{alias}_foo"}],
                    "data": [{f"min_{alias}_foo": 3.45}],
                },
            ]
            values = discover.find_histogram_min_max(
                [f"{alias}.foo"], None, 3.4, "", {"project_id": [self.project.id]}
            )
            assert values == (
                3.4,
                3.4,
            ), f"failing for {array_column}"

            # use the given max, but query for min
            mock_query.side_effect = [
                {
                    "meta": [{"name": f"min_{alias}_foo"}],
                    "data": [{f"min_{alias}_foo": 1.23}],
                },
            ]
            values = discover.find_histogram_min_max(
                [f"{alias}.foo"], None, 3.45, "", {"project_id": [self.project.id]}
            )
            assert values == (
                1.23,
                3.45,
            ), f"failing for {array_column}"

            # single min/max returned from snuba
            mock_query.side_effect = [
                {
                    "meta": [
                        {"name": f"min_{alias}_foo"},
                        {"name": f"max_{alias}_foo"},
                    ],
                    "data": [{f"min_{alias}_foo": 1.23, f"max_{alias}_foo": 3.45}],
                },
            ]
            values = discover.find_histogram_min_max(
                [f"{alias}.foo"], None, None, "", {"project_id": [self.project.id]}
            )
            assert values == (
                1.23,
                3.45,
            ), f"failing for {array_column}"

            # multiple min/max returned from snuba
            mock_query.side_effect = [
                {
                    "meta": [
                        {"name": f"min_{alias}_foo"},
                        {"name": f"min_{alias}_bar"},
                        {"name": f"min_{alias}_baz"},
                        {"name": f"max_{alias}_foo"},
                        {"name": f"max_{alias}_bar"},
                        {"name": f"max_{alias}_baz"},
                    ],
                    "data": [
                        {
                            f"min_{alias}_foo": 1.23,
                            f"min_{alias}_bar": 1.34,
                            f"min_{alias}_baz": 1.45,
                            f"max_{alias}_foo": 3.45,
                            f"max_{alias}_bar": 3.56,
                            f"max_{alias}_baz": 3.67,
                        }
                    ],
                },
            ]
            values = discover.find_histogram_min_max(
                [f"{alias}.foo", f"{alias}.bar", f"{alias}.baz"],
                None,
                None,
                "",
                {"project_id": [self.project.id]},
            )
            assert values == (
                1.23,
                3.67,
            ), f"failing for {array_column}"

            # multiple min/max with some Nones returned from snuba
            mock_query.side_effect = [
                {
                    "meta": [
                        {"name": f"min_{alias}_foo"},
                        {"name": f"min_{alias}_bar"},
                        {"name": f"min_{alias}_baz"},
                        {"name": f"max_{alias}_foo"},
                        {"name": f"max_{alias}_bar"},
                        {"name": f"max_{alias}_baz"},
                    ],
                    "data": [
                        {
                            f"min_{alias}_foo": 1.23,
                            f"min_{alias}_bar": None,
                            f"min_{alias}_baz": 1.45,
                            f"max_{alias}_foo": 3.45,
                            f"max_{alias}_bar": None,
                            f"max_{alias}_baz": 3.67,
                        }
                    ],
                },
            ]
            values = discover.find_histogram_min_max(
                [f"{alias}.foo", f"{alias}.bar", f"{alias}.baz"],
                None,
                None,
                "",
                {"project_id": [self.project.id]},
            )
            assert values == (
                1.23,
                3.67,
            ), f"failing for {array_column}"

    def test_find_histogram_params(self):
        # min and max is None
        assert discover.find_histogram_params(1, None, None, 1) == (1, 1, 0, 1)
        # min is None
        assert discover.find_histogram_params(1, None, 1, 10) == (1, 1, 0, 10)
        # max is None
        assert discover.find_histogram_params(1, 1, None, 100) == (1, 1, 100, 100)

        assert discover.find_histogram_params(10, 0, 9, 1) == (10, 1, 0, 1)
        assert discover.find_histogram_params(10, 0, 10, 1) == (6, 2, 0, 1)
        assert discover.find_histogram_params(10, 0, 99, 1) == (10, 10, 0, 1)
        assert discover.find_histogram_params(10, 0, 100, 1) == (6, 20, 0, 1)
        assert discover.find_histogram_params(5, 10, 19, 10) == (5, 20, 100, 10)
        assert discover.find_histogram_params(5, 10, 19.9, 10) == (5, 20, 100, 10)
        assert discover.find_histogram_params(10, 10, 20, 1) == (6, 2, 10, 1)
        assert discover.find_histogram_params(10, 10, 20, 10) == (6, 20, 100, 10)
        assert discover.find_histogram_params(10, 10, 20, 100) == (9, 120, 1000, 100)

    def test_normalize_histogram_results_empty(self):
        for array_column in ARRAY_COLUMNS:
            results = {
                "meta": {
                    f"array_join_{array_column}_key": "string",
                    f"histogram_{array_column}_value_1_0_1": "number",
                    "count": "integer",
                },
                "data": [],
            }
            normalized_results = discover.normalize_histogram_results(
                [f"{array_column}.foo"],
                f"array_join({array_column}_key)",
                HistogramParams(3, 1, 0, 1),
                results,
                array_column,
            )
            assert normalized_results == {
                f"{array_column}.foo": [
                    {"bin": 0, "count": 0},
                    {"bin": 1, "count": 0},
                    {"bin": 2, "count": 0},
                ],
            }, f"failing for {array_column}"

    def test_normalize_histogram_results_empty_multiple(self):
        for array_column in ARRAY_COLUMNS:
            results = {
                "meta": {
                    f"array_join_{array_column}_key": "string",
                    f"histogram_{array_column}_value_1_0_1": "number",
                    "count": "integer",
                },
                "data": [],
            }
            normalized_results = discover.normalize_histogram_results(
                [f"{array_column}.bar", f"{array_column}.foo"],
                f"array_join({array_column}_key)",
                HistogramParams(3, 1, 0, 1),
                results,
                array_column,
            )
            assert normalized_results == {
                f"{array_column}.bar": [
                    {"bin": 0, "count": 0},
                    {"bin": 1, "count": 0},
                    {"bin": 2, "count": 0},
                ],
                f"{array_column}.foo": [
                    {"bin": 0, "count": 0},
                    {"bin": 1, "count": 0},
                    {"bin": 2, "count": 0},
                ],
            }, f"failing for {array_column}"

    def test_normalize_histogram_results_full(self):
        for array_column in ARRAY_COLUMNS:
            alias = get_array_column_alias(array_column)
            results = {
                "meta": {
                    f"array_join_{array_column}_key": "string",
                    f"histogram_{array_column}_value_1_0_1": "number",
                    "count": "integer",
                },
                "data": [
                    {
                        f"array_join_{array_column}_key": "foo",
                        f"histogram_{array_column}_value_1_0_1": 0,
                        "count": 3,
                    },
                    {
                        f"array_join_{array_column}_key": "foo",
                        f"histogram_{array_column}_value_1_0_1": 1,
                        "count": 2,
                    },
                    {
                        f"array_join_{array_column}_key": "foo",
                        f"histogram_{array_column}_value_1_0_1": 2,
                        "count": 1,
                    },
                ],
            }
            normalized_results = discover.normalize_histogram_results(
                [f"{alias}.foo"],
                f"array_join({array_column}_key)",
                HistogramParams(3, 1, 0, 1),
                results,
                array_column,
            )
            assert normalized_results == {
                f"{alias}.foo": [
                    {"bin": 0, "count": 3},
                    {"bin": 1, "count": 2},
                    {"bin": 2, "count": 1},
                ],
            }, f"failing for {array_column}"

    def test_normalize_histogram_results_full_multiple(self):
        for array_column in ARRAY_COLUMNS:
            alias = get_array_column_alias(array_column)
            results = {
                "meta": {
                    f"array_join_{array_column}_key": "string",
                    f"histogram_{array_column}_value_1_0_1": "number",
                    "count": "integer",
                },
                "data": [
                    {
                        f"array_join_{array_column}_key": "bar",
                        f"histogram_{array_column}_value_1_0_1": 0,
                        "count": 1,
                    },
                    {
                        f"array_join_{array_column}_key": "foo",
                        f"histogram_{array_column}_value_1_0_1": 0,
                        "count": 3,
                    },
                    {
                        f"array_join_{array_column}_key": "bar",
                        f"histogram_{array_column}_value_1_0_1": 1,
                        "count": 2,
                    },
                    {
                        f"array_join_{array_column}_key": "foo",
                        f"histogram_{array_column}_value_1_0_1": 1,
                        "count": 2,
                    },
                    {
                        f"array_join_{array_column}_key": "bar",
                        f"histogram_{array_column}_value_1_0_1": 2,
                        "count": 3,
                    },
                    {
                        f"array_join_{array_column}_key": "foo",
                        f"histogram_{array_column}_value_1_0_1": 2,
                        "count": 1,
                    },
                ],
            }
            normalized_results = discover.normalize_histogram_results(
                [f"{alias}.bar", f"{alias}.foo"],
                f"array_join({array_column}_key)",
                HistogramParams(3, 1, 0, 1),
                results,
                array_column,
            )
            assert normalized_results == {
                f"{alias}.bar": [
                    {"bin": 0, "count": 1},
                    {"bin": 1, "count": 2},
                    {"bin": 2, "count": 3},
                ],
                f"{alias}.foo": [
                    {"bin": 0, "count": 3},
                    {"bin": 1, "count": 2},
                    {"bin": 2, "count": 1},
                ],
            }, f"failing for {array_column}"

    def test_normalize_histogram_results_partial(self):
        for array_column in ARRAY_COLUMNS:
            alias = get_array_column_alias(array_column)
            results = {
                "meta": {
                    f"array_join_{array_column}_key": "string",
                    f"histogram_{array_column}_value_1_0_1": "number",
                    "count": "integer",
                },
                "data": [
                    {
                        f"array_join_{array_column}_key": "foo",
                        f"histogram_{array_column}_value_1_0_1": 0,
                        "count": 3,
                    },
                ],
            }
            normalized_results = discover.normalize_histogram_results(
                [f"{alias}.foo"],
                f"array_join({array_column}_key)",
                HistogramParams(3, 1, 0, 1),
                results,
                array_column,
            )
            assert normalized_results == {
                f"{alias}.foo": [
                    {"bin": 0, "count": 3},
                    {"bin": 1, "count": 0},
                    {"bin": 2, "count": 0},
                ],
            }, f"failing for {array_column}"

    def test_normalize_histogram_results_partial_multiple(self):
        for array_column in ARRAY_COLUMNS:
            alias = get_array_column_alias(array_column)
            results = {
                "meta": {
                    f"array_join_{array_column}_key": "string",
                    f"histogram_{array_column}_value_1_0_1": "number",
                    "count": "integer",
                },
                "data": [
                    {
                        f"array_join_{array_column}_key": "foo",
                        f"histogram_{array_column}_value_1_0_1": 0,
                        "count": 3,
                    },
                    {
                        f"array_join_{array_column}_key": "bar",
                        f"histogram_{array_column}_value_1_0_1": 2,
                        "count": 3,
                    },
                ],
            }
            normalized_results = discover.normalize_histogram_results(
                [f"{alias}.bar", f"{alias}.foo"],
                f"array_join({array_column}_key)",
                HistogramParams(3, 1, 0, 1),
                results,
                array_column,
            )
            assert normalized_results == {
                f"{alias}.bar": [
                    {"bin": 0, "count": 0},
                    {"bin": 1, "count": 0},
                    {"bin": 2, "count": 3},
                ],
                f"{alias}.foo": [
                    {"bin": 0, "count": 3},
                    {"bin": 1, "count": 0},
                    {"bin": 2, "count": 0},
                ],
            }, f"failing for {array_column}"

    def test_normalize_histogram_results_ignore_unexpected_rows(self):
        for array_column in ARRAY_COLUMNS:
            alias = get_array_column_alias(array_column)
            results = {
                "meta": {
                    f"array_join_{array_column}_key": "string",
                    f"histogram_{array_column}_value_1_0_1": "number",
                    "count": "integer",
                },
                "data": [
                    {
                        f"array_join_{array_column}_key": "foo",
                        f"histogram_{array_column}_value_1_0_1": 0,
                        "count": 3,
                    },
                    # this row shouldn't be used because "baz" isn't an expected array_column
                    {
                        f"array_join_{array_column}_key": "baz",
                        f"histogram_{array_column}_value_1_0_1": 1,
                        "count": 3,
                    },
                    {
                        f"array_join_{array_column}_key": "bar",
                        f"histogram_{array_column}_value_1_0_1": 2,
                        "count": 3,
                    },
                    # this row shouldn't be used because 3 isn't an expected bin
                    {
                        f"array_join_{array_column}_key": "bar",
                        f"histogram_{array_column}_value_1_0_1": 3,
                        "count": 3,
                    },
                ],
            }
            normalized_results = discover.normalize_histogram_results(
                [f"{alias}.bar", f"{alias}.foo"],
                f"array_join({array_column}_key)",
                HistogramParams(3, 1, 0, 1),
                results,
                array_column,
            )
            assert normalized_results == {
                f"{alias}.bar": [
                    {"bin": 0, "count": 0},
                    {"bin": 1, "count": 0},
                    {"bin": 2, "count": 3},
                ],
                f"{alias}.foo": [
                    {"bin": 0, "count": 3},
                    {"bin": 1, "count": 0},
                    {"bin": 2, "count": 0},
                ],
            }, f"failing for {array_column}"

    def test_normalize_histogram_results_adjust_for_precision(self):
        for array_column in ARRAY_COLUMNS:
            alias = get_array_column_alias(array_column)
            results = {
                "meta": {
                    f"array_join_{array_column}_key": "string",
                    f"histogram_{array_column}_value_25_0_100": "number",
                    "count": "integer",
                },
                "data": [
                    {
                        f"array_join_{array_column}_key": "foo",
                        f"histogram_{array_column}_value_25_0_100": 0,
                        "count": 3,
                    },
                    {
                        f"array_join_{array_column}_key": "foo",
                        f"histogram_{array_column}_value_25_0_100": 25,
                        "count": 2,
                    },
                    {
                        f"array_join_{array_column}_key": "foo",
                        f"histogram_{array_column}_value_25_0_100": 50,
                        "count": 1,
                    },
                    {
                        f"array_join_{array_column}_key": "foo",
                        f"histogram_{array_column}_value_25_0_100": 75,
                        "count": 1,
                    },
                ],
            }
            normalized_results = discover.normalize_histogram_results(
                [f"{alias}.foo"],
                f"array_join({array_column}_key)",
                HistogramParams(4, 25, 0, 100),
                results,
                array_column,
            )
            assert normalized_results == {
                f"{alias}.foo": [
                    {"bin": 0, "count": 3},
                    {"bin": 0.25, "count": 2},
                    {"bin": 0.50, "count": 1},
                    {"bin": 0.75, "count": 1},
                ],
            }, f"failing for {array_column}"

    @patch("sentry.snuba.discover.raw_query")
    def test_histogram_query(self, mock_query):
        for array_column in ARRAY_COLUMNS:
            alias = get_array_column_alias(array_column)
            mock_query.side_effect = [
                {
                    "meta": [
                        {"name": f"min_{alias}_foo"},
                        {"name": f"max_{alias}_foo"},
                    ],
                    "data": [
                        {
                            f"min_{alias}_bar": 2,
                            f"min_{alias}_foo": 0,
                            f"max_{alias}_bar": 2,
                            f"max_{alias}_foo": 2,
                        }
                    ],
                },
                {
                    "meta": [
                        {"name": f"array_join_{array_column}_key", "type": "String"},
                        {"name": f"histogram_{array_column}_value_1_0_1", "type": "Float64"},
                        {"name": "count", "type": "UInt64"},
                    ],
                    "data": [
                        {
                            f"array_join_{array_column}_key": "bar",
                            f"histogram_{array_column}_value_1_0_1": 0,
                            "count": 3,
                        },
                        {
                            f"array_join_{array_column}_key": "foo",
                            f"histogram_{array_column}_value_1_0_1": 0,
                            "count": 3,
                        },
                        {
                            f"array_join_{array_column}_key": "foo",
                            f"histogram_{array_column}_value_1_0_1": 2,
                            "count": 1,
                        },
                    ],
                },
            ]
            results = discover.histogram_query(
                [f"{alias}.bar", f"{alias}.foo"],
                "",
                {"project_id": [self.project.id]},
                3,
                0,
            )
            assert results == {
                f"{alias}.bar": [
                    {"bin": 0, "count": 3},
                    {"bin": 1, "count": 0},
                    {"bin": 2, "count": 0},
                ],
                f"{alias}.foo": [
                    {"bin": 0, "count": 3},
                    {"bin": 1, "count": 0},
                    {"bin": 2, "count": 1},
                ],
            }, f"failing for {array_column}"

    def test_histogram_query_with_bad_fields(self):
        for array_column in ARRAY_COLUMNS:
            alias = get_array_column_alias(array_column)
            with pytest.raises(InvalidSearchQuery) as err:
                discover.histogram_query(
                    [f"{alias}.bar", "transaction.duration"],
                    "",
                    {"project_id": [self.project.id]},
                    3,
                    0,
                )
            assert "multihistogram expected either all measurements or all breakdowns" in str(
                err
            ), f"failing for {array_column}"

    @patch("sentry.snuba.discover.raw_query")
    def test_histogram_query_with_optionals(self, mock_query):
        for array_column in ARRAY_COLUMNS:
            alias = get_array_column_alias(array_column)
            mock_query.side_effect = [
                {
                    "meta": [
                        {"name": f"array_join_{array_column}_key", "type": "String"},
                        {"name": f"histogram_{array_column}_value_5_5_10", "type": "Float64"},
                        {"name": "count", "type": "UInt64"},
                    ],
                    "data": [
                        # this row shouldn't be used because it lies outside the boundary
                        {
                            f"array_join_{array_column}_key": "foo",
                            f"histogram_{array_column}_value_5_5_10": 0,
                            "count": 1,
                        },
                        {
                            f"array_join_{array_column}_key": "foo",
                            f"histogram_{array_column}_value_5_5_10": 5,
                            "count": 3,
                        },
                        {
                            f"array_join_{array_column}_key": "bar",
                            f"histogram_{array_column}_value_5_5_10": 10,
                            "count": 2,
                        },
                        {
                            f"array_join_{array_column}_key": "foo",
                            f"histogram_{array_column}_value_5_5_10": 15,
                            "count": 1,
                        },
                        # this row shouldn't be used because it lies outside the boundary
                        {
                            f"array_join_{array_column}_key": "bar",
                            f"histogram_{array_column}_value_5_5_10": 30,
                            "count": 2,
                        },
                    ],
                },
            ]
            results = discover.histogram_query(
                [f"{alias}.bar", f"{alias}.foo"],
                "",
                {"project_id": [self.project.id]},
                3,
                1,
                0.5,
                2,
            )
            assert results == {
                f"{alias}.bar": [
                    {"bin": 0.5, "count": 0},
                    {"bin": 1.0, "count": 2},
                    {"bin": 1.5, "count": 0},
                ],
                f"{alias}.foo": [
                    {"bin": 0.5, "count": 3},
                    {"bin": 1.0, "count": 0},
                    {"bin": 1.5, "count": 1},
                ],
            }, f"failing for {array_column}"


def test_zerofill():
    results = discover.zerofill(
        {}, datetime(2019, 1, 2, 0, 0), datetime(2019, 1, 9, 23, 59, 59), 86400, "time"
    )
    results_desc = discover.zerofill(
        {}, datetime(2019, 1, 2, 0, 0), datetime(2019, 1, 9, 23, 59, 59), 86400, "-time"
    )

    assert results == list(reversed(results_desc))

    # Bucket for the 2, 3, 4, 5, 6, 7, 8, 9
    assert len(results) == 8

    assert results[0]["time"] == 1546387200
    assert results[7]["time"] == 1546992000
