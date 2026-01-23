from sentry.dynamic_sampling.tasks.recalibrate_orgs import _partition_orgs_by_span_metric_option
from sentry.testutils.cases import TestCase


class TestPartitionOrgsBySpanMetricOption(TestCase):
    def test_partition_with_no_span_metric_orgs(self) -> None:
        """
        When no orgs are in the span-metric-orgs option, all should be in transaction_metric_orgs.
        """
        org1 = self.create_organization("test-org1")
        org2 = self.create_organization("test-org2")

        with self.options({"dynamic-sampling.recalibrate_orgs.span-metric-orgs": []}):
            span_orgs, transaction_orgs = _partition_orgs_by_span_metric_option([org1.id, org2.id])

            assert span_orgs == []
            assert set(transaction_orgs) == {org1.id, org2.id}

    def test_partition_with_all_span_metric_orgs(self) -> None:
        """
        When all orgs are in the span-metric-orgs option, all should be in span_metric_orgs.
        """
        org1 = self.create_organization("test-org1")
        org2 = self.create_organization("test-org2")

        with self.options(
            {"dynamic-sampling.recalibrate_orgs.span-metric-orgs": [org1.id, org2.id]}
        ):
            span_orgs, transaction_orgs = _partition_orgs_by_span_metric_option([org1.id, org2.id])

            assert set(span_orgs) == {org1.id, org2.id}
            assert transaction_orgs == []

    def test_partition_with_mixed_orgs(self) -> None:
        """
        When some orgs are in the span-metric-orgs option, they should be partitioned correctly.
        """
        org1 = self.create_organization("test-org1")
        org2 = self.create_organization("test-org2")
        org3 = self.create_organization("test-org3")

        with self.options({"dynamic-sampling.recalibrate_orgs.span-metric-orgs": [org2.id]}):
            span_orgs, transaction_orgs = _partition_orgs_by_span_metric_option(
                [org1.id, org2.id, org3.id]
            )

            assert span_orgs == [org2.id]
            assert set(transaction_orgs) == {org1.id, org3.id}

    def test_partition_with_empty_org_list(self) -> None:
        """
        When the org list is empty, both partitions should be empty.
        """
        with self.options({"dynamic-sampling.recalibrate_orgs.span-metric-orgs": [1, 2, 3]}):
            span_orgs, transaction_orgs = _partition_orgs_by_span_metric_option([])

            assert span_orgs == []
            assert transaction_orgs == []

    def test_partition_preserves_order(self) -> None:
        """
        The partition function should preserve the order of org IDs.
        """
        org1 = self.create_organization("test-org1")
        org2 = self.create_organization("test-org2")
        org3 = self.create_organization("test-org3")
        org4 = self.create_organization("test-org4")

        with self.options(
            {"dynamic-sampling.recalibrate_orgs.span-metric-orgs": [org2.id, org4.id]}
        ):
            span_orgs, transaction_orgs = _partition_orgs_by_span_metric_option(
                [org1.id, org2.id, org3.id, org4.id]
            )

            # Order should be preserved
            assert span_orgs == [org2.id, org4.id]
            assert transaction_orgs == [org1.id, org3.id]
