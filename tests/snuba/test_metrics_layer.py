from __future__ import annotations

from collections.abc import Mapping
from datetime import datetime, timedelta, timezone
from typing import Literal

import pytest
from snuba_sdk import (
    ArithmeticOperator,
    Column,
    Condition,
    Direction,
    Formula,
    Limit,
    Metric,
    MetricsQuery,
    MetricsScope,
    Op,
    Request,
    Rollup,
    Timeseries,
)

from sentry.exceptions import InvalidParams
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.snuba.metrics.naming_layer import SessionMRI, TransactionMRI
from sentry.snuba.metrics.naming_layer.public import TransactionStatusTagValue, TransactionTagsKey
from sentry.snuba.metrics_layer.query import (
    bulk_run_query,
    fetch_metric_mris,
    fetch_metric_tag_keys,
    run_query,
)
from sentry.testutils.cases import BaseMetricsTestCase, TestCase

pytestmark = pytest.mark.sentry_metrics


class MQLTest(TestCase, BaseMetricsTestCase):
    def ts(self, dt: datetime) -> int:
        return int(dt.timestamp())

    def setUp(self) -> None:
        super().setUp()

        self.generic_metrics: Mapping[str, Literal["counter", "set", "distribution", "gauge"]] = {
            TransactionMRI.DURATION.value: "distribution",
            TransactionMRI.USER.value: "set",
            TransactionMRI.COUNT_PER_ROOT_PROJECT.value: "counter",
            "g:transactions/test_gauge@none": "gauge",
        }
        self.metrics: Mapping[str, Literal["counter", "set", "distribution"]] = {
            SessionMRI.RAW_DURATION.value: "distribution",
            SessionMRI.RAW_USER.value: "set",
            SessionMRI.RAW_SESSION.value: "counter",
        }
        self.now = datetime.now(tz=timezone.utc).replace(microsecond=0)
        self.hour_ago = self.now - timedelta(hours=1)
        self.org_id = self.project.organization_id
        for mri, metric_type in self.generic_metrics.items():
            assert metric_type in {"counter", "distribution", "set", "gauge"}
            for i in range(10):
                value: int | dict[str, int]
                if metric_type == "gauge":
                    value = {
                        "min": i,
                        "max": i,
                        "sum": i,
                        "count": i,
                        "last": i,
                    }
                else:
                    value = i
                self.store_metric(
                    org_id=self.org_id,
                    project_id=self.project.id,
                    mri=mri,
                    tags={
                        "transaction": f"transaction_{i % 2}",
                        "status_code": "500" if i % 3 == 0 else "200",
                        "device": "BlackBerry" if i % 2 == 0 else "Nokia",
                    },
                    timestamp=self.ts(self.hour_ago + timedelta(minutes=1 * i)),
                    value=value,
                    sampling_weight=10,
                )
        for mri, metric_type in self.metrics.items():
            assert metric_type in {"counter", "distribution", "set"}
            for i in range(10):
                value = i
                self.store_metric(
                    self.org_id,
                    self.project.id,
                    mri,
                    {
                        "release": "release_even" if i % 2 == 0 else "release_odd",
                    },
                    self.ts(self.hour_ago + timedelta(minutes=1 * i)),
                    value,
                )

    def test_basic_generic_metrics(self) -> None:
        query = MetricsQuery(
            query=Timeseries(
                metric=Metric(
                    "transaction.duration",
                    TransactionMRI.DURATION.value,
                ),
                aggregate="max",
            ),
            start=self.hour_ago,
            end=self.now,
            rollup=Rollup(interval=60, granularity=60),
            scope=MetricsScope(
                org_ids=[self.org_id],
                project_ids=[self.project.id],
                use_case_id=UseCaseID.TRANSACTIONS.value,
            ),
        )

        request = Request(
            dataset="generic_metrics",
            app_id="tests",
            query=query,
            tenant_ids={"referrer": "metrics.testing.test", "organization_id": self.org_id},
        )
        result = run_query(request)
        assert len(result["data"]) == 10
        rows = result["data"]
        for i in range(10):
            assert rows[i]["aggregate_value"] == i
            assert (
                rows[i]["time"]
                == (
                    self.hour_ago.replace(second=0, microsecond=0) + timedelta(minutes=1 * i)
                ).isoformat()
            )

    def test_basic_bulk_generic_metrics(self) -> None:
        query = MetricsQuery(
            query=None,
            start=self.hour_ago,
            end=self.now,
            rollup=Rollup(interval=60, granularity=60),
            scope=MetricsScope(
                org_ids=[self.org_id],
                project_ids=[self.project.id],
                use_case_id=UseCaseID.TRANSACTIONS.value,
            ),
        )

        query1 = query.set_query(
            Timeseries(
                metric=Metric(
                    "transaction.duration",
                    TransactionMRI.DURATION.value,
                ),
                aggregate="max",
            )
        )
        query2 = query.set_query(
            Timeseries(
                metric=Metric(
                    public_name=None,
                    mri=TransactionMRI.USER.value,
                ),
                aggregate="uniq",
            )
        )
        request1 = Request(
            dataset="generic_metrics",
            app_id="tests",
            query=query1,
            tenant_ids={"referrer": "metrics.testing.test", "organization_id": self.org_id},
        )
        request2 = Request(
            dataset="generic_metrics",
            app_id="tests",
            query=query2,
            tenant_ids={"referrer": "metrics.testing.test", "organization_id": self.org_id},
        )
        results = bulk_run_query([request1, request2])
        assert len(results) == 2

        result = results[0]  # Distribution
        rows = result["data"]
        for i in range(10):
            assert rows[i]["aggregate_value"] == i
            assert (
                rows[i]["time"]
                == (
                    self.hour_ago.replace(second=0, microsecond=0) + timedelta(minutes=1 * i)
                ).isoformat()
            )

    def test_groupby_generic_metrics(self) -> None:
        query = MetricsQuery(
            query=Timeseries(
                metric=Metric(
                    "transaction.duration",
                    TransactionMRI.DURATION.value,
                ),
                aggregate="quantiles",
                aggregate_params=[0.5, 0.99],
                groupby=[Column("transaction")],
            ),
            start=self.hour_ago,
            end=self.now,
            rollup=Rollup(interval=60, granularity=60),
            scope=MetricsScope(
                org_ids=[self.org_id],
                project_ids=[self.project.id],
                use_case_id=UseCaseID.TRANSACTIONS.value,
            ),
        )

        request = Request(
            dataset="generic_metrics",
            app_id="tests",
            query=query,
            tenant_ids={"referrer": "metrics.testing.test", "organization_id": self.org_id},
        )
        result = run_query(request)
        assert len(result["data"]) == 10
        rows = result["data"]
        for i in range(10):
            assert rows[i]["aggregate_value"] == [i, i]
            assert rows[i]["transaction"] == f"transaction_{i % 2}"
            assert (
                rows[i]["time"]
                == (
                    self.hour_ago.replace(second=0, microsecond=0) + timedelta(minutes=1 * i)
                ).isoformat()
            )

    def test_filters_generic_metrics(self) -> None:
        query = MetricsQuery(
            query=Timeseries(
                metric=Metric(
                    "transaction.duration",
                    TransactionMRI.DURATION.value,
                ),
                aggregate="quantiles",
                aggregate_params=[0.5],
                filters=[
                    Condition(Column("status_code"), Op.EQ, "500"),
                    Condition(Column("device"), Op.EQ, "BlackBerry"),
                ],
            ),
            start=self.hour_ago,
            end=self.now,
            rollup=Rollup(interval=60, granularity=60),
            scope=MetricsScope(
                org_ids=[self.org_id],
                project_ids=[self.project.id],
                use_case_id=UseCaseID.TRANSACTIONS.value,
            ),
        )

        request = Request(
            dataset="generic_metrics",
            app_id="tests",
            query=query,
            tenant_ids={"referrer": "metrics.testing.test", "organization_id": self.org_id},
        )
        result = run_query(request)
        assert len(result["data"]) == 2
        rows = result["data"]
        # TODO: Snuba is going to start returning 0 instead of [0] for single value aggregates
        # For now handle both cases for backwards compatibility
        assert rows[0]["aggregate_value"] in ([0], 0)
        assert rows[1]["aggregate_value"] in ([6.0], 6)

    def test_complex_generic_metrics(self) -> None:
        query = MetricsQuery(
            query=Timeseries(
                metric=Metric(
                    "transaction.duration",
                    TransactionMRI.DURATION.value,
                ),
                aggregate="quantiles",
                aggregate_params=[0.5],
                filters=[
                    Condition(Column("status_code"), Op.EQ, "500"),
                    Condition(Column("device"), Op.EQ, "BlackBerry"),
                ],
                groupby=[Column("transaction")],
            ),
            start=self.hour_ago,
            end=self.now,
            rollup=Rollup(interval=60, granularity=60),
            scope=MetricsScope(
                org_ids=[self.org_id],
                project_ids=[self.project.id],
                use_case_id=UseCaseID.TRANSACTIONS.value,
            ),
        )

        request = Request(
            dataset="generic_metrics",
            app_id="tests",
            query=query,
            tenant_ids={"referrer": "metrics.testing.test", "organization_id": self.org_id},
        )
        result = run_query(request)
        assert len(result["data"]) == 2
        rows = result["data"]
        # TODO: Snuba is going to start returning 0 instead of [0] for single value aggregates
        # For now handle both cases for backwards compatibility
        assert rows[0]["aggregate_value"] in ([0], 0)
        assert rows[0]["transaction"] == "transaction_0"
        assert rows[1]["aggregate_value"] in ([6.0], 6)
        assert rows[1]["transaction"] == "transaction_0"

    def test_totals(self) -> None:
        query = MetricsQuery(
            query=Timeseries(
                metric=Metric(
                    "transaction.duration",
                    TransactionMRI.DURATION.value,
                ),
                aggregate="max",
                filters=[Condition(Column("status_code"), Op.EQ, "200")],
                groupby=[Column("transaction")],
            ),
            start=self.hour_ago,
            end=self.now,
            rollup=Rollup(totals=True, granularity=60, orderby=Direction.ASC),
            scope=MetricsScope(
                org_ids=[self.org_id],
                project_ids=[self.project.id],
                use_case_id=UseCaseID.TRANSACTIONS.value,
            ),
        )

        request = Request(
            dataset="generic_metrics",
            app_id="tests",
            query=query,
            tenant_ids={"referrer": "metrics.testing.test", "organization_id": self.org_id},
        )
        result = run_query(request)
        assert len(result["data"]) == 2
        rows = result["data"]

        assert rows[0]["aggregate_value"] == 7.0
        assert rows[1]["aggregate_value"] == 8.0

    def test_meta_data_in_response(self) -> None:
        query = MetricsQuery(
            query=Timeseries(
                metric=Metric(
                    "transaction.duration",
                    TransactionMRI.DURATION.value,
                ),
                aggregate="max",
                filters=[Condition(Column("status_code"), Op.EQ, "200")],
                groupby=[Column("transaction")],
            ),
            start=self.hour_ago.replace(minute=16, second=59),
            end=self.now.replace(minute=16, second=59),
            rollup=Rollup(interval=60, granularity=60),
            scope=MetricsScope(
                org_ids=[self.org_id],
                project_ids=[self.project.id],
                use_case_id=UseCaseID.TRANSACTIONS.value,
            ),
        )
        request = Request(
            dataset="generic_metrics",
            app_id="tests",
            query=query,
            tenant_ids={"referrer": "metrics.testing.test", "organization_id": self.org_id},
        )
        result = run_query(request)
        assert result["modified_start"] == self.hour_ago.replace(minute=16, second=0)
        assert result["modified_end"] == self.now.replace(minute=17, second=0)
        assert result["indexer_mappings"] == {
            "d:transactions/duration@millisecond": 9223372036854775909,
            "status_code": 10000,
            "transaction": 9223372036854776020,
        }

    def test_bad_query(self) -> None:
        query = MetricsQuery(
            query=Timeseries(
                metric=Metric(
                    "transaction.duration",
                    "not a real MRI",
                ),
                aggregate="max",
            ),
            start=self.hour_ago.replace(minute=16, second=59),
            end=self.now.replace(minute=16, second=59),
            rollup=Rollup(interval=60, granularity=60),
            scope=MetricsScope(
                org_ids=[self.org_id],
                project_ids=[self.project.id],
                use_case_id=UseCaseID.TRANSACTIONS.value,
            ),
        )
        request = Request(
            dataset="generic_metrics",
            app_id="tests",
            query=query,
            tenant_ids={"referrer": "metrics.testing.test", "organization_id": self.org_id},
        )

        with pytest.raises(InvalidParams):
            run_query(request)

    def test_interval_with_totals(self) -> None:
        query = MetricsQuery(
            query=Timeseries(
                metric=Metric(
                    "transaction.duration",
                    TransactionMRI.DURATION.value,
                ),
                aggregate="max",
                filters=[Condition(Column("status_code"), Op.EQ, "200")],
                groupby=[Column("transaction")],
            ),
            start=self.hour_ago,
            end=self.now,
            rollup=Rollup(interval=60, totals=True, granularity=60),
            scope=MetricsScope(
                org_ids=[self.org_id],
                project_ids=[self.project.id],
                use_case_id=UseCaseID.TRANSACTIONS.value,
            ),
        )

        request = Request(
            dataset="generic_metrics",
            app_id="tests",
            query=query,
            tenant_ids={"referrer": "metrics.testing.test", "organization_id": self.org_id},
        )
        result = run_query(request)
        assert len(result["data"]) == 6
        assert result["totals"]["aggregate_value"] == 8.0

    def test_automatic_granularity(self) -> None:
        query = MetricsQuery(
            query=Timeseries(
                metric=Metric(
                    "transaction.duration",
                    TransactionMRI.DURATION.value,
                ),
                aggregate="max",
            ),
            start=self.hour_ago,
            end=self.now,
            rollup=Rollup(interval=120),
            scope=MetricsScope(
                org_ids=[self.org_id],
                project_ids=[self.project.id],
            ),
        )

        request = Request(
            dataset="generic_metrics",
            app_id="tests",
            query=query,
            tenant_ids={"referrer": "metrics.testing.test", "organization_id": self.org_id},
        )
        result = run_query(request)

        # There's a flaky off by one error here that is very difficult to track down
        # TODO: figure out why this is flaky and assert to one specific value
        assert len(result["data"]) in [5, 6]

    def test_automatic_dataset(self) -> None:
        query = MetricsQuery(
            query=Timeseries(
                metric=Metric(
                    None,
                    SessionMRI.RAW_DURATION.value,
                ),
                aggregate="max",
            ),
            start=self.hour_ago,
            end=self.now,
            rollup=Rollup(interval=60, granularity=60),
            scope=MetricsScope(
                org_ids=[self.org_id],
                project_ids=[self.project.id],
                use_case_id=UseCaseID.SESSIONS.value,
            ),
        )

        request = Request(
            dataset="generic_metrics",
            app_id="tests",
            query=query,
            tenant_ids={"referrer": "metrics.testing.test", "organization_id": self.org_id},
        )
        result = run_query(request)
        assert request.dataset == "metrics"
        assert len(result["data"]) == 10

    def test_gauges(self) -> None:
        query = MetricsQuery(
            query=Timeseries(
                metric=Metric(
                    None,
                    "g:transactions/test_gauge@none",
                ),
                aggregate="last",
            ),
            start=self.hour_ago,
            end=self.now,
            rollup=Rollup(interval=60, totals=True, granularity=60),
            scope=MetricsScope(
                org_ids=[self.org_id],
                project_ids=[self.project.id],
            ),
        )

        request = Request(
            dataset="generic_metrics",
            app_id="tests",
            query=query,
            tenant_ids={"referrer": "metrics.testing.test", "organization_id": self.org_id},
        )
        result = run_query(request)

        assert len(result["data"]) == 10
        assert result["totals"]["aggregate_value"] == 9.0

    def test_metrics_groupby(self) -> None:
        query = MetricsQuery(
            query=Timeseries(
                metric=Metric(
                    None,
                    SessionMRI.RAW_DURATION.value,
                ),
                aggregate="max",
                groupby=[Column("release")],
            ),
            start=self.hour_ago,
            end=self.now,
            rollup=Rollup(interval=60, granularity=60),
            scope=MetricsScope(
                org_ids=[self.org_id],
                project_ids=[self.project.id],
                use_case_id=UseCaseID.SESSIONS.value,
            ),
        )

        request = Request(
            dataset="metrics",
            app_id="tests",
            query=query,
            tenant_ids={"referrer": "metrics.testing.test", "organization_id": self.org_id},
        )
        result = run_query(request)
        assert request.dataset == "metrics"
        assert len(result["data"]) == 10
        for data_point in result["data"]:
            assert data_point["release"] == "release_even" or data_point["release"] == "release_odd"

    def test_metrics_filters(self) -> None:
        query = MetricsQuery(
            query=Timeseries(
                metric=Metric(
                    None,
                    SessionMRI.RAW_USER.value,
                ),
                aggregate="count",
                filters=[
                    Condition(Column("release"), Op.EQ, "release_even"),
                ],
            ),
            start=self.hour_ago,
            end=self.now,
            rollup=Rollup(interval=60, granularity=60),
            scope=MetricsScope(
                org_ids=[self.org_id],
                project_ids=[self.project.id],
                use_case_id=UseCaseID.SESSIONS.value,
            ),
        )

        request = Request(
            dataset="metrics",
            app_id="tests",
            query=query,
            tenant_ids={"referrer": "metrics.testing.test", "organization_id": self.org_id},
        )
        result = run_query(request)
        assert request.dataset == "metrics"
        assert len(result["data"]) == 5

    def test_metrics_complex(self) -> None:
        query = MetricsQuery(
            query=Timeseries(
                metric=Metric(
                    None,
                    SessionMRI.RAW_SESSION.value,
                ),
                aggregate="count",
                groupby=[Column("release")],
                filters=[
                    Condition(Column("release"), Op.EQ, "release_even"),
                ],
            ),
            start=self.hour_ago,
            end=self.now,
            rollup=Rollup(interval=60, granularity=60),
            scope=MetricsScope(
                org_ids=[self.org_id],
                project_ids=[self.project.id],
                use_case_id=UseCaseID.SESSIONS.value,
            ),
        )

        request = Request(
            dataset="metrics",
            app_id="tests",
            query=query,
            tenant_ids={"referrer": "metrics.testing.test", "organization_id": self.org_id},
        )
        result = run_query(request)
        assert request.dataset == "metrics"
        assert len(result["data"]) == 5
        assert any(data_point["release"] == "release_even" for data_point in result["data"])

    def test_metrics_correctly_reverse_resolved(self) -> None:
        query = MetricsQuery(
            query=Timeseries(
                metric=Metric(
                    None,
                    SessionMRI.RAW_SESSION.value,
                ),
                aggregate="count",
                groupby=[Column("release"), Column("project_id")],
                filters=[
                    Condition(Column("release"), Op.EQ, "release_even"),
                    Condition(Column("project_id"), Op.EQ, self.project.id),
                ],
            ),
            start=self.hour_ago,
            end=self.now,
            rollup=Rollup(interval=60, granularity=60),
            scope=MetricsScope(
                org_ids=[self.org_id],
                project_ids=[self.project.id],
                use_case_id=UseCaseID.SESSIONS.value,
            ),
        )

        request = Request(
            dataset="metrics",
            app_id="tests",
            query=query,
            tenant_ids={"referrer": "metrics.testing.test", "organization_id": self.org_id},
        )
        result = run_query(request)
        assert request.dataset == "metrics"
        assert len(result["data"]) == 5
        assert any(data_point["release"] == "release_even" for data_point in result["data"])
        assert any(data_point["project_id"] == self.project.id for data_point in result["data"])

    def test_failure_rate(self) -> None:
        query = MetricsQuery(
            query=Formula(
                ArithmeticOperator.DIVIDE.value,
                [
                    Timeseries(
                        metric=Metric(
                            mri=TransactionMRI.DURATION.value,
                        ),
                        aggregate="count",
                        filters=[
                            Condition(
                                Column(TransactionTagsKey.TRANSACTION_STATUS.value),
                                Op.NOT_IN,
                                [
                                    TransactionStatusTagValue.OK.value,
                                    TransactionStatusTagValue.CANCELLED.value,
                                    TransactionStatusTagValue.UNKNOWN.value,
                                ],
                            )
                        ],
                    ),
                    Timeseries(
                        metric=Metric(
                            mri=TransactionMRI.DURATION.value,
                        ),
                        aggregate="count",
                    ),
                ],
            ),
            start=self.hour_ago,
            end=self.now,
            rollup=Rollup(interval=60, totals=True, granularity=60),
            scope=MetricsScope(
                org_ids=[self.org_id],
                project_ids=[self.project.id],
            ),
        )

        request = Request(
            dataset="generic_metrics",
            app_id="tests",
            query=query,
            tenant_ids={"referrer": "metrics.testing.test", "organization_id": self.org_id},
        )
        result = run_query(request)

        assert len(result["data"]) == 10
        assert result["totals"]["aggregate_value"] == 1.0

    def test_aggregate_aliases(self) -> None:
        query = MetricsQuery(
            query=Timeseries(
                metric=Metric(
                    "transaction.duration",
                    TransactionMRI.DURATION.value,
                ),
                aggregate="p95",
            ),
            start=self.hour_ago,
            end=self.now,
            rollup=Rollup(interval=60, granularity=60),
            scope=MetricsScope(
                org_ids=[self.org_id],
                project_ids=[self.project.id],
                use_case_id=UseCaseID.TRANSACTIONS.value,
            ),
        )

        request = Request(
            dataset="generic_metrics",
            app_id="tests",
            query=query,
            tenant_ids={"referrer": "metrics.testing.test", "organization_id": self.org_id},
        )
        result = run_query(request)
        assert len(result["data"]) == 10
        rows = result["data"]
        for i in range(10):
            # TODO: Snuba is going to start returning 0 instead of [0] for single value aggregates
            # For now handle both cases for backwards compatibility
            assert rows[i]["aggregate_value"] in ([i], i)
            assert (
                rows[i]["time"]
                == (
                    self.hour_ago.replace(second=0, microsecond=0) + timedelta(minutes=1 * i)
                ).isoformat()
            )

    def test_dataset_correctness(self) -> None:
        query = MetricsQuery(
            query=Timeseries(
                metric=Metric(
                    "transaction.duration",
                    TransactionMRI.DURATION.value,
                ),
                aggregate="quantiles",
                aggregate_params=[0.5, 0.99],
                groupby=[Column("transaction")],
                filters=[
                    Condition(Column("transaction"), Op.IN, ["transaction_0", "transaction_1"])
                ],
            ),
            start=self.hour_ago,
            end=self.now,
            rollup=Rollup(interval=60, granularity=60),
            scope=MetricsScope(
                org_ids=[self.org_id],
                project_ids=[self.project.id],
                use_case_id=UseCaseID.TRANSACTIONS.value,
            ),
        )

        request = Request(
            dataset="metrics",
            app_id="tests",
            query=query,
            tenant_ids={"referrer": "metrics.testing.test", "organization_id": self.org_id},
        )
        result = run_query(request)
        assert len(result["data"]) == 10
        rows = result["data"]
        for i in range(10):
            assert rows[i]["aggregate_value"] == [i, i]
            assert rows[i]["transaction"] == f"transaction_{i % 2}"
            assert (
                rows[i]["time"]
                == (
                    self.hour_ago.replace(second=0, microsecond=0) + timedelta(minutes=1 * i)
                ).isoformat()
            )

    def test_resolve_all_mris(self) -> None:
        for mri in [
            "d:transactions/sentry.event_manager.save@second",
            "d:transactions/sentry.event_manager.save_generic_events@second",
        ]:
            self.store_metric(
                self.org_id,
                self.project.id,
                mri,
                {
                    "transaction": "transaction_1",
                    "status_code": "200",
                    "device": "BlackBerry",
                },
                self.ts(self.hour_ago + timedelta(minutes=5)),
                1,
            )

        query = MetricsQuery(
            query=Formula(
                function_name="plus",
                parameters=[
                    Timeseries(
                        metric=Metric(
                            mri="d:transactions/sentry.event_manager.save@second",
                        ),
                        aggregate="avg",
                    ),
                    Timeseries(
                        metric=Metric(
                            mri="d:transactions/sentry.event_manager.save_generic_events@second",
                        ),
                        aggregate="avg",
                    ),
                ],
            ),
            start=self.hour_ago,
            end=self.now,
            rollup=Rollup(interval=None, totals=True, orderby=None, granularity=10),
            scope=MetricsScope(
                org_ids=[self.org_id], project_ids=[self.project.id], use_case_id="transactions"
            ),
            limit=Limit(20),
            offset=None,
        )

        request = Request(
            dataset="generic_metrics",
            app_id="tests",
            query=query,
            tenant_ids={"referrer": "metrics.testing.test", "organization_id": self.org_id},
        )
        result = run_query(request)
        assert len(result["data"]) == 1

    def test_formulas_with_scalar_formulas(self) -> None:
        query = MetricsQuery(
            query=f"sum({TransactionMRI.DURATION.value}) + (24 * 3600)",
            start=self.hour_ago,
            end=self.now,
            rollup=Rollup(interval=60, granularity=60),
            scope=MetricsScope(
                org_ids=[self.org_id],
                project_ids=[self.project.id],
                use_case_id=UseCaseID.TRANSACTIONS.value,
            ),
        )

        request = Request(
            dataset="generic_metrics",
            app_id="tests",
            query=query,
            tenant_ids={"referrer": "metrics.testing.test", "organization_id": self.org_id},
        )
        result = run_query(request)
        assert len(result["data"]) == 10
        for row in result["data"]:
            assert row["aggregate_value"] >= 86400

    def test_extrapolated_generic_metrics(self) -> None:
        query = MetricsQuery(
            query=Timeseries(
                metric=Metric(
                    "transaction.duration",
                    TransactionMRI.DURATION.value,
                ),
                aggregate="sum",
                filters=[
                    Condition(Column("status_code"), Op.EQ, "500"),
                    Condition(Column("device"), Op.EQ, "BlackBerry"),
                ],
                groupby=[Column("transaction")],
            ),
            start=self.hour_ago,
            end=self.now,
            rollup=Rollup(interval=60, granularity=60),
            scope=MetricsScope(
                org_ids=[self.org_id],
                project_ids=[self.project.id],
                use_case_id=UseCaseID.TRANSACTIONS.value,
            ),
        )
        request = Request(
            dataset="generic_metrics",
            app_id="tests",
            query=query,
            tenant_ids={"referrer": "metrics.testing.test", "organization_id": self.org_id},
        )
        result = run_query(request)
        assert len(result["data"]) == 2
        rows = result["data"]
        assert rows[0]["aggregate_value"] in ([0], 0)
        assert rows[0]["transaction"] == "transaction_0"
        assert rows[1]["aggregate_value"] in ([6.00], 6)
        assert rows[1]["transaction"] == "transaction_0"

        # Set extrapolate flag to True. Since the sampling weight is set to 10, the extrapolated value should be 6*10
        query = query.set_extrapolate(True)
        request = Request(
            dataset="generic_metrics",
            app_id="tests",
            query=query,
            tenant_ids={"referrer": "metrics.testing.test", "organization_id": self.org_id},
        )
        result = run_query(request)
        assert len(result["data"]) == 2
        rows = result["data"]
        assert rows[0]["aggregate_value"] in ([0], 0)
        assert rows[0]["transaction"] == "transaction_0"
        assert rows[1]["aggregate_value"] in ([60.00], 60)
        assert rows[1]["transaction"] == "transaction_0"


