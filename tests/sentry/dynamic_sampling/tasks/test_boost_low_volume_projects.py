from datetime import datetime, timedelta
from typing import cast
from unittest.mock import patch

from django.utils import timezone

from sentry.dynamic_sampling.rules.base import get_guarded_project_sample_rate
from sentry.dynamic_sampling.rules.utils import get_redis_client_for_ds
from sentry.dynamic_sampling.tasks.boost_low_volume_projects import (
    _partition_orgs_by_measure,
    boost_low_volume_projects,
    boost_low_volume_projects_of_org_with_query,
    fetch_projects_with_total_root_transaction_count_and_rates,
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
from sentry.snuba.metrics.naming_layer.mri import SpanMRI, TransactionMRI
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
            name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo_transaction", "decision": "keep", "is_segment": "true"},
            minutes_before_now=30,
            value=1,
            project_id=p1.id,
            org_id=org1.id,
        )

        self.store_performance_metric(
            name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo_transaction", "decision": "drop", "is_segment": "true"},
            minutes_before_now=30,
            value=3,
            project_id=p1.id,
            org_id=org1.id,
        )
        results = fetch_projects_with_total_root_transaction_count_and_rates(
            org_ids=[org1.id], measure=SamplingMeasure.SEGMENTS
        )
        assert results[org1.id] == [(p1.id, 4.0, 1, 3)]

    def test_deleted_projects_are_not_queried(self) -> None:
        org1 = self.create_organization("test-org")
        p1 = self.create_project(organization=org1)
        p2 = self.create_project(organization=org1)

        for p in [p1, p2]:
            self.store_performance_metric(
                name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
                tags={"transaction": "foo_transaction", "decision": "keep", "is_segment": "true"},
                minutes_before_now=30,
                value=1,
                project_id=p.id,
                org_id=org1.id,
            )

            self.store_performance_metric(
                name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
                tags={"transaction": "foo_transaction", "decision": "drop", "is_segment": "true"},
                minutes_before_now=30,
                value=3,
                project_id=p.id,
                org_id=org1.id,
            )
        p2.delete()
        results = fetch_projects_with_total_root_transaction_count_and_rates(
            org_ids=[org1.id], measure=SamplingMeasure.SEGMENTS
        )
        assert results[org1.id] == [(p1.id, 4.0, 1, 3)]

    @with_feature(["organizations:dynamic-sampling", "organizations:dynamic-sampling-custom"])
    def test_simple_one_org_one_project_task_sliding_window_sample_rate(self) -> None:
        org1 = self.create_organization("test-org")
        p1 = self.create_project(organization=org1)

        self.store_performance_metric(
            name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo_transaction", "decision": "keep", "is_segment": "true"},
            minutes_before_now=30,
            value=1,
            project_id=p1.id,
            org_id=org1.id,
        )

        self.store_performance_metric(
            name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo_transaction", "decision": "drop", "is_segment": "true"},
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
            name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo_transaction", "decision": "keep", "is_segment": "true"},
            minutes_before_now=30,
            value=1,
            project_id=p1.id,
            org_id=org1.id,
        )

        self.store_performance_metric(
            name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo_transaction", "decision": "drop", "is_segment": "true"},
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
            name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo_transaction", "decision": "keep", "is_segment": "true"},
            minutes_before_now=30,
            value=1,
            project_id=p1.id,
            org_id=org1.id,
        )

        self.store_performance_metric(
            name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo_transaction", "decision": "drop", "is_segment": "true"},
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
                    name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
                    tags={
                        "transaction": "foo_transaction",
                        "decision": "keep",
                        "is_segment": "true",
                    },
                    minutes_before_now=29,
                    value=keep,
                    project_id=project.id,
                    org_id=org.id,
                )
                self.store_performance_metric(
                    name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
                    tags={
                        "transaction": "foo_transaction",
                        "decision": "drop",
                        "is_segment": "true",
                    },
                    minutes_before_now=29,
                    value=drop,
                    project_id=project.id,
                    org_id=org.id,
                )
        results = fetch_projects_with_total_root_transaction_count_and_rates(
            org_ids=[org1.id, org2.id], measure=SamplingMeasure.SEGMENTS
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


class TestPartitionOrgsByMeasure(TestCase):
    def test_all_orgs_go_to_segments_by_default(self) -> None:
        """All orgs should be partitioned to SEGMENTS by default."""
        org = self.create_organization("test-org")
        with self.options(
            {
                "dynamic-sampling.check_span_feature_flag": False,
            }
        ):
            result = _partition_orgs_by_measure([org.id])
            assert org.id in result[SamplingMeasure.SEGMENTS]

    def test_project_mode_orgs_are_excluded(self) -> None:
        """Orgs with PROJECT sampling mode should be excluded from all partitions."""
        org = self.create_organization("test-org")
        org.update_option("sentry:sampling_mode", DynamicSamplingMode.PROJECT)

        with self.options(
            {
                "dynamic-sampling.check_span_feature_flag": False,
            }
        ):
            result = _partition_orgs_by_measure([org.id])
            assert org.id not in result.get(SamplingMeasure.SEGMENTS, [])

    def test_span_orgs_partitioned_when_check_span_flag_enabled(self) -> None:
        """When check_span_feature_flag is on, orgs in span option go to SPANS."""
        org_span = self.create_organization("org-span")
        org_seg = self.create_organization("org-seg")

        with self.options(
            {
                "dynamic-sampling.check_span_feature_flag": True,
                "dynamic-sampling.measure.spans": [org_span.id],
            }
        ):
            result = _partition_orgs_by_measure([org_span.id, org_seg.id])
            assert org_span.id in result[SamplingMeasure.SPANS]
            assert org_seg.id in result[SamplingMeasure.SEGMENTS]

    def test_span_flag_disabled_means_no_span_partition(self) -> None:
        """When check_span_feature_flag is off, SPANS key should not be in result."""
        org = self.create_organization("test-org")
        with self.options(
            {
                "dynamic-sampling.check_span_feature_flag": False,
                "dynamic-sampling.measure.spans": [org.id],
            }
        ):
            result = _partition_orgs_by_measure([org.id])
            assert SamplingMeasure.SPANS not in result
            assert org.id in result[SamplingMeasure.SEGMENTS]

    def test_project_mode_excluded_from_segments_and_spans(self) -> None:
        """Project-mode orgs should be excluded even if listed in spans option."""
        org = self.create_organization("test-org")
        org.update_option("sentry:sampling_mode", DynamicSamplingMode.PROJECT)

        with self.options(
            {
                "dynamic-sampling.check_span_feature_flag": True,
                "dynamic-sampling.measure.spans": [org.id],
            }
        ):
            result = _partition_orgs_by_measure([org.id])
            assert org.id not in result.get(SamplingMeasure.SEGMENTS, [])
            assert org.id not in result.get(SamplingMeasure.SPANS, [])


@freeze_time(MOCK_DATETIME)
class TestQueryProjectCountsByOrgEmptyOrgIds(BaseMetricsLayerTestCase, TestCase, SnubaTestCase):
    """
    Test that query_project_counts_by_org correctly skips Snuba queries
    when org_ids is empty, avoiding unnecessary queries.
    """

    @property
    def now(self) -> datetime:
        return MOCK_DATETIME

    def test_query_skips_for_empty_org_ids_when_option_enabled(self) -> None:
        """
        Confirms that query_project_counts_by_org does NOT make a Snuba query
        when called with an empty org_ids list.
        """
        with patch(
            "sentry.dynamic_sampling.tasks.boost_low_volume_projects.raw_snql_query"
        ) as mock_query:
            mock_query.return_value = {"data": []}

            list(query_project_counts_by_org([], SamplingMeasure.SEGMENTS))

            assert mock_query.call_count == 0

    def test_fetch_projects_only_queries_measures_with_orgs(self) -> None:
        """
        Confirms that fetch_projects_with_total_root_transaction_count_and_rates
        does NOT make a Snuba query when called with an empty org_ids list.
        """
        org = self.create_organization("test-org")
        self.create_project(organization=org)

        self.store_performance_metric(
            name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo", "decision": "keep", "is_segment": "true"},
            minutes_before_now=30,
            value=1,
            project_id=org.project_set.first().id,
            org_id=org.id,
        )

        with patch(
            "sentry.dynamic_sampling.tasks.boost_low_volume_projects.raw_snql_query"
        ) as mock_query:
            mock_query.return_value = {"data": []}

            # Query with org should make one call
            fetch_projects_with_total_root_transaction_count_and_rates(
                org_ids=[org.id], measure=SamplingMeasure.SEGMENTS
            )
            assert mock_query.call_count == 1

            # Query with empty list should not make any additional calls
            fetch_projects_with_total_root_transaction_count_and_rates(
                org_ids=[], measure=SamplingMeasure.SEGMENTS
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

            batches = [[org1.id], [org2.id]]

            for batch in batches:
                orgs_by_measure = _partition_orgs_by_measure(batch)
                assert orgs_by_measure.get(SamplingMeasure.SPANS, []) == []

                # Each batch should result in one query for SEGMENTS
                fetch_projects_with_total_root_transaction_count_and_rates(
                    org_ids=orgs_by_measure.get(SamplingMeasure.SEGMENTS, []),
                    measure=SamplingMeasure.SEGMENTS,
                )
                # SPANS partition is empty, no query needed
                fetch_projects_with_total_root_transaction_count_and_rates(
                    org_ids=orgs_by_measure.get(SamplingMeasure.SPANS, []),
                    measure=SamplingMeasure.SPANS,
                )

            assert mock_query.call_count == 2


@freeze_time(MOCK_DATETIME)
class TestSpanMetricQuery(BaseMetricsLayerTestCase, TestCase, SnubaTestCase):
    """
    Tests that verify the span metric query works correctly with is_segment filter.
    """

    @property
    def now(self) -> datetime:
        return MOCK_DATETIME

    def test_span_metric_with_is_segment_filter(self) -> None:
        """
        Test that span metric queries only count spans with is_segment=true.
        """
        org = self.create_organization("test-org")
        project = self.create_project(organization=org)

        # Store span metrics with is_segment=true (should be counted)
        self.store_performance_metric(
            name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo_transaction", "decision": "keep", "is_segment": "true"},
            minutes_before_now=30,
            value=5,
            project_id=project.id,
            org_id=org.id,
        )
        self.store_performance_metric(
            name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo_transaction", "decision": "drop", "is_segment": "true"},
            minutes_before_now=30,
            value=10,
            project_id=project.id,
            org_id=org.id,
        )

        # Store span metrics without is_segment tag (should NOT be counted)
        self.store_performance_metric(
            name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "bar_transaction", "decision": "keep"},
            minutes_before_now=30,
            value=100,
            project_id=project.id,
            org_id=org.id,
        )

        results = fetch_projects_with_total_root_transaction_count_and_rates(
            org_ids=[org.id], measure=SamplingMeasure.SEGMENTS
        )

        # Should only count the is_segment=true metrics (5 + 10 = 15)
        assert results[org.id] == [(project.id, 15.0, 5, 10)]

    def test_span_metric_multiple_projects(self) -> None:
        """
        Test span metric query with multiple projects.
        """
        org = self.create_organization("test-org")
        p1 = self.create_project(organization=org)
        p2 = self.create_project(organization=org)

        # Project 1: 3 keep, 7 drop
        self.store_performance_metric(
            name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo", "decision": "keep", "is_segment": "true"},
            minutes_before_now=30,
            value=3,
            project_id=p1.id,
            org_id=org.id,
        )
        self.store_performance_metric(
            name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo", "decision": "drop", "is_segment": "true"},
            minutes_before_now=30,
            value=7,
            project_id=p1.id,
            org_id=org.id,
        )

        # Project 2: 2 keep, 8 drop
        self.store_performance_metric(
            name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "bar", "decision": "keep", "is_segment": "true"},
            minutes_before_now=30,
            value=2,
            project_id=p2.id,
            org_id=org.id,
        )
        self.store_performance_metric(
            name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "bar", "decision": "drop", "is_segment": "true"},
            minutes_before_now=30,
            value=8,
            project_id=p2.id,
            org_id=org.id,
        )

        results = fetch_projects_with_total_root_transaction_count_and_rates(
            org_ids=[org.id], measure=SamplingMeasure.SPANS
        )

        assert len(results[org.id]) == 2
        assert (p1.id, 10.0, 3, 7) in results[org.id]
        assert (p2.id, 10.0, 2, 8) in results[org.id]


