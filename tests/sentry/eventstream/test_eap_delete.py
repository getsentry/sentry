from unittest.mock import patch

import pytest
from sentry_protos.snuba.v1.endpoint_delete_trace_items_pb2 import DeleteTraceItemsResponse
from sentry_protos.snuba.v1.request_common_pb2 import TRACE_ITEM_TYPE_OCCURRENCE, ResponseMeta

from sentry.deletions.tasks.nodestore import delete_events_from_eap
from sentry.eventstream.eap_delete import delete_groups_from_eap_rpc
from sentry.snuba.dataset import Dataset
from sentry.testutils.cases import TestCase


class TestEAPDeletion(TestCase):
    def setUp(self):
        self.organization_id = 1
        self.project_id = 123
        self.group_ids = [1, 2, 3]

    @patch("sentry.eventstream.eap_delete.snuba_rpc.rpc")
    def test_deletion_with_error_dataset(self, mock_rpc):
        mock_rpc.return_value = DeleteTraceItemsResponse(
            meta=ResponseMeta(),
            matching_items_count=150,
        )

        with self.options(
            {"eventstream.eap.deletion_enabled.organization_allowlist": [self.organization_id]}
        ):
            delete_events_from_eap(
                self.organization_id, self.project_id, self.group_ids, Dataset.Events
            )

        assert mock_rpc.call_count == 1

        request = mock_rpc.call_args[0][0]
        assert request.meta.organization_id == self.organization_id
        assert request.meta.project_ids == [self.project_id]
        assert request.meta.referrer == "deletions.group.eap"
        assert request.meta.cogs_category == "deletions"

        assert len(request.filters) == 1
        assert request.filters[0].item_type == TRACE_ITEM_TYPE_OCCURRENCE

    @patch("sentry.eventstream.eap_delete.snuba_rpc.rpc")
    def test_multiple_group_ids(self, mock_rpc):
        mock_rpc.return_value = DeleteTraceItemsResponse(
            meta=ResponseMeta(),
            matching_items_count=500,
        )

        many_group_ids = [10, 20, 30, 40, 50]

        with self.options(
            {"eventstream.eap.deletion_enabled.organization_allowlist": [self.organization_id]}
        ):
            delete_events_from_eap(
                self.organization_id, self.project_id, many_group_ids, Dataset.Events
            )

        request = mock_rpc.call_args[0][0]
        group_filter = request.filters[0].filter.and_filter.filters[1]
        assert list(group_filter.comparison_filter.value.val_int_array.values) == many_group_ids

    @patch("sentry.eventstream.eap_delete.snuba_rpc.rpc")
    def test_organization_not_in_allowlist_skips_deletion(self, mock_rpc):
        with self.options({"eventstream.eap.deletion_enabled.organization_allowlist": [456, 789]}):
            delete_events_from_eap(
                self.organization_id, self.project_id, self.group_ids, Dataset.Events
            )

        mock_rpc.assert_not_called()

    @patch("sentry.eventstream.eap_delete.snuba_rpc.rpc")
    def test_empty_allowlist_skips_deletion(self, mock_rpc):
        with self.options({"eventstream.eap.deletion_enabled.organization_allowlist": []}):
            delete_events_from_eap(
                self.organization_id, self.project_id, self.group_ids, Dataset.Events
            )

        mock_rpc.assert_not_called()

    def test_empty_group_ids_raises_error(self):
        with pytest.raises(ValueError, match="group_ids must not be empty"):
            delete_groups_from_eap_rpc(
                organization_id=self.organization_id,
                project_id=self.project_id,
                group_ids=[],
            )
