"""
Metrics Service Layer Tests for Performance
"""
import re
from datetime import timedelta
from unittest import mock

import pytest
from django.utils import timezone
from django.utils.datastructures import MultiValueDict
from freezegun import freeze_time
from freezegun.api import FakeDatetime
from snuba_sdk import Column, Condition, Direction, Function, Granularity, Limit, Offset, Op

from sentry.api.utils import InvalidParams
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.snuba.metrics import (
    MetricConditionField,
    MetricField,
    MetricGroupByField,
    MetricsQuery,
    OrderBy,
    TransactionStatusTagValue,
    TransactionTagsKey,
)
from sentry.snuba.metrics.datasource import get_custom_measurements, get_series
from sentry.snuba.metrics.naming_layer import TransactionMetricKey, TransactionMRI
from sentry.snuba.metrics.query_builder import QueryDefinition
from sentry.testutils import TestCase
from sentry.testutils.cases import BaseMetricsLayerTestCase, MetricsEnhancedPerformanceTestCase
from sentry.testutils.helpers.datetime import before_now

pytestmark = pytest.mark.sentry_metrics


@freeze_time("2022-09-29 10:00:00")
class PerformanceMetricsLayerTestCase(BaseMetricsLayerTestCase, TestCase):
    @property
    def now(self):
        return timezone.now()

    def test_valid_filter_include_meta_derived_metrics(self):
        query_params = MultiValueDict(
            {
                "field": [
                    "transaction.user_misery",
                    "transaction.apdex",
                    "transaction.failure_rate",
                    "transaction.failure_count",
                    "transaction.miserable_user",
                ],
            }
        )
        query = QueryDefinition([self.project], query_params)
        data = get_series(
            [self.project],
            query.to_metrics_query(),
            include_meta=True,
            use_case_id=UseCaseKey.PERFORMANCE,
        )
        assert data["meta"] == sorted(
            [
                {"name": "bucketed_time", "type": "DateTime('Universal')"},
                {"name": "transaction.apdex", "type": "Float64"},
                {"name": "transaction.failure_count", "type": "UInt64"},
                {"name": "transaction.failure_rate", "type": "Float64"},
                {"name": "transaction.miserable_user", "type": "UInt64"},
                {"name": "transaction.user_misery", "type": "Float64"},
            ],
            key=lambda elem: elem["name"],
        )

    def test_alias_on_different_metrics_expression(self):
        for v_transaction, count in (("/foo", 1), ("/bar", 3), ("/baz", 2)):
            for value in [123.4] * count:
                self.store_performance_metric(
                    name=TransactionMRI.MEASUREMENTS_LCP.value,
                    tags={"transaction": v_transaction, "measurement_rating": "poor"},
                    value=value,
                )

        metrics_query = self.build_metrics_query(
            before_now="1h",
            granularity="1h",
            select=[
                MetricField(
                    op="count",
                    metric_mri=TransactionMRI.MEASUREMENTS_LCP.value,
                    alias="count_lcp",
                ),
                MetricField(
                    op="count",
                    metric_mri=TransactionMRI.MEASUREMENTS_FCP.value,
                    alias="count_fcp",
                ),
            ],
            groupby=[MetricGroupByField("transaction", alias="transaction_group")],
            orderby=[
                OrderBy(
                    MetricField(
                        op="count",
                        metric_mri=TransactionMRI.MEASUREMENTS_LCP.value,
                        alias="count_lcp",
                    ),
                    Direction.DESC,
                ),
                OrderBy(
                    MetricField(
                        op="count",
                        metric_mri=TransactionMRI.MEASUREMENTS_FCP.value,
                        alias="count_fcp",
                    ),
                    Direction.DESC,
                ),
            ],
            limit=Limit(limit=2),
            offset=Offset(offset=0),
            include_series=False,
        )
        data = get_series(
            [self.project],
            metrics_query=metrics_query,
            include_meta=True,
            use_case_id=UseCaseKey.PERFORMANCE,
        )
        groups = data["groups"]
        assert len(groups) == 2

        expected = [
            ("/bar", 3),
            ("/baz", 2),
        ]
        for (expected_transaction, expected_count), group in zip(expected, groups):
            # With orderBy, you only get totals:
            assert group["by"] == {"transaction_group": expected_transaction}
            assert group["totals"] == {
                "count_lcp": expected_count,
                "count_fcp": 0,
            }

        assert data["meta"] == sorted(
            [
                {"name": "count_fcp", "type": "UInt64"},
                {"name": "count_lcp", "type": "UInt64"},
                {"name": "transaction_group", "type": "string"},
            ],
            key=lambda elem: elem["name"],
        )

    def test_alias_on_same_metrics_expression_but_different_aliases(self):
        for v_transaction, count in (("/foo", 1), ("/bar", 3), ("/baz", 2)):
            for value in [123.4] * count:
                self.store_performance_metric(
                    name=TransactionMRI.MEASUREMENTS_LCP.value,
                    tags={"transaction": v_transaction, "measurement_rating": "poor"},
                    value=value,
                )

        metrics_query = self.build_metrics_query(
            before_now="1h",
            granularity="1h",
            select=[
                MetricField(
                    op="count",
                    metric_mri=TransactionMRI.MEASUREMENTS_LCP.value,
                    alias="count_lcp",
                ),
                MetricField(
                    op="count",
                    metric_mri=TransactionMRI.MEASUREMENTS_LCP.value,
                    alias="count_lcp_2",
                ),
            ],
            groupby=[
                MetricGroupByField("transaction", alias="transaction_group"),
            ],
            orderby=[
                OrderBy(
                    MetricField(
                        op="count",
                        metric_mri=TransactionMRI.MEASUREMENTS_LCP.value,
                        alias="count_lcp",
                    ),
                    Direction.DESC,
                ),
                OrderBy(
                    MetricField(
                        op="count",
                        metric_mri=TransactionMRI.MEASUREMENTS_LCP.value,
                        alias="count_lcp_2",
                    ),
                    Direction.DESC,
                ),
            ],
            limit=Limit(limit=2),
            offset=Offset(offset=0),
            include_series=False,
        )
        data = get_series(
            [self.project],
            metrics_query=metrics_query,
            include_meta=True,
            use_case_id=UseCaseKey.PERFORMANCE,
        )
        groups = data["groups"]
        assert len(groups) == 2

        expected = [
            ("/bar", 3),
            ("/baz", 2),
        ]
        for (expected_transaction, expected_count), group in zip(expected, groups):
            # With orderBy, you only get totals:
            assert group["by"] == {"transaction_group": expected_transaction}
            assert group["totals"] == {
                "count_lcp": expected_count,
                "count_lcp_2": expected_count,
            }
        assert data["meta"] == sorted(
            [
                {"name": "count_lcp", "type": "UInt64"},
                {"name": "count_lcp_2", "type": "UInt64"},
                {"name": "transaction_group", "type": "string"},
            ],
            key=lambda elem: elem["name"],
        )

    def test_custom_measurement_query_with_valid_mri(self):
        transactions_speed_mri = "d:transactions/measurements.speed@millisecond"

        for value in (100, 200, 300):
            self.store_performance_metric(
                name=transactions_speed_mri,
                tags={},
                value=value,
            )

        metrics_query = self.build_metrics_query(
            before_now="1h",
            granularity="1h",
            select=[
                MetricField(
                    op="count",
                    metric_mri=transactions_speed_mri,
                ),
            ],
            groupby=[],
            orderby=[],
            limit=Limit(limit=1),
            offset=Offset(offset=0),
            include_series=False,
        )

        data = get_series(
            [self.project],
            metrics_query=metrics_query,
            include_meta=True,
            use_case_id=UseCaseKey.PERFORMANCE,
        )
        groups = data["groups"]
        assert len(groups) == 1

        expected_count = 3
        expected_alias = "count(measurements.speed)"
        assert groups[0]["totals"] == {
            expected_alias: expected_count,
        }
        assert data["meta"] == sorted(
            [
                {"name": expected_alias, "type": "UInt64"},
            ],
            key=lambda elem: elem["name"],
        )

    def test_custom_measurement_query_with_invalid_mri(self):
        invalid_mris = [
            "d:sessions/measurements.speed@millisecond",
            "s:transactions/measurements.speed@millisecond",
        ]

        for value, invalid_mri in zip([100, 200], invalid_mris):
            self.store_performance_metric(
                name=invalid_mri,
                tags={},
                value=value,
            )

        for invalid_mri in invalid_mris:
            with pytest.raises(
                InvalidParams, match=f"Unable to find a mri reverse mapping for '{invalid_mri}'."
            ):
                # We keep the query in order to add more context to the test, even though the actual test
                # is testing for the '__post_init__' inside 'MetricField'.
                metrics_query = self.build_metrics_query(
                    before_now="1h",
                    granularity="1h",
                    select=[
                        MetricField(
                            op="count",
                            metric_mri=invalid_mri,
                        ),
                    ],
                    groupby=[],
                    orderby=[],
                    limit=Limit(limit=2),
                    offset=Offset(offset=0),
                    include_series=False,
                )

                get_series(
                    [self.project],
                    metrics_query=metrics_query,
                    include_meta=True,
                    use_case_id=UseCaseKey.PERFORMANCE,
                )

    def test_query_with_tuple_condition(self):
        for value, transaction in ((10, "/foo"), (20, "/bar"), (30, "/lorem")):
            self.store_performance_metric(
                name=TransactionMRI.DURATION.value,
                tags={"transaction": transaction},
                value=value,
            )

        metrics_query = self.build_metrics_query(
            before_now="1m",
            granularity="1m",
            select=[
                MetricField(
                    op="count",
                    metric_mri=TransactionMRI.DURATION.value,
                ),
            ],
            groupby=[],
            where=[
                Condition(
                    lhs=Function(
                        function="tuple",
                        parameters=[
                            Column(
                                name="tags[transaction]",
                            )
                        ],
                    ),
                    op=Op.IN,
                    rhs=Function(
                        function="tuple",
                        parameters=[("/foo",), ("/bar",)],
                    ),
                )
            ],
            limit=Limit(limit=1),
            offset=Offset(offset=0),
            include_series=False,
        )

        data = get_series(
            [self.project],
            metrics_query=metrics_query,
            include_meta=True,
            use_case_id=UseCaseKey.PERFORMANCE,
        )

        groups = data["groups"]
        assert len(groups) == 1

        expected_count = 2
        expected_alias = "count(transaction.duration)"
        assert groups[0]["totals"] == {
            expected_alias: expected_count,
        }
        assert data["meta"] == sorted(
            [
                {"name": expected_alias, "type": "UInt64"},
            ],
            key=lambda elem: elem["name"],
        )

    def test_query_with_has_condition(self):
        for value, transaction in ((10, "/foo"), (20, "/bar"), (30, "/lorem")):
            self.store_performance_metric(
                name=TransactionMRI.DURATION.value,
                tags={"transaction": transaction},
                value=value,
            )

        # We also store a metric without the transaction tag.
        self.store_performance_metric(
            name=TransactionMRI.DURATION.value,
            tags={},
            value=value,
        )

        metrics_query = self.build_metrics_query(
            before_now="1m",
            granularity="1m",
            select=[
                MetricField(
                    op="count",
                    metric_mri=TransactionMRI.DURATION.value,
                ),
            ],
            groupby=[],
            where=[
                Condition(
                    lhs=Function(
                        function="has",
                        parameters=[
                            Column(
                                name="tags.key",
                            ),
                            "transaction",
                        ],
                    ),
                    op=Op.EQ,
                    rhs=1,
                )
            ],
            limit=Limit(limit=1),
            offset=Offset(offset=0),
            include_series=False,
        )

        data = get_series(
            [self.project],
            metrics_query=metrics_query,
            include_meta=True,
            use_case_id=UseCaseKey.PERFORMANCE,
        )

        groups = data["groups"]
        assert len(groups) == 1

        expected_count = 3
        expected_alias = "count(transaction.duration)"
        assert groups[0]["totals"] == {
            expected_alias: expected_count,
        }
        assert data["meta"] == sorted(
            [
                {"name": expected_alias, "type": "UInt64"},
            ],
            key=lambda elem: elem["name"],
        )

    def test_count_transaction_with_valid_condition(self):
        for transaction, values in (
            ("<< unparameterized >>", [1]),
            ("", [2, 3]),
            ("/foo", [4, 5, 6]),
        ):
            if transaction == "":
                tags = {}
            else:
                tags = {"transaction": transaction}

            for value in values:
                self.store_performance_metric(
                    name=TransactionMRI.DURATION.value,
                    tags=tags,
                    value=value,
                )

        metrics_query = self.build_metrics_query(
            before_now="1m",
            granularity="1m",
            select=[
                MetricField(
                    op="count_transaction_name",
                    metric_mri=TransactionMRI.DURATION.value,
                    params={"transaction_name": "is_unparameterized"},
                    alias="count_transaction_name_is_unparameterized",
                ),
                MetricField(
                    op="count_transaction_name",
                    metric_mri=TransactionMRI.DURATION.value,
                    params={"transaction_name": "is_null"},
                    alias="count_transaction_name_is_null",
                ),
                MetricField(
                    op="count_transaction_name",
                    metric_mri=TransactionMRI.DURATION.value,
                    params={"transaction_name": "has_value"},
                    alias="count_transaction_name_has_value",
                ),
            ],
            groupby=[],
            limit=Limit(limit=3),
            offset=Offset(offset=0),
            include_series=False,
        )

        data = get_series(
            [self.project],
            metrics_query=metrics_query,
            include_meta=True,
            use_case_id=UseCaseKey.PERFORMANCE,
        )

        groups = data["groups"]
        assert len(groups) == 1

        assert groups[0]["totals"] == {
            "count_transaction_name_is_unparameterized": 1,
            "count_transaction_name_is_null": 2,
            "count_transaction_name_has_value": 3,
        }

        assert data["meta"] == sorted(
            [
                {"name": "count_transaction_name_is_unparameterized", "type": "UInt64"},
                {"name": "count_transaction_name_is_null", "type": "UInt64"},
                {"name": "count_transaction_name_has_value", "type": "UInt64"},
            ],
            key=lambda elem: elem["name"],
        )

    def test_count_transaction_with_invalid_condition(self):
        for transaction, values in (
            ("<< unparameterized >>", [1]),
            ("", [2]),
            ("/foo", [4]),
        ):
            if transaction == "":
                tags = {}
            else:
                tags = {"transaction": transaction}

            for value in values:
                self.store_performance_metric(
                    name=TransactionMRI.DURATION.value,
                    tags=tags,
                    value=value,
                )

        invalid_condition = "invalid"

        metrics_query = self.build_metrics_query(
            before_now="1m",
            granularity="1m",
            select=[
                MetricField(
                    op="count_transaction_name",
                    metric_mri=TransactionMRI.DURATION.value,
                    params={"transaction_name": invalid_condition},
                    alias="count_transaction_name_invalid",
                ),
            ],
            groupby=[],
            limit=Limit(limit=3),
            offset=Offset(offset=0),
            include_series=False,
        )

        with pytest.raises(
            InvalidParams,
            match=f"The `count_transaction_name` function expects a valid transaction name filter, which must be "
            f"either is_unparameterized is_null has_value but {invalid_condition} was passed",
        ):
            get_series(
                [self.project],
                metrics_query=metrics_query,
                include_meta=True,
                use_case_id=UseCaseKey.PERFORMANCE,
            )

    def test_alias_on_single_entity_derived_metrics(self):
        for value, tag_value in (
            (3.4, TransactionStatusTagValue.OK.value),
            (0.3, TransactionStatusTagValue.CANCELLED.value),
            (2.3, TransactionStatusTagValue.UNKNOWN.value),
            (0.5, TransactionStatusTagValue.ABORTED.value),
        ):
            self.store_performance_metric(
                org_id=self.organization.id,
                project_id=self.project.id,
                name=TransactionMRI.DURATION.value,
                tags={TransactionTagsKey.TRANSACTION_STATUS.value: tag_value},
                value=value,
            )

        metrics_query = self.build_metrics_query(
            before_now="1m",
            granularity="1m",
            select=[
                MetricField(
                    op=None,
                    metric_mri=TransactionMRI.FAILURE_RATE.value,
                    alias="failure_rate_alias",
                ),
            ],
            limit=Limit(limit=2),
            offset=Offset(offset=0),
            include_series=False,
        )
        data = get_series(
            [self.project],
            metrics_query=metrics_query,
            include_meta=True,
            use_case_id=UseCaseKey.PERFORMANCE,
        )
        assert len(data["groups"]) == 1
        group = data["groups"][0]
        assert group["by"] == {}
        assert group["totals"] == {"failure_rate_alias": 0.25}
        assert data["meta"] == [{"name": "failure_rate_alias", "type": "Float64"}]

    def test_groupby_aliasing_with_multiple_groups_and_orderby(self):
        for tag, value, numbers in (
            ("transaction", "/foo/", [10, 11, 12]),
            ("transaction", "/bar/", [4, 5, 6]),
        ):
            for subvalue in numbers:
                self.store_performance_metric(
                    name=TransactionMRI.MEASUREMENTS_LCP.value,
                    tags={tag: value},
                    value=subvalue,
                )

        for tag, value, numbers in (
            ("transaction", "/foo/", [1, 2, 3]),
            ("transaction", "/bar/", [13, 14, 15]),
        ):
            for subvalue in numbers:
                self.store_performance_metric(
                    name=TransactionMRI.MEASUREMENTS_FCP.value,
                    tags={tag: value},
                    value=subvalue,
                )

        metrics_query = self.build_metrics_query(
            before_now="1h",
            granularity="1h",
            select=[
                MetricField(
                    op="p50",
                    metric_mri=TransactionMRI.MEASUREMENTS_LCP.value,
                    alias="p50_lcp",
                ),
                MetricField(
                    op="p50",
                    metric_mri=TransactionMRI.MEASUREMENTS_FCP.value,
                    alias="p50_fcp",
                ),
            ],
            groupby=[
                MetricGroupByField("transaction", "transaction_group"),
                MetricGroupByField("project_id", "project"),
                MetricGroupByField("project", "project_alias"),
            ],
            orderby=[
                OrderBy(
                    MetricField(
                        op="p50",
                        metric_mri=TransactionMRI.MEASUREMENTS_LCP.value,
                        alias="p50_lcp",
                    ),
                    direction=Direction.ASC,
                )
            ],
            limit=Limit(limit=51),
            offset=Offset(offset=0),
        )
        data = get_series(
            [self.project],
            metrics_query=metrics_query,
            include_meta=True,
            use_case_id=UseCaseKey.PERFORMANCE,
        )

        groups = data["groups"]
        assert len(groups) == 2

        expected = [
            ("/bar/", 5.0, 14.0),
            ("/foo/", 11.0, 2.0),
        ]
        for (expected_tag_value, expected_lcp_count, expected_fcp_count), group in zip(
            expected, groups
        ):
            # With orderBy, you only get totals:
            assert group["by"] == {
                "transaction_group": expected_tag_value,
                "project": self.project.id,
                "project_alias": self.project.id,
            }
            assert group["totals"] == {
                "p50_lcp": expected_lcp_count,
                "p50_fcp": expected_fcp_count,
            }
            assert group["series"] == {
                "p50_lcp": [expected_lcp_count],
                "p50_fcp": [expected_fcp_count],
            }
        assert data["meta"] == sorted(
            [
                {"name": "bucketed_time", "type": "DateTime('Universal')"},
                {"name": "p50_fcp", "type": "Float64"},
                {"name": "p50_lcp", "type": "Float64"},
                {"name": "project", "type": "string"},
                {"name": "project_alias", "type": "string"},
                {"name": "transaction_group", "type": "string"},
            ],
            key=lambda elem: elem["name"],
        )

    def test_histogram_transaction_duration(self):
        for tag, value, numbers in (
            ("tag1", "value1", [1, 2, 3]),
            ("tag1", "value2", [10, 100, 1000]),
        ):
            for subvalue in numbers:
                self.store_performance_metric(
                    name=TransactionMRI.MEASUREMENTS_LCP.value,
                    tags={tag: value},
                    value=subvalue,
                )

        metrics_query = self.build_metrics_query(
            before_now="1h",
            granularity="1h",
            select=[
                MetricField(
                    op="histogram",
                    metric_mri=TransactionMRI.MEASUREMENTS_LCP.value,
                    params={
                        "histogram_from": 2,
                        "histogram_to": None,
                        "histogram_buckets": 2,
                    },
                    alias="histogram_lcp_1",
                ),
                MetricField(
                    op="histogram",
                    metric_mri=TransactionMRI.MEASUREMENTS_LCP.value,
                    params={
                        "histogram_from": None,
                        "histogram_to": 9,
                        "histogram_buckets": 2,
                    },
                    alias="histogram_lcp_2",
                ),
            ],
            limit=Limit(limit=51),
            offset=Offset(offset=0),
            include_series=False,
        )
        data = get_series(
            [self.project],
            metrics_query=metrics_query,
            include_meta=True,
            use_case_id=UseCaseKey.PERFORMANCE,
        )

        assert data["groups"] == [
            {
                "by": {},
                "totals": {
                    "histogram_lcp_1": [(2.0, 501.0, 4), (501.0, 1000.0, 2)],
                    "histogram_lcp_2": [(1.0, 5.0, 3), (5.0, 9.0, 0)],
                },
            }
        ]

    def test_rate_epm_hour_rollup(self):
        event_counts = [6, 0, 6, 3, 0, 3]
        for hour, count in enumerate(event_counts):
            for _ in range(count):
                self.store_performance_metric(
                    name=TransactionMRI.DURATION.value,
                    tags={},
                    value=1,
                    hours_before_now=hour,
                )

        metrics_query = self.build_metrics_query(
            before_now="6h",
            granularity="1h",
            select=[
                MetricField(
                    op="rate",
                    metric_mri=TransactionMRI.DURATION.value,
                    params={"numerator": 3600, "denominator": 60},
                ),
                MetricField(
                    op="count",
                    metric_mri=TransactionMRI.DURATION.value,
                ),
            ],
            limit=Limit(limit=51),
            offset=Offset(offset=0),
            include_series=True,
        )
        data = get_series(
            [self.project],
            metrics_query=metrics_query,
            include_meta=True,
            use_case_id=UseCaseKey.PERFORMANCE,
        )

        # The order they will be in is the reverse of the order they were inserted so -> [3, 0, 3, 6, 0, 6] and hence
        # the expected rates would be each of those event counts divided by 3600 / 60
        assert data["groups"] == [
            {
                "by": {},
                "series": {
                    "rate(transaction.duration)": [0.05, 0, 0.05, 0.1, 0, 0.1],
                    "count(transaction.duration)": [3, 0, 3, 6, 0, 6],
                },
                "totals": {"rate(transaction.duration)": 0.3, "count(transaction.duration)": 18},
            }
        ]

    def test_rate_epm_day_rollup(self):
        event_counts = [6, 0, 6, 3, 0, 3]
        for hour, count in enumerate(event_counts):
            for minute in range(count):
                self.store_performance_metric(
                    name=TransactionMRI.DURATION.value,
                    tags={},
                    value=1,
                    hours_before_now=hour,
                )

        metrics_query = self.build_metrics_query(
            before_now="6h",
            granularity="1h",
            select=[
                MetricField(
                    op="rate",
                    metric_mri=TransactionMRI.DURATION.value,
                    params={"numerator": 86400, "denominator": 60},
                ),
            ],
            limit=Limit(limit=51),
            offset=Offset(offset=0),
            include_series=True,
        )
        data = get_series(
            [self.project],
            metrics_query=metrics_query,
            include_meta=True,
            use_case_id=UseCaseKey.PERFORMANCE,
        )

        # The order they will be in is the reverse of the order they were inserted so -> [3, 0, 3, 6, 0, 6] and hence
        # the expected rates would be each of those event counts divided by 86400 / 60
        assert data["groups"] == [
            {
                "by": {},
                "series": {
                    "rate(transaction.duration)": [3 / 1440, 0, 3 / 1440, 6 / 1440, 0, 6 / 1440],
                },
                "totals": {"rate(transaction.duration)": 18 / 1440},
            }
        ]

    def test_throughput_epm_hour_rollup_offset_of_hour(self):
        # Each of these denotes how many events to create in each hour
        day_ago = before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0)

        event_counts = [6, 0, 6, 3, 0, 3]
        for hour, count in enumerate(event_counts):
            for minute in range(count):
                self.store_performance_metric(
                    name=TransactionMRI.DURATION.value,
                    tags={},
                    value=1,
                    minutes_before_now=-(minute + 30),
                    days_before_now=1,
                    hours_before_now=-hour,
                    seconds_before_now=-1,
                )

        metrics_query = MetricsQuery(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            select=[
                MetricField(
                    op="rate",
                    metric_mri=TransactionMRI.DURATION.value,
                    params={"numerator": 3600, "denominator": 60},
                ),
                MetricField(
                    op="count",
                    metric_mri=TransactionMRI.DURATION.value,
                ),
            ],
            start=day_ago + timedelta(minutes=30),
            end=day_ago + timedelta(hours=6, minutes=30),
            granularity=Granularity(granularity=60),
            limit=Limit(limit=5),
            offset=Offset(offset=0),
            include_series=True,
            interval=3600,
        )
        data = get_series(
            [self.project],
            metrics_query=metrics_query,
            include_meta=True,
            use_case_id=UseCaseKey.PERFORMANCE,
        )
        assert data == {
            "start": FakeDatetime(2022, 9, 28, 10, 30),
            "end": FakeDatetime(2022, 9, 28, 16, 30),
            "intervals": [
                FakeDatetime(2022, 9, 28, 10, 0, tzinfo=timezone.utc),
                FakeDatetime(2022, 9, 28, 11, 0, tzinfo=timezone.utc),
                FakeDatetime(2022, 9, 28, 12, 0, tzinfo=timezone.utc),
                FakeDatetime(2022, 9, 28, 13, 0, tzinfo=timezone.utc),
                FakeDatetime(2022, 9, 28, 14, 0, tzinfo=timezone.utc),
                FakeDatetime(2022, 9, 28, 15, 0, tzinfo=timezone.utc),
            ],
            "groups": [
                {
                    "by": {},
                    "series": {
                        "rate(transaction.duration)": [0.1, 0, 0.1, 0.05, 0, 0.05],
                        "count(transaction.duration)": [6, 0, 6, 3, 0, 3],
                    },
                    "totals": {
                        "rate(transaction.duration)": 0.3,
                        "count(transaction.duration)": 18,
                    },
                }
            ],
            "meta": [
                {"name": "bucketed_time", "type": "DateTime('Universal')"},
                {"name": "count(transaction.duration)", "type": "UInt64"},
                {"name": "rate(transaction.duration)", "type": "Float64"},
            ],
        }

    def test_throughput_eps_minute_rollup(self):
        event_counts = [6, 0, 6, 3, 0, 3]
        for minute, count in enumerate(event_counts):
            for _ in range(count):
                self.store_performance_metric(
                    name=TransactionMRI.DURATION.value,
                    tags={},
                    value=1,
                    minutes_before_now=minute,
                )

        metrics_query = self.build_metrics_query(
            before_now="6m",
            granularity="1m",
            select=[
                MetricField(
                    op="rate",
                    metric_mri=TransactionMRI.DURATION.value,
                    params={"numerator": 60},
                ),
                MetricField(
                    op="count",
                    metric_mri=TransactionMRI.DURATION.value,
                ),
            ],
            limit=Limit(limit=51),
            offset=Offset(offset=0),
            include_series=True,
        )
        data = get_series(
            [self.project],
            metrics_query=metrics_query,
            include_meta=True,
            use_case_id=UseCaseKey.PERFORMANCE,
        )
        # The order they will be in is the reverse of the order they were inserted so -> [3, 0, 3, 6, 0, 6] and hence
        # the expected rates would be each of those event counts divided by 86400 / 60
        assert data["groups"] == [
            {
                "by": {},
                "series": {
                    "rate(transaction.duration)": [3 / 60, 0, 3 / 60, 6 / 60, 0, 6 / 60],
                    "count(transaction.duration)": [3, 0, 3, 6, 0, 6],
                },
                "totals": {
                    "rate(transaction.duration)": 18 / 60,
                    "count(transaction.duration)": 18,
                },
            }
        ]

    def test_rate_with_missing_numerator_value(self):
        event_counts = [6, 0, 6, 3, 0, 3]
        for minute, count in enumerate(event_counts):
            for _ in range(count):
                self.store_performance_metric(
                    name=TransactionMRI.DURATION.value,
                    tags={},
                    value=1,
                    minutes_before_now=minute,
                )

        metrics_query = self.build_metrics_query(
            before_now="6m",
            granularity="1m",
            select=[
                MetricField(
                    op="rate",
                    metric_mri=TransactionMRI.DURATION.value,
                ),
            ],
            limit=Limit(limit=51),
            offset=Offset(offset=0),
            include_series=True,
        )
        with pytest.raises(
            InvalidParams,
            match=re.escape(
                "rate_snql_factory() missing 1 required positional argument: 'numerator'"
            ),
        ):
            get_series(
                [self.project],
                metrics_query=metrics_query,
                include_meta=True,
                use_case_id=UseCaseKey.PERFORMANCE,
            )

    def test_measurement_rating(self):
        for tags, metric, metric_mri, value in (
            (
                {"measurement_rating": "good", "transaction": "foo_transaction"},
                TransactionMetricKey.MEASUREMENTS_LCP.value,
                TransactionMRI.MEASUREMENTS_LCP.value,
                50,
            ),
            (
                {"measurement_rating": "good", "transaction": "foo_transaction"},
                TransactionMetricKey.MEASUREMENTS_FP.value,
                TransactionMRI.MEASUREMENTS_FP.value,
                15,
            ),
            (
                {"measurement_rating": "meh", "transaction": "foo_transaction"},
                TransactionMetricKey.MEASUREMENTS_FCP.value,
                TransactionMRI.MEASUREMENTS_FCP.value,
                1500,
            ),
            (
                {"measurement_rating": "meh", "transaction": "foo_transaction"},
                TransactionMetricKey.MEASUREMENTS_FID.value,
                TransactionMRI.MEASUREMENTS_FID.value,
                125,
            ),
            (
                {"measurement_rating": "good", "transaction": "foo_transaction"},
                TransactionMetricKey.MEASUREMENTS_CLS.value,
                TransactionMRI.MEASUREMENTS_CLS.value,
                0.15,
            ),
        ):
            self.store_performance_metric(
                name=metric_mri,
                tags=tags,
                value=value,
            )

        metrics_query = self.build_metrics_query(
            before_now="1m",
            granularity="1m",
            select=[
                MetricField(
                    op="count_web_vitals",
                    metric_mri=TransactionMRI.MEASUREMENTS_LCP.value,
                    params={"measurement_rating": "good"},
                    alias="count_web_vitals_measurements_lcp_good",
                ),
                MetricField(
                    op="count_web_vitals",
                    metric_mri=TransactionMRI.MEASUREMENTS_FP.value,
                    params={"measurement_rating": "good"},
                    alias="count_web_vitals_measurements_fp_good",
                ),
                MetricField(
                    op="count_web_vitals",
                    metric_mri=TransactionMRI.MEASUREMENTS_FCP.value,
                    params={"measurement_rating": "meh"},
                    alias="count_web_vitals_measurements_fcp_meh",
                ),
                MetricField(
                    op="count_web_vitals",
                    metric_mri=TransactionMRI.MEASUREMENTS_FID.value,
                    params={"measurement_rating": "meh"},
                    alias="count_web_vitals_measurements_fid_meh",
                ),
                MetricField(
                    op="count_web_vitals",
                    metric_mri=TransactionMRI.MEASUREMENTS_CLS.value,
                    params={"measurement_rating": "good"},
                    alias="count_web_vitals_measurements_cls_good",
                ),
            ],
            groupby=[
                MetricGroupByField(
                    field="transaction",
                )
            ],
            limit=Limit(limit=51),
            offset=Offset(offset=0),
            include_series=False,
        )

        data = get_series(
            [self.project],
            metrics_query=metrics_query,
            include_meta=True,
            use_case_id=UseCaseKey.PERFORMANCE,
        )

        group_totals = data["groups"][0]["totals"]

        assert group_totals["count_web_vitals_measurements_lcp_good"] == 1
        assert group_totals["count_web_vitals_measurements_fp_good"] == 1
        assert group_totals["count_web_vitals_measurements_fcp_meh"] == 1
        assert group_totals["count_web_vitals_measurements_cls_good"] == 1
        assert group_totals["count_web_vitals_measurements_fid_meh"] == 1

        assert data["meta"] == sorted(
            [
                {"name": "count_web_vitals_measurements_cls_good", "type": "UInt64"},
                {"name": "count_web_vitals_measurements_fcp_meh", "type": "UInt64"},
                {"name": "count_web_vitals_measurements_fid_meh", "type": "UInt64"},
                {"name": "count_web_vitals_measurements_fp_good", "type": "UInt64"},
                {"name": "count_web_vitals_measurements_lcp_good", "type": "UInt64"},
                {"name": "transaction", "type": "string"},
            ],
            key=lambda elem: elem["name"],
        )

    def test_team_key_transactions_my_teams(self):
        for idx, (transaction, value) in enumerate(
            (("foo_transaction", 1), ("bar_transaction", 1), ("baz_transaction", 0.5))
        ):
            self.store_performance_metric(
                type="distribution",
                name=TransactionMRI.DURATION.value,
                tags={"transaction": transaction},
                value=value,
                minutes_before_now=idx,
            )

        metrics_query = self.build_metrics_query(
            before_now="1h",
            granularity="1h",
            select=[
                MetricField(
                    op="team_key_transaction",
                    metric_mri=str(TransactionMRI.DURATION.value),
                    params={
                        "team_key_condition_rhs": [
                            (self.project.id, "foo_transaction"),
                        ]
                    },
                    alias="team_key_transactions",
                ),
                MetricField(
                    op="p95",
                    metric_mri=str(TransactionMRI.DURATION.value),
                    alias="p95",
                ),
            ],
            limit=Limit(limit=50),
            offset=Offset(offset=0),
            groupby=[
                MetricGroupByField(
                    field=MetricField(
                        op="team_key_transaction",
                        metric_mri=str(TransactionMRI.DURATION.value),
                        params={
                            "team_key_condition_rhs": [
                                (self.project.id, "foo_transaction"),
                            ]
                        },
                        alias="team_key_transactions",
                    )
                ),
                MetricGroupByField("transaction"),
            ],
            orderby=[
                OrderBy(
                    field=MetricField(
                        op="team_key_transaction",
                        metric_mri=str(TransactionMRI.DURATION.value),
                        params={
                            "team_key_condition_rhs": [
                                (self.project.id, "foo_transaction"),
                            ]
                        },
                        alias="team_key_transactions",
                    ),
                    direction=Direction.DESC,
                ),
                OrderBy(
                    field=MetricField(
                        op="p95",
                        metric_mri=str(TransactionMRI.DURATION.value),
                        alias="p95",
                    ),
                    direction=Direction.DESC,
                ),
            ],
            include_series=False,
        )
        data = get_series(
            [self.project],
            metrics_query=metrics_query,
            include_meta=True,
            use_case_id=UseCaseKey.PERFORMANCE,
        )
        assert data["groups"] == [
            {
                "by": {"team_key_transactions": 1, "transaction": "foo_transaction"},
                "totals": {"team_key_transactions": 1, "p95": 1.0},
            },
            {
                "by": {"team_key_transactions": 0, "transaction": "bar_transaction"},
                "totals": {"team_key_transactions": 0, "p95": 1.0},
            },
            {
                "by": {"team_key_transactions": 0, "transaction": "baz_transaction"},
                "totals": {"team_key_transactions": 0, "p95": 0.5},
            },
        ]
        assert data["meta"] == sorted(
            [
                {"name": "p95", "type": "Float64"},
                {"name": "team_key_transactions", "type": "boolean"},
                {"name": "transaction", "type": "string"},
            ],
            key=lambda elem: elem["name"],
        )

    def test_transform_null_to_unparameterized_with_null_transactions(self):
        for transaction, value in ((None, 0), ("/foo", 1), ("/bar", 2)):
            self.store_performance_metric(
                type="distribution",
                name=TransactionMRI.DURATION.value,
                tags={} if transaction is None else {"transaction": transaction},
                value=value,
            )

        metrics_query = self.build_metrics_query(
            before_now="1h",
            granularity="1h",
            select=[
                MetricField(
                    op="count", metric_mri=TransactionMRI.DURATION.value, alias="duration_count"
                ),
            ],
            limit=Limit(limit=50),
            offset=Offset(offset=0),
            groupby=[
                MetricGroupByField(
                    field=MetricField(
                        op="transform_null_to_unparameterized",
                        # TODO: metric_mri doesn't make sense for fields without aggregate filters, we should
                        #  design a special value when the mri is not needed.
                        metric_mri=TransactionMRI.DURATION.value,
                        params={"tag_key": "transaction"},
                        alias="transformed_transaction",
                    )
                ),
            ],
            include_series=False,
        )
        data = get_series(
            [self.project],
            metrics_query=metrics_query,
            include_meta=True,
            use_case_id=UseCaseKey.PERFORMANCE,
        )

        # We sort the output of ClickHouse because we don't have any ordering guarantees without the use of an order by.
        # Technically we could use an order by here but any ordering can be performed only on select fields and we
        # don't support `transform_null_to_unparameterized` at the select level.
        #
        # TODO: check with Ahmed if we want to throw an error if `transform_null_to_unparameterized` is used in select.
        assert sorted(data["groups"], key=lambda group: group["by"]["transformed_transaction"]) == [
            {
                "by": {"transformed_transaction": "/bar"},
                "totals": {"duration_count": 1},
            },
            {
                "by": {"transformed_transaction": "/foo"},
                "totals": {"duration_count": 1},
            },
            {
                "by": {"transformed_transaction": "<< unparameterized >>"},
                "totals": {"duration_count": 1},
            },
        ]
        assert data["meta"] == sorted(
            [
                {"name": "duration_count", "type": "UInt64"},
                {"name": "transformed_transaction", "type": "string"},
            ],
            key=lambda elem: elem["name"],
        )

    def test_transform_null_to_unparameterized_with_filter(self):
        for transaction, value in ((None, 0), ("/foo", 1), ("/bar", 2)):
            self.store_performance_metric(
                type="distribution",
                name=TransactionMRI.DURATION.value,
                tags={} if transaction is None else {"transaction": transaction},
                value=value,
            )

        metrics_query = self.build_metrics_query(
            before_now="1h",
            granularity="1h",
            select=[
                MetricField(
                    op="count", metric_mri=TransactionMRI.DURATION.value, alias="duration_count"
                ),
            ],
            where=[
                MetricConditionField(
                    lhs=MetricField(
                        op="transform_null_to_unparameterized",
                        metric_mri="d:transactions/duration@millisecond",
                        params={"tag_key": "transaction"},
                        alias="transaction",
                    ),
                    op=Op.NEQ,
                    rhs="<< unparameterized >>",
                )
            ],
            limit=Limit(limit=50),
            offset=Offset(offset=0),
            groupby=[
                MetricGroupByField(
                    field=MetricField(
                        op="transform_null_to_unparameterized",
                        metric_mri=TransactionMRI.DURATION.value,
                        params={"tag_key": "transaction"},
                        alias="transformed_transaction",
                    )
                ),
            ],
            include_series=False,
        )
        data = get_series(
            [self.project],
            metrics_query=metrics_query,
            include_meta=True,
            use_case_id=UseCaseKey.PERFORMANCE,
        )

        assert sorted(data["groups"], key=lambda group: group["by"]["transformed_transaction"]) == [
            {
                "by": {"transformed_transaction": "/bar"},
                "totals": {"duration_count": 1},
            },
            {
                "by": {"transformed_transaction": "/foo"},
                "totals": {"duration_count": 1},
            },
        ]
        assert data["meta"] == sorted(
            [
                {"name": "duration_count", "type": "UInt64"},
                {"name": "transformed_transaction", "type": "string"},
            ],
            key=lambda elem: elem["name"],
        )

    def test_transform_null_to_unparameterized_with_null_and_unparameterized_transactions(self):
        for transaction, value in ((None, 0), ("<< unparameterized >>", 1)):
            self.store_performance_metric(
                type="distribution",
                name=TransactionMRI.DURATION.value,
                tags={} if transaction is None else {"transaction": transaction},
                value=value,
            )

        metrics_query = self.build_metrics_query(
            before_now="1h",
            granularity="1h",
            select=[
                MetricField(
                    op="count", metric_mri=TransactionMRI.DURATION.value, alias="duration_count"
                ),
            ],
            limit=Limit(limit=50),
            offset=Offset(offset=0),
            groupby=[
                MetricGroupByField(
                    field=MetricField(
                        op="transform_null_to_unparameterized",
                        metric_mri=TransactionMRI.DURATION.value,
                        params={"tag_key": "transaction"},
                        alias="transformed_transaction",
                    )
                ),
            ],
            include_series=False,
        )
        data = get_series(
            [self.project],
            metrics_query=metrics_query,
            include_meta=True,
            use_case_id=UseCaseKey.PERFORMANCE,
        )
        assert data["groups"] == [
            {
                "by": {"transformed_transaction": "<< unparameterized >>"},
                "totals": {"duration_count": 2},
            },
        ]
        assert data["meta"] == sorted(
            [
                {"name": "duration_count", "type": "UInt64"},
                {"name": "transformed_transaction", "type": "string"},
            ],
            key=lambda elem: elem["name"],
        )

    @freeze_time("2022-09-22 11:07:00")
    def test_team_key_transaction_as_condition(self):
        now = timezone.now()

        for idx, (transaction, value) in enumerate(
            (("foo_transaction", 1), ("bar_transaction", 1), ("baz_transaction", 0.5))
        ):
            self.store_metric(
                org_id=self.organization.id,
                project_id=self.project.id,
                type="distribution",
                name=TransactionMRI.DURATION.value,
                tags={"transaction": transaction},
                timestamp=(now - timedelta(minutes=idx)).timestamp(),
                value=value,
                use_case_id=UseCaseKey.PERFORMANCE,
            )

        metrics_query = MetricsQuery(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            select=[
                MetricField(
                    op="team_key_transaction",
                    metric_mri=str(TransactionMRI.DURATION.value),
                    params={
                        "team_key_condition_rhs": [
                            (self.project.id, "foo_transaction"),
                        ]
                    },
                    alias="team_key_transactions",
                ),
                MetricField(
                    op="p95",
                    metric_mri=str(TransactionMRI.DURATION.value),
                    alias="p95",
                ),
            ],
            start=now - timedelta(hours=1),
            end=now,
            granularity=Granularity(granularity=3600),
            limit=Limit(limit=50),
            offset=Offset(offset=0),
            groupby=[
                MetricGroupByField(
                    field=MetricField(
                        op="team_key_transaction",
                        metric_mri=str(TransactionMRI.DURATION.value),
                        params={
                            "team_key_condition_rhs": [
                                (self.project.id, "foo_transaction"),
                            ]
                        },
                        alias="team_key_transactions",
                    )
                ),
                MetricGroupByField("transaction"),
            ],
            orderby=[
                OrderBy(
                    field=MetricField(
                        op="team_key_transaction",
                        metric_mri=str(TransactionMRI.DURATION.value),
                        params={
                            "team_key_condition_rhs": [
                                (self.project.id, "foo_transaction"),
                            ]
                        },
                        alias="team_key_transactions",
                    ),
                    direction=Direction.DESC,
                ),
                OrderBy(
                    field=MetricField(
                        op="p95",
                        metric_mri=str(TransactionMRI.DURATION.value),
                        alias="p95",
                    ),
                    direction=Direction.DESC,
                ),
            ],
            where=[
                MetricConditionField(
                    lhs=MetricField(
                        op="team_key_transaction",
                        metric_mri=str(TransactionMRI.DURATION.value),
                        params={
                            "team_key_condition_rhs": [
                                (self.project.id, "foo_transaction"),
                            ]
                        },
                        alias="team_key_transactions",
                    ),
                    op=Op.EQ,
                    rhs=1,
                )
            ],
            include_series=False,
        )
        data = get_series(
            [self.project],
            metrics_query=metrics_query,
            include_meta=False,
            use_case_id=UseCaseKey.PERFORMANCE,
        )
        assert data["groups"] == [
            {
                "by": {"team_key_transactions": 1, "transaction": "foo_transaction"},
                "totals": {"team_key_transactions": 1, "p95": 1.0},
            },
        ]


