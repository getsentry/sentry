from datetime import timedelta

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
        self.created_org_ids = []
        # create 10 orgs each with 10 transactions
        for i in range(10):
            org = self.create_organization(f"org-{i}")
            self.created_org_ids.append(org.id)
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
        all_returned_orgs = []
        for orgs in GetActiveOrgs(3):
            num_orgs = len(orgs)
            assert num_orgs <= 3  # each batch should respect max_orgs
            all_returned_orgs.extend(orgs)
        assert set(self.created_org_ids).issubset(set(all_returned_orgs))

    def test_get_active_orgs_with_max_projects(self) -> None:
        all_returned_orgs = []
        for orgs in GetActiveOrgs(3, 18):
            # max_orgs=3, max_projects=18 limits batch size
            num_orgs = len(orgs)
            all_returned_orgs.extend(orgs)
            assert num_orgs <= 3  # respects max_orgs cap
        assert set(self.created_org_ids).issubset(set(all_returned_orgs))


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
        expected_org_ids = {org.id for org in self.orgs}
        found_volumes = []
        for orgs in GetActiveOrgsVolumes(max_orgs=3):
            assert len(orgs) <= 3  # each batch should respect max_orgs
            found_volumes.extend(orgs)
        found_org_ids = {v.org_id for v in found_volumes}
        assert expected_org_ids.issubset(found_org_ids)
        # Verify our orgs have correct volumes
        for v in found_volumes:
            if v.org_id in expected_org_ids:
                assert v.total == 3
                assert v.indexed == 1

    def test_get_active_orgs_volumes(self) -> None:
        """
        gets active org volumes, with a batch size that is not a multiple
        of the number of elements in the DB
        """
        expected_org_ids = {org.id for org in self.orgs}
        found_volumes = []
        for orgs in GetActiveOrgsVolumes(max_orgs=5):
            assert len(orgs) <= 5  # each batch should respect max_orgs
            found_volumes.extend(orgs)
        found_org_ids = {v.org_id for v in found_volumes}
        assert expected_org_ids.issubset(found_org_ids)
        # Verify our orgs have correct volumes
        for v in found_volumes:
            if v.org_id in expected_org_ids:
                assert v.total == 3
                assert v.indexed == 1

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

    def setUp(self) -> None:
        # org with only TransactionMRI data
        self.tx_only_org = self.create_organization("tx-only-org")
        tx_project = self.create_project(organization=self.tx_only_org)
        self.store_performance_metric(
            name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo", "decision": "keep"},
            minutes_before_now=30,
            value=1,
            project_id=tx_project.id,
            org_id=self.tx_only_org.id,
        )

        # org with only SpanMRI is_segment=true data
        self.segment_only_org = self.create_organization("segment-only-org")
        seg_project = self.create_project(organization=self.segment_only_org)
        self.store_performance_metric(
            name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "bar", "decision": "keep", "is_segment": "true"},
            minutes_before_now=30,
            value=1,
            project_id=seg_project.id,
            org_id=self.segment_only_org.id,
        )

        # org with only non-segment SpanMRI data
        self.non_segment_span_org = self.create_organization("non-segment-span-org")
        ns_project = self.create_project(organization=self.non_segment_span_org)
        self.store_performance_metric(
            name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "baz", "decision": "keep"},
            minutes_before_now=30,
            value=100,
            project_id=ns_project.id,
            org_id=self.non_segment_span_org.id,
        )

        # Multiple orgs with TransactionMRI data
        self.tx_org_ids = []
        for i in range(5):
            org = self.create_organization(f"tx-org-{i}")
            self.tx_org_ids.append(org.id)
            project = self.create_project(organization=org)
            self.store_performance_metric(
                name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
                tags={"transaction": "tx", "decision": "keep"},
                minutes_before_now=30,
                value=1,
                project_id=project.id,
                org_id=org.id,
            )

        # Multiple orgs with SEGMENTS data
        self.segment_org_ids = []
        for i in range(5):
            org = self.create_organization(f"segment-org-{i}")
            self.segment_org_ids.append(org.id)
            project = self.create_project(organization=org)
            self.store_performance_metric(
                name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
                tags={"transaction": "tx", "decision": "keep", "is_segment": "true"},
                minutes_before_now=30,
                value=1,
                project_id=project.id,
                org_id=org.id,
            )

    @property
    def now(self):
        return MOCK_DATETIME

    def test_transactions_measure_only_counts_transaction_metrics(self) -> None:
        """
        Test that TRANSACTIONS measure only counts TransactionMRI metrics, not SpanMRI.
        """
        found_orgs = []
        for orgs in GetActiveOrgs(max_orgs=10, measure=SamplingMeasure.TRANSACTIONS):
            found_orgs.extend(orgs)

        assert self.tx_only_org.id in found_orgs
        assert self.segment_only_org.id not in found_orgs

    def test_segments_measure_only_counts_segment_spans(self) -> None:
        """
        Test that SEGMENTS measure only counts SpanMRI with is_segment=true, not TransactionMRI.
        """
        found_orgs = []
        for orgs in GetActiveOrgs(max_orgs=10, measure=SamplingMeasure.SEGMENTS):
            found_orgs.extend(orgs)

        assert self.segment_only_org.id in found_orgs
        assert self.tx_only_org.id not in found_orgs

    def test_segments_measure_excludes_non_segment_spans(self) -> None:
        """
        Test that SEGMENTS measure excludes SpanMRI without is_segment=true.
        """
        found_orgs = []
        for orgs in GetActiveOrgs(max_orgs=10, measure=SamplingMeasure.SEGMENTS):
            found_orgs.extend(orgs)

        assert self.segment_only_org.id in found_orgs
        assert self.non_segment_span_org.id not in found_orgs

    def test_transactions_measure_multiple_orgs(self) -> None:
        """
        Test GetActiveOrgs with TRANSACTIONS measure for multiple organizations.
        """
        found_orgs = []
        for orgs in GetActiveOrgs(max_orgs=10, measure=SamplingMeasure.TRANSACTIONS):
            found_orgs.extend(orgs)

        for org_id in self.tx_org_ids:
            assert org_id in found_orgs

    def test_segments_measure_multiple_orgs(self) -> None:
        """
        Test GetActiveOrgs with SEGMENTS measure for multiple organizations.
        """
        found_orgs = []
        for orgs in GetActiveOrgs(max_orgs=10, measure=SamplingMeasure.SEGMENTS):
            found_orgs.extend(orgs)

        for org_id in self.segment_org_ids:
            assert org_id in found_orgs


