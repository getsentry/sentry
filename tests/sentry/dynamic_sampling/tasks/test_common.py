from datetime import timedelta

import pytest
from django.utils import timezone

from sentry.dynamic_sampling.tasks.common import (
    GetActiveOrgs,
    GetActiveOrgsVolumes,
    OrganizationDataVolume,
    get_organization_volume,
)
from sentry.dynamic_sampling.types import SamplingMeasure
from sentry.snuba.metrics.naming_layer.mri import SpanMRI, TransactionMRI
from sentry.testutils.cases import BaseMetricsLayerTestCase, SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import freeze_time

MOCK_DATETIME = (timezone.now() - timedelta(days=1)).replace(
    hour=0, minute=0, second=0, microsecond=0
)


@freeze_time(MOCK_DATETIME)
class TestGetActiveOrgs(BaseMetricsLayerTestCase, TestCase, SnubaTestCase):
    def setUp(self) -> None:

        # create 10 orgs each with 10 transactions
        for i in range(10):
            org = self.create_organization(f"org-{i}")
            for i in range(10):
                project = self.create_project(organization=org)
                self.store_performance_metric(
                    name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
                    tags={"transaction": "foo_transaction", "decision": "keep"},
                    minutes_before_now=30,
                    value=1,
                    project_id=project.id,
                    org_id=org.id,
                )

    @property
    def now(self):
        return MOCK_DATETIME

    def test_get_active_orgs_no_max_projects(self) -> None:
        total_orgs = 0
        for idx, orgs in enumerate(GetActiveOrgs(3)):
            num_orgs = len(orgs)
            total_orgs += num_orgs
            if idx in [0, 1, 2]:
                assert num_orgs == 3  # first batch should be full
            else:
                assert num_orgs == 1  # second should contain the remaining 3
        assert total_orgs == 10

    def test_get_active_orgs_with_max_projects(self) -> None:
        total_orgs = 0
        for orgs in GetActiveOrgs(3, 18):
            # we ask for max 18 proj (that's 2 org per request since one org has 10 )
            num_orgs = len(orgs)
            total_orgs += num_orgs
            assert num_orgs == 2  # only 2 orgs since we limit the number of projects
        assert total_orgs == 10


NOW_ISH = timezone.now().replace(second=0, microsecond=0)


@freeze_time(MOCK_DATETIME)
class TestGetActiveOrgsVolumes(BaseMetricsLayerTestCase, TestCase, SnubaTestCase):
    def setUp(self) -> None:
        self.orgs = []
        # create 12 orgs each and some transactions with a 2/1 drop/keep rate
        for i in range(12):
            org = self.create_organization(f"org-{i}")
            self.orgs.append(org)
            project = self.create_project(organization=org)
            for decision, value in [("drop", 2), ("keep", 1)]:
                self.store_performance_metric(
                    name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
                    tags={"transaction": "foo_transaction", "decision": decision},
                    minutes_before_now=1,
                    value=value,
                    project_id=project.id,
                    org_id=org.id,
                )

    @property
    def now(self):
        return MOCK_DATETIME

    def test_get_active_orgs_volumes_exact_batch_match(self) -> None:
        """
        gets active org volumes, with a batch size multiple of
        number of elements
        """
        total_orgs = 0
        for orgs in GetActiveOrgsVolumes(max_orgs=3):
            num_orgs = len(orgs)
            total_orgs += num_orgs
            assert num_orgs == 3  # first batch should be full
            for org in orgs:
                assert org.total == 3
                assert org.indexed == 1
        assert total_orgs == 12

    def test_get_active_orgs_volumes(self) -> None:
        """
        gets active org volumes, with a batch size that is not a multiple
        of the number of elements in the DB
        """
        total_orgs = 0
        for idx, orgs in enumerate(GetActiveOrgsVolumes(max_orgs=5)):
            num_orgs = len(orgs)
            total_orgs += num_orgs
            if idx in [0, 1]:
                assert num_orgs == 5  # first two batches should be full
            elif idx == 2:
                assert num_orgs == 2  # last batch not full
            else:
                pytest.fail(f"Unexpected index {idx} only 3 iterations expected.")
            for org in orgs:
                assert org.total == 3
                assert org.indexed == 1

        assert total_orgs == 12

    def test_get_organization_volume_existing_org(self) -> None:
        """
        gets the volume of one existing organization
        """
        org = self.orgs[0]
        org_volume = get_organization_volume(org.id)
        assert org_volume == OrganizationDataVolume(org_id=org.id, total=3, indexed=1)

    def test_get_organization_volume_missing_org(self) -> None:
        """
        calls get_organization_volume for a missing org (should return None)
        """
        org_id = 99999999  # can we do better, an id we know for sure is not in the DB?
        org_volume = get_organization_volume(org_id)
        assert org_volume is None