class GetCustomMeasurementsTestCase(MetricsEnhancedPerformanceTestCase):
    METRIC_STRINGS = [
        "d:transactions/measurements.something_custom@millisecond",
        "d:transactions/measurements.something_else@byte",
    ]

    def setUp(self):
        super().setUp()
        self.day_ago = before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0)

    def test_simple(self):
        something_custom_metric = "d:transactions/measurements.something_custom@millisecond"
        self.store_transaction_metric(
            1,
            metric="measurements.something_custom",
            internal_metric=something_custom_metric,
            entity="metrics_distributions",
            timestamp=self.day_ago + timedelta(hours=1, minutes=0),
        )
        result = get_custom_measurements(
            project_ids=[self.project.id],
            organization_id=self.organization.id,
            start=self.day_ago,
            use_case_id=UseCaseKey.PERFORMANCE,
        )
        assert result == [
            {
                "name": "measurements.something_custom",
                "type": "generic_distribution",
                "operations": [
                    "avg",
                    "count",
                    "histogram",
                    "max",
                    "min",
                    "p50",
                    "p75",
                    "p90",
                    "p95",
                    "p99",
                    "sum",
                ],
                "unit": "millisecond",
                "metric_id": indexer.resolve(
                    UseCaseKey.PERFORMANCE, self.organization.id, something_custom_metric
                ),
                "mri_string": something_custom_metric,
            }
        ]

    def test_metric_outside_query_daterange(self):
        something_custom_metric = "d:transactions/measurements.something_custom@millisecond"
        something_else_metric = "d:transactions/measurements.something_else@byte"
        self.store_transaction_metric(
            1,
            metric="measurements.something_custom",
            internal_metric=something_custom_metric,
            entity="metrics_distributions",
            timestamp=self.day_ago + timedelta(hours=1, minutes=0),
        )
        # Shouldn't show up
        self.store_transaction_metric(
            1,
            metric="measurements.something_else",
            internal_metric=something_else_metric,
            entity="metrics_distributions",
            timestamp=self.day_ago - timedelta(days=1, minutes=0),
        )
        result = get_custom_measurements(
            project_ids=[self.project.id],
            organization_id=self.organization.id,
            start=self.day_ago,
            use_case_id=UseCaseKey.PERFORMANCE,
        )

        assert result == [
            {
                "name": "measurements.something_custom",
                "type": "generic_distribution",
                "operations": [
                    "avg",
                    "count",
                    "histogram",
                    "max",
                    "min",
                    "p50",
                    "p75",
                    "p90",
                    "p95",
                    "p99",
                    "sum",
                ],
                "unit": "millisecond",
                "metric_id": indexer.resolve(
                    UseCaseKey.PERFORMANCE, self.organization.id, something_custom_metric
                ),
                "mri_string": something_custom_metric,
            }
        ]

    @mock.patch("sentry.snuba.metrics.datasource.parse_mri")
    def test_broken_custom_metric(self, mock):
        # Store valid metric
        self.store_transaction_metric(
            1,
            metric="measurements.something_custom",
            internal_metric="d:transactions/measurements.something_custom@millisecond",
            entity="metrics_distributions",
            timestamp=self.day_ago + timedelta(hours=1, minutes=0),
        )

        # mock mri failing to parse the metric
        mock.return_value = None
        result = get_custom_measurements(
            project_ids=[self.project.id], organization_id=self.organization.id, start=self.day_ago
        )
        assert result == []
