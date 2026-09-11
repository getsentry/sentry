from datetime import UTC, datetime
from unittest import mock

from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType

from sentry.ingestion_delay.query import (
    measure_delay_seconds,
)
from sentry.testutils.helpers.datetime import before_now
from tests.snuba.api.endpoints.test_organization_events import OrganizationEventsEndpointTestBase


class MeasureDelaySecondsTest(OrganizationEventsEndpointTestBase):
    def _measure_delay_seconds(self) -> float | None:
        return measure_delay_seconds(
            organization_id=self.organization.id,
            item_type=TraceItemType.TRACE_ITEM_TYPE_SPAN,
            now=datetime.now(tz=UTC),
        )

    def _response(self, value: float) -> mock.MagicMock:
        response = mock.MagicMock()
        result = mock.MagicMock()
        result.val_double = value
        response.column_values = [mock.MagicMock(results=[result])]
        return response

    def _store_span_received_at(self, received_at: datetime) -> None:
        span = self.create_span(
            {
                "description": "foo",
                "data": {
                    "sentry._internal.received_at": received_at.timestamp(),
                },
            },
            start_ts=received_at,
        )
        self.store_spans([span])

    def test_returns_measured_value(self) -> None:
        self._store_span_received_at(before_now(seconds=42.5))
        delay = self._measure_delay_seconds()
        # Upper bound is intentionally loose to reduce flakiness.
        # ingested_at timestamp is inserted by snuba and we can't inject it in test.
        assert delay is not None
        assert 42.5 <= delay < 50

    def test_returns_measured_value_multiple_spans(self) -> None:
        for i in range(100):
            self._store_span_received_at(before_now(seconds=i * 10))
        delay = self._measure_delay_seconds()
        assert delay is not None
        assert 980 <= delay < 1000

    def test_no_result_returns_none(self) -> None:
        assert self._measure_delay_seconds() is None

    @mock.patch("sentry.ingestion_delay.query.snuba_rpc.table_rpc")
    def test_empty_response_returns_none(self, mock_table_rpc: mock.MagicMock) -> None:
        mock_table_rpc.return_value = []
        assert self._measure_delay_seconds() is None

    @mock.patch("sentry.ingestion_delay.query.snuba_rpc.table_rpc")
    def test_measures_all_projects_in_organization(self, mock_table_rpc: mock.MagicMock) -> None:
        project = self.project
        other = self.create_project(organization=self.organization)
        mock_table_rpc.return_value = [self._response(1.0)]
        self._measure_delay_seconds()
        request = mock_table_rpc.call_args[0][0][0]
        assert set(request.meta.project_ids) == {project.id, other.id}

    @mock.patch("sentry.ingestion_delay.query.snuba_rpc.table_rpc")
    def test_query_failure_does_not_propagate(self, mock_table_rpc: mock.MagicMock) -> None:
        mock_table_rpc.side_effect = Exception("snuba is down")
        assert self._measure_delay_seconds() is None
