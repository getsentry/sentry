from datetime import datetime, timedelta

import pytest
from django.utils import timezone as django_timezone

from sentry.sentry_metrics.querying.data_v2 import run_metrics_queries_plan
from sentry.sentry_metrics.querying.data_v2.plan import MetricsQueriesPlan, QueryOrder
from sentry.sentry_metrics.querying.errors import (
    InvalidMetricsQueryError,
    MetricsQueryExecutionError,
)
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.sentry_metrics.visibility import block_metric
from sentry.snuba.metrics.naming_layer import TransactionMRI
from sentry.testutils.cases import BaseMetricsTestCase, TestCase
from sentry.testutils.helpers.datetime import freeze_time

pytestmark = pytest.mark.sentry_metrics

MOCK_DATETIME = (django_timezone.now() - timedelta(days=1)).replace(
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
                "distribution",
                TransactionMRI.DURATION.value,
                {
                    "transaction": transaction,
                    "platform": platform,
                    "environment": env,
                    "release": release,
                },
                self.ts(time),
                value,
                UseCaseID.TRANSACTIONS,
            )

        self.prod_env = self.create_environment(name="prod", project=self.project)
        self.dev_env = self.create_environment(name="dev", project=self.project)

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

    def test_query_with_empty_results(self) -> None:
        for aggregate, expected_identity in (
            ("count", 0.0),
            ("avg", None),
            ("sum", 0.0),
            ("min", 0.0),
        ):
            query_1 = self.mql(aggregate, TransactionMRI.DURATION.value, "transaction:/bar")
            plan = MetricsQueriesPlan().declare_query("query_1", query_1).apply_formula("$query_1")

            results = run_metrics_queries_plan(
                metrics_queries_plan=plan,
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
            assert data[0][0]["series"] == [None, None, None]
            assert data[0][0]["totals"] == expected_identity

    def test_query_with_one_aggregation(self) -> None:
        query_1 = self.mql("sum", TransactionMRI.DURATION.value)
        plan = MetricsQueriesPlan().declare_query("query_1", query_1).apply_formula("$query_1")

        results = run_metrics_queries_plan(
            metrics_queries_plan=plan,
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
        assert data[0][0]["series"] == [None, 12.0, 9.0]
        assert data[0][0]["totals"] == 21.0

    def test_query_with_one_aggregation_and_environment(self) -> None:
        query_1 = self.mql("sum", TransactionMRI.DURATION.value)
        plan = MetricsQueriesPlan().declare_query("query_1", query_1).apply_formula("$query_1")

        results = run_metrics_queries_plan(
            metrics_queries_plan=plan,
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
        assert data[0][0]["series"] == [None, 6.0, 4.0]
        assert data[0][0]["totals"] == 10.0

    def test_query_with_one_aggregation_and_latest_release(self) -> None:
        query_1 = self.mql("sum", TransactionMRI.DURATION.value, "release:latest")
        plan = MetricsQueriesPlan().declare_query("query_1", query_1).apply_formula("$query_1")

        results = run_metrics_queries_plan(
            metrics_queries_plan=plan,
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
        assert data[0][0]["series"] == [None, 6.0, 7.0]
        assert data[0][0]["totals"] == 13.0

    def test_query_with_percentile(self) -> None:
        query_1 = self.mql("p90", TransactionMRI.DURATION.value)
        plan = MetricsQueriesPlan().declare_query("query_1", query_1).apply_formula("$query_1")

        results = run_metrics_queries_plan(
            metrics_queries_plan=plan,
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
        assert data[0][0]["series"] == [None, pytest.approx(5.8), 3.8]
        assert data[0][0]["totals"] == 5.5
        # We want to test that the `Array(x)` is stripped away from the `type` of the aggregate.
        meta = results["meta"]
        assert len(meta) == 1
        assert meta[0][0] == {"name": "aggregate_value", "type": "Float64"}

    def test_query_with_valid_percentiles(self) -> None:
        # We only want to check if these percentiles return results.
        for percentile in ("p50", "p75", "p90", "p95", "p99"):
            query_1 = self.mql(percentile, TransactionMRI.DURATION.value)
            plan = MetricsQueriesPlan().declare_query("query_1", query_1).apply_formula("$query_1")

            results = run_metrics_queries_plan(
                metrics_queries_plan=plan,
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
            plan = MetricsQueriesPlan().declare_query("query_1", query_1).apply_formula("$query_1")

            with pytest.raises(MetricsQueryExecutionError):
                run_metrics_queries_plan(
                    metrics_queries_plan=plan,
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
        plan = MetricsQueriesPlan().declare_query("query_1", query_1).apply_formula("$query_1")

        results = run_metrics_queries_plan(
            metrics_queries_plan=plan,
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
        assert first_query[0]["totals"] == 3.0
        assert first_query[1]["by"] == {"platform": "ios", "transaction": "/hello"}
        assert first_query[1]["series"] == [None, 6.0, 3.0]
        assert first_query[1]["totals"] == 9.0
        assert first_query[2]["by"] == {"platform": "windows", "transaction": "/world"}
        assert first_query[2]["series"] == [None, 5.0, 4.0]
        assert first_query[2]["totals"] == 9.0
        # We want to test that the `group_bys` are shown in the meta.
        meta = results["meta"]
        assert len(meta) == 1
        first_meta = sorted(meta[0], key=lambda value: value.get("name", ""))
        assert first_meta[0] == {
            "group_bys": ["platform", "transaction"],
            "limit": 10000,
            "order": None,
        }

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
                "distribution",
                TransactionMRI.MEASUREMENTS_FCP.value,
                tags,
                self.ts(time),
                value,
                UseCaseID.TRANSACTIONS,
            )

        query_1 = self.mql("sum", TransactionMRI.MEASUREMENTS_FCP.value, group_by="transaction")
        plan = MetricsQueriesPlan().declare_query("query_1", query_1).apply_formula("$query_1")

        results = run_metrics_queries_plan(
            metrics_queries_plan=plan,
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
        assert first_query[0]["series"] == [5.0]
        assert first_query[0]["totals"] == 5.0
        assert first_query[1]["by"] == {"transaction": "/hello"}
        assert first_query[1]["series"] == [1.0]
        assert first_query[1]["totals"] == 1.0

    def test_query_with_parenthesized_filter(self) -> None:
        query_1 = self.mql("sum", TransactionMRI.DURATION.value, "(transaction:/hello)", "platform")
        plan = MetricsQueriesPlan().declare_query("query_1", query_1).apply_formula("$query_1")

        results = run_metrics_queries_plan(
            metrics_queries_plan=plan,
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
        assert first_query[0]["series"] == [None, 1.0, 2.0]
        assert first_query[0]["totals"] == 3.0
        assert first_query[1]["by"] == {"platform": "ios"}
        assert first_query[1]["series"] == [None, 6.0, 3.0]
        assert first_query[1]["totals"] == 9.0

    def test_query_with_and_filter(self) -> None:
        query_1 = self.mql(
            "sum", TransactionMRI.DURATION.value, "platform:ios AND transaction:/hello", "platform"
        )
        plan = MetricsQueriesPlan().declare_query("query_1", query_1).apply_formula("$query_1")

        results = run_metrics_queries_plan(
            metrics_queries_plan=plan,
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
        assert first_query[0]["series"] == [None, 6.0, 3.0]
        assert first_query[0]["totals"] == 9.0

    def test_query_with_or_filter(self) -> None:
        query_1 = self.mql(
            "sum", TransactionMRI.DURATION.value, "platform:ios OR platform:android", "platform"
        )
        plan = MetricsQueriesPlan().declare_query("query_1", query_1).apply_formula("$query_1")

        results = run_metrics_queries_plan(
            metrics_queries_plan=plan,
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
        assert first_query[0]["series"] == [None, 1.0, 2.0]
        assert first_query[0]["totals"] == 3.0
        assert first_query[1]["by"] == {"platform": "ios"}
        assert first_query[1]["series"] == [None, 6.0, 3.0]
        assert first_query[1]["totals"] == 9.0

    def test_query_one_negated_filter(self) -> None:
        query_1 = self.mql(
            "sum", TransactionMRI.DURATION.value, "!platform:ios transaction:/hello", "platform"
        )
        plan = MetricsQueriesPlan().declare_query("query_1", query_1).apply_formula("$query_1")

        results = run_metrics_queries_plan(
            metrics_queries_plan=plan,
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
        assert first_query[0]["series"] == [None, 1.0, 2.0]
        assert first_query[0]["totals"] == 3.0

    def test_query_one_in_filter(self) -> None:
        query_1 = self.mql(
            "sum", TransactionMRI.DURATION.value, "platform:[android, ios]", "platform"
        )
        plan = MetricsQueriesPlan().declare_query("query_1", query_1).apply_formula("$query_1")

        results = run_metrics_queries_plan(
            metrics_queries_plan=plan,
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
        assert first_query[0]["series"] == [None, 1.0, 2.0]
        assert first_query[0]["totals"] == 3.0
        assert first_query[1]["by"] == {"platform": "ios"}
        assert first_query[1]["series"] == [None, 6.0, 3.0]
        assert first_query[1]["totals"] == 9.0

    def test_query_one_not_in_filter(self) -> None:
        query_1 = self.mql(
            "sum", TransactionMRI.DURATION.value, '!platform:["android", "ios"]', "platform"
        )
        plan = MetricsQueriesPlan().declare_query("query_1", query_1).apply_formula("$query_1")

        results = run_metrics_queries_plan(
            metrics_queries_plan=plan,
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
        assert first_query[0]["series"] == [None, 5.0, 4.0]
        assert first_query[0]["totals"] == 9.0

    def test_query_with_multiple_aggregations(self) -> None:
        query_1 = self.mql("min", TransactionMRI.DURATION.value)
        query_2 = self.mql("max", TransactionMRI.DURATION.value)
        plan = (
            MetricsQueriesPlan()
            .declare_query("query_1", query_1)
            .declare_query("query_2", query_2)
            .apply_formula("$query_1")
            .apply_formula("$query_2")
        )

        results = run_metrics_queries_plan(
            metrics_queries_plan=plan,
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
        assert data[0][0]["series"] == [None, 1.0, 2.0]
        assert data[0][0]["totals"] == 1.0
        assert data[1][0]["by"] == {}
        assert data[1][0]["series"] == [None, 6.0, 4.0]
        assert data[1][0]["totals"] == 6.0

    def test_query_with_multiple_aggregations_and_single_group_by(self) -> None:
        query_1 = self.mql("min", TransactionMRI.DURATION.value, group_by="platform")
        query_2 = self.mql("max", TransactionMRI.DURATION.value, group_by="platform")
        plan = (
            MetricsQueriesPlan()
            .declare_query("query_1", query_1)
            .declare_query("query_2", query_2)
            .apply_formula("$query_1")
            .apply_formula("$query_2")
        )

        results = run_metrics_queries_plan(
            metrics_queries_plan=plan,
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
        assert first_query[0]["series"] == [None, 1.0, 2.0]
        assert first_query[0]["totals"] == 1.0
        assert first_query[1]["by"] == {"platform": "ios"}
        assert first_query[1]["series"] == [None, 6.0, 3.0]
        assert first_query[1]["totals"] == 3.0
        assert first_query[2]["by"] == {"platform": "windows"}
        assert first_query[2]["series"] == [None, 5.0, 4.0]
        assert first_query[2]["totals"] == 4.0
        second_query = sorted(data[1], key=lambda value: value["by"]["platform"])
        assert len(second_query) == 3
        assert second_query[0]["by"] == {"platform": "android"}
        assert second_query[0]["series"] == [None, 1.0, 2.0]
        assert second_query[0]["totals"] == 2.0
        assert second_query[1]["by"] == {"platform": "ios"}
        assert second_query[1]["series"] == [None, 6.0, 3.0]
        assert second_query[1]["totals"] == 6.0
        assert second_query[2]["by"] == {"platform": "windows"}
        assert second_query[2]["series"] == [None, 5.0, 4.0]
        assert second_query[2]["totals"] == 5.0

    def test_query_with_multiple_aggregations_and_single_group_by_and_order_by_with_limit(
        self,
    ) -> None:
        query_1 = self.mql("min", TransactionMRI.DURATION.value, group_by="platform")
        query_2 = self.mql("max", TransactionMRI.DURATION.value, group_by="platform")
        plan = (
            MetricsQueriesPlan()
            .declare_query("query_1", query_1)
            .declare_query("query_2", query_2)
            .apply_formula("$query_1", QueryOrder.ASC, 2)
            .apply_formula("$query_2", QueryOrder.DESC, 2)
        )

        results = run_metrics_queries_plan(
            metrics_queries_plan=plan,
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
        assert first_query[0]["series"] == [None, 1.0, 2.0]
        assert first_query[0]["totals"] == 1.0
        assert first_query[1]["by"] == {"platform": "ios"}
        assert first_query[1]["series"] == [None, 6.0, 3.0]
        assert first_query[1]["totals"] == 3.0
        second_query = sorted(data[1], key=lambda value: value["by"]["platform"])
        assert len(second_query) == 2
        assert second_query[0]["by"] == {"platform": "ios"}
        assert second_query[0]["series"] == [None, 6.0, 3.0]
        assert second_query[0]["totals"] == 6.0
        assert second_query[1]["by"] == {"platform": "windows"}
        assert second_query[1]["series"] == [None, 5.0, 4.0]
        assert second_query[1]["totals"] == 5.0
        # We want to test that the correct order and limit are in the meta.
        meta = results["meta"]
        assert len(meta) == 2
        first_meta = sorted(meta[0], key=lambda value: value.get("name", ""))
        assert first_meta[0] == {"group_bys": ["platform"], "limit": 2, "order": "ASC"}
        second_meta = sorted(meta[1], key=lambda value: value.get("name", ""))
        assert second_meta[0] == {"group_bys": ["platform"], "limit": 2, "order": "DESC"}

    def test_query_with_custom_set(self):
        mri = "s:custom/User.Click.2@none"
        for user in ("marco", "marco", "john"):
            self.store_metric(
                self.project.organization.id,
                self.project.id,
                "set",
                mri,
                {},
                self.ts(self.now()),
                user,
                UseCaseID.CUSTOM,
            )

        query_1 = self.mql("count_unique", mri)
        plan = MetricsQueriesPlan().declare_query("query_1", query_1).apply_formula("$query_1")

        results = run_metrics_queries_plan(
            metrics_queries_plan=plan,
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

    def test_query_with_one_metric_blocked_for_one_project(self):
        mri = "d:custom/page_load@millisecond"

        project_1 = self.create_project()
        project_2 = self.create_project()

        block_metric(mri, [project_1])

        for project, value in ((project_1, 10.0), (project_2, 15.0)):
            self.store_metric(
                self.project.organization.id,
                project.id,
                "distribution",
                mri,
                {},
                self.ts(self.now()),
                value,
                UseCaseID.CUSTOM,
            )

        query_1 = self.mql("sum", mri)
        plan = MetricsQueriesPlan().declare_query("query_1", query_1).apply_formula("$query_1")

        results = run_metrics_queries_plan(
            metrics_queries_plan=plan,
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
        assert data[0][0]["series"] == [None, 15.0, None]
        assert data[0][0]["totals"] == 15.0

    def test_query_with_one_metric_blocked_for_all_projects(self):
        mri = "d:custom/page_load@millisecond"

        project_1 = self.create_project()
        project_2 = self.create_project()

        block_metric(mri, [project_1, project_2])

        for project, value in ((project_1, 10.0), (project_2, 15.0)):
            self.store_metric(
                self.project.organization.id,
                project.id,
                "distribution",
                mri,
                {},
                self.ts(self.now()),
                value,
                UseCaseID.CUSTOM,
            )

        query_1 = self.mql("sum", mri)
        plan = MetricsQueriesPlan().declare_query("query_1", query_1).apply_formula("$query_1")

        results = run_metrics_queries_plan(
            metrics_queries_plan=plan,
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
        assert len(data[0]) == 0

    def test_query_with_two_metrics_and_one_blocked_for_a_project(self):
        mri_1 = "d:custom/page_load@millisecond"
        mri_2 = "d:custom/app_load@millisecond"

        project_1 = self.create_project()
        project_2 = self.create_project()

        block_metric(mri_1, [project_1, project_2])

        for project, mri in ((project_1, mri_1), (project_2, mri_2)):
            self.store_metric(
                self.project.organization.id,
                project.id,
                "distribution",
                mri,
                {},
                self.ts(self.now()),
                10.0,
                UseCaseID.CUSTOM,
            )

        query_1 = self.mql("sum", mri_1)
        query_2 = self.mql("sum", mri_2)
        plan = (
            MetricsQueriesPlan()
            .declare_query("query_1", query_1)
            .declare_query("query_2", query_2)
            .apply_formula("$query_1")
            .apply_formula("$query_2")
        )
        results = run_metrics_queries_plan(
            metrics_queries_plan=plan,
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[project_1, project_2],
            environments=[],
            referrer="metrics.data.api",
        )
        data = results["data"]
        assert len(data) == 2
        assert len(data[0]) == 0
        assert data[1][0]["by"] == {}
        assert data[1][0]["series"] == [None, 10.0, None]
        assert data[1][0]["totals"] == 10.0

    def test_query_with_invalid_syntax(
        self,
    ) -> None:
        query_1 = self.mql(
            "min",
            TransactionMRI.DURATION.value,
            "transaction:/api/0/organizations/{organization_slug}/",
        )
        plan = MetricsQueriesPlan().declare_query("query_1", query_1).apply_formula("$query_1")

        with pytest.raises(InvalidMetricsQueryError):
            run_metrics_queries_plan(
                metrics_queries_plan=plan,
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
        query_2 = self.mql("max", "d:custom/app_load@millisecond")
        plan = (
            MetricsQueriesPlan()
            .declare_query("query_1", query_1)
            .declare_query("query_2", query_2)
            .apply_formula("$query_1 / $query_2")
        )

        with pytest.raises(InvalidMetricsQueryError):
            run_metrics_queries_plan(
                metrics_queries_plan=plan,
                start=self.now() - timedelta(minutes=30),
                end=self.now() + timedelta(hours=1, minutes=30),
                interval=3600,
                organization=self.project.organization,
                projects=[self.project],
                environments=[],
                referrer="metrics.data.api",
            )

    def test_query_with_different_metric_types(self):
        query_1 = self.mql("count", "c:custom/page_click@none")
        query_2 = self.mql("max", "d:custom/app_load@millisecond")
        plan = (
            MetricsQueriesPlan()
            .declare_query("query_1", query_1)
            .declare_query("query_2", query_2)
            .apply_formula("$query_1 * $query_2")
        )

        with pytest.raises(InvalidMetricsQueryError):
            run_metrics_queries_plan(
                metrics_queries_plan=plan,
                start=self.now() - timedelta(minutes=30),
                end=self.now() + timedelta(hours=1, minutes=30),
                interval=3600,
                organization=self.project.organization,
                projects=[self.project],
                environments=[],
                referrer="metrics.data.api",
            )

    def test_query_with_different_group_bys(self):
        query_1 = self.mql("min", "d:custom/page_click@none", group_by="transaction, environment")
        query_2 = self.mql("max", "d:custom/app_load@millisecond", group_by="transaction")
        plan = (
            MetricsQueriesPlan()
            .declare_query("query_1", query_1)
            .declare_query("query_2", query_2)
            .apply_formula("$query_1 * $query_2 / $query_1")
        )

        with pytest.raises(InvalidMetricsQueryError):
            run_metrics_queries_plan(
                metrics_queries_plan=plan,
                start=self.now() - timedelta(minutes=30),
                end=self.now() + timedelta(hours=1, minutes=30),
                interval=3600,
                organization=self.project.organization,
                projects=[self.project],
                environments=[],
                referrer="metrics.data.api",
            )

    def test_query_with_complex_group_by(self):
        query_1 = self.mql("min", "d:custom/page_click@none", group_by="environment")
        query_2 = self.mql("max", "d:custom/app_load@millisecond", group_by="transaction")
        plan = (
            MetricsQueriesPlan()
            .declare_query("query_1", query_1)
            .declare_query("query_2", query_2)
            .apply_formula("((($query_1 * $query_2) by (release)) / $query_1) by (browser)")
        )

        with pytest.raises(InvalidMetricsQueryError):
            run_metrics_queries_plan(
                metrics_queries_plan=plan,
                start=self.now() - timedelta(minutes=30),
                end=self.now() + timedelta(hours=1, minutes=30),
                interval=3600,
                organization=self.project.organization,
                projects=[self.project],
                environments=[],
                referrer="metrics.data.api",
            )
