from collections.abc import Mapping, Sequence
from datetime import datetime, timedelta
from typing import Any
from unittest.mock import patch

import pytest
from django.utils import timezone

from sentry.models.environment import Environment
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.sentry_metrics.querying.constants import SNUBA_QUERY_LIMIT
from sentry.sentry_metrics.querying.data import (
    MetricsAPIQueryResultsTransformer,
    MQLQuery,
    run_queries,
)
from sentry.sentry_metrics.querying.errors import (
    InvalidMetricsQueryError,
    MetricsQueryExecutionError,
)
from sentry.sentry_metrics.querying.types import QueryOrder, QueryType
from sentry.sentry_metrics.querying.units import (
    MeasurementUnit,
    UnitFamily,
    get_unit_family_and_unit,
)
from sentry.snuba.metrics.naming_layer import TransactionMRI
from sentry.testutils.cases import BaseMetricsTestCase, TestCase
from sentry.testutils.helpers.datetime import freeze_time

pytestmark = pytest.mark.sentry_metrics

MOCK_DATETIME = (timezone.now() - timedelta(days=1)).replace(
    hour=10, minute=0, second=0, microsecond=0
)


@freeze_time(MOCK_DATETIME)
class MetricsAPITestCase(TestCase, BaseMetricsTestCase):
    def setUp(self):
        super().setUp()

        release_1 = self.create_release(
            project=self.project, version="1.0", date_added=MOCK_DATETIME
        )
        release_2 = self.create_release(
            project=self.project, version="2.0", date_added=MOCK_DATETIME + timedelta(minutes=5)
        )

        for value, transaction, platform, env, release, time in (
            (1, "/hello", "android", "prod", release_1.version, self.now()),
            (6, "/hello", "ios", "dev", release_2.version, self.now()),
            (5, "/world", "windows", "prod", release_1.version, self.now() + timedelta(minutes=30)),
            (3, "/hello", "ios", "dev", release_2.version, self.now() + timedelta(hours=1)),
            (2, "/hello", "android", "dev", release_1.version, self.now() + timedelta(hours=1)),
            (
                4,
                "/world",
                "windows",
                "prod",
                release_2.version,
                self.now() + timedelta(hours=1, minutes=30),
            ),
        ):
            self.store_metric(
                self.project.organization.id,
                self.project.id,
                TransactionMRI.DURATION.value,
                {
                    "transaction": transaction,
                    "platform": platform,
                    "environment": env,
                    "release": release,
                },
                self.ts(time),
                value,
            )

        self.prod_env = self.create_environment(name="prod", project=self.project)
        self.dev_env = self.create_environment(name="dev", project=self.project)

        self.query_transformer = MetricsAPIQueryResultsTransformer()

    def now(self):
        return MOCK_DATETIME

    def ts(self, dt: datetime) -> int:
        return int(dt.timestamp())

    def mql(self, aggregate: str, metric_mri: str, filters: str = "", group_by: str = "") -> str:
        query = aggregate + f"({metric_mri})"
        if filters:
            query += "{" + filters + "}"
        if group_by:
            query += " by" + f"({group_by})"

        return query

    def to_reference_unit(
        self, value: float | int, measurement_unit: MeasurementUnit = "millisecond"
    ) -> float:
        unit_family_and_unit = get_unit_family_and_unit(measurement_unit)
        assert unit_family_and_unit is not None
        _, _, unit = unit_family_and_unit
        return unit.convert(value)

    def run_query(
        self,
        mql_queries: Sequence[MQLQuery],
        start: datetime,
        end: datetime,
        interval: int,
        organization: Organization,
        projects: Sequence[Project],
        environments: Sequence[Environment],
        referrer: str,
        query_type: QueryType = QueryType.TOTALS_AND_SERIES,
    ) -> Mapping[str, Any]:
        return run_queries(
            mql_queries,
            start,
            end,
            interval,
            organization,
            projects,
            environments,
            referrer,
            query_type,
        ).apply_transformer(self.query_transformer)

    def test_query_with_no_formulas(self) -> None:
        results = self.run_query(
            mql_queries=[],
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[self.project],
            environments=[],
            referrer="metrics.data.api",
        )
        assert len(results["data"]) == 0
        assert len(results["meta"]) == 0
        assert results["start"] is None
        assert results["end"] is None

    def test_query_with_empty_results(self) -> None:
        # TODO: the identities returned here to not make much sense, we need to figure out the right semantics.
        for aggregate, expected_identity_series, expected_identity_totals in (
            ("count", None, 0),
            ("avg", None, None),
            ("sum", None, 0.0),
            ("min", None, 0.0),
        ):
            query_1 = self.mql(aggregate, TransactionMRI.DURATION.value, "transaction:/bar")

            results = self.run_query(
                mql_queries=[MQLQuery(query_1)],
                start=self.now() - timedelta(minutes=30),
                end=self.now() + timedelta(hours=1, minutes=30),
                interval=3600,
                organization=self.project.organization,
                projects=[self.project],
                environments=[],
                referrer="metrics.data.api",
            )
            data = results["data"]
            assert len(data) == 1
            assert data[0][0]["by"] == {}
            assert data[0][0]["series"] == [
                None,
                expected_identity_series,
                expected_identity_series,
            ]
            assert data[0][0]["totals"] == expected_identity_totals

    def test_query_with_infinite_value(self) -> None:
        query_1 = self.mql("count", TransactionMRI.DURATION.value)

        results = self.run_query(
            mql_queries=[MQLQuery("$query_1 / 0", query_1=MQLQuery(query_1))],
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[self.project],
            environments=[],
            referrer="metrics.data.api",
        )
        data = results["data"]
        assert len(data) == 1
        assert data[0][0]["by"] == {}
        assert data[0][0]["series"] == [
            None,
            None,
            None,
        ]
        assert data[0][0]["totals"] is None

    def test_query_with_one_aggregation(self) -> None:
        query_1 = self.mql("sum", TransactionMRI.DURATION.value)

        results = self.run_query(
            mql_queries=[MQLQuery(query_1)],
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[self.project],
            environments=[],
            referrer="metrics.data.api",
        )
        data = results["data"]
        assert len(data) == 1
        assert data[0][0]["by"] == {}
        assert data[0][0]["series"] == [
            None,
            self.to_reference_unit(12.0),
            self.to_reference_unit(9.0),
        ]
        assert data[0][0]["totals"] == self.to_reference_unit(21.0)
        meta = results["meta"]
        assert len(meta) == 1
        assert meta[0][1]["unit_family"] == UnitFamily.DURATION.value
        assert meta[0][1]["unit"] is not None
        assert meta[0][1]["scaling_factor"] is not None

    def test_query_with_one_aggregation_and_only_totals(self) -> None:
        query_1 = self.mql("sum", TransactionMRI.DURATION.value)

        results = self.run_query(
            mql_queries=[MQLQuery(query_1)],
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[self.project],
            environments=[],
            referrer="metrics.data.api",
            query_type=QueryType.TOTALS,
        )
        assert results["intervals"] == []
        data = results["data"]
        assert len(data) == 1
        assert data[0][0]["by"] == {}
        assert "series" not in data[0][0]
        assert data[0][0]["totals"] == self.to_reference_unit(21.0)
        meta = results["meta"]
        assert len(meta) == 1
        assert meta[0][1]["unit_family"] == UnitFamily.DURATION.value
        assert meta[0][1]["unit"] is not None
        assert meta[0][1]["scaling_factor"] is not None

    def test_query_with_one_aggregation_and_unitless_aggregate(self) -> None:
        query_1 = self.mql("count", TransactionMRI.DURATION.value)

        results = self.run_query(
            mql_queries=[MQLQuery(query_1)],
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[self.project],
            environments=[],
            referrer="metrics.data.api",
        )
        data = results["data"]
        assert len(data) == 1
        assert data[0][0]["by"] == {}
        assert data[0][0]["series"] == [
            None,
            3,
            3,
        ]
        assert data[0][0]["totals"] == 6
        meta = results["meta"]
        assert len(meta) == 1
        assert meta[0][1]["unit_family"] is None
        assert meta[0][1]["unit"] is None
        assert meta[0][1]["scaling_factor"] is None

    def test_query_with_one_aggregation_and_environment(self) -> None:
        query_1 = self.mql("sum", TransactionMRI.DURATION.value)

        results = self.run_query(
            mql_queries=[MQLQuery(query_1)],
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[self.project],
            environments=[self.prod_env],
            referrer="metrics.data.api",
        )
        data = results["data"]
        assert len(data) == 1
        assert data[0][0]["by"] == {}
        assert data[0][0]["series"] == [
            None,
            self.to_reference_unit(6.0),
            self.to_reference_unit(4.0),
        ]
        assert data[0][0]["totals"] == self.to_reference_unit(10.0)

    def test_query_with_one_aggregation_and_latest_release(self) -> None:
        query_1 = self.mql("sum", TransactionMRI.DURATION.value, "release:latest")

        results = self.run_query(
            mql_queries=[MQLQuery(query_1)],
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[self.project],
            environments=[],
            referrer="metrics.data.api",
        )
        data = results["data"]
        assert len(data) == 1
        assert data[0][0]["by"] == {}
        assert data[0][0]["series"] == [
            None,
            self.to_reference_unit(6.0),
            self.to_reference_unit(7.0),
        ]
        assert data[0][0]["totals"] == self.to_reference_unit(13.0)

    def test_query_with_percentile(self) -> None:
        query_1 = self.mql("p90", TransactionMRI.DURATION.value)

        results = self.run_query(
            mql_queries=[MQLQuery(query_1)],
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[self.project],
            environments=[],
            referrer="metrics.data.api",
        )
        data = results["data"]
        assert len(data) == 1
        assert data[0][0]["by"] == {}
        assert data[0][0]["series"] == [
            None,
            pytest.approx(self.to_reference_unit(5.8)),
            self.to_reference_unit(3.8),
        ]
        assert data[0][0]["totals"] == self.to_reference_unit(5.5)
        meta = results["meta"]
        assert len(meta) == 1
        assert meta[0][0] == {"name": "aggregate_value", "type": "Float64"}

    def test_query_with_valid_percentiles(self) -> None:
        # We only want to check if these percentiles return results.
        for percentile in ("p50", "p75", "p90", "p95", "p99"):
            query_1 = self.mql(percentile, TransactionMRI.DURATION.value)

            results = self.run_query(
                mql_queries=[MQLQuery(query_1)],
                start=self.now() - timedelta(minutes=30),
                end=self.now() + timedelta(hours=1, minutes=30),
                interval=3600,
                organization=self.project.organization,
                projects=[self.project],
                environments=[],
                referrer="metrics.data.api",
            )
            data = results["data"]
            assert len(data) == 1

    def test_query_with_invalid_percentiles(self) -> None:
        # We only want to check if these percentiles result in a error.
        for percentile in ("p30", "p45"):
            query_1 = self.mql(percentile, TransactionMRI.DURATION.value)

            with pytest.raises(MetricsQueryExecutionError):
                self.run_query(
                    mql_queries=[MQLQuery(query_1)],
                    start=self.now() - timedelta(minutes=30),
                    end=self.now() + timedelta(hours=1, minutes=30),
                    interval=3600,
                    organization=self.project.organization,
                    projects=[self.project],
                    environments=[],
                    referrer="metrics.data.api",
                )

    def test_query_with_group_by(self) -> None:
        query_1 = self.mql("sum", TransactionMRI.DURATION.value, group_by="transaction, platform")

        results = self.run_query(
            mql_queries=[MQLQuery(query_1)],
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[self.project],
            environments=[],
            referrer="metrics.data.api",
        )
        data = results["data"]
        assert len(data) == 1
        first_query = sorted(data[0], key=lambda value: value["by"]["platform"])
        assert len(first_query) == 3
        assert first_query[0]["by"] == {"platform": "android", "transaction": "/hello"}
        assert first_query[0]["series"] == [
            None,
            self.to_reference_unit(1.0),
            self.to_reference_unit(2.0),
        ]
        assert first_query[0]["totals"] == self.to_reference_unit(3.0)
        assert first_query[1]["by"] == {"platform": "ios", "transaction": "/hello"}
        assert first_query[1]["series"] == [
            None,
            self.to_reference_unit(6.0),
            self.to_reference_unit(3.0),
        ]
        assert first_query[1]["totals"] == self.to_reference_unit(9.0)
        assert first_query[2]["by"] == {"platform": "windows", "transaction": "/world"}
        assert first_query[2]["series"] == [
            None,
            self.to_reference_unit(5.0),
            self.to_reference_unit(4.0),
        ]
        assert first_query[2]["totals"] == self.to_reference_unit(9.0)
        meta = results["meta"]
        assert len(meta) == 1
        first_meta = sorted(meta[0], key=lambda value: value.get("name", ""))
        assert first_meta[0]["group_bys"] == ["platform", "transaction"]

    def test_query_with_group_by_and_order_by(self) -> None:
        query_1 = self.mql("sum", TransactionMRI.DURATION.value, group_by="transaction")

        results = self.run_query(
            mql_queries=[MQLQuery(query_1, order=QueryOrder.DESC)],
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[self.project],
            environments=[],
            referrer="metrics.data.api",
        )
        data = results["data"]
        assert len(data) == 1
        assert len(data[0]) == 2
        assert data[0][0]["by"] == {"transaction": "/hello"}
        assert data[0][0]["series"] == [
            None,
            self.to_reference_unit(7.0),
            self.to_reference_unit(5.0),
        ]
        assert data[0][0]["totals"] == self.to_reference_unit(12.0)
        assert data[0][1]["by"] == {"transaction": "/world"}
        assert data[0][1]["series"] == [
            None,
            self.to_reference_unit(5.0),
            self.to_reference_unit(4.0),
        ]
        assert data[0][1]["totals"] == self.to_reference_unit(9.0)

    def test_query_with_group_by_and_order_by_and_only_totals(self) -> None:
        query_1 = self.mql("sum", TransactionMRI.DURATION.value, group_by="transaction")

        results = self.run_query(
            mql_queries=[MQLQuery(query_1, order=QueryOrder.ASC)],
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[self.project],
            environments=[],
            referrer="metrics.data.api",
            query_type=QueryType.TOTALS,
        )
        assert results["intervals"] == []
        data = results["data"]
        assert len(data) == 1
        assert len(data[0]) == 2
        assert data[0][0]["by"] == {"transaction": "/world"}
        assert data[0][0]["totals"] == self.to_reference_unit(9.0)
        assert data[0][1]["by"] == {"transaction": "/hello"}
        assert data[0][1]["totals"] == self.to_reference_unit(12.0)

    def test_query_with_group_by_on_null_tag(self) -> None:
        for value, transaction, time in (
            (1, "/hello", self.now()),
            (5, None, self.now() + timedelta(minutes=30)),
        ):
            tags = {}
            if transaction:
                tags["transaction"] = transaction

            self.store_metric(
                self.project.organization.id,
                self.project.id,
                TransactionMRI.MEASUREMENTS_FCP.value,
                tags,
                self.ts(time),
                value,
            )

        query_1 = self.mql("sum", TransactionMRI.MEASUREMENTS_FCP.value, group_by="transaction")

        results = self.run_query(
            mql_queries=[MQLQuery(query_1)],
            start=self.now(),
            end=self.now() + timedelta(hours=1),
            interval=3600,
            organization=self.project.organization,
            projects=[self.project],
            environments=[],
            referrer="metrics.data.api",
        )
        data = results["data"]
        assert len(data) == 1
        first_query = sorted(data[0], key=lambda value: value["by"]["transaction"])
        assert len(first_query) == 2
        assert first_query[0]["by"] == {"transaction": ""}
        assert first_query[0]["series"] == [self.to_reference_unit(5.0)]
        assert first_query[0]["totals"] == self.to_reference_unit(5.0)
        assert first_query[1]["by"] == {"transaction": "/hello"}
        assert first_query[1]["series"] == [self.to_reference_unit(1.0)]
        assert first_query[1]["totals"] == self.to_reference_unit(1.0)

    def test_query_with_parenthesized_filter(self) -> None:
        query_1 = self.mql("sum", TransactionMRI.DURATION.value, "(transaction:/hello)", "platform")

        results = self.run_query(
            mql_queries=[MQLQuery(query_1)],
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[self.project],
            environments=[],
            referrer="metrics.data.api",
        )
        data = results["data"]
        assert len(data) == 1
        first_query = sorted(data[0], key=lambda value: value["by"]["platform"])
        assert len(first_query) == 2
        assert first_query[0]["by"] == {"platform": "android"}
        assert first_query[0]["series"] == [
            None,
            self.to_reference_unit(1.0),
            self.to_reference_unit(2.0),
        ]
        assert first_query[0]["totals"] == self.to_reference_unit(3.0)
        assert first_query[1]["by"] == {"platform": "ios"}
        assert first_query[1]["series"] == [
            None,
            self.to_reference_unit(6.0),
            self.to_reference_unit(3.0),
        ]
        assert first_query[1]["totals"] == self.to_reference_unit(9.0)

    def test_query_with_and_filter(self) -> None:
        query_1 = self.mql(
            "sum", TransactionMRI.DURATION.value, "platform:ios AND transaction:/hello", "platform"
        )

        results = self.run_query(
            mql_queries=[MQLQuery(query_1)],
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[self.project],
            environments=[],
            referrer="metrics.data.api",
        )
        data = results["data"]
        assert len(data) == 1
        first_query = sorted(data[0], key=lambda value: value["by"]["platform"])
        assert len(first_query) == 1
        assert first_query[0]["by"] == {"platform": "ios"}
        assert first_query[0]["series"] == [
            None,
            self.to_reference_unit(6.0),
            self.to_reference_unit(3.0),
        ]
        assert first_query[0]["totals"] == self.to_reference_unit(9.0)

    def test_query_with_or_filter(self) -> None:
        query_1 = self.mql(
            "sum", TransactionMRI.DURATION.value, "platform:ios OR platform:android", "platform"
        )

        results = self.run_query(
            mql_queries=[MQLQuery(query_1)],
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[self.project],
            environments=[],
            referrer="metrics.data.api",
        )
        data = results["data"]
        assert len(data) == 1
        first_query = sorted(data[0], key=lambda value: value["by"]["platform"])
        assert len(first_query) == 2
        assert first_query[0]["by"] == {"platform": "android"}
        assert first_query[0]["series"] == [
            None,
            self.to_reference_unit(1.0),
            self.to_reference_unit(2.0),
        ]
        assert first_query[0]["totals"] == self.to_reference_unit(3.0)
        assert first_query[1]["by"] == {"platform": "ios"}
        assert first_query[1]["series"] == [
            None,
            self.to_reference_unit(6.0),
            self.to_reference_unit(3.0),
        ]
        assert first_query[1]["totals"] == self.to_reference_unit(9.0)

    def test_query_one_negated_filter(self) -> None:
        query_1 = self.mql(
            "sum", TransactionMRI.DURATION.value, "!platform:ios transaction:/hello", "platform"
        )

        results = self.run_query(
            mql_queries=[MQLQuery(query_1)],
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[self.project],
            environments=[],
            referrer="metrics.data.api",
        )
        data = results["data"]
        assert len(data) == 1
        first_query = sorted(data[0], key=lambda value: value["by"]["platform"])
        assert len(first_query) == 1
        assert first_query[0]["by"] == {"platform": "android"}
        assert first_query[0]["series"] == [
            None,
            self.to_reference_unit(1.0),
            self.to_reference_unit(2.0),
        ]
        assert first_query[0]["totals"] == self.to_reference_unit(3.0)

    def test_query_one_in_filter(self) -> None:
        query_1 = self.mql(
            "sum", TransactionMRI.DURATION.value, "platform:[android, ios]", "platform"
        )

        results = self.run_query(
            mql_queries=[MQLQuery(query_1)],
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[self.project],
            environments=[],
            referrer="metrics.data.api",
        )
        data = results["data"]
        assert len(data) == 1
        first_query = sorted(data[0], key=lambda value: value["by"]["platform"])
        assert len(first_query) == 2
        assert first_query[0]["by"] == {"platform": "android"}
        assert first_query[0]["series"] == [
            None,
            self.to_reference_unit(1.0),
            self.to_reference_unit(2.0),
        ]
        assert first_query[0]["totals"] == self.to_reference_unit(3.0)
        assert first_query[1]["by"] == {"platform": "ios"}
        assert first_query[1]["series"] == [
            None,
            self.to_reference_unit(6.0),
            self.to_reference_unit(3.0),
        ]
        assert first_query[1]["totals"] == self.to_reference_unit(9.0)

    def test_query_one_not_in_filter(self) -> None:
        query_1 = self.mql(
            "sum", TransactionMRI.DURATION.value, '!platform:["android", "ios"]', "platform"
        )

        results = self.run_query(
            mql_queries=[MQLQuery(query_1)],
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[self.project],
            environments=[],
            referrer="metrics.data.api",
        )
        data = results["data"]
        assert len(data) == 1
        first_query = sorted(data[0], key=lambda value: value["by"]["platform"])
        assert len(first_query) == 1
        assert first_query[0]["by"] == {"platform": "windows"}
        assert first_query[0]["series"] == [
            None,
            self.to_reference_unit(5.0),
            self.to_reference_unit(4.0),
        ]
        assert first_query[0]["totals"] == self.to_reference_unit(9.0)

    def test_query_with_multiple_aggregations(self) -> None:
        query_1 = self.mql("min", TransactionMRI.DURATION.value)
        query_2 = self.mql("max", TransactionMRI.DURATION.value)

        results = self.run_query(
            mql_queries=[MQLQuery(query_1), MQLQuery(query_2)],
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[self.project],
            environments=[],
            referrer="metrics.data.api",
        )
        data = results["data"]
        assert len(data) == 2
        assert data[0][0]["by"] == {}
        assert data[0][0]["series"] == [
            None,
            self.to_reference_unit(1.0),
            self.to_reference_unit(2.0),
        ]
        assert data[0][0]["totals"] == self.to_reference_unit(1.0)
        assert data[1][0]["by"] == {}
        assert data[1][0]["series"] == [
            None,
            self.to_reference_unit(6.0),
            self.to_reference_unit(4.0),
        ]
        assert data[1][0]["totals"] == self.to_reference_unit(6.0)

    def test_query_with_multiple_aggregations_and_single_group_by(self) -> None:
        query_1 = self.mql("min", TransactionMRI.DURATION.value, group_by="platform")
        query_2 = self.mql("max", TransactionMRI.DURATION.value, group_by="platform")

        results = self.run_query(
            mql_queries=[MQLQuery(query_1), MQLQuery(query_2)],
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[self.project],
            environments=[],
            referrer="metrics.data.api",
        )
        data = results["data"]
        assert len(data) == 2
        first_query = sorted(data[0], key=lambda value: value["by"]["platform"])
        assert len(first_query) == 3
        assert first_query[0]["by"] == {"platform": "android"}
        assert first_query[0]["series"] == [
            None,
            self.to_reference_unit(1.0),
            self.to_reference_unit(2.0),
        ]
        assert first_query[0]["totals"] == self.to_reference_unit(1.0)
        assert first_query[1]["by"] == {"platform": "ios"}
        assert first_query[1]["series"] == [
            None,
            self.to_reference_unit(6.0),
            self.to_reference_unit(3.0),
        ]
        assert first_query[1]["totals"] == self.to_reference_unit(3.0)
        assert first_query[2]["by"] == {"platform": "windows"}
        assert first_query[2]["series"] == [
            None,
            self.to_reference_unit(5.0),
            self.to_reference_unit(4.0),
        ]
        assert first_query[2]["totals"] == self.to_reference_unit(4.0)
        second_query = sorted(data[1], key=lambda value: value["by"]["platform"])
        assert len(second_query) == 3
        assert second_query[0]["by"] == {"platform": "android"}
        assert second_query[0]["series"] == [
            None,
            self.to_reference_unit(1.0),
            self.to_reference_unit(2.0),
        ]
        assert second_query[0]["totals"] == self.to_reference_unit(2.0)
        assert second_query[1]["by"] == {"platform": "ios"}
        assert second_query[1]["series"] == [
            None,
            self.to_reference_unit(6.0),
            self.to_reference_unit(3.0),
        ]
        assert second_query[1]["totals"] == self.to_reference_unit(6.0)
        assert second_query[2]["by"] == {"platform": "windows"}
        assert second_query[2]["series"] == [
            None,
            self.to_reference_unit(5.0),
            self.to_reference_unit(4.0),
        ]
        assert second_query[2]["totals"] == self.to_reference_unit(5.0)

    def test_query_with_multiple_aggregations_and_single_group_by_and_order_by_with_limit(
        self,
    ) -> None:
        query_1 = self.mql("min", TransactionMRI.DURATION.value, group_by="platform")
        query_2 = self.mql("max", TransactionMRI.DURATION.value, group_by="platform")

        results = self.run_query(
            mql_queries=[
                MQLQuery(query_1, order=QueryOrder.ASC, limit=2),
                MQLQuery(query_2, order=QueryOrder.DESC, limit=2),
            ],
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[self.project],
            environments=[],
            referrer="metrics.data.api",
        )
        data = results["data"]
        assert len(data) == 2
        first_query = sorted(data[0], key=lambda value: value["by"]["platform"])
        assert len(first_query) == 2
        assert first_query[0]["by"] == {"platform": "android"}
        assert first_query[0]["series"] == [
            None,
            self.to_reference_unit(1.0),
            self.to_reference_unit(2.0),
        ]
        assert first_query[0]["totals"] == self.to_reference_unit(1.0)
        assert first_query[1]["by"] == {"platform": "ios"}
        assert first_query[1]["series"] == [
            None,
            self.to_reference_unit(6.0),
            self.to_reference_unit(3.0),
        ]
        assert first_query[1]["totals"] == self.to_reference_unit(3.0)
        second_query = sorted(data[1], key=lambda value: value["by"]["platform"])
        assert len(second_query) == 2
        assert second_query[0]["by"] == {"platform": "ios"}
        assert second_query[0]["series"] == [
            None,
            self.to_reference_unit(6.0),
            self.to_reference_unit(3.0),
        ]
        assert second_query[0]["totals"] == self.to_reference_unit(6.0)
        assert second_query[1]["by"] == {"platform": "windows"}
        assert second_query[1]["series"] == [
            None,
            self.to_reference_unit(5.0),
            self.to_reference_unit(4.0),
        ]
        assert second_query[1]["totals"] == self.to_reference_unit(5.0)
        meta = results["meta"]
        assert len(meta) == 2
        first_meta = sorted(meta[0], key=lambda value: value.get("name", ""))
        assert first_meta[0]["limit"] == 2
        assert first_meta[0]["order"] == "ASC"
        second_meta = sorted(meta[1], key=lambda value: value.get("name", ""))
        assert second_meta[0]["limit"] == 2
        assert second_meta[0]["order"] == "DESC"

    def test_query_with_limit_above_snuba_limit(
        self,
    ) -> None:
        query_1 = self.mql("min", TransactionMRI.DURATION.value)

        results = self.run_query(
            mql_queries=[MQLQuery(query_1, limit=SNUBA_QUERY_LIMIT + 10)],
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[self.project],
            environments=[],
            referrer="metrics.data.api",
        )
        data = results["data"]
        assert len(data) == 1
        assert data[0][0]["by"] == {}
        assert data[0][0]["series"] == [
            None,
            self.to_reference_unit(1.0),
            self.to_reference_unit(2.0),
        ]
        assert data[0][0]["totals"] == self.to_reference_unit(1.0)
        meta = results["meta"]
        assert len(meta) == 1
        first_meta = sorted(meta[0], key=lambda value: value.get("name", ""))
        assert first_meta[0]["limit"] == SNUBA_QUERY_LIMIT

    @patch("sentry.sentry_metrics.querying.data.execution.SNUBA_QUERY_LIMIT", 3)
    def test_query_with_multiple_aggregations_and_single_group_by_and_dynamic_limit(
        self,
    ) -> None:
        query_1 = self.mql("min", TransactionMRI.DURATION.value, group_by="platform")
        query_2 = self.mql("max", TransactionMRI.DURATION.value, group_by="platform")

        # With a snuba limit of 3 and 3 intervals we expect to only have 1 group returned. Currently,
        # the test is failing because totals are correctly queried but series data is returned up to
        # 3 elements and since filters are not properly applied, any 3 entries are returned out of all
        # the groups * intervals combinations. Once the bug will be fixed on the snuba side, we should
        # expect to get back 3 correct entries from the series query.
        results = self.run_query(
            mql_queries=[
                MQLQuery(query_1, order=QueryOrder.DESC),
                MQLQuery(query_2, order=QueryOrder.DESC),
            ],
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[self.project],
            environments=[],
            referrer="metrics.data.api",
        )
        data = results["data"]
        assert len(data) == 2
        first_query = sorted(data[0], key=lambda value: value["by"]["platform"])
        assert len(first_query) == 1
        assert first_query[0]["by"] == {"platform": "windows"}
        assert first_query[0]["series"] == [
            None,
            self.to_reference_unit(5.0),
            self.to_reference_unit(4.0),
        ]
        assert first_query[0]["totals"] == self.to_reference_unit(4.0)
        second_query = sorted(data[1], key=lambda value: value["by"]["platform"])
        assert len(second_query) == 1
        assert second_query[0]["by"] == {"platform": "ios"}
        assert second_query[0]["series"] == [
            None,
            self.to_reference_unit(6.0),
            self.to_reference_unit(3.0),
        ]
        assert second_query[0]["totals"] == self.to_reference_unit(6.0)
        meta = results["meta"]
        assert len(meta) == 2
        first_meta = sorted(meta[0], key=lambda value: value.get("name", ""))
        assert first_meta[0]["limit"] == 2
        assert first_meta[0]["has_more"]
        assert first_meta[0]["order"] == "DESC"
        second_meta = sorted(meta[1], key=lambda value: value.get("name", ""))
        assert second_meta[0]["limit"] == 2
        assert first_meta[0]["has_more"]
        assert second_meta[0]["order"] == "DESC"

    def test_query_with_custom_set(self):
        mri = "s:transactions/User.Click.2@none"
        for user in ("marco", "marco", "john"):
            self.store_metric(
                self.project.organization.id,
                self.project.id,
                mri,
                {},
                self.ts(self.now()),
                user,
            )

        query_1 = self.mql("count_unique", mri)

        results = self.run_query(
            mql_queries=[MQLQuery(query_1)],
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[self.project],
            environments=[],
            referrer="metrics.data.api",
        )
        data = results["data"]
        assert len(data) == 1
        assert data[0][0]["by"] == {}
        assert data[0][0]["series"] == [None, 2, None]
        assert data[0][0]["totals"] == 2

        mri = "d:transactions/page_size@byte"

        project_1 = self.create_project()
        project_2 = self.create_project()

        for project, value in ((project_1, 10.0), (project_2, 15.0)):
            self.store_metric(
                self.project.organization.id,
                project.id,
                mri,
                {"transaction": "/hello"},
                self.ts(self.now()),
                value,
            )

        query_1 = self.mql("sum", mri)

        results = self.run_query(
            mql_queries=[MQLQuery(query_1)],
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[project_1, project_2],
            environments=[],
            referrer="metrics.data.api",
        )
        data = results["data"]
        assert len(data) == 1
        assert data[0][0]["by"] == {}
        assert data[0][0]["series"] == [None, self.to_reference_unit(25.0, "byte"), None]
        assert data[0][0]["totals"] == self.to_reference_unit(25.0, "byte")

    def test_query_with_invalid_syntax(
        self,
    ) -> None:
        query_1 = self.mql(
            "min",
            TransactionMRI.DURATION.value,
            "transaction:/api/0/organizations/{organization_id_or_slug}/",
        )

        with pytest.raises(InvalidMetricsQueryError):
            self.run_query(
                mql_queries=[MQLQuery(query_1)],
                start=self.now() - timedelta(minutes=30),
                end=self.now() + timedelta(hours=1, minutes=30),
                interval=3600,
                organization=self.project.organization,
                projects=[self.project],
                environments=[],
                referrer="metrics.data.api",
            )

    def test_query_with_different_namespaces(self):
        query_1 = self.mql(
            "min",
            TransactionMRI.DURATION.value,
        )
        query_2 = self.mql("max", "d:transactions/app_load@millisecond")

        with pytest.raises(InvalidMetricsQueryError):
            self.run_query(
                mql_queries=[
                    MQLQuery(
                        "$query_1 / $query_2", query_1=MQLQuery(query_1), query_2=MQLQuery(query_2)
                    )
                ],
                start=self.now() - timedelta(minutes=30),
                end=self.now() + timedelta(hours=1, minutes=30),
                interval=3600,
                organization=self.project.organization,
                projects=[self.project],
                environments=[],
                referrer="metrics.data.api",
            )

    def test_query_with_different_metric_types(self):
        query_1 = self.mql("count", "c:transactions/page_click@none")
        query_2 = self.mql("max", "d:transactions/app_load@millisecond")

        with pytest.raises(InvalidMetricsQueryError):
            self.run_query(
                mql_queries=[
                    MQLQuery(
                        "$query_1 * $query_2", query_1=MQLQuery(query_1), query_2=MQLQuery(query_2)
                    )
                ],
                start=self.now() - timedelta(minutes=30),
                end=self.now() + timedelta(hours=1, minutes=30),
                interval=3600,
                organization=self.project.organization,
                projects=[self.project],
                environments=[],
                referrer="metrics.data.api",
            )

    def test_query_with_different_group_bys(self):
        query_1 = self.mql(
            "min", "d:transactions/page_click@none", group_by="transaction, environment"
        )
        query_2 = self.mql("max", "d:transactions/app_load@millisecond", group_by="transaction")

        with pytest.raises(InvalidMetricsQueryError):
            self.run_query(
                mql_queries=[
                    MQLQuery(
                        "$query_1 * $query_2 / $query_1",
                        query_1=MQLQuery(query_1),
                        query_2=MQLQuery(query_2),
                    )
                ],
                start=self.now() - timedelta(minutes=30),
                end=self.now() + timedelta(hours=1, minutes=30),
                interval=3600,
                organization=self.project.organization,
                projects=[self.project],
                environments=[],
                referrer="metrics.data.api",
            )

    def test_query_with_complex_group_by(self):
        query_1 = self.mql("min", "d:transactions/page_click@none", group_by="environment")
        query_2 = self.mql("max", "d:transactions/app_load@millisecond", group_by="transaction")

        with pytest.raises(InvalidMetricsQueryError):
            self.run_query(
                mql_queries=[
                    MQLQuery(
                        "((($query_1 * $query_2) by (release)) / $query_1) by (browser)",
                        query_1=MQLQuery(query_1),
                        query_2=MQLQuery(query_2),
                    )
                ],
                start=self.now() - timedelta(minutes=30),
                end=self.now() + timedelta(hours=1, minutes=30),
                interval=3600,
                organization=self.project.organization,
                projects=[self.project],
                environments=[],
                referrer="metrics.data.api",
            )

    def test_query_with_basic_formula(self):
        query_1 = self.mql("count", TransactionMRI.DURATION.value)
        query_2 = self.mql("sum", TransactionMRI.DURATION.value)

        results = self.run_query(
            mql_queries=[
                MQLQuery(
                    "$query_2 / $query_1", query_1=MQLQuery(query_1), query_2=MQLQuery(query_2)
                )
            ],
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[self.project],
            environments=[],
            referrer="metrics.data.api",
        )
        data = results["data"]
        assert len(data) == 1
        assert data[0][0]["by"] == {}
        assert data[0][0]["series"] == [None, 4.0, 3.0]
        assert data[0][0]["totals"] == 3.5

    def test_query_with_complex_formula(self):
        query_1 = self.mql("count", TransactionMRI.DURATION.value)
        query_2 = self.mql("sum", TransactionMRI.DURATION.value)

        results = self.run_query(
            mql_queries=[
                MQLQuery(
                    "$query_2 * $query_1 + 100",
                    query_1=MQLQuery(query_1),
                    query_2=MQLQuery(query_2),
                ),
                MQLQuery("$query_1", query_1=MQLQuery(query_1)),
                MQLQuery("$query_2", query_2=MQLQuery(query_2)),
            ],
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[self.project],
            environments=[],
            referrer="metrics.data.api",
        )
        data = results["data"]
        assert len(data) == 3
        assert data[0][0]["by"] == {}
        # Units normalization is not performed if a `count` is in the formula.
        assert data[0][0]["series"] == [None, 136.0, 127.0]
        assert data[0][0]["totals"] == 226.0

    def test_query_with_formula_and_group_by(self):
        query_1 = self.mql("count", TransactionMRI.DURATION.value)
        query_2 = self.mql("sum", TransactionMRI.DURATION.value)

        results = self.run_query(
            mql_queries=[
                MQLQuery(
                    "($query_2 * $query_1) by (platform, transaction)",
                    query_1=MQLQuery(query_1),
                    query_2=MQLQuery(query_2),
                )
            ],
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[self.project],
            environments=[],
            referrer="metrics.data.api",
        )
        data = results["data"]
        assert len(data) == 1
        first_query = sorted(data[0], key=lambda value: value["by"]["platform"])
        assert len(first_query) == 3
        assert first_query[0]["by"] == {"platform": "android", "transaction": "/hello"}
        assert first_query[0]["series"] == [None, 1.0, 2.0]
        assert first_query[0]["totals"] == 6.0
        assert first_query[1]["by"] == {"platform": "ios", "transaction": "/hello"}
        assert first_query[1]["series"] == [None, 6.0, 3.0]
        assert first_query[1]["totals"] == 18.0
        assert first_query[2]["by"] == {"platform": "windows", "transaction": "/world"}
        assert first_query[2]["series"] == [None, 5.0, 4.0]
        assert first_query[2]["totals"] == 18.0

    def test_query_with_formula_and_filter(self):
        query_1 = self.mql("count", TransactionMRI.DURATION.value, filters="platform:android")
        query_2 = self.mql("sum", TransactionMRI.DURATION.value, filters="platform:ios")

        results = self.run_query(
            mql_queries=[
                MQLQuery(
                    "($query_2 + $query_1) by (transaction)",
                    order=QueryOrder.DESC,
                    query_1=MQLQuery(query_1),
                    query_2=MQLQuery(query_2),
                )
            ],
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[self.project],
            environments=[],
            referrer="metrics.data.api",
        )
        data = results["data"]
        assert len(data) == 1
        assert len(data[0]) == 1
        assert data[0][0]["by"] == {"transaction": "/hello"}
        assert data[0][0]["series"] == [None, 7.0, 4.0]
        assert data[0][0]["totals"] == 11.0

    def test_query_with_basic_formula_and_coercible_units(self):
        mri_1 = "d:transactions/page_load@nanosecond"
        mri_2 = "d:transactions/image_load@microsecond"
        for mri, value in ((mri_1, 20), (mri_1, 10), (mri_2, 15), (mri_2, 5)):
            self.store_metric(
                self.project.organization.id,
                self.project.id,
                mri,
                {},
                self.ts(self.now()),
                value,
            )

        for formula, expected_result, expected_unit_family in (
            # (($query_2 * 1000) + 10000.0)
            ("($query_2 + 10)", 30000.0, UnitFamily.DURATION.value),
            # (($query_2 * 1000) + (10 * 2) * 1000)
            ("($query_2 + (10 * 2))", 40000.0, UnitFamily.DURATION.value),
            # (10000.0 + ($query_2 * 1000))
            ("(10 + $query_2)", 30000.0, UnitFamily.DURATION.value),
            # (($query_2 + 1000) + (10000.0 + 20000.0))
            ("($query_2 + (10 + 20))", 50000.0, UnitFamily.DURATION.value),
            # ((10000.0 + 20000.0) + ($query_2 + 1000))
            ("((10 + 20) + $query_2)", 50000.0, UnitFamily.DURATION.value),
            # ($query_2 * 1000 + 10000.0) + ($query_2 * 1000)
            ("($query_2 + 10) + $query_2", 50000.0, UnitFamily.DURATION.value),
            # ($query_2 * 1000 + 10000.0) + $query_1
            ("($query_2 + 10) + $query_1", 30015.0, UnitFamily.DURATION.value),
            # ($query_1 + 10) + ($query_2 * 1000)
            ("($query_1 + 10) + $query_2", 20025.0, UnitFamily.DURATION.value),
        ):
            query_1 = self.mql("avg", mri_1)
            query_2 = self.mql("sum", mri_2)

            results = self.run_query(
                mql_queries=[
                    MQLQuery(formula, query_1=MQLQuery(query_1), query_2=MQLQuery(query_2))
                ],
                start=self.now() - timedelta(minutes=30),
                end=self.now() + timedelta(hours=1, minutes=30),
                interval=3600,
                organization=self.project.organization,
                projects=[self.project],
                environments=[],
                referrer="metrics.data.api",
            )
            data = results["data"]
            assert len(data) == 1
            assert data[0][0]["by"] == {}
            assert data[0][0]["series"] == [None, expected_result, None]
            assert data[0][0]["totals"] == expected_result
            meta = results["meta"]
            assert len(meta) == 1
            assert meta[0][1]["unit_family"] == expected_unit_family
            assert meta[0][1]["unit"] == "nanosecond"
            assert meta[0][1]["scaling_factor"] is None

    def test_query_with_basic_formula_and_non_coercible_units(self):
        mri_1 = "d:transactions/page_load@nanosecond"
        mri_2 = "d:transactions/page_size@byte"
        for mri, value in ((mri_1, 20), (mri_2, 15)):
            self.store_metric(
                self.project.organization.id,
                self.project.id,
                mri,
                {},
                self.ts(self.now()),
                value,
            )

        query_1 = self.mql("avg", mri_1)
        query_2 = self.mql("sum", mri_2)

        results = self.run_query(
            mql_queries=[
                MQLQuery(
                    "$query_1 + $query_2", query_1=MQLQuery(query_1), query_2=MQLQuery(query_2)
                )
            ],
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[self.project],
            environments=[],
            referrer="metrics.data.api",
        )
        data = results["data"]
        assert len(data) == 1
        assert data[0][0]["by"] == {}
        assert data[0][0]["series"] == [None, 35.0, None]
        assert data[0][0]["totals"] == 35.0
        meta = results["meta"]
        assert len(meta) == 1
        assert meta[0][1]["unit_family"] is None
        assert meta[0][1]["unit"] is None
        assert meta[0][1]["scaling_factor"] is None

    def test_query_with_basic_formula_and_unitless_aggregates(self):
        mri_1 = "d:transactions/page_load@nanosecond"
        mri_2 = "d:transactions/load_time@microsecond"
        for mri, value in ((mri_1, 20), (mri_2, 15)):
            self.store_metric(
                self.project.organization.id,
                self.project.id,
                mri,
                {},
                self.ts(self.now()),
                value,
            )

        query_1 = self.mql("avg", mri_1)
        query_2 = self.mql("count", mri_2)

        results = self.run_query(
            mql_queries=[
                MQLQuery(
                    "$query_1 + $query_2", query_1=MQLQuery(query_1), query_2=MQLQuery(query_2)
                )
            ],
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[self.project],
            environments=[],
            referrer="metrics.data.api",
        )
        data = results["data"]
        assert len(data) == 1
        assert data[0][0]["by"] == {}
        assert data[0][0]["series"] == [None, 21.0, None]
        assert data[0][0]["totals"] == 21.0
        meta = results["meta"]
        assert len(meta) == 1
        assert meta[0][1]["unit_family"] is None
        assert meta[0][1]["unit"] is None
        assert meta[0][1]["scaling_factor"] is None

    def test_query_with_basic_formula_and_unknown_units(self):
        mri_1 = "d:transactions/cost@bananas"
        mri_2 = "d:transactions/speed@mangos"
        for mri, value in ((mri_1, 20), (mri_2, 15)):
            self.store_metric(
                self.project.organization.id,
                self.project.id,
                mri,
                {},
                self.ts(self.now()),
                value,
            )

        query_1 = self.mql("avg", mri_1)
        query_2 = self.mql("sum", mri_2)

        results = self.run_query(
            mql_queries=[
                MQLQuery(
                    "$query_1 + $query_2", query_1=MQLQuery(query_1), query_2=MQLQuery(query_2)
                )
            ],
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[self.project],
            environments=[],
            referrer="metrics.data.api",
        )
        data = results["data"]
        assert len(data) == 1
        assert data[0][0]["by"] == {}
        assert data[0][0]["series"] == [None, 35.0, None]
        assert data[0][0]["totals"] == 35.0
        meta = results["meta"]
        assert len(meta) == 1
        assert meta[0][1]["unit_family"] is None
        assert meta[0][1]["unit"] is None
        assert meta[0][1]["scaling_factor"] is None

    def test_query_with_basic_formula_and_coefficient_operators(self):
        mri_1 = "d:transactions/page_load@nanosecond"
        mri_2 = "d:transactions/load_time@microsecond"
        for mri, value in ((mri_1, 20), (mri_2, 15)):
            self.store_metric(
                self.project.organization.id,
                self.project.id,
                mri,
                {},
                self.ts(self.now()),
                value,
            )

        for formula, expected_result, expected_unit_family, expected_unit in (
            ("$query_1 * $query_2", 300.0, None, None),
            ("$query_1 * $query_2 + 25", 325.0, None, None),
            ("$query_1 * $query_2 / 1", 300.0, None, None),
            ("$query_1 * 2", 40.0, UnitFamily.DURATION.value, "nanosecond"),
            ("$query_2 * 2", 30000.0, UnitFamily.DURATION.value, "nanosecond"),
            ("$query_1 / 2", 10.0, UnitFamily.DURATION.value, "nanosecond"),
            ("$query_2 / 2", 7500.0, UnitFamily.DURATION.value, "nanosecond"),
            ("$query_2 * (2 + 1)", 45000.0, UnitFamily.DURATION.value, "nanosecond"),
        ):
            query_1 = self.mql("avg", mri_1)
            query_2 = self.mql("sum", mri_2)

            results = self.run_query(
                mql_queries=[
                    MQLQuery(formula, query_1=MQLQuery(query_1), query_2=MQLQuery(query_2))
                ],
                start=self.now() - timedelta(minutes=30),
                end=self.now() + timedelta(hours=1, minutes=30),
                interval=3600,
                organization=self.project.organization,
                projects=[self.project],
                environments=[],
                referrer="metrics.data.api",
            )
            data = results["data"]
            assert len(data) == 1
            assert data[0][0]["by"] == {}
            assert data[0][0]["series"] == [None, expected_result, None]
            assert data[0][0]["totals"] == expected_result
            meta = results["meta"]
            assert len(meta) == 1
            assert meta[0][1]["unit_family"] == expected_unit_family
            assert meta[0][1]["unit"] == expected_unit
            assert meta[0][1]["scaling_factor"] is None

    def setup_project_with_metrics(self, name: str):
        new_project = self.create_project(name=name)
        for value, transaction, platform, env, time in (
            (1, "/hello", "android", "prod", self.now()),
            (3, "/hello", "android", "prod", self.now()),
            (5, "/hello", "android", "prod", self.now()),
            (2, "/hello", "android", "prod", self.now() + timedelta(hours=1, minutes=30)),
            (5, "/hello", "android", "prod", self.now() + timedelta(hours=1, minutes=30)),
            (8, "/hello", "android", "prod", self.now() + timedelta(hours=1, minutes=30)),
        ):
            self.store_metric(
                new_project.organization.id,
                new_project.id,
                TransactionMRI.DURATION.value,
                {
                    "transaction": transaction,
                    "platform": platform,
                    "environment": env,
                },
                self.ts(time),
                value,
            )
        return new_project

    def test_project_mapping(self) -> None:
        new_project_1 = self.setup_project_with_metrics("Bar Again")
        new_project_2 = self.setup_project_with_metrics("Bar Yet Again")
        new_empty_project = self.create_project(name="empty project")
        expected_series_project = [
            None,
            self.to_reference_unit(4.0),
            self.to_reference_unit(3.0),
        ]
        expected_totals_project = self.to_reference_unit(3.5)

        expected_series_new_project_1 = [
            None,
            self.to_reference_unit(3.0),
            self.to_reference_unit(5.0),
        ]
        expected_totals_new_project_1 = self.to_reference_unit(4)

        cases: list[dict[str, Any]] = [
            {
                "name": "filter by project",
                "filters": "project:bar",
                "group_by": "",
                "len": 1,
                "series": expected_series_project,
                "totals": expected_totals_project,
            },
            {
                "name": "group by project",
                "filters": "",
                "group_by": "project",
                "len": 3,
                "series": expected_series_project,
                "totals": expected_totals_project,
                "expected_groups": ["bar", "bar-again", "bar-yet-again"],
            },
            {
                "name": "group by and filter by project list",
                "filters": "project:[bar,bar-again]",
                "group_by": "project",
                "len": 2,
                "series": expected_series_project,
                "totals": expected_totals_project,
                "expected_groups": ["bar", "bar-again"],
            },
            {
                "name": "group by and filter by negated project condition",
                "filters": "!project:bar-again",
                "group_by": "project",
                "len": 2,
                "series": expected_series_project,
                "totals": expected_totals_project,
                "expected_groups": ["bar", "bar-yet-again"],
            },
            {
                "name": "group by and filter by boolean negated project condition",
                "filters": "project:bar-again or project:bar-yet-again",
                "group_by": "project",
                "len": 2,
                "series": expected_series_new_project_1,
                "totals": expected_totals_new_project_1,
                "expected_groups": ["bar-again", "bar-yet-again"],
            },
            {
                "name": "group by project and filter by project id",
                "filters": f"project_id:[{self.project.id},{new_project_1.id}]",
                "group_by": "project",
                "len": 2,
                "series": expected_series_project,
                "totals": expected_totals_project,
                "expected_groups": [self.project.slug, new_project_1.slug],
            },
            {
                "name": "group by project id and filter by project",
                "filters": "project:[bar,bar-again]",
                "group_by": "project_id",
                "len": 2,
                "series": expected_series_project,
                "totals": expected_totals_project,
                "expected_groups": [self.project.id, new_project_1.id],
            },
            {
                "name": "group by project id",
                "filters": "",
                "group_by": "project_id",
                "len": 3,
                "series": expected_series_project,
                "totals": expected_totals_project,
                "expected_groups": [self.project.id, new_project_1.id, new_project_2.id],
            },
            {
                "name": "group by project id",
                "filters": "",
                "group_by": "project_id",
                "len": 3,
                "series": expected_series_project,
                "totals": expected_totals_project,
                "expected_groups": [self.project.id, new_project_1.id, new_project_2.id],
            },
        ]
        for case in cases:
            mql = self.mql(
                "avg",
                TransactionMRI.DURATION.value,
                group_by=case["group_by"],
                filters=case["filters"],
            )
            results = self.run_query(
                mql_queries=[MQLQuery(mql)],
                start=self.now() - timedelta(minutes=30),
                end=self.now() + timedelta(hours=1, minutes=30),
                interval=3600,
                organization=self.project.organization,
                projects=[self.project, new_project_1, new_project_2, new_empty_project],
                environments=[],
                referrer="metrics.data.api",
            )

            data = results["data"][0]
            if len(data) > 0 and case["group_by"] != "":
                data = sorted(data, key=lambda x: x["by"][case["group_by"]])
                assert [x["by"][case["group_by"]] for x in data] == case["expected_groups"]

            assert len(data) == case["len"]
            assert data[0]["series"] == case["series"]
            assert data[0]["totals"] == case["totals"]

    def test_project_mapping_empty_results(self) -> None:
        new_project_1 = self.setup_project_with_metrics("Bar Again")
        new_project_2 = self.setup_project_with_metrics("Bar Yet Again")
        new_empty_project = self.create_project(name="empty project")

        expected_empty_series = [None, None, None]
        expected_empty_totals = None

        cases: list[dict[str, Any]] = [
            {
                "name": "group by project and filter by unknown project id",
                "group_by": "project",
                "filters": f"project_id:{new_empty_project.id}",
                "len": 1,
                "series": expected_empty_series,
                "totals": expected_empty_totals,
            },
            {
                "name": "filter by unknown project",
                "group_by": "",
                "filters": "project:unknown-project",
                "len": 1,
                "series": expected_empty_series,
                "totals": expected_empty_totals,
            },
        ]
        for case in cases:
            mql = self.mql(
                "avg",
                TransactionMRI.DURATION.value,
                group_by=case["group_by"],
                filters=case["filters"],
            )
            results = self.run_query(
                mql_queries=[MQLQuery(mql)],
                start=self.now() - timedelta(minutes=30),
                end=self.now() + timedelta(hours=1, minutes=30),
                interval=3600,
                organization=self.project.organization,
                projects=[self.project, new_project_1, new_project_2, new_empty_project],
                environments=[],
                referrer="metrics.data.api",
            )

            data = results["data"][0]
            assert len(data) == case["len"]
            assert data[0]["series"] == case["series"]
            assert data[0]["totals"] == case["totals"]

    def test_only_specific_queries_project_mapping(self) -> None:
        new_project_1 = self.setup_project_with_metrics("Bar Again")
        new_project_2 = self.setup_project_with_metrics("Bar Yet Again")
        new_empty_project = self.create_project(name="empty project")

        mql_1 = self.mql("avg", TransactionMRI.DURATION.value, group_by="project_id")
        mql_2 = self.mql("avg", TransactionMRI.DURATION.value, group_by="project")
        query_1 = MQLQuery(mql_1)
        query_2 = MQLQuery(mql_2)

        results = self.run_query(
            mql_queries=[query_1, query_2],
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[self.project, new_project_1, new_project_2, new_empty_project],
            environments=[],
            referrer="metrics.data.api",
        )
        data_1 = results["data"][0]
        data_1 = sorted(data_1, key=lambda x: x["by"]["project_id"])
        data_2 = results["data"][1]
        data_2 = sorted(data_2, key=lambda x: x["by"]["project"])

        assert data_1[0]["by"] == {"project_id": self.project.id}
        assert data_1[1]["by"] == {"project_id": new_project_1.id}
        assert data_2[0]["by"] == {"project": self.project.slug}
        assert data_2[1]["by"] == {"project": new_project_1.slug}