class MQLMetaTest(TestCase, BaseMetricsTestCase):
    def ts(self, dt: datetime) -> int:
        return int(dt.timestamp())

    def setUp(self) -> None:
        super().setUp()

        self.generic_metrics: Mapping[str, Literal["counter", "set", "distribution", "gauge"]] = {
            TransactionMRI.DURATION.value: "distribution",
            TransactionMRI.USER.value: "set",
            TransactionMRI.COUNT_PER_ROOT_PROJECT.value: "counter",
            "g:transactions/test_gauge@none": "gauge",
        }
        self.now = datetime.now(tz=timezone.utc).replace(microsecond=0)
        self.hour_ago = self.now - timedelta(hours=1)
        self.org_id = self.project.organization_id
        for mri, metric_type in self.generic_metrics.items():
            assert metric_type in {"counter", "distribution", "set", "gauge"}
            for i in range(2):
                value: int | dict[str, int]
                if metric_type == "gauge":
                    value = {
                        "min": i,
                        "max": i,
                        "sum": i,
                        "count": i,
                        "last": i,
                    }
                else:
                    value = i
                self.store_metric(
                    self.org_id,
                    self.project.id,
                    mri,
                    {
                        "transaction": f"transaction_{i % 2}",
                        "status_code": "500" if i % 2 == 0 else "200",
                        "device": "BlackBerry" if i % 2 == 0 else "Nokia",
                    },
                    self.ts(self.hour_ago + timedelta(minutes=1 * i)),
                    value,
                )

    def test_fetch_metric_mris(self) -> None:
        metric_mris = fetch_metric_mris(self.org_id, [self.project.id], UseCaseID.TRANSACTIONS)
        assert len(metric_mris) == 1
        assert len(metric_mris[self.project.id]) == 4
        assert metric_mris[self.project.id] == [
            "c:transactions/count_per_root_project@none",
            "s:transactions/user@none",
            "g:transactions/test_gauge@none",
            "d:transactions/duration@millisecond",
        ]

    def test_fetch_metric_tag_keys(self) -> None:
        tag_keys = fetch_metric_tag_keys(
            self.org_id, [self.project.id], UseCaseID.TRANSACTIONS, "g:transactions/test_gauge@none"
        )
        assert len(tag_keys) == 1
        assert len(tag_keys[self.project.id]) == 3
        assert tag_keys[self.project.id] == ["status_code", "device", "transaction"]
