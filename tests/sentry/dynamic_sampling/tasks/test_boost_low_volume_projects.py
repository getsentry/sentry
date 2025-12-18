from datetime import datetime, timedelta
from typing import cast
from unittest.mock import patch

from django.utils import timezone

from sentry.dynamic_sampling.rules.base import get_guarded_project_sample_rate
from sentry.dynamic_sampling.rules.utils import get_redis_client_for_ds
from sentry.dynamic_sampling.tasks.boost_low_volume_projects import (
    boost_low_volume_projects,
    boost_low_volume_projects_of_org_with_query,
    fetch_projects_with_total_root_transaction_count_and_rates,
    partition_by_measure,
    query_project_counts_by_org,
)
from sentry.dynamic_sampling.tasks.helpers.boost_low_volume_projects import (
    get_boost_low_volume_projects_sample_rate,
)
from sentry.dynamic_sampling.tasks.helpers.sliding_window import (
    generate_sliding_window_org_cache_key,
)
from sentry.dynamic_sampling.types import DynamicSamplingMode, SamplingMeasure
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.snuba.metrics.naming_layer.mri import TransactionMRI
from sentry.testutils.cases import BaseMetricsLayerTestCase, SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.features import with_feature

MOCK_DATETIME = (timezone.now() - timedelta(days=1)).replace(
    hour=0, minute=0, second=0, microsecond=0
)


