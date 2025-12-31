from unittest import mock
from uuid import uuid4

from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import (
    TraceItemColumnValues,
    TraceItemTableResponse,
)
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeValue

from sentry.issues.related.trace_connected import (
    _trace_connected_issues_eap,
    trace_connected_issues,
)
from sentry.search.eap.occurrences.rollout_utils import EAPOccurrencesComparator
from sentry.testutils.cases import TestCase


class TraceConnectedIssuesTest(TestCase):
    @mock.patch("sentry.snuba.rpc_dataset_common.snuba_rpc.table_rpc")
    def test_eap_returns_group_ids(self, mock_table_rpc: mock.MagicMock) -> None:
        organization = self.create_organization()
        project = self.create_project(organization=organization)

        mock_response = TraceItemTableResponse(
            column_values=[
                TraceItemColumnValues(
                    attribute_name="group_id",
                    results=[
                        AttributeValue(val_int=100),
                        AttributeValue(val_int=200),
                        AttributeValue(val_int=300),
                    ],
                ),
                TraceItemColumnValues(
                    attribute_name="count()",
                    results=[
                        AttributeValue(val_double=5.0),
                        AttributeValue(val_double=3.0),
                        AttributeValue(val_double=1.0),
                    ],
                ),
            ]
        )
        mock_table_rpc.return_value = [mock_response]

        result = _trace_connected_issues_eap(
            trace_id=uuid4().hex,
            organization=organization,
            projects=[project],
            exclude_group_id=200,  # Should be excluded
        )

        # Should return unique group_ids excluding the specified one
        assert result == {100, 300}
        mock_table_rpc.assert_called_once()

    @mock.patch("sentry.snuba.rpc_dataset_common.snuba_rpc.table_rpc")
    def test_eap_returns_empty_on_empty_response(self, mock_table_rpc: mock.MagicMock) -> None:
        organization = self.create_organization()
        project = self.create_project(organization=organization)

        mock_response = TraceItemTableResponse(column_values=[])
        mock_table_rpc.return_value = [mock_response]

        result = _trace_connected_issues_eap(
            trace_id=uuid4().hex,
            organization=organization,
            projects=[project],
            exclude_group_id=1,
        )

        assert result == set()

    @mock.patch("sentry.snuba.rpc_dataset_common.snuba_rpc.table_rpc")
    def test_eap_returns_empty_on_exception(self, mock_table_rpc: mock.MagicMock) -> None:
        organization = self.create_organization()
        project = self.create_project(organization=organization)

        mock_table_rpc.side_effect = Exception("RPC failed")

        result = _trace_connected_issues_eap(
            trace_id=uuid4().hex,
            organization=organization,
            projects=[project],
            exclude_group_id=1,
        )

        assert result == set()

    @mock.patch("sentry.issues.related.trace_connected._trace_connected_issues_eap")
    @mock.patch("sentry.issues.related.trace_connected._trace_connected_issues_snuba")
    def test_uses_snuba_as_source_of_truth(
        self,
        mock_snuba: mock.MagicMock,
        mock_eap: mock.MagicMock,
    ) -> None:
        organization = self.create_organization()
        project = self.create_project(organization=organization)
        group = self.create_group(project=project)

        # Create a mock event with trace_id
        event = mock.MagicMock()
        event.event_id = uuid4().hex
        event.trace_id = uuid4().hex
        event.group = group
        event.group.id = group.id
        event.group.project.organization_id = organization.id

        mock_snuba.return_value = {100, 200, 300}
        mock_eap.return_value = {100, 200}

        with self.options({EAPOccurrencesComparator._should_eval_option_name(): True}):
            result, meta = trace_connected_issues(event)

        assert set(result) == {100, 200, 300}
        assert meta["trace_id"] == event.trace_id
        mock_snuba.assert_called_once()
        mock_eap.assert_called_once()

    @mock.patch("sentry.issues.related.trace_connected._trace_connected_issues_eap")
    @mock.patch("sentry.issues.related.trace_connected._trace_connected_issues_snuba")
    def test_uses_eap_as_source_of_truth(
        self,
        mock_snuba: mock.MagicMock,
        mock_eap: mock.MagicMock,
    ) -> None:
        organization = self.create_organization()
        project = self.create_project(organization=organization)
        group = self.create_group(project=project)

        # Create a mock event with trace_id
        event = mock.MagicMock()
        event.event_id = uuid4().hex
        event.trace_id = uuid4().hex
        event.group = group
        event.group.id = group.id
        event.group.project.organization_id = organization.id

        mock_snuba.return_value = {100, 200, 300}
        mock_eap.return_value = {100, 200}

        with self.options(
            {
                EAPOccurrencesComparator._should_eval_option_name(): True,
                EAPOccurrencesComparator._callsite_allowlist_option_name(): [
                    "issues.related.trace_connected_issues"
                ],
            }
        ):
            result, meta = trace_connected_issues(event)

        assert set(result) == {100, 200}
        assert meta["trace_id"] == event.trace_id
        mock_snuba.assert_called_once()
        mock_eap.assert_called_once()
