from datetime import datetime, timedelta, timezone
from typing import Tuple

from freezegun import freeze_time

from sentry.dynamic_sampling.recalibrate_transactions import fetch_org_volumes
from sentry.dynamic_sampling.snuba_utils import get_active_orgs
from sentry.snuba.metrics import TransactionMRI
from sentry.testutils import BaseMetricsLayerTestCase, SnubaTestCase, TestCase

now = datetime.now()
MOCK_DATETIME = datetime(now.year, now.month, 15, 0, 0, 0, tzinfo=timezone.utc)


@freeze_time(MOCK_DATETIME)
class FetchOrgVolumesSnubaQueryTest(BaseMetricsLayerTestCase, TestCase, SnubaTestCase):
    @property
    def now(self):
        return MOCK_DATETIME

    def setUp(self):
        super().setUp()
        self.orgs_info = []
        self.num_orgs = 3
        self.num_proj = 2
        self.num_trans = 2
        # create some orgs, projects and transactions
        for org_idx in range(self.num_orgs):
            org = self.create_organization(f"test-org{org_idx}")
            org_info = {"org_id": org.id, "project_ids": []}
            self.orgs_info.append(org_info)
            for proj_idx in range(self.num_proj):
                p = self.create_project(organization=org)
                org_info["project_ids"].append(p.id)
                for name_idx in range(1, self.num_trans + 1):
                    # make up some unique count
                    count_transactions_keep = name_idx + proj_idx * 10
                    count_transactions_drop = count_transactions_keep + org_idx * 100

                    self.store_performance_metric(
                        name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
                        tags={"transaction": f"t-{name_idx}", "decision": "drop"},
                        minutes_before_now=2,
                        value=count_transactions_drop,
                        project_id=p.id,
                        org_id=org.id,
                    )
                    self.store_performance_metric(
                        name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
                        tags={"transaction": f"t-{name_idx}", "decision": "keep"},
                        minutes_before_now=2,
                        value=count_transactions_keep,
                        project_id=p.id,
                        org_id=org.id,
                    )
        self.org_ids = [org["org_id"] for org in self.orgs_info]

    def get_counts_for_org(self, org_id: int) -> Tuple[int, int]:
        for org_idx, cur_org_id in enumerate(self.org_ids):
            if cur_org_id == org_id:
                break
        else:
            raise ValueError("Invalid organisation passed")

        trans = self.num_trans
        projs = self.num_proj

        # calculate how many transactions we created in the setup for this org
        total_keep = int(trans * (trans + 1) / 2) * projs + 10 * (projs - 1) * trans
        total_drop = total_keep + 100 * org_idx * trans * projs

        return total_drop + total_keep, total_keep

    def test_fetch_org_volumes(self):
        org_counts = fetch_org_volumes(self.org_ids, timedelta(minutes=5))

        for actual_counts in org_counts:
            current_org = actual_counts.org_id
            expected_total, expected_keep = self.get_counts_for_org(current_org)

            assert actual_counts.total == expected_total
            assert actual_counts.indexed == expected_keep

    def test_get_active_orgs(self):
        all_orgs = []
        for orgs in get_active_orgs(2, time_interval=timedelta(minutes=5)):
            all_orgs += orgs

        # test we return the expected number of unique orgs
        assert len(set(all_orgs)) == len(self.org_ids)

        for org in self.org_ids:
            assert org in self.org_ids