@freeze_time(MOCK_DATETIME)
class PrioritiseProjectsSnubaQueryTest(BaseMetricsLayerTestCase, TestCase, SnubaTestCase):
    @property
    def now(self) -> datetime:
        return MOCK_DATETIME

    def test_simple_one_org_one_project(self) -> None:
        org1 = self.create_organization("test-org")
        p1 = self.create_project(organization=org1)

        self.store_performance_metric(
            name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo_transaction", "decision": "keep"},
            minutes_before_now=30,
            value=1,
            project_id=p1.id,
            org_id=org1.id,
        )

        self.store_performance_metric(
            name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo_transaction", "decision": "drop"},
            minutes_before_now=30,
            value=3,
            project_id=p1.id,
            org_id=org1.id,
        )
        results = fetch_projects_with_total_root_transaction_count_and_rates(
            org_ids=[org1.id], measure=SamplingMeasure.TRANSACTIONS
        )
        assert results[org1.id] == [(p1.id, 4.0, 1, 3)]

    def test_deleted_projects_are_not_queried(self) -> None:
        org1 = self.create_organization("test-org")
        p1 = self.create_project(organization=org1)
        p2 = self.create_project(organization=org1)

        for p in [p1, p2]:
            self.store_performance_metric(
                name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
                tags={"transaction": "foo_transaction", "decision": "keep"},
                minutes_before_now=30,
                value=1,
                project_id=p.id,
                org_id=org1.id,
            )

            self.store_performance_metric(
                name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
                tags={"transaction": "foo_transaction", "decision": "drop"},
                minutes_before_now=30,
                value=3,
                project_id=p.id,
                org_id=org1.id,
            )
        p2.delete()
        results = fetch_projects_with_total_root_transaction_count_and_rates(
            org_ids=[org1.id], measure=SamplingMeasure.TRANSACTIONS
        )
        assert results[org1.id] == [(p1.id, 4.0, 1, 3)]

    @with_feature(["organizations:dynamic-sampling", "organizations:dynamic-sampling-custom"])
    def test_simple_one_org_one_project_task_sliding_window_sample_rate(self) -> None:
        org1 = self.create_organization("test-org")
        p1 = self.create_project(organization=org1)

        self.store_performance_metric(
            name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo_transaction", "decision": "keep"},
            minutes_before_now=30,
            value=1,
            project_id=p1.id,
            org_id=org1.id,
        )

        self.store_performance_metric(
            name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo_transaction", "decision": "drop"},
            minutes_before_now=30,
            value=3,
            project_id=p1.id,
            org_id=org1.id,
        )

        # simulate having a sliding window sample rate for the org
        redis_client = get_redis_client_for_ds()
        cache_key = generate_sliding_window_org_cache_key(org1.id)
        redis_client.set(cache_key, 1.0)

        with self.tasks():
            boost_low_volume_projects_of_org_with_query.delay(org1.id)

        sample_rate, got_value = get_boost_low_volume_projects_sample_rate(
            org1.id, p1.id, error_sample_rate_fallback=None
        )

        assert got_value
        assert sample_rate == 1.0

    @with_feature(["organizations:dynamic-sampling", "organizations:dynamic-sampling-custom"])
    def test_simple_one_org_one_project_task_target_sample_rate(self) -> None:
        org1 = self.create_organization("test-org")
        p1 = self.create_project(organization=org1)

        OrganizationOption.objects.create(
            organization=org1, key="sentry:target_sample_rate", value=0.5
        )

        self.store_performance_metric(
            name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo_transaction", "decision": "keep"},
            minutes_before_now=30,
            value=1,
            project_id=p1.id,
            org_id=org1.id,
        )

        self.store_performance_metric(
            name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo_transaction", "decision": "drop"},
            minutes_before_now=30,
            value=3,
            project_id=p1.id,
            org_id=org1.id,
        )

        with self.tasks():
            boost_low_volume_projects_of_org_with_query.delay(org1.id)

        sample_rate, got_value = get_boost_low_volume_projects_sample_rate(
            org1.id, p1.id, error_sample_rate_fallback=None
        )
        assert (sample_rate, got_value) == (0.5, True)

    @with_feature(["organizations:dynamic-sampling", "organizations:dynamic-sampling-custom"])
    def test_project_mode_sampling_with_query(self) -> None:
        org1 = self.create_organization("test-org")
        p1 = self.create_project(organization=org1)

        org1.update_option("sentry:sampling_mode", DynamicSamplingMode.PROJECT)
        p1.update_option("sentry:target_sample_rate", 0.2)

        self.store_performance_metric(
            name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo_transaction", "decision": "keep"},
            minutes_before_now=30,
            value=1,
            project_id=p1.id,
            org_id=org1.id,
        )

        self.store_performance_metric(
            name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo_transaction", "decision": "drop"},
            minutes_before_now=30,
            value=3,
            project_id=p1.id,
            org_id=org1.id,
        )

        # bulk task
        with self.tasks():
            boost_low_volume_projects.delay()

        sample_rate, got_value = get_boost_low_volume_projects_sample_rate(
            org1.id, p1.id, error_sample_rate_fallback=None
        )
        assert (sample_rate, got_value) == (None, False)

        # single-org task
        with self.tasks():
            boost_low_volume_projects_of_org_with_query.delay(org1.id)

        sample_rate, got_value = get_boost_low_volume_projects_sample_rate(
            org1.id, p1.id, error_sample_rate_fallback=None
        )
        assert (sample_rate, got_value) == (None, False)

        assert get_guarded_project_sample_rate(org1, p1) == 0.2

    @with_feature(["organizations:dynamic-sampling", "organizations:dynamic-sampling-custom"])
    def test_project_mode_sampling_with_query_zero_metrics(self) -> None:
        organization = self.create_organization("test-org")
        project = self.create_project(organization=organization)

        organization.update_option("sentry:sampling_mode", DynamicSamplingMode.PROJECT)
        project.update_option("sentry:target_sample_rate", 0.2)

        # make sure that no rebalancing is actually run
        with patch(
            "sentry.dynamic_sampling.models.projects_rebalancing.ProjectsRebalancingModel._run"
        ) as mock_run:
            with self.tasks():
                boost_low_volume_projects.delay()
            assert not mock_run.called

    def test_complex(self) -> None:
        org1 = self.create_organization("test-org1")
        p1_1 = self.create_project(organization=org1, name="p1_1")
        p1_2 = self.create_project(organization=org1, name="p1_2")
        org2 = self.create_organization("test-org2")
        p2_1 = self.create_project(organization=org2, name="p2_1")
        p2_2 = self.create_project(organization=org2, name="p2_2")

        proj_orgs = [
            {"org": org1, "projects": [p1_1, p1_2]},
            {"org": org2, "projects": [p2_1, p2_2]},
        ]

        proj_counts = {"p1_1": (1, 2), "p1_2": (3, 4), "p2_1": (5, 6), "p2_2": (7, 8)}  # keep,drop

        for org_info in proj_orgs:
            org = cast(Organization, org_info.get("org"))
            projects = cast(list[Project], org_info.get("projects"))
            for project in projects:
                keep, drop = proj_counts[project.name]
                self.store_performance_metric(
                    name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
                    tags={"transaction": "foo_transaction", "decision": "keep"},
                    minutes_before_now=29,
                    value=keep,
                    project_id=project.id,
                    org_id=org.id,
                )
                self.store_performance_metric(
                    name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
                    tags={"transaction": "foo_transaction", "decision": "drop"},
                    minutes_before_now=29,
                    value=drop,
                    project_id=project.id,
                    org_id=org.id,
                )
        results = fetch_projects_with_total_root_transaction_count_and_rates(
            org_ids=[org1.id, org2.id], measure=SamplingMeasure.TRANSACTIONS
        )

        assert len(results) == 2  # two orgs

        org_1_results = results[org1.id]

        assert len(org_1_results) == 2

        # (p.id, total, keep, drop) == result
        assert (p1_1.id, 3, 1, 2) in org_1_results
        assert (p1_2.id, 7, 3, 4) in org_1_results

        org_2_results = results[org2.id]
        assert len(org_2_results) == 2
        assert (p2_1.id, 11, 5, 6) in org_2_results
        assert (p2_2.id, 15, 7, 8) in org_2_results


