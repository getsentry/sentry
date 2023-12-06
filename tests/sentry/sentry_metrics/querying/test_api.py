from datetime import datetime, timedelta

import pytest
from django.utils import timezone as django_timezone

from sentry.sentry_metrics.querying.api import (
    InvalidMetricsQueryError,
    MetricsQueryExecutionError,
    run_metrics_query,
)
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.snuba.metrics.naming_layer import SessionMRI, TransactionMRI
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

        for value, transaction, platform, env, time in (
            (1, "/hello", "android", "prod", self.now()),
            (3, "/hello", "ios", "dev", self.now()),
            (5, "/world", "windows", "prod", self.now() + timedelta(minutes=30)),
            (3, "/hello", "ios", "dev", self.now() + timedelta(hours=1)),
            (2, "/hello", "android", "dev", self.now() + timedelta(hours=1)),
            (3, "/world", "windows", "prod", self.now() + timedelta(hours=1, minutes=30)),
        ):
            self.store_metric(
                self.project.organization.id,
                self.project.id,
                "distribution",
                TransactionMRI.DURATION.value,
                {"transaction": transaction, "platform": platform, "environment": env},
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

    def test_query_with_empty_results(self) -> None:
        for aggregate, expected_identity in (
            ("count", 0.0),
            ("avg", None),
            ("sum", 0.0),
            ("min", 0.0),
        ):
            field = f"{aggregate}({TransactionMRI.DURATION.value})"
            results = run_metrics_query(
                fields=[field],
                query="transaction:/bar",
                group_bys=None,
                start=self.now() - timedelta(minutes=30),
                end=self.now() + timedelta(hours=1, minutes=30),
                interval=3600,
                organization=self.project.organization,
                projects=[self.project],
                environments=[],
                referrer="metrics.data.api",
            )
            groups = results["groups"]
            assert len(groups) == 1
            assert groups[0]["by"] == {}
            assert groups[0]["series"] == {
                field: [expected_identity, expected_identity, expected_identity]
            }
            assert groups[0]["totals"] == {field: expected_identity}

    def test_query_with_one_aggregation(self) -> None:
        # Query with just one aggregation.
        field = f"sum({TransactionMRI.DURATION.value})"
        results = run_metrics_query(
            fields=[field],
            query=None,
            group_bys=None,
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[self.project],
            environments=[],
            referrer="metrics.data.api",
        )
        groups = results["groups"]
        assert len(groups) == 1
        assert groups[0]["by"] == {}
        assert groups[0]["series"] == {field: [0.0, 9.0, 8.0]}
        assert groups[0]["totals"] == {field: 17.0}

    def test_query_with_one_aggregation_and_environment(self) -> None:
        # Query with just one aggregation.
        field = f"sum({TransactionMRI.DURATION.value})"
        results = run_metrics_query(
            fields=[field],
            query=None,
            group_bys=None,
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[self.project],
            environments=[self.prod_env],
            referrer="metrics.data.api",
        )
        groups = results["groups"]
        assert len(groups) == 1
        assert groups[0]["by"] == {}
        assert groups[0]["series"] == {field: [0.0, 6.0, 3.0]}
        assert groups[0]["totals"] == {field: 9.0}

    def test_query_with_percentile(self) -> None:
        field = f"p90({TransactionMRI.DURATION.value})"
        results = run_metrics_query(
            fields=[field],
            query=None,
            group_bys=None,
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[self.project],
            environments=[],
            referrer="metrics.data.api",
        )
        groups = results["groups"]
        assert len(groups) == 1
        assert groups[0]["by"] == {}
        assert groups[0]["series"] == {field: [0.0, 4.6, 3.0]}
        assert groups[0]["totals"] == {field: 4.0}

    def test_query_with_valid_percentiles(self) -> None:
        # We only want to check if these percentiles return results.
        for percentile in ("p50", "p75", "p90", "p95", "p99"):
            field = f"{percentile}({TransactionMRI.DURATION.value})"
            results = run_metrics_query(
                fields=[field],
                query=None,
                group_bys=None,
                start=self.now() - timedelta(minutes=30),
                end=self.now() + timedelta(hours=1, minutes=30),
                interval=3600,
                organization=self.project.organization,
                projects=[self.project],
                environments=[],
                referrer="metrics.data.api",
            )
            groups = results["groups"]
            assert len(groups) == 1

    def test_query_with_invalid_percentiles(self) -> None:
        # We only want to check if these percentiles result in a error.
        for percentile in ("p30", "p45"):
            field = f"{percentile}({TransactionMRI.DURATION.value})"
            with pytest.raises(MetricsQueryExecutionError):
                run_metrics_query(
                    fields=[field],
                    query=None,
                    group_bys=None,
                    start=self.now() - timedelta(minutes=30),
                    end=self.now() + timedelta(hours=1, minutes=30),
                    interval=3600,
                    organization=self.project.organization,
                    projects=[self.project],
                    environments=[],
                    referrer="metrics.data.api",
                )

    def test_query_with_group_by(self) -> None:
        # Query with one aggregation and two group by.
        field = f"sum({TransactionMRI.DURATION.value})"
        results = run_metrics_query(
            fields=[field],
            query=None,
            group_bys=["transaction", "platform"],
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[self.project],
            environments=[],
            referrer="metrics.data.api",
        )
        groups = results["groups"]
        assert len(groups) == 3
        assert groups[0]["by"] == {"platform": "android", "transaction": "/hello"}
        assert groups[0]["series"] == {field: [0.0, 1.0, 2.0]}
        assert groups[0]["totals"] == {field: 3.0}
        assert groups[1]["by"] == {"platform": "ios", "transaction": "/hello"}
        assert groups[1]["series"] == {field: [0.0, 3.0, 3.0]}
        assert groups[1]["totals"] == {field: 6.0}
        assert groups[2]["by"] == {"platform": "windows", "transaction": "/world"}
        assert groups[2]["series"] == {field: [0.0, 5.0, 3.0]}
        assert groups[2]["totals"] == {field: 8.0}

    def test_query_with_two_simple_filters(self) -> None:
        # Query with one aggregation, one group by and two filters.
        field = f"sum({TransactionMRI.DURATION.value})"
        results = run_metrics_query(
            fields=[field],
            # TODO: change test to (transaction:/hello) when Snuba fix is out.
            query="(platform:ios AND transaction:/hello)",
            group_bys=["platform"],
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[self.project],
            environments=[],
            referrer="metrics.data.api",
        )
        groups = results["groups"]
        assert len(groups) == 1
        assert groups[0]["by"] == {"platform": "ios"}
        assert groups[0]["series"] == {field: [0.0, 3.0, 3.0]}
        assert groups[0]["totals"] == {field: 6.0}

    def test_query_one_negated_filter(self) -> None:
        # Query with one aggregation, one group by and two filters.
        field = f"sum({TransactionMRI.DURATION.value})"
        results = run_metrics_query(
            fields=[field],
            query="!platform:ios transaction:/hello",
            group_bys=["platform"],
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[self.project],
            environments=[],
            referrer="metrics.data.api",
        )
        groups = results["groups"]
        assert len(groups) == 1
        assert groups[0]["by"] == {"platform": "android"}
        assert groups[0]["series"] == {field: [0.0, 1.0, 2.0]}
        assert groups[0]["totals"] == {field: 3.0}

    def test_query_one_in_filter(self) -> None:
        # Query with one aggregation, one group by and two filters.
        field = f"sum({TransactionMRI.DURATION.value})"
        results = run_metrics_query(
            fields=[field],
            query="platform:[android, ios]",
            group_bys=["platform"],
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[self.project],
            environments=[],
            referrer="metrics.data.api",
        )
        groups = results["groups"]
        assert len(groups) == 2
        assert groups[0]["by"] == {"platform": "android"}
        assert groups[0]["series"] == {field: [0.0, 1.0, 2.0]}
        assert groups[0]["totals"] == {field: 3.0}
        assert groups[1]["by"] == {"platform": "ios"}
        assert groups[1]["series"] == {field: [0.0, 3.0, 3.0]}
        assert groups[1]["totals"] == {field: 6.0}

    def test_query_one_not_in_filter(self) -> None:
        # Query with one aggregation, one group by and two filters.
        field = f"sum({TransactionMRI.DURATION.value})"
        results = run_metrics_query(
            fields=[field],
            query='!platform:["android", "ios"]',
            group_bys=["platform"],
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[self.project],
            environments=[],
            referrer="metrics.data.api",
        )
        groups = results["groups"]
        assert len(groups) == 1
        assert groups[0]["by"] == {"platform": "windows"}
        assert groups[0]["series"] == {field: [0.0, 5.0, 3.0]}
        assert groups[0]["totals"] == {field: 8.0}

    def test_query_with_multiple_aggregations(self) -> None:
        # Query with two aggregations.
        field_1 = f"min({TransactionMRI.DURATION.value})"
        field_2 = f"max({TransactionMRI.DURATION.value})"
        results = run_metrics_query(
            fields=[field_1, field_2],
            query=None,
            group_bys=None,
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[self.project],
            environments=[],
            referrer="metrics.data.api",
        )
        groups = results["groups"]
        assert len(groups) == 1
        assert groups[0]["by"] == {}
        assert groups[0]["series"] == {field_2: [0.0, 5.0, 3.0], field_1: [0.0, 1.0, 2.0]}
        assert groups[0]["totals"] == {field_2: 5.0, field_1: 1.0}

    def test_query_with_invalid_filters(self) -> None:
        # Query with one aggregation, one group by and two filters.
        field = f"sum({TransactionMRI.DURATION.value})"

        with pytest.raises(InvalidMetricsQueryError):
            run_metrics_query(
                fields=[field],
                query='platform:"android" OR platform:ios',
                group_bys=["platform"],
                start=self.now() - timedelta(minutes=30),
                end=self.now() + timedelta(hours=1, minutes=30),
                interval=3600,
                organization=self.project.organization,
                projects=[self.project],
                environments=[],
                referrer="metrics.data.api",
            )

    def test_query_with_injection_attack(self) -> None:
        field = f"sum({TransactionMRI.DURATION.value})"

        with pytest.raises(InvalidMetricsQueryError):
            run_metrics_query(
                fields=[field],
                query=f'platform:"android"}} / {field} {{',
                group_bys=["platform"],
                start=self.now() - timedelta(minutes=30),
                end=self.now() + timedelta(hours=1, minutes=30),
                interval=3600,
                organization=self.project.organization,
                projects=[self.project],
                environments=[],
                referrer="metrics.data.api",
            )

    def test_query_with_custom_set(self):
        mri = "s:custom/user_click@none"
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

        field = f"count_unique({mri})"
        results = run_metrics_query(
            fields=[field],
            query=None,
            group_bys=None,
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[self.project],
            environments=[],
            referrer="metrics.data.api",
        )
        groups = results["groups"]
        assert len(groups) == 1
        assert groups[0]["by"] == {}
        assert groups[0]["series"] == {field: [0, 2, 0]}
        assert groups[0]["totals"] == {field: 2}

    @pytest.mark.skip(reason="sessions are not supported in the new metrics layer")
    def test_with_sessions(self) -> None:
        self.store_session(
            self.build_session(
                project_id=self.project.id,
                started=(self.now() + timedelta(minutes=30)).timestamp(),
                status="exited",
                release="foobar@2.0",
                errors=2,
            )
        )

        field = f"sum({SessionMRI.RAW_DURATION.value})"
        results = run_metrics_query(
            fields=[field],
            query=None,
            group_bys=None,
            start=self.now(),
            end=self.now() + timedelta(hours=1),
            interval=3600,
            organization=self.project.organization,
            projects=[self.project],
            environments=[],
            referrer="metrics.data.api",
        )
        groups = results["groups"]
        assert len(groups) == 1
        assert groups[0]["by"] == {}
        assert groups[0]["series"] == {field: [60.0]}