@freeze_time(MOCK_DATETIME)
class TestGetActiveOrgsMeasureFiltering(BaseMetricsLayerTestCase, TestCase, SnubaTestCase):
    """
    Tests that TRANSACTIONS and SEGMENTS measures filter metrics correctly.
    Both measures should behave equivalently when the appropriate metrics are emitted.
    """

    @property
    def now(self):
        return MOCK_DATETIME

    def test_transactions_measure_only_counts_transaction_metrics(self) -> None:
        """
        Test that TRANSACTIONS measure only counts TransactionMRI metrics, not SpanMRI.
        """
        org1 = self.create_organization("test-org-1")
        project1 = self.create_project(organization=org1)
        org2 = self.create_organization("test-org-2")
        project2 = self.create_project(organization=org2)

        # Store transaction metric (should be counted by TRANSACTIONS measure)
        self.store_performance_metric(
            name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo", "decision": "keep"},
            minutes_before_now=30,
            value=1,
            project_id=project1.id,
            org_id=org1.id,
        )

        # Store span metric with is_segment=true (should NOT be counted by TRANSACTIONS measure)
        self.store_performance_metric(
            name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "bar", "decision": "keep", "is_segment": "true"},
            minutes_before_now=30,
            value=100,
            project_id=project2.id,
            org_id=org2.id,
        )

        found_orgs = []
        for orgs in GetActiveOrgs(max_orgs=10, measure=SamplingMeasure.TRANSACTIONS):
            found_orgs.extend(orgs)

        assert org1.id in found_orgs
        assert org2.id not in found_orgs

    def test_segments_measure_only_counts_segment_spans(self) -> None:
        """
        Test that SEGMENTS measure only counts SpanMRI with is_segment=true, not TransactionMRI.
        """
        org1 = self.create_organization("test-org-1")
        project1 = self.create_project(organization=org1)
        org2 = self.create_organization("test-org-2")
        project2 = self.create_project(organization=org2)

        # Store span metric with is_segment=true (should be counted by SEGMENTS measure)
        self.store_performance_metric(
            name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo", "decision": "keep", "is_segment": "true"},
            minutes_before_now=30,
            value=1,
            project_id=project1.id,
            org_id=org1.id,
        )

        # Store transaction metric (should NOT be counted by SEGMENTS measure)
        self.store_performance_metric(
            name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "bar", "decision": "keep"},
            minutes_before_now=30,
            value=100,
            project_id=project2.id,
            org_id=org2.id,
        )

        found_orgs = []
        for orgs in GetActiveOrgs(max_orgs=10, measure=SamplingMeasure.SEGMENTS):
            found_orgs.extend(orgs)

        assert org1.id in found_orgs
        assert org2.id not in found_orgs

    def test_segments_measure_excludes_non_segment_spans(self) -> None:
        """
        Test that SEGMENTS measure excludes SpanMRI without is_segment=true.
        """
        org1 = self.create_organization("test-org-1")
        project1 = self.create_project(organization=org1)
        org2 = self.create_organization("test-org-2")
        project2 = self.create_project(organization=org2)

        # Store span metric with is_segment=true (should be counted)
        self.store_performance_metric(
            name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo", "decision": "keep", "is_segment": "true"},
            minutes_before_now=30,
            value=1,
            project_id=project1.id,
            org_id=org1.id,
        )

        # Store span metric without is_segment (should NOT be counted)
        self.store_performance_metric(
            name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "bar", "decision": "keep"},
            minutes_before_now=30,
            value=100,
            project_id=project2.id,
            org_id=org2.id,
        )

        found_orgs = []
        for orgs in GetActiveOrgs(max_orgs=10, measure=SamplingMeasure.SEGMENTS):
            found_orgs.extend(orgs)

        assert org1.id in found_orgs
        assert org2.id not in found_orgs

    def test_transactions_measure_multiple_orgs(self) -> None:
        """
        Test GetActiveOrgs with TRANSACTIONS measure for multiple organizations.
        """
        created_org_ids = []
        for i in range(5):
            org = self.create_organization(f"tx-org-{i}")
            created_org_ids.append(org.id)
            project = self.create_project(organization=org)
            self.store_performance_metric(
                name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
                tags={"transaction": "tx", "decision": "keep"},
                minutes_before_now=30,
                value=1,
                project_id=project.id,
                org_id=org.id,
            )

        found_orgs = []
        for orgs in GetActiveOrgs(max_orgs=10, measure=SamplingMeasure.TRANSACTIONS):
            found_orgs.extend(orgs)

        for org_id in created_org_ids:
            assert org_id in found_orgs

    def test_segments_measure_multiple_orgs(self) -> None:
        """
        Test GetActiveOrgs with SEGMENTS measure for multiple organizations.
        """
        created_org_ids = []
        for i in range(5):
            org = self.create_organization(f"segment-org-{i}")
            created_org_ids.append(org.id)
            project = self.create_project(organization=org)
            self.store_performance_metric(
                name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
                tags={"transaction": "tx", "decision": "keep", "is_segment": "true"},
                minutes_before_now=30,
                value=1,
                project_id=project.id,
                org_id=org.id,
            )

        found_orgs = []
        for orgs in GetActiveOrgs(max_orgs=10, measure=SamplingMeasure.SEGMENTS):
            found_orgs.extend(orgs)

        for org_id in created_org_ids:
            assert org_id in found_orgs