class TestPartitionByMeasure(TestCase):
    def test_partition_by_measure_with_spans_feature(self) -> None:
        org = self.create_organization("test-org1")
        with self.options(
            {
                "dynamic-sampling.check_span_feature_flag": True,
                "dynamic-sampling.measure.spans": [org.id],
            }
        ):
            result = partition_by_measure([org.id])
            assert SamplingMeasure.SPANS in result
            assert SamplingMeasure.TRANSACTIONS in result
            assert result[SamplingMeasure.SPANS] == [org.id]
            assert result[SamplingMeasure.TRANSACTIONS] == []

    def test_partition_by_measure_without_spans_feature(self) -> None:
        org = self.create_organization("test-org1")
        with self.options(
            {
                "dynamic-sampling.check_span_feature_flag": True,
                "dynamic-sampling.measure.spans": [],
            }
        ):
            result = partition_by_measure([org.id])
            assert SamplingMeasure.SPANS in result
            assert SamplingMeasure.TRANSACTIONS in result
            assert result[SamplingMeasure.SPANS] == []
            assert result[SamplingMeasure.TRANSACTIONS] == [org.id]

    def test_partition_by_measure_with_span_feature_flag_disabled(self) -> None:
        org = self.create_organization("test-org1")
        with self.options(
            {
                "dynamic-sampling.check_span_feature_flag": False,
                "dynamic-sampling.measure.spans": [org.id],
            }
        ):
            result = partition_by_measure([org.id])
            assert SamplingMeasure.TRANSACTIONS in result
            assert SamplingMeasure.SPANS not in result
            assert result[SamplingMeasure.TRANSACTIONS] == [org.id]

    def test_partition_by_measure_returns_sorted_output_multiple_orgs(self) -> None:
        orgs = [self.create_organization(f"test-org{i}") for i in range(10)]
        org_ids = [org.id for org in reversed(orgs)]

        with self.options(
            {
                "dynamic-sampling.check_span_feature_flag": True,
                "dynamic-sampling.measure.spans": [orgs[2].id, orgs[7].id, orgs[5].id],
            }
        ):
            result = partition_by_measure(org_ids)

            assert result[SamplingMeasure.SPANS] == sorted([orgs[2].id, orgs[7].id, orgs[5].id])
            expected_transaction_orgs = sorted(
                [org.id for org in orgs if org.id not in [orgs[2].id, orgs[7].id, orgs[5].id]]
            )
            assert result[SamplingMeasure.TRANSACTIONS] == expected_transaction_orgs

    def test_partition_by_measure_returns_sorted_when_feature_disabled(self) -> None:
        org1 = self.create_organization("test-org1")
        org2 = self.create_organization("test-org2")
        org3 = self.create_organization("test-org3")

        org_ids = [org3.id, org1.id, org2.id]

        with self.options(
            {
                "dynamic-sampling.check_span_feature_flag": False,
            }
        ):
            result = partition_by_measure(org_ids)

            assert result[SamplingMeasure.TRANSACTIONS] == sorted(org_ids)
            assert SamplingMeasure.SPANS not in result


