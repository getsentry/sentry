from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Literal, Mapping

import pytest
from snuba_sdk import (
    ArithmeticOperator,
    Column,
    Condition,
    Direction,
    Formula,
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
from sentry.snuba.metrics_layer.query import run_query as layer_run_query
from sentry.testutils.cases import BaseMetricsTestCase, TestCase

pytestmark = pytest.mark.sentry_metrics


# TODO: This is only needed while we support SnQL and MQL. Once SnQL is removed, this can be removed.
LayerQuery = Callable[[Request], Mapping[str, Any]]


class MQLTest(TestCase, BaseMetricsTestCase):
    @property
    def run_query(self) -> LayerQuery:
        def mql_query_fn(request: Request) -> Mapping[str, Any]:
            with self.options({"snuba.use-mql-endpoint": 1.0}):
                return layer_run_query(request)

        return mql_query_fn

    def ts(self, dt: datetime) -> int:
        return int(dt.timestamp())

    def setUp(self) -> None:
        super().setUp()

        self.metrics: Mapping[str, Literal["counter", "set", "distribution", "gauge"]] = {
            TransactionMRI.DURATION.value: "distribution",
            TransactionMRI.USER.value: "set",
            TransactionMRI.COUNT_PER_ROOT_PROJECT.value: "counter",
            "g:transactions/test_gauge@none": "gauge",
        }
        self.now = datetime.now(tz=timezone.utc).replace(microsecond=0)
        self.hour_ago = self.now - timedelta(hours=1)
        self.org_id = self.project.organization_id
        for mri, metric_type in self.metrics.items():
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
                    self.org_id,
                    self.project.id,
                    metric_type,
                    mri,
                    {
                        "transaction": f"transaction_{i % 2}",
                        "status_code": "500" if i % 3 == 0 else "200",
                        "device": "BlackBerry" if i % 2 == 0 else "Nokia",
                    },
                    self.ts(self.hour_ago + timedelta(minutes=1 * i)),
                    value,
                    UseCaseID.TRANSACTIONS,
                )

    def test_basic(self) -> None:
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
        result = self.run_query(request)
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

    def test_groupby(self) -> None:
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
        result = self.run_query(request)
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

    def test_filters(self) -> None:
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
        result = self.run_query(request)
        assert len(result["data"]) == 2
        rows = result["data"]
        assert rows[0]["aggregate_value"] == [0]
        assert rows[1]["aggregate_value"] == [6.0]

    def test_complex(self) -> None:
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
        result = self.run_query(request)
        assert len(result["data"]) == 2
        rows = result["data"]
        assert rows[0]["aggregate_value"] == [0]
        assert rows[0]["transaction"] == "transaction_0"
        assert rows[1]["aggregate_value"] == [6.0]
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
        result = self.run_query(request)
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
        result = self.run_query(request)
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
            self.run_query(request)

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
        result = self.run_query(request)
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
        result = self.run_query(request)

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
        result = self.run_query(request)
        assert request.dataset == "metrics"
        assert len(result["data"]) == 0

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
        result = self.run_query(request)

        assert len(result["data"]) == 10
        assert result["totals"]["aggregate_value"] == 9.0

    @pytest.mark.skip(reason="This is not implemented in MQL")
    def test_failure_rate(self) -> None:
        query = MetricsQuery(
            query=Formula(
                ArithmeticOperator.DIVIDE,
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
        result = self.run_query(request)

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
        result = self.run_query(request)
        assert len(result["data"]) == 10
        rows = result["data"]
        for i in range(10):
            assert rows[i]["aggregate_value"] == [i]
            assert (
                rows[i]["time"]
                == (
                    self.hour_ago.replace(second=0, microsecond=0) + timedelta(minutes=1 * i)
                ).isoformat()
            )


class SnQLTest(MQLTest):
    @property
    def run_query(self) -> LayerQuery:
        def snql_query_fn(request: Request) -> Mapping[str, Any]:
            with self.options({"snuba.use-mql-endpoint": 0}):
                return layer_run_query(request)

        return snql_query_fn

    def test_failure_rate(self) -> None:
        super().test_failure_rate()
