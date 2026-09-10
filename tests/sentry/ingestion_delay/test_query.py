from datetime import UTC, datetime
from unittest import mock

from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType

from sentry.ingestion_delay.query import (
    measure_delay_seconds,
)
from sentry.testutils.cases import TestCase


class MeasureDelaySecondsTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.project

    def _measure_delay_seconds(self):
        return measure_delay_seconds(
            organization_id=self.organization.id,
            item_type=TraceItemType.TRACE_ITEM_TYPE_SPAN,
            now=datetime.now(tz=UTC),
        )

    def _response(self, value: float):
        response = mock.MagicMock()
        result = mock.MagicMock()
        result.val_double = value
        response.column_values = [mock.MagicMock(results=[result])]
        return response

    @mock.patch("sentry.ingestion_delay.query.snuba_rpc.table_rpc")
    def test_returns_measured_value(self, mock_table_rpc) -> None:
        mock_table_rpc.return_value = [self._response(42.5)]
        assert self._measure_delay_seconds() == 42.5

    @mock.patch("sentry.ingestion_delay.query.snuba_rpc.table_rpc")
    def test_no_result_returns_none(self, mock_table_rpc) -> None:
        mock_table_rpc.return_value = [self._response(0.0)]  # no result comes back as 0.0
        assert self._measure_delay_seconds() is None

    @mock.patch("sentry.ingestion_delay.query.snuba_rpc.table_rpc")
    def test_empty_response_returns_none(self, mock_table_rpc) -> None:
        mock_table_rpc.return_value = []
        assert self._measure_delay_seconds() is None

    @mock.patch("sentry.ingestion_delay.query.snuba_rpc.table_rpc")
    def test_measures_all_projects_in_organization(self, mock_table_rpc) -> None:
        other = self.create_project(organization=self.organization)
        mock_table_rpc.return_value = [self._response(1.0)]
        self._measure_delay_seconds()
        request = mock_table_rpc.call_args[0][0][0]
        assert set(request.meta.project_ids) == {self.project.id, other.id}

    @mock.patch("sentry.ingestion_delay.query.snuba_rpc.table_rpc")
    def test_query_failure_does_not_propagate(self, mock_table_rpc) -> None:
        mock_table_rpc.side_effect = Exception("snuba is down")
        assert self._measure_delay_seconds() is None
