from typing import int
from datetime import timedelta

import pytest
from django.utils import timezone

from sentry.dynamic_sampling.tasks.common import (
    GetActiveOrgs,
    GetActiveOrgsVolumes,
    OrganizationDataVolume,
    get_organization_volume,
)
from sentry.snuba.metrics.naming_layer.mri import TransactionMRI
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
