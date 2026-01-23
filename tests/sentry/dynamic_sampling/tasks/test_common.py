from datetime import timedelta

import pytest
from django.utils import timezone

from sentry.dynamic_sampling.tasks.common import (
    GetActiveOrgs,
    GetActiveOrgsVolumes,
    OrganizationDataVolume,
    get_organization_volume,
)
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
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

    def test_get_active_orgs_uses_transaction_metric_by_default(self) -> None:
        """
        Verify that GetActiveOrgs uses the transaction count per root metric
        by default (when use_span_metric=False).
        """
        fetcher = GetActiveOrgs(max_orgs=3, use_span_metric=False)

        expected_metric_id = indexer.resolve_shared_org(
            str(TransactionMRI.COUNT_PER_ROOT_PROJECT.value)
        )
        assert fetcher.metric_id == expected_metric_id
        assert fetcher.use_span_metric is False
        assert fetcher.is_segment_tag is None
        assert fetcher.use_case_id == UseCaseID.TRANSACTIONS

    def test_get_active_orgs_uses_span_metric_when_enabled(self) -> None:
        """
        Verify that GetActiveOrgs uses the span count per root metric
        with is_segment tag when use_span_metric=True.
        """
        fetcher = GetActiveOrgs(max_orgs=3, use_span_metric=True)

        expected_metric_id = indexer.resolve_shared_org(str(SpanMRI.COUNT_PER_ROOT_PROJECT.value))
        assert fetcher.metric_id == expected_metric_id
        assert fetcher.use_span_metric is True
        assert fetcher.use_case_id == UseCaseID.SPANS

        is_segment_string_id = indexer.resolve_shared_org("is_segment")
        expected_is_segment_tag = f"tags_raw[{is_segment_string_id}]"
        assert fetcher.is_segment_tag == expected_is_segment_tag


