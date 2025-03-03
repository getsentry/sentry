from datetime import timedelta
from typing import cast
from unittest.mock import patch

from django.utils import timezone

from sentry.dynamic_sampling.rules.base import get_guarded_project_sample_rate
from sentry.dynamic_sampling.rules.utils import get_redis_client_for_ds
from sentry.dynamic_sampling.tasks.boost_low_volume_projects import (
    boost_low_volume_projects,
    boost_low_volume_projects_of_org_with_query,
    fetch_projects_with_total_root_transaction_count_and_rates,
)
from sentry.dynamic_sampling.tasks.helpers.boost_low_volume_projects import (
    get_boost_low_volume_projects_sample_rate,
)
from sentry.dynamic_sampling.tasks.helpers.sliding_window import (
    generate_sliding_window_org_cache_key,
)
from sentry.dynamic_sampling.tasks.task_context import TaskContext
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
    def now(self):
        return MOCK_DATETIME

    def test_simple_one_org_one_project(self):
        context = TaskContext("rebalancing", 20)
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
            context, org_ids=[org1.id], measure=SamplingMeasure.TRANSACTIONS
        )
        assert results[org1.id] == [(p1.id, 4.0, 1, 3)]

    def test_deleted_projects_are_not_queried(self):
        context = TaskContext("rebalancing", 20)
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
            context, org_ids=[org1.id], measure=SamplingMeasure.TRANSACTIONS
        )
        assert results[org1.id] == [(p1.id, 4.0, 1, 3)]

    @with_feature(["organizations:dynamic-sampling", "organizations:dynamic-sampling-custom"])
    def test_simple_one_org_one_project_task_sliding_window_sample_rate(self):
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
    def test_simple_one_org_one_project_task_target_sample_rate(self):
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
    def test_project_mode_sampling_with_query(self):
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
    def test_project_mode_sampling_with_query_zero_metrics(self):
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

    def test_complex(self):
        context = TaskContext("rebalancing", 20)
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
            context, org_ids=[org1.id, org2.id], measure=SamplingMeasure.TRANSACTIONS
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
