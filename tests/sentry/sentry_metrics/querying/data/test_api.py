from datetime import datetime, timedelta
from unittest.mock import patch

import pytest
from django.utils import timezone as django_timezone

from sentry.sentry_metrics.querying.data import run_metrics_query
from sentry.sentry_metrics.querying.errors import (
    InvalidMetricsQueryError,
    MetricsQueryExecutionError,
)
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.sentry_metrics.visibility import block_metric
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

    def test_query_with_empty_results(self) -> None:
        for aggregate, expected_total in (
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
            # Right now we are returning data since there is a weird behavior in the metrics layer that returns an
            # aggregate value even if there is no data (grouping by something results in the right result being
            # returned). When the layer will be updated, this test should  be asserted to have empty groups.
            groups = results["groups"]
            assert len(groups) == 1
            assert groups[0]["by"] == {}
            assert groups[0]["series"] == {field: [None, None, None]}
            assert groups[0]["totals"] == {field: expected_total}

    def test_query_with_one_aggregation(self) -> None:
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
        assert groups[0]["series"] == {field: [None, 12.0, 9.0]}
        assert groups[0]["totals"] == {field: 21.0}

    def test_query_with_one_aggregation_and_environment(self) -> None:
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
        assert groups[0]["series"] == {field: [None, 6.0, 4.0]}
        assert groups[0]["totals"] == {field: 10.0}

    def test_query_with_one_aggregation_and_latest_release(self) -> None:
        field = f"sum({TransactionMRI.DURATION.value})"
        results = run_metrics_query(
            fields=[field],
            query="release:latest",
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
        assert groups[0]["series"] == {field: [None, 6.0, 7.0]}
        assert groups[0]["totals"] == {field: 13.0}

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
        assert groups[0]["series"] == {field: [None, pytest.approx(5.8), 3.8]}
        assert groups[0]["totals"] == {field: 5.5}

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
        groups = sorted(results["groups"], key=lambda value: value["by"]["platform"])
        assert len(groups) == 3
        assert groups[0]["by"] == {"platform": "android", "transaction": "/hello"}
        assert groups[0]["series"] == {field: [None, 1.0, 2.0]}
        assert groups[0]["totals"] == {field: 3.0}
        assert groups[1]["by"] == {"platform": "ios", "transaction": "/hello"}
        assert groups[1]["series"] == {field: [None, 6.0, 3.0]}
        assert groups[1]["totals"] == {field: 9.0}
        assert groups[2]["by"] == {"platform": "windows", "transaction": "/world"}
        assert groups[2]["series"] == {field: [None, 5.0, 4.0]}
        assert groups[2]["totals"] == {field: 9.0}

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

        field = f"sum({TransactionMRI.MEASUREMENTS_FCP.value})"
        results = run_metrics_query(
            fields=[field],
            query=None,
            group_bys=["transaction"],
            start=self.now(),
            end=self.now() + timedelta(hours=1),
            interval=3600,
            organization=self.project.organization,
            projects=[self.project],
            environments=[],
            referrer="metrics.data.api",
        )
        groups = sorted(results["groups"], key=lambda value: value["by"]["transaction"])
        assert len(groups) == 2
        assert groups[0]["by"] == {"transaction": ""}
        assert groups[0]["series"] == {field: [5.0]}
        assert groups[0]["totals"] == {field: 5.0}
        assert groups[1]["by"] == {"transaction": "/hello"}
        assert groups[1]["series"] == {field: [1.0]}
        assert groups[1]["totals"] == {field: 1.0}

    def test_query_with_parenthesized_filter(self) -> None:
        field = f"sum({TransactionMRI.DURATION.value})"
        results = run_metrics_query(
            fields=[field],
            query="(transaction:/hello)",
            group_bys=["platform"],
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[self.project],
            environments=[],
            referrer="metrics.data.api",
        )
        groups = sorted(results["groups"], key=lambda value: value["by"]["platform"])
        assert len(groups) == 2
        assert groups[0]["by"] == {"platform": "android"}
        assert groups[0]["series"] == {field: [None, 1.0, 2.0]}
        assert groups[0]["totals"] == {field: 3.0}
        assert groups[1]["by"] == {"platform": "ios"}
        assert groups[1]["series"] == {field: [None, 6.0, 3.0]}
        assert groups[1]["totals"] == {field: 9.0}

    def test_query_with_and_filter(self) -> None:
        field = f"sum({TransactionMRI.DURATION.value})"
        results = run_metrics_query(
            fields=[field],
            query="platform:ios AND transaction:/hello",
            group_bys=["platform"],
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[self.project],
            environments=[],
            referrer="metrics.data.api",
        )
        groups = sorted(results["groups"], key=lambda value: value["by"]["platform"])
        assert len(groups) == 1
        assert groups[0]["by"] == {"platform": "ios"}
        assert groups[0]["series"] == {field: [None, 6.0, 3.0]}
        assert groups[0]["totals"] == {field: 9.0}

    def test_query_with_or_filter(self) -> None:
        field = f"sum({TransactionMRI.DURATION.value})"
        results = run_metrics_query(
            fields=[field],
            query="platform:ios OR platform:android",
            group_bys=["platform"],
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[self.project],
            environments=[],
            referrer="metrics.data.api",
        )
        groups = sorted(results["groups"], key=lambda value: value["by"]["platform"])
        assert len(groups) == 2
        assert groups[0]["by"] == {"platform": "android"}
        assert groups[0]["series"] == {field: [None, 1.0, 2.0]}
        assert groups[0]["totals"] == {field: 3.0}
        assert groups[1]["by"] == {"platform": "ios"}
        assert groups[1]["series"] == {field: [None, 6.0, 3.0]}
        assert groups[1]["totals"] == {field: 9.0}

    def test_query_one_negated_filter(self) -> None:
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
        assert groups[0]["series"] == {field: [None, 1.0, 2.0]}
        assert groups[0]["totals"] == {field: 3.0}

    def test_query_one_in_filter(self) -> None:
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
        groups = sorted(results["groups"], key=lambda value: value["by"]["platform"])
        assert len(groups) == 2
        assert groups[0]["by"] == {"platform": "android"}
        assert groups[0]["series"] == {field: [None, 1.0, 2.0]}
        assert groups[0]["totals"] == {field: 3.0}
        assert groups[1]["by"] == {"platform": "ios"}
        assert groups[1]["series"] == {field: [None, 6.0, 3.0]}
        assert groups[1]["totals"] == {field: 9.0}

    def test_query_one_not_in_filter(self) -> None:
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
        assert groups[0]["series"] == {field: [None, 5.0, 4.0]}
        assert groups[0]["totals"] == {field: 9.0}

    def test_query_with_multiple_aggregations(self) -> None:
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
        assert groups[0]["series"] == {field_2: [None, 6.0, 4.0], field_1: [None, 1.0, 2.0]}
        assert groups[0]["totals"] == {field_2: 6.0, field_1: 1.0}

    def test_query_with_multiple_aggregations_and_single_group_by(self) -> None:
        field_1 = f"min({TransactionMRI.DURATION.value})"
        field_2 = f"max({TransactionMRI.DURATION.value})"
        results = run_metrics_query(
            fields=[field_1, field_2],
            query=None,
            group_bys=["platform"],
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[self.project],
            environments=[],
            referrer="metrics.data.api",
        )
        groups = sorted(results["groups"], key=lambda value: value["by"]["platform"])
        assert len(groups) == 3
        assert groups[0]["by"] == {"platform": "android"}
        assert sorted(groups[0]["series"].items(), key=lambda v: v[0]) == [
            (field_2, [None, 1.0, 2.0]),
            (field_1, [None, 1.0, 2.0]),
        ]
        assert sorted(groups[0]["totals"].items(), key=lambda v: v[0]) == [
            (field_2, 2.0),
            (field_1, 1.0),
        ]
        assert groups[1]["by"] == {"platform": "ios"}
        assert sorted(groups[1]["series"].items(), key=lambda v: v[0]) == [
            (field_2, [None, 6.0, 3.0]),
            (field_1, [None, 6.0, 3.0]),
        ]
        assert sorted(groups[1]["totals"].items(), key=lambda v: v[0]) == [
            (field_2, 6.0),
            (field_1, 3.0),
        ]
        assert groups[2]["by"] == {"platform": "windows"}
        assert sorted(groups[2]["series"].items(), key=lambda v: v[0]) == [
            (field_2, [None, 5.0, 4.0]),
            (field_1, [None, 5.0, 4.0]),
        ]
        assert sorted(groups[2]["totals"].items(), key=lambda v: v[0]) == [
            (field_2, 5.0),
            (field_1, 4.0),
        ]

    def test_query_with_multiple_aggregations_and_single_group_by_and_order_by(self) -> None:
        field_1 = f"min({TransactionMRI.DURATION.value})"
        field_2 = f"max({TransactionMRI.DURATION.value})"
        results = run_metrics_query(
            fields=[field_1, field_2],
            query=None,
            group_bys=["platform"],
            order_by=f"-{field_2}",
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
        assert groups[0]["by"] == {"platform": "ios"}
        assert sorted(groups[0]["series"].items(), key=lambda v: v[0]) == [
            (field_2, [None, 6.0, 3.0]),
            (field_1, [None, 6.0, 3.0]),
        ]
        assert sorted(groups[0]["totals"].items(), key=lambda v: v[0]) == [
            (field_2, 6.0),
            (field_1, 3.0),
        ]
        assert groups[1]["by"] == {"platform": "windows"}
        assert sorted(groups[1]["series"].items(), key=lambda v: v[0]) == [
            (field_2, [None, 5.0, 4.0]),
            (field_1, [None, 5.0, 4.0]),
        ]
        assert sorted(groups[1]["totals"].items(), key=lambda v: v[0]) == [
            (field_2, 5.0),
            (field_1, 4.0),
        ]
        assert groups[2]["by"] == {"platform": "android"}
        assert sorted(groups[2]["series"].items(), key=lambda v: v[0]) == [
            (field_2, [None, 1.0, 2.0]),
            (field_1, [None, 1.0, 2.0]),
        ]
        assert sorted(groups[2]["totals"].items(), key=lambda v: v[0]) == [
            (field_2, 2.0),
            (field_1, 1.0),
        ]

    def test_query_with_multiple_aggregations_and_single_group_by_and_order_by_with_limit(
        self,
    ) -> None:
        field_1 = f"min({TransactionMRI.DURATION.value})"
        field_2 = f"max({TransactionMRI.DURATION.value})"
        results = run_metrics_query(
            fields=[field_1, field_2],
            query=None,
            group_bys=["platform"],
            order_by=f"{field_1}",
            limit=2,
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
        assert sorted(groups[0]["series"].items(), key=lambda v: v[0]) == [
            (field_2, [None, 1.0, 2.0]),
            (field_1, [None, 1.0, 2.0]),
        ]
        assert sorted(groups[0]["totals"].items(), key=lambda v: v[0]) == [
            (field_2, 2.0),
            (field_1, 1.0),
        ]
        assert groups[1]["by"] == {"platform": "ios"}
        assert sorted(groups[1]["series"].items(), key=lambda v: v[0]) == [
            (field_2, [None, 6.0, 3.0]),
            (field_1, [None, 6.0, 3.0]),
        ]
        assert sorted(groups[1]["totals"].items(), key=lambda v: v[0]) == [
            (field_2, 6.0),
            (field_1, 3.0),
        ]

    def test_query_with_invalid_syntax(
        self,
    ) -> None:
        field = f"min({TransactionMRI.DURATION.value})"
        with pytest.raises(InvalidMetricsQueryError):
            run_metrics_query(
                fields=[field],
                query="transaction:/api/0/organizations/{organization_slug}/",
                limit=2,
                start=self.now() - timedelta(minutes=30),
                end=self.now() + timedelta(hours=1, minutes=30),
                interval=3600,
                organization=self.project.organization,
                projects=[self.project],
                environments=[],
                referrer="metrics.data.api",
            )

    def test_query_with_invalid_order_by(
        self,
    ) -> None:
        field_1 = f"min({TransactionMRI.DURATION.value})"
        field_2 = f"max({TransactionMRI.DURATION.value})"
        field_3 = f"avg({TransactionMRI.DURATION.value})"
        with pytest.raises(InvalidMetricsQueryError):
            run_metrics_query(
                fields=[field_1, field_2],
                query=None,
                group_bys=["platform"],
                order_by=f"{field_3}",
                limit=2,
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
        assert groups[0]["series"] == {field: [None, 2, None]}
        assert groups[0]["totals"] == {field: 2}

    @patch("sentry.sentry_metrics.querying.data.execution.SNUBA_QUERY_LIMIT", 5)
    def test_query_with_too_many_results(self) -> None:
        field = f"sum({TransactionMRI.DURATION.value})"
        results = run_metrics_query(
            fields=[field],
            query=None,
            group_bys=["transaction", "platform"],
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=60,
            organization=self.project.organization,
            projects=[self.project],
            environments=[],
            referrer="metrics.data.api",
        )
        # We expect that the algorithm chooses an interval of 2 hours, since we are querying 3 timeseries and given
        # a limit of 5, the best that we can do is to have one interval per timeseries 3 * 1 < 5. We can't have for
        # example an interval of 1 hour, since this will result in 2 intervals for each group which is 3 * 2 < 5.
        # Given the inner workings of query ranges, if we query from 09:30 to 11:30 with an interval of 2 hours, the
        # system will approximate to the outer bounds that are a multiple of 2 hours, which in this case is:
        # 08:00 - 10:00
        # 10:00 - 12:00
        assert results["intervals"] == [self.now() - timedelta(hours=2), self.now()]
        groups = sorted(results["groups"], key=lambda value: value["by"]["platform"])
        assert len(groups) == 3
        assert groups[0]["by"] == {"platform": "android", "transaction": "/hello"}
        assert groups[0]["series"] == {field: [None, 3.0]}
        assert groups[0]["totals"] == {field: 3.0}
        assert groups[1]["by"] == {"platform": "ios", "transaction": "/hello"}
        assert groups[1]["series"] == {field: [None, 9.0]}
        assert groups[1]["totals"] == {field: 9.0}
        assert groups[2]["by"] == {"platform": "windows", "transaction": "/world"}
        assert groups[2]["series"] == {field: [None, 9.0]}
        assert groups[2]["totals"] == {field: 9.0}

    @patch("sentry.sentry_metrics.querying.data.execution.SNUBA_QUERY_LIMIT", 5)
    @patch("sentry.sentry_metrics.querying.data.execution.DEFAULT_QUERY_INTERVALS", [])
    def test_query_with_too_many_results_and_no_interval_found(self) -> None:
        with pytest.raises(MetricsQueryExecutionError):
            run_metrics_query(
                fields=[f"sum({TransactionMRI.DURATION.value})"],
                query=None,
                group_bys=["transaction", "platform"],
                start=self.now() - timedelta(minutes=30),
                end=self.now() + timedelta(hours=1, minutes=30),
                interval=60,
                organization=self.project.organization,
                projects=[self.project],
                environments=[],
                referrer="metrics.data.api",
            )

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

        field = f"sum({mri})"
        results = run_metrics_query(
            fields=[field],
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[project_1, project_2],
            environments=[],
            referrer="metrics.data.api",
        )
        groups = results["groups"]
        assert len(groups) == 1
        assert groups[0]["by"] == {}
        assert groups[0]["series"] == {field: [None, 15.0, None]}
        assert groups[0]["totals"] == {field: 15.0}

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

        field = f"sum({mri})"
        results = run_metrics_query(
            fields=[field],
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[project_1, project_2],
            environments=[],
            referrer="metrics.data.api",
        )
        groups = results["groups"]
        assert len(groups) == 0

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

        field_1 = f"sum({mri_1})"
        field_2 = f"sum({mri_2})"
        results = run_metrics_query(
            fields=[field_1, field_2],
            # We test with the order by to make sure alignment doesn't remove data.
            order_by=field_1,
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[project_1, project_2],
            environments=[],
            referrer="metrics.data.api",
        )
        groups = results["groups"]
        assert len(groups) == 1
        assert groups[0]["by"] == {}
        assert groups[0]["series"] == {field_2: [None, 10.0, None]}
        assert groups[0]["totals"] == {field_2: 10.0}