@freeze_time(MOCK_DATETIME)
class TestGetActiveOrgsWithSpanMetrics(BaseMetricsLayerTestCase, TestCase, SnubaTestCase):
    """
    Test GetActiveOrgs with both transaction and span metrics to verify
    the correct metric is queried based on use_span_metric flag.
    """

    @property
    def now(self):
        return MOCK_DATETIME

    def test_get_active_orgs_returns_orgs_with_transaction_metrics(self) -> None:
        """
        Verify that GetActiveOrgs with use_span_metric=False returns orgs
        that have transaction metrics.
        """
        # Create org with only transaction metrics
        org_tx = self.create_organization("org-tx-only")
        project_tx = self.create_project(organization=org_tx)
        self.store_performance_metric(
            name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo", "decision": "keep"},
            minutes_before_now=30,
            value=10,
            project_id=project_tx.id,
            org_id=org_tx.id,
        )

        # Query with transaction metric (default)
        orgs_found = []
        for orgs in GetActiveOrgs(max_orgs=10, use_span_metric=False):
            orgs_found.extend(orgs)

        assert org_tx.id in orgs_found

    def test_get_active_orgs_returns_orgs_with_span_metrics(self) -> None:
        """
        Verify that GetActiveOrgs with use_span_metric=True returns orgs
        that have span metrics with is_segment=true.
        """
        # Create org with span metrics (is_segment=true)
        org_span = self.create_organization("org-span-only")
        project_span = self.create_project(organization=org_span)
        self.store_performance_metric(
            name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "bar", "decision": "keep", "is_segment": "true"},
            minutes_before_now=30,
            value=10,
            project_id=project_span.id,
            org_id=org_span.id,
        )

        # Query with span metric
        orgs_found = []
        for orgs in GetActiveOrgs(max_orgs=10, use_span_metric=True):
            orgs_found.extend(orgs)

        assert org_span.id in orgs_found

    def test_get_active_orgs_with_span_metric_ignores_non_segment_spans(self) -> None:
        """
        Verify that GetActiveOrgs with use_span_metric=True only counts
        spans with is_segment=true, ignoring non-segment spans.
        """
        # Create org with only non-segment span metrics
        org_non_segment = self.create_organization("org-non-segment")
        project_non_segment = self.create_project(organization=org_non_segment)
        self.store_performance_metric(
            name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "baz", "decision": "keep", "is_segment": "false"},
            minutes_before_now=30,
            value=10,
            project_id=project_non_segment.id,
            org_id=org_non_segment.id,
        )

        # Query with span metric - should not find this org
        orgs_found = []
        for orgs in GetActiveOrgs(max_orgs=10, use_span_metric=True):
            orgs_found.extend(orgs)

        assert org_non_segment.id not in orgs_found

    def test_get_active_orgs_transaction_and_span_metrics_separate(self) -> None:
        """
        Verify that orgs with only transaction metrics are found by transaction query
        and orgs with only span metrics are found by span query.
        """
        # Create org with only transaction metrics
        org_tx = self.create_organization("org-tx")
        project_tx = self.create_project(organization=org_tx)
        self.store_performance_metric(
            name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "tx", "decision": "keep"},
            minutes_before_now=30,
            value=5,
            project_id=project_tx.id,
            org_id=org_tx.id,
        )

        # Create org with only span metrics (is_segment=true)
        org_span = self.create_organization("org-span")
        project_span = self.create_project(organization=org_span)
        self.store_performance_metric(
            name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "span", "decision": "keep", "is_segment": "true"},
            minutes_before_now=30,
            value=5,
            project_id=project_span.id,
            org_id=org_span.id,
        )

        # Query with transaction metric
        tx_orgs_found = []
        for orgs in GetActiveOrgs(max_orgs=10, use_span_metric=False):
            tx_orgs_found.extend(orgs)

        # Query with span metric
        span_orgs_found = []
        for orgs in GetActiveOrgs(max_orgs=10, use_span_metric=True):
            span_orgs_found.extend(orgs)

        # Transaction query finds tx org, not span org
        assert org_tx.id in tx_orgs_found
        assert org_span.id not in tx_orgs_found

        # Span query finds span org, not tx org
        assert org_span.id in span_orgs_found
        assert org_tx.id not in span_orgs_found


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

    def test_get_active_orgs_volumes_uses_transaction_metric_by_default(self) -> None:
        """
        Verify that GetActiveOrgsVolumes uses the transaction count per root metric
        by default (when use_span_metric=False).
        """
        fetcher = GetActiveOrgsVolumes(max_orgs=3, use_span_metric=False)

        expected_metric_id = indexer.resolve_shared_org(
            str(TransactionMRI.COUNT_PER_ROOT_PROJECT.value)
        )
        assert fetcher.metric_id == expected_metric_id
        assert fetcher.use_span_metric is False
        assert fetcher.is_segment_tag is None
        assert fetcher.use_case_id == UseCaseID.TRANSACTIONS

    def test_get_active_orgs_volumes_uses_span_metric_when_enabled(self) -> None:
        """
        Verify that GetActiveOrgsVolumes uses the span count per root metric
        with is_segment tag when use_span_metric=True.
        """
        fetcher = GetActiveOrgsVolumes(max_orgs=3, use_span_metric=True)

        expected_metric_id = indexer.resolve_shared_org(str(SpanMRI.COUNT_PER_ROOT_PROJECT.value))
        assert fetcher.metric_id == expected_metric_id
        assert fetcher.use_span_metric is True
        assert fetcher.use_case_id == UseCaseID.SPANS

        is_segment_string_id = indexer.resolve_shared_org("is_segment")
        expected_is_segment_tag = f"tags_raw[{is_segment_string_id}]"
        assert fetcher.is_segment_tag == expected_is_segment_tag


