from unittest.mock import MagicMock, patch

import pytest
from sentry_protos.snuba.v1.endpoint_delete_trace_items_pb2 import DeleteTraceItemsResponse
from sentry_protos.snuba.v1.request_common_pb2 import ResponseMeta, TraceItemType

from sentry.deletions.tasks.nodestore import delete_events_from_eap
from sentry.eventstream.eap import delete_groups_from_eap_rpc
from sentry.snuba.dataset import Dataset
from sentry.testutils.cases import TestCase
from sentry.utils.snuba_rpc import SnubaRPCRateLimitExceeded


class TestEAPDeletion(TestCase):
    def setUp(self) -> None:
        self.organization_id = 1
        self.project_id = 123
        self.group_ids = [1, 2, 3]

    @patch("sentry.eventstream.eap.snuba_rpc.delete_trace_items_rpc")
    def test_deletion_with_error_dataset(self, mock_rpc: MagicMock) -> None:
        mock_rpc.return_value = DeleteTraceItemsResponse(
            meta=ResponseMeta(),
            matching_items_count=150,
        )

        delete_events_from_eap(
            self.organization_id, self.project_id, self.group_ids, Dataset.Events
        )
        assert mock_rpc.call_count == 1

        request = mock_rpc.call_args[0][0]
        assert request.meta.organization_id == self.organization_id
        assert request.meta.project_ids == [self.project_id]
        assert request.meta.referrer == "deletions.group.eap"
        assert request.meta.cogs_category == "deletions"
        assert request.meta.trace_item_type == TraceItemType.TRACE_ITEM_TYPE_OCCURRENCE

        assert len(request.filters) == 1
        assert request.filters[0].item_type == TraceItemType.TRACE_ITEM_TYPE_OCCURRENCE
        assert request.filters[0].filter.HasField("comparison_filter")
        assert request.filters[0].filter.comparison_filter.key.name == "group_id"
        assert (
            list(request.filters[0].filter.comparison_filter.value.val_int_array.values)
            == self.group_ids
        )

    @patch("sentry.eventstream.eap.snuba_rpc.delete_trace_items_rpc")
    def test_multiple_group_ids(self, mock_rpc: MagicMock) -> None:
        mock_rpc.return_value = DeleteTraceItemsResponse(
            meta=ResponseMeta(),
            matching_items_count=500,
        )

        many_group_ids = [10, 20, 30, 40, 50]

        delete_events_from_eap(
            self.organization_id, self.project_id, many_group_ids, Dataset.Events
        )

        request = mock_rpc.call_args[0][0]
        group_filter = request.filters[0].filter
        assert group_filter.HasField("comparison_filter")
        assert group_filter.comparison_filter.key.name == "group_id"
        assert list(group_filter.comparison_filter.value.val_int_array.values) == many_group_ids

    @patch("sentry.eventstream.eap.snuba_rpc.delete_trace_items_rpc")
    def test_eap_deletion_disabled_skips_deletion(self, mock_rpc: MagicMock) -> None:
        with self.options({"eventstream.eap.deletion-enabled": False}):
            delete_events_from_eap(
                self.organization_id, self.project_id, self.group_ids, Dataset.Events
            )

        mock_rpc.assert_not_called()

    def test_empty_group_ids_raises_error(self) -> None:
        with pytest.raises(ValueError, match="group_ids must not be empty"):
            delete_groups_from_eap_rpc(
                organization_id=self.organization_id,
                project_id=self.project_id,
                group_ids=[],
            )

    @patch("sentry.eventstream.eap.snuba_rpc.delete_trace_items_rpc")
    def test_exception_does_not_propagate(self, mock_rpc: MagicMock) -> None:
        mock_rpc.side_effect = Exception("RPC connection failed")

        # Should not raise - exception should be caught
        try:
            delete_events_from_eap(
                self.organization_id, self.project_id, self.group_ids, Dataset.Events
            )
        except Exception:
            pytest.fail("Exception should have been caught and not propagated")

    @patch("sentry.deletions.tasks.nodestore.exponential_delay")
    @patch("sentry.eventstream.eap.snuba_rpc.delete_trace_items_rpc")
    def test_rate_limit_error_is_retried(self, mock_rpc: MagicMock, mock_delay: MagicMock) -> None:
        mock_rpc.side_effect = SnubaRPCRateLimitExceeded("rate limited")
        mock_delay.return_value = lambda _: 0

        delete_events_from_eap(
            self.organization_id, self.project_id, self.group_ids, Dataset.Events
        )

        assert mock_rpc.call_count == 5

    @patch("sentry.deletions.tasks.nodestore.exponential_delay")
    @patch("sentry.eventstream.eap.snuba_rpc.delete_trace_items_rpc")
    def test_rate_limit_succeeds_on_retry(self, mock_rpc: MagicMock, mock_delay: MagicMock) -> None:
        mock_rpc.side_effect = [
            SnubaRPCRateLimitExceeded("rate limited"),
            SnubaRPCRateLimitExceeded("rate limited"),
            DeleteTraceItemsResponse(meta=ResponseMeta(), matching_items_count=10),
        ]
        mock_delay.return_value = lambda _: 0

        delete_events_from_eap(
            self.organization_id, self.project_id, self.group_ids, Dataset.Events
        )

        assert mock_rpc.call_count == 3

    @patch("sentry.eventstream.eap.snuba_rpc.delete_trace_items_rpc")
    def test_non_rate_limit_error_not_retried(self, mock_rpc: MagicMock) -> None:
        mock_rpc.side_effect = Exception("Some other error")

        delete_events_from_eap(
            self.organization_id, self.project_id, self.group_ids, Dataset.Events
        )

        assert mock_rpc.call_count == 1