@freeze_time(MOCK_DATETIME)
class TestGetActiveOrgsVolumesMeasureFiltering(BaseMetricsLayerTestCase, TestCase, SnubaTestCase):
    """
    Tests that TRANSACTIONS and SEGMENTS measures filter volumes correctly.
    Both measures should behave equivalently when the appropriate metrics are emitted.
    """

    @property
    def now(self):
        return MOCK_DATETIME

    def test_transactions_measure_volumes(self) -> None:
        """
        Test that GetActiveOrgsVolumes correctly queries TRANSACTIONS measure.
        """
        org = self.create_organization("test-org")
        project = self.create_project(organization=org)

        # Store transaction metrics
        self.store_performance_metric(
            name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo", "decision": "keep"},
            minutes_before_now=1,
            value=5,
            project_id=project.id,
            org_id=org.id,
        )
        self.store_performance_metric(
            name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo", "decision": "drop"},
            minutes_before_now=1,
            value=10,
            project_id=project.id,
            org_id=org.id,
        )

        # Store span metrics (should NOT be counted by TRANSACTIONS measure)
        self.store_performance_metric(
            name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "bar", "decision": "keep", "is_segment": "true"},
            minutes_before_now=1,
            value=100,
            project_id=project.id,
            org_id=org.id,
        )

        found_volumes = []
        for volumes in GetActiveOrgsVolumes(max_orgs=10, measure=SamplingMeasure.TRANSACTIONS):
            found_volumes.extend(volumes)

        # Should only find the transaction metrics
        assert len(found_volumes) == 1
        assert found_volumes[0].org_id == org.id
        assert found_volumes[0].total == 15  # 5 + 10
        assert found_volumes[0].indexed == 5  # only keep

    def test_segments_measure_volumes(self) -> None:
        """
        Test that GetActiveOrgsVolumes correctly queries SEGMENTS measure.
        """
        org = self.create_organization("test-org")
        project = self.create_project(organization=org)

        # Store span metrics with is_segment=true
        self.store_performance_metric(
            name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo", "decision": "keep", "is_segment": "true"},
            minutes_before_now=1,
            value=5,
            project_id=project.id,
            org_id=org.id,
        )
        self.store_performance_metric(
            name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo", "decision": "drop", "is_segment": "true"},
            minutes_before_now=1,
            value=10,
            project_id=project.id,
            org_id=org.id,
        )

        # Store transaction metrics (should NOT be counted by SEGMENTS measure)
        self.store_performance_metric(
            name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "bar", "decision": "keep"},
            minutes_before_now=1,
            value=100,
            project_id=project.id,
            org_id=org.id,
        )

        found_volumes = []
        for volumes in GetActiveOrgsVolumes(max_orgs=10, measure=SamplingMeasure.SEGMENTS):
            found_volumes.extend(volumes)

        # Should only find the is_segment=true span metrics
        assert len(found_volumes) == 1
        assert found_volumes[0].org_id == org.id
        assert found_volumes[0].total == 15  # 5 + 10
        assert found_volumes[0].indexed == 5  # only keep

    def test_segments_measure_excludes_non_segment_spans(self) -> None:
        """
        Test that non-segment spans are excluded from SEGMENTS volume calculation.
        """
        org = self.create_organization("test-org")
        project = self.create_project(organization=org)

        # Only store non-segment spans
        self.store_performance_metric(
            name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo", "decision": "keep"},
            minutes_before_now=1,
            value=100,
            project_id=project.id,
            org_id=org.id,
        )

        found_volumes = []
        for volumes in GetActiveOrgsVolumes(max_orgs=10, measure=SamplingMeasure.SEGMENTS):
            found_volumes.extend(volumes)

        # Should find no volumes since there are no is_segment=true spans
        assert len(found_volumes) == 0

    def test_transactions_measure_excludes_span_metrics(self) -> None:
        """
        Test that span metrics are excluded from TRANSACTIONS volume calculation.
        """
        org = self.create_organization("test-org")
        project = self.create_project(organization=org)

        # Only store span metrics (even with is_segment=true)
        self.store_performance_metric(
            name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo", "decision": "keep", "is_segment": "true"},
            minutes_before_now=1,
            value=100,
            project_id=project.id,
            org_id=org.id,
        )

        found_volumes = []
        for volumes in GetActiveOrgsVolumes(max_orgs=10, measure=SamplingMeasure.TRANSACTIONS):
            found_volumes.extend(volumes)

        # Should find no volumes since there are no transaction metrics
        assert len(found_volumes) == 0