@freeze_time(MOCK_DATETIME)
class TestGetActiveOrgsVolumesMeasureFiltering(BaseMetricsLayerTestCase, TestCase, SnubaTestCase):
    """
    Tests that TRANSACTIONS and SEGMENTS measures filter volumes correctly.
    Both measures should behave equivalently when the appropriate metrics are emitted.
    """

    def setUp(self) -> None:
        # org with transaction metrics (keep=5, drop=10)
        self.tx_org = self.create_organization("tx-vol-org")
        tx_project = self.create_project(organization=self.tx_org)
        self.store_performance_metric(
            name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo", "decision": "keep"},
            minutes_before_now=1,
            value=5,
            project_id=tx_project.id,
            org_id=self.tx_org.id,
        )
        self.store_performance_metric(
            name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo", "decision": "drop"},
            minutes_before_now=1,
            value=10,
            project_id=tx_project.id,
            org_id=self.tx_org.id,
        )
        # Also store span metrics on tx_org (should NOT be counted by TRANSACTIONS measure)
        self.store_performance_metric(
            name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "bar", "decision": "keep", "is_segment": "true"},
            minutes_before_now=1,
            value=100,
            project_id=tx_project.id,
            org_id=self.tx_org.id,
        )

        # org with segment span metrics (keep=5, drop=10)
        self.seg_org = self.create_organization("seg-vol-org")
        seg_project = self.create_project(organization=self.seg_org)
        self.store_performance_metric(
            name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo", "decision": "keep", "is_segment": "true"},
            minutes_before_now=1,
            value=5,
            project_id=seg_project.id,
            org_id=self.seg_org.id,
        )
        self.store_performance_metric(
            name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo", "decision": "drop", "is_segment": "true"},
            minutes_before_now=1,
            value=10,
            project_id=seg_project.id,
            org_id=self.seg_org.id,
        )
        # Also store transaction metrics on seg_org (should NOT be counted by SEGMENTS measure)
        self.store_performance_metric(
            name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "bar", "decision": "keep"},
            minutes_before_now=1,
            value=100,
            project_id=seg_project.id,
            org_id=self.seg_org.id,
        )

        # org with only non-segment spans
        self.non_seg_org = self.create_organization("non-seg-vol-org")
        ns_project = self.create_project(organization=self.non_seg_org)
        self.store_performance_metric(
            name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo", "decision": "keep"},
            minutes_before_now=1,
            value=100,
            project_id=ns_project.id,
            org_id=self.non_seg_org.id,
        )

        # org with only segment span metrics (no transaction metrics)
        self.seg_only_org = self.create_organization("seg-only-vol-org")
        so_project = self.create_project(organization=self.seg_only_org)
        self.store_performance_metric(
            name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo", "decision": "keep", "is_segment": "true"},
            minutes_before_now=1,
            value=100,
            project_id=so_project.id,
            org_id=self.seg_only_org.id,
        )

    @property
    def now(self):
        return MOCK_DATETIME

    def test_transactions_measure_volumes(self) -> None:
        """
        Test that GetActiveOrgsVolumes correctly queries TRANSACTIONS measure.
        Scopes the query to our test orgs to avoid ClickHouse timing issues.
        """
        found_volumes = []
        for volumes in GetActiveOrgsVolumes(
            max_orgs=10,
            measure=SamplingMeasure.TRANSACTIONS,
            orgs=[self.tx_org.id],
        ):
            found_volumes.extend(volumes)

        assert len(found_volumes) == 1
        assert found_volumes[0].org_id == self.tx_org.id
        assert found_volumes[0].total == 15  # 5 + 10
        assert found_volumes[0].indexed == 5  # only keep

    def test_segments_measure_volumes(self) -> None:
        """
        Test that GetActiveOrgsVolumes correctly queries SEGMENTS measure.
        Scopes the query to our test orgs to avoid ClickHouse timing issues.
        """
        found_volumes = []
        for volumes in GetActiveOrgsVolumes(
            max_orgs=10,
            measure=SamplingMeasure.SEGMENTS,
            orgs=[self.seg_org.id],
        ):
            found_volumes.extend(volumes)

        assert len(found_volumes) == 1
        assert found_volumes[0].org_id == self.seg_org.id
        assert found_volumes[0].total == 15  # 5 + 10
        assert found_volumes[0].indexed == 5  # only keep

    def test_segments_measure_excludes_non_segment_spans(self) -> None:
        """
        Test that non-segment spans are excluded from SEGMENTS volume calculation.
        """
        found_volumes = []
        for volumes in GetActiveOrgsVolumes(
            max_orgs=10,
            measure=SamplingMeasure.SEGMENTS,
            orgs=[self.non_seg_org.id],
        ):
            found_volumes.extend(volumes)

        # Our non-segment org should not appear since there are no is_segment=true spans
        assert len(found_volumes) == 0

    def test_transactions_measure_excludes_span_metrics(self) -> None:
        """
        Test that span metrics are excluded from TRANSACTIONS volume calculation.
        """
        found_volumes = []
        for volumes in GetActiveOrgsVolumes(
            max_orgs=10,
            measure=SamplingMeasure.TRANSACTIONS,
            orgs=[self.seg_only_org.id],
        ):
            found_volumes.extend(volumes)

        # Our segment-only org should not appear since there are no transaction metrics for it
        assert len(found_volumes) == 0