@freeze_time(MOCK_DATETIME)
class TestGetActiveOrgsVolumesWithSpanMetrics(BaseMetricsLayerTestCase, TestCase, SnubaTestCase):
    """
    Test GetActiveOrgsVolumes with both transaction and span metrics to verify
    the correct metric is queried based on use_span_metric flag.
    """

    @property
    def now(self):
        return MOCK_DATETIME

    def test_get_active_orgs_volumes_returns_correct_volumes_for_transaction_metrics(self) -> None:
        """
        Verify that GetActiveOrgsVolumes with use_span_metric=False returns
        correct volumes from transaction metrics.
        """
        org = self.create_organization("org-tx-volumes")
        project = self.create_project(organization=org)

        # Store transaction metrics: 5 keep, 10 drop = 15 total
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

        # Query with transaction metric
        volumes = []
        for batch in GetActiveOrgsVolumes(max_orgs=10, orgs=[org.id], use_span_metric=False):
            volumes.extend(batch)

        assert len(volumes) == 1
        assert volumes[0].org_id == org.id
        assert volumes[0].total == 15
        assert volumes[0].indexed == 5

    def test_get_active_orgs_volumes_returns_correct_volumes_for_span_metrics(self) -> None:
        """
        Verify that GetActiveOrgsVolumes with use_span_metric=True returns
        correct volumes from span metrics with is_segment=true.
        """
        org = self.create_organization("org-span-volumes")
        project = self.create_project(organization=org)

        # Store span metrics with is_segment=true: 8 keep, 12 drop = 20 total
        self.store_performance_metric(
            name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "bar", "decision": "keep", "is_segment": "true"},
            minutes_before_now=1,
            value=8,
            project_id=project.id,
            org_id=org.id,
        )
        self.store_performance_metric(
            name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "bar", "decision": "drop", "is_segment": "true"},
            minutes_before_now=1,
            value=12,
            project_id=project.id,
            org_id=org.id,
        )

        # Query with span metric
        volumes = []
        for batch in GetActiveOrgsVolumes(max_orgs=10, orgs=[org.id], use_span_metric=True):
            volumes.extend(batch)

        assert len(volumes) == 1
        assert volumes[0].org_id == org.id
        assert volumes[0].total == 20
        assert volumes[0].indexed == 8

    def test_get_active_orgs_volumes_with_span_metric_ignores_non_segment_spans(self) -> None:
        """
        Verify that GetActiveOrgsVolumes with use_span_metric=True only counts
        spans with is_segment=true, ignoring non-segment spans.
        """
        org = self.create_organization("org-mixed-segments")
        project = self.create_project(organization=org)

        # Store span metrics with is_segment=true: 3 keep
        self.store_performance_metric(
            name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "seg", "decision": "keep", "is_segment": "true"},
            minutes_before_now=1,
            value=3,
            project_id=project.id,
            org_id=org.id,
        )
        # Store span metrics with is_segment=false: 100 keep (should be ignored)
        self.store_performance_metric(
            name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "non-seg", "decision": "keep", "is_segment": "false"},
            minutes_before_now=1,
            value=100,
            project_id=project.id,
            org_id=org.id,
        )

        # Query with span metric
        volumes = []
        for batch in GetActiveOrgsVolumes(max_orgs=10, orgs=[org.id], use_span_metric=True):
            volumes.extend(batch)

        assert len(volumes) == 1
        assert volumes[0].org_id == org.id
        # Only the is_segment=true spans should be counted
        assert volumes[0].total == 3
        assert volumes[0].indexed == 3

    def test_get_active_orgs_volumes_transaction_vs_span_metrics_separate(self) -> None:
        """
        Verify that transaction and span metrics return different volumes
        for the same org when both are present.
        """
        org = self.create_organization("org-both-metrics")
        project = self.create_project(organization=org)

        # Store transaction metrics: 10 keep, 20 drop = 30 total
        self.store_performance_metric(
            name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "tx", "decision": "keep"},
            minutes_before_now=1,
            value=10,
            project_id=project.id,
            org_id=org.id,
        )
        self.store_performance_metric(
            name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "tx", "decision": "drop"},
            minutes_before_now=1,
            value=20,
            project_id=project.id,
            org_id=org.id,
        )

        # Store span metrics with is_segment=true: 5 keep, 15 drop = 20 total
        self.store_performance_metric(
            name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "span", "decision": "keep", "is_segment": "true"},
            minutes_before_now=1,
            value=5,
            project_id=project.id,
            org_id=org.id,
        )
        self.store_performance_metric(
            name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "span", "decision": "drop", "is_segment": "true"},
            minutes_before_now=1,
            value=15,
            project_id=project.id,
            org_id=org.id,
        )

        # Query with transaction metric
        tx_volumes = []
        for batch in GetActiveOrgsVolumes(max_orgs=10, orgs=[org.id], use_span_metric=False):
            tx_volumes.extend(batch)

        # Query with span metric
        span_volumes = []
        for batch in GetActiveOrgsVolumes(max_orgs=10, orgs=[org.id], use_span_metric=True):
            span_volumes.extend(batch)

        # Transaction query returns transaction volumes
        assert len(tx_volumes) == 1
        assert tx_volumes[0].total == 30
        assert tx_volumes[0].indexed == 10

        # Span query returns span volumes
        assert len(span_volumes) == 1
        assert span_volumes[0].total == 20
        assert span_volumes[0].indexed == 5