@freeze_time(MOCK_DATETIME)
class TestEndToEndMeasureDispatching(BaseMetricsLayerTestCase, TestCase, SnubaTestCase):
    """
    End-to-end tests verifying that the boost_low_volume_projects task correctly
    dispatches orgs to the right measure and that segment, transaction, and span
    processing are all executed correctly.
    """

    @property
    def now(self) -> datetime:
        return MOCK_DATETIME

    @with_feature(["organizations:dynamic-sampling", "organizations:dynamic-sampling-custom"])
    def test_org_uses_segments_measure_in_with_query_task(self) -> None:
        """
        boost_low_volume_projects_of_org_with_query should use SEGMENTS measure.
        """
        org = self.create_organization("test-org")
        p1 = self.create_project(organization=org)

        # Store span metrics with is_segment=true (used by SEGMENTS measure)
        self.store_performance_metric(
            name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo", "decision": "keep", "is_segment": "true"},
            minutes_before_now=30,
            value=5,
            project_id=p1.id,
            org_id=org.id,
        )
        self.store_performance_metric(
            name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo", "decision": "drop", "is_segment": "true"},
            minutes_before_now=30,
            value=10,
            project_id=p1.id,
            org_id=org.id,
        )

        redis_client = get_redis_client_for_ds()
        cache_key = generate_sliding_window_org_cache_key(org.id)
        redis_client.set(cache_key, 0.5)

        with self.tasks():
            boost_low_volume_projects_of_org_with_query.delay(org.id)

        sample_rate, got_value = get_boost_low_volume_projects_sample_rate(
            org.id, p1.id, error_sample_rate_fallback=None
        )
        assert got_value
        assert sample_rate is not None

    def test_main_task_dispatches_correct_measures(self) -> None:
        """
        The main boost_low_volume_projects task should call _process_orgs_for_boost
        with SEGMENTS measure for all orgs discovered via GetActiveOrgs scan.
        """
        org1 = self.create_organization("org-1")
        org2 = self.create_organization("org-2")
        p1 = self.create_project(organization=org1)
        p2 = self.create_project(organization=org2)

        # Both orgs emit SpanMRI with is_segment=true
        for p, org in [(p1, org1), (p2, org2)]:
            self.store_performance_metric(
                name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
                tags={"transaction": "foo", "decision": "keep", "is_segment": "true"},
                minutes_before_now=30,
                value=1,
                project_id=p.id,
                org_id=org.id,
            )

        with patch(
            "sentry.dynamic_sampling.tasks.boost_low_volume_projects._process_orgs_for_boost"
        ) as mock_process:
            with self.tasks():
                boost_low_volume_projects()

            # Collect all calls: (org_ids, measure) pairs
            calls_by_measure: dict[SamplingMeasure, list[int]] = {}
            for call in mock_process.call_args_list:
                org_ids = call[0][0]
                measure = call[0][1]
                calls_by_measure.setdefault(measure, []).extend(org_ids)

            assert org1.id in calls_by_measure.get(SamplingMeasure.SEGMENTS, [])
            assert org2.id in calls_by_measure.get(SamplingMeasure.SEGMENTS, [])

    def test_segment_only_org_is_discovered_by_main_task(self) -> None:
        """
        An org that emits segment metrics (SpanMRI with is_segment=true)
        must be discovered and processed by the main boost_low_volume_projects task.
        """
        org = self.create_organization("segment-only-org")
        project = self.create_project(organization=org)

        self.store_performance_metric(
            name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo", "decision": "keep", "is_segment": "true"},
            minutes_before_now=30,
            value=5,
            project_id=project.id,
            org_id=org.id,
        )

        with patch(
            "sentry.dynamic_sampling.tasks.boost_low_volume_projects._process_orgs_for_boost"
        ) as mock_process:
            with self.tasks():
                boost_low_volume_projects()

            calls_by_measure: dict[SamplingMeasure, list[int]] = {}
            for call in mock_process.call_args_list:
                org_ids = call[0][0]
                measure = call[0][1]
                calls_by_measure.setdefault(measure, []).extend(org_ids)

            assert org.id in calls_by_measure.get(SamplingMeasure.SEGMENTS, [])

    @with_feature(["organizations:dynamic-sampling", "organizations:dynamic-sampling-custom"])
    def test_segments_query_uses_span_mri_with_is_segment_tag(self) -> None:
        """
        When processing an org with SEGMENTS measure, the Snuba query should use
        SpanMRI and filter by is_segment=true, not TransactionMRI.
        """
        org = self.create_organization("test-org")
        project = self.create_project(organization=org)

        # Store ONLY span metrics with is_segment=true
        self.store_performance_metric(
            name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo", "decision": "keep", "is_segment": "true"},
            minutes_before_now=30,
            value=3,
            project_id=project.id,
            org_id=org.id,
        )
        self.store_performance_metric(
            name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo", "decision": "drop", "is_segment": "true"},
            minutes_before_now=30,
            value=7,
            project_id=project.id,
            org_id=org.id,
        )

        # Also store transaction metrics (should NOT be picked up for SEGMENTS)
        self.store_performance_metric(
            name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo", "decision": "keep"},
            minutes_before_now=30,
            value=100,
            project_id=project.id,
            org_id=org.id,
        )

        results = fetch_projects_with_total_root_transaction_count_and_rates(
            org_ids=[org.id], measure=SamplingMeasure.SEGMENTS
        )

        # Should only see the span/segment metrics (3 + 7 = 10), not the transaction metrics (100)
        assert results[org.id] == [(project.id, 10.0, 3, 7)]

    @with_feature(["organizations:dynamic-sampling", "organizations:dynamic-sampling-custom"])
    def test_spans_query_uses_span_mri_without_is_segment(self) -> None:
        """
        When processing an org with SPANS measure, the Snuba query should use
        SpanMRI but NOT filter by is_segment (counts all spans).
        """
        org = self.create_organization("test-org")
        project = self.create_project(organization=org)

        # Store span metrics WITH is_segment=true
        self.store_performance_metric(
            name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo", "decision": "keep", "is_segment": "true"},
            minutes_before_now=30,
            value=3,
            project_id=project.id,
            org_id=org.id,
        )

        # Store span metrics WITHOUT is_segment tag
        self.store_performance_metric(
            name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "bar", "decision": "keep"},
            minutes_before_now=30,
            value=7,
            project_id=project.id,
            org_id=org.id,
        )

        results = fetch_projects_with_total_root_transaction_count_and_rates(
            org_ids=[org.id], measure=SamplingMeasure.SPANS
        )

        # SPANS measure should count ALL spans (both with and without is_segment)
        # Total = 3 + 7 = 10, all keeps
        assert results[org.id] == [(project.id, 10.0, 10, 0)]

    @with_feature(["organizations:dynamic-sampling", "organizations:dynamic-sampling-custom"])
    def test_with_query_task_skips_project_mode_orgs(self) -> None:
        """
        boost_low_volume_projects_of_org_with_query should early-return for
        project-mode orgs without storing any rebalanced rates.
        """
        org = self.create_organization("test-org")
        p1 = self.create_project(organization=org)
        org.update_option("sentry:sampling_mode", DynamicSamplingMode.PROJECT)

        self.store_performance_metric(
            name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo", "decision": "keep", "is_segment": "true"},
            minutes_before_now=30,
            value=5,
            project_id=p1.id,
            org_id=org.id,
        )

        redis_client = get_redis_client_for_ds()
        cache_key = generate_sliding_window_org_cache_key(org.id)
        redis_client.set(cache_key, 0.5)

        with self.tasks():
            boost_low_volume_projects_of_org_with_query.delay(org.id)

        sample_rate, got_value = get_boost_low_volume_projects_sample_rate(
            org.id, p1.id, error_sample_rate_fallback=None
        )
        assert not got_value
        assert sample_rate is None

    @with_feature(["organizations:dynamic-sampling", "organizations:dynamic-sampling-custom"])
    def test_with_query_task_uses_spans_measure_for_span_orgs(self) -> None:
        """
        boost_low_volume_projects_of_org_with_query should use SPANS measure
        for orgs listed in the span-metric option when the span flag is enabled.
        """
        org = self.create_organization("test-org")
        p1 = self.create_project(organization=org)

        # Store span metrics (with and without is_segment)
        self.store_performance_metric(
            name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo", "decision": "keep", "is_segment": "true"},
            minutes_before_now=30,
            value=3,
            project_id=p1.id,
            org_id=org.id,
        )
        self.store_performance_metric(
            name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "bar", "decision": "keep"},
            minutes_before_now=30,
            value=7,
            project_id=p1.id,
            org_id=org.id,
        )

        redis_client = get_redis_client_for_ds()
        cache_key = generate_sliding_window_org_cache_key(org.id)
        redis_client.set(cache_key, 0.5)

        with self.options(
            {
                "dynamic-sampling.check_span_feature_flag": True,
                "dynamic-sampling.measure.spans": [org.id],
            }
        ):
            with self.tasks():
                boost_low_volume_projects_of_org_with_query.delay(org.id)

        sample_rate, got_value = get_boost_low_volume_projects_sample_rate(
            org.id, p1.id, error_sample_rate_fallback=None
        )
        assert got_value
        assert sample_rate is not None
