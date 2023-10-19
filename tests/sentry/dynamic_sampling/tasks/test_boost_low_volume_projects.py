from datetime import timedelta
from typing import List, cast

from django.utils import timezone

from sentry.dynamic_sampling.tasks.boost_low_volume_projects import (
    fetch_projects_with_total_root_transaction_count_and_rates,
)
from sentry.dynamic_sampling.tasks.task_context import TaskContext
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.snuba.metrics.naming_layer.mri import TransactionMRI
from sentry.testutils.cases import BaseMetricsLayerTestCase, SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import freeze_time

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
            context, org_ids=[org1.id]
        )
        assert results[org1.id] == [(p1.id, 4.0, 1, 3)]

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
            projects = cast(List[Project], org_info.get("projects"))
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
            context, org_ids=[org1.id, org2.id]
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
