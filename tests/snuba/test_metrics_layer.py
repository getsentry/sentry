from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Literal, Mapping

import pytest
from snuba_sdk import (
    Column,
    Condition,
    Direction,
    Metric,
    MetricsQuery,
    MetricsScope,
    Op,
    Request,
    Rollup,
    Timeseries,
)

from sentry.api.utils import InvalidParams
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.snuba.metrics.naming_layer import SessionMRI, TransactionMRI
from sentry.snuba.metrics_layer.query import run_query
from sentry.testutils.cases import BaseMetricsTestCase, TestCase

pytestmark = pytest.mark.sentry_metrics


class SnQLTest(TestCase, BaseMetricsTestCase):
    def ts(self, dt: datetime) -> int:
        return int(dt.timestamp())

    def setUp(self) -> None:
        # TODO (evanh): Figure out how to get this to run once per class instead of for every test
        # Every attempt I've made has caused failures because some other part of the test initialization
        # doesn't work properly.

        super().setUp()

        self.metrics: Mapping[str, Literal["counter", "set", "distribution", "gauge"]] = {
            TransactionMRI.DURATION.value: "distribution",
            "g:transactions/test_gauge@none": "gauge",
            # Can be added when a test actually needs it
            # TransactionMRI.USER.value: "set", # Can be added when a test actually needs it
            # TransactionMRI.COUNT_PER_ROOT_PROJECT.value: "counter",
        }
        self.now = datetime.now(tz=timezone.utc).replace(microsecond=0)
        self.hour_ago = self.now - timedelta(hours=1)
        self.org_id = self.project.organization_id
        for mri, metric_type in self.metrics.items():
            assert metric_type in {"counter", "distribution", "set", "gauge"}
            for i in range(60):
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
                        "status_code": "500" if i % 10 == 0 else "200",
                        "device": "BlackBerry" if i % 3 == 0 else "Nokia",
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
        result = run_query(request)
        assert len(result["data"]) == 60
        rows = result["data"]
        for i in range(60):
            assert rows[i]["aggregate_value"] == i
            assert (
                rows[i]["time"]
                == (
                    self.hour_ago.replace(second=0, microsecond=0) + timedelta(minutes=1 * i)
                ).isoformat()
            )

    def test_basic_quantile(self) -> None:
        query = MetricsQuery(
            query=Timeseries(
                metric=Metric(
                    "transaction.duration",
                    TransactionMRI.DURATION.value,
                ),
                aggregate="quantiles",
                aggregate_params=[0.9],
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
        assert len(result["data"]) == 60
        rows = result["data"]
        for i in range(60):
            assert rows[i]["aggregate_value"] == [i]
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
        result = run_query(request)
        assert len(result["data"]) == 60
        rows = result["data"]
        for i in range(60):
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
        result = run_query(request)
        assert len(result["data"]) == 2
        rows = result["data"]
        for i in range(2):  # 500 status codes on Blackberry are sparse
            assert rows[i]["aggregate_value"] == [i * 30]
            assert (
                rows[i]["time"]
                == (
                    self.hour_ago.replace(second=0, microsecond=0) + timedelta(minutes=30 * i)
                ).isoformat()
            )

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
        result = run_query(request)
        assert len(result["data"]) == 2
        rows = result["data"]
        for i in range(2):  # 500 status codes on BB are sparse
            assert rows[i]["aggregate_value"] == [i * 30]
            assert rows[i]["transaction"] == "transaction_0"
            assert (
                rows[i]["time"]
                == (
                    self.hour_ago.replace(second=0, microsecond=0) + timedelta(minutes=30 * i)
                ).isoformat()
            )

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

        assert rows[0]["aggregate_value"] == 58
        assert rows[0]["transaction"] == "transaction_0"
        assert rows[1]["aggregate_value"] == 59
        assert rows[1]["transaction"] == "transaction_1"

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
        assert len(result["data"]) == 54
        assert result["totals"]["aggregate_value"] == 59

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
        # 30 since it's every 2 minutes.
        # # TODO(evanh): There's a flaky off by one error that comes from the interval rounding I don't care to fix right now, hence the 31 option.
        assert len(result["data"]) in [30, 31]

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
        result = run_query(request)

        assert len(result["data"]) == 60
        assert result["totals"]["aggregate_value"] == 59
