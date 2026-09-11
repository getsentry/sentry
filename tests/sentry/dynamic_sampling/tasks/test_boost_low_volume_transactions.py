from datetime import timedelta
from unittest.mock import patch

from django.utils import timezone

from sentry.dynamic_sampling.tasks.boost_low_volume_transactions import (
    FetchProjectTransactionVolumes,
)
from sentry.dynamic_sampling.tasks.common import MEASURE_CONFIGS
from sentry.dynamic_sampling.types import SamplingMeasure
from sentry.sentry_metrics import indexer
from sentry.snuba.metrics.naming_layer.mri import SpanMRI
from sentry.testutils.cases import BaseMetricsLayerTestCase, SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import freeze_time

MOCK_DATETIME = (timezone.now() - timedelta(days=1)).replace(
    hour=0, minute=0, second=0, microsecond=0
)


@freeze_time(MOCK_DATETIME)
class FetchProjectTransactionVolumesTest(BaseMetricsLayerTestCase, TestCase, SnubaTestCase):
    @property
    def now(self):
        return MOCK_DATETIME

    def setUp(self) -> None:
        super().setUp()
        self.orgs_info = []
        num_orgs = 3
        num_proj_per_org = 3
        for org_idx in range(num_orgs):
            org = self.create_organization(f"test-org{org_idx}")
            org_info = {"org_id": org.id, "project_ids": []}
            self.orgs_info.append(org_info)
            for proj_idx in range(num_proj_per_org):
                p = self.create_project(organization=org)
                org_info["project_ids"].append(p.id)
                # create 5 transaction types
                for name in ["ts1", "ts2", "tm3", "tl4", "tl5"]:
                    # make up some unique count
                    idx = org_idx * num_orgs + proj_idx
                    num_transactions = self.get_count_for_transaction(idx, name)
                    self.store_performance_metric(
                        name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
                        tags={"transaction": name, "is_segment": "true"},
                        minutes_before_now=30,
                        value=num_transactions,
                        project_id=p.id,
                        org_id=org.id,
                    )
        self.org_ids = [org["org_id"] for org in self.orgs_info]

    def get_count_for_transaction(self, idx: int, name: str):
        """
        Create some known count based on transaction name and the order (based on org and project)
        """
        counts = {
            "ts1": 1,
            "ts2": 100,
            "tm3": 1000,
            "tl4": 2000,
            "tl5": 3000,
        }
        return idx + counts[name]

    def test_fetch_transactions_with_total_volumes_large(self) -> None:
        """
        Create some transactions in some orgs and project and verify
        that they are correctly returned by fetch_transactions_with_total_volumes
        """

        # get the transaction counts from snuba and check that they match what we put in
        orgs = self.org_ids

        expected_names = {"tm3", "tl5", "tl4"}
        for idx, p_tran in enumerate(FetchProjectTransactionVolumes(orgs, 3)):
            if p_tran is not None:
                assert len(p_tran["transaction_counts"]) == 3
                for name, count in p_tran["transaction_counts"]:
                    assert name in expected_names
                    assert count == self.get_count_for_transaction(idx, name)

    def test_fetch_project_transaction_volumes_uses_segment_metric_by_default(self) -> None:
        """
        Verify that FetchProjectTransactionVolumes uses the span count per root metric
        with is_segment tag by default (measure=SEGMENTS).
        """
        orgs = self.org_ids
        fetcher = FetchProjectTransactionVolumes(orgs, max_transactions=3)

        expected_metric_id = indexer.resolve_shared_org(str(SpanMRI.COUNT_PER_ROOT_PROJECT.value))
        assert fetcher.metric_id == expected_metric_id
        assert fetcher.measure == SamplingMeasure.SEGMENTS
        assert fetcher.tag_filters == MEASURE_CONFIGS[SamplingMeasure.SEGMENTS]["tags"]

    def test_fetch_project_transaction_volumes_uses_segment_metric_when_enabled(self) -> None:
        """
        Verify that FetchProjectTransactionVolumes uses the span count per root metric
        with is_segment tag when measure=SEGMENTS.
        """
        orgs = self.org_ids
        fetcher = FetchProjectTransactionVolumes(
            orgs, max_transactions=3, measure=SamplingMeasure.SEGMENTS
        )

        expected_metric_id = indexer.resolve_shared_org(str(SpanMRI.COUNT_PER_ROOT_PROJECT.value))
        assert fetcher.metric_id == expected_metric_id
        assert fetcher.measure == SamplingMeasure.SEGMENTS
        assert fetcher.tag_filters == MEASURE_CONFIGS[SamplingMeasure.SEGMENTS]["tags"]

    @patch("sentry.dynamic_sampling.tasks.boost_low_volume_transactions.raw_snql_query")
    def test_fetch_project_transaction_volumes_query_includes_is_segment_filter_for_segments(
        self, mock_raw_snql_query
    ) -> None:
        """
        Verify that the query sent to Snuba includes the is_segment=true filter for SEGMENTS measure.
        """
        mock_raw_snql_query.return_value = {"data": []}

        orgs = self.org_ids
        fetcher = FetchProjectTransactionVolumes(
            orgs, max_transactions=3, measure=SamplingMeasure.SEGMENTS
        )
        try:
            next(fetcher)
        except StopIteration:
            pass

        assert mock_raw_snql_query.called
        call_args = mock_raw_snql_query.call_args
        request = call_args[0][0]

        query_str = str(request.query)
        is_segment_id = indexer.resolve_shared_org("is_segment")
        assert f"tags_raw[{is_segment_id}]" in query_str
        assert "'true'" in query_str