@freeze_time(MOCK_DATETIME)
class TestQueryProjectCountsByOrgEmptyOrgIds(BaseMetricsLayerTestCase, TestCase, SnubaTestCase):
    """
    Test that query_project_counts_by_org correctly skips Snuba queries
    when org_ids is empty, avoiding unnecessary queries.
    """

    @property
    def now(self) -> datetime:
        return MOCK_DATETIME

    def test_query_skips_for_empty_org_ids(self) -> None:
        """
        Confirms that query_project_counts_by_org does NOT make a Snuba query
        when called with an empty org_ids list.
        """
        with patch(
            "sentry.dynamic_sampling.tasks.boost_low_volume_projects.raw_snql_query"
        ) as mock_query:
            mock_query.return_value = {"data": []}

            list(query_project_counts_by_org([], SamplingMeasure.TRANSACTIONS))

            assert mock_query.call_count == 0

    def test_fetch_projects_only_queries_measures_with_orgs(self) -> None:
        """
        Confirms that when partition_by_measure returns both measures
        (one with orgs, one empty), only the measure with orgs results
        in a Snuba query.
        """
        org = self.create_organization("test-org")
        self.create_project(organization=org)

        self.store_performance_metric(
            name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo", "decision": "keep"},
            minutes_before_now=30,
            value=1,
            project_id=org.project_set.first().id,
            org_id=org.id,
        )

        with patch(
            "sentry.dynamic_sampling.tasks.boost_low_volume_projects.raw_snql_query"
        ) as mock_query:
            mock_query.return_value = {"data": []}

            with self.options(
                {
                    "dynamic-sampling.check_span_feature_flag": True,
                    "dynamic-sampling.measure.spans": [org.id],
                }
            ):
                partitioned = partition_by_measure([org.id])
                assert partitioned[SamplingMeasure.SPANS] == [org.id]
                assert partitioned[SamplingMeasure.TRANSACTIONS] == []

                for measure, org_ids in partitioned.items():
                    fetch_projects_with_total_root_transaction_count_and_rates(
                        org_ids=org_ids, measure=measure
                    )

            assert mock_query.call_count == 1

    def test_only_measures_with_orgs_are_queried_per_batch(self) -> None:
        """
        Simulates the main task loop behavior and confirms that
        for each batch of orgs, only measures with non-empty org lists
        result in Snuba queries.
        """
        org1 = self.create_organization("test-org1")
        org2 = self.create_organization("test-org2")
        self.create_project(organization=org1)
        self.create_project(organization=org2)

        with patch(
            "sentry.dynamic_sampling.tasks.boost_low_volume_projects.raw_snql_query"
        ) as mock_query:
            mock_query.return_value = {"data": []}

            with self.options(
                {
                    "dynamic-sampling.check_span_feature_flag": True,
                    "dynamic-sampling.measure.spans": [org1.id, org2.id],
                }
            ):
                batches = [[org1.id], [org2.id]]

                for batch in batches:
                    partitioned = partition_by_measure(batch)
                    assert partitioned[SamplingMeasure.TRANSACTIONS] == []

                    for measure, org_ids in partitioned.items():
                        fetch_projects_with_total_root_transaction_count_and_rates(
                            org_ids=org_ids, measure=measure
                        )

            assert mock_query.call_count == 2
