from datetime import UTC, datetime
from unittest import mock

from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import (
    TraceItemColumnValues,
    TraceItemTableResponse,
)
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeValue

from sentry.ingestion_delay.query import (
    DELAY_LABEL,
    FAILED_MEASUREMENT,
    LAST_INGESTED_LABEL,
    NO_MEASUREMENT,
    IngestionDelayMeasurement,
    measure_ingestion_delay,
)
from sentry.testutils.helpers.datetime import before_now
from tests.snuba.api.endpoints.test_organization_events import OrganizationEventsEndpointTestBase


class GetIngestionDelayMeasurementTest(OrganizationEventsEndpointTestBase):
    def setUp(self) -> None:
        super().setUp()
        self.project

    def _measure_ingestion_delay(self) -> IngestionDelayMeasurement:
        return measure_ingestion_delay(
            organization_id=self.organization.id,
            item_type=TraceItemType.TRACE_ITEM_TYPE_SPAN,
            now=datetime.now(tz=UTC),
        )

    def _response(
        self, delay_seconds: float = 1.0, last_ingested_ms: float = 1.0
    ) -> TraceItemTableResponse:
        return TraceItemTableResponse(
            column_values=[
                TraceItemColumnValues(
                    attribute_name=DELAY_LABEL,
                    results=[AttributeValue(val_double=delay_seconds)],
                ),
                TraceItemColumnValues(
                    attribute_name=LAST_INGESTED_LABEL,
                    results=[AttributeValue(val_double=last_ingested_ms)],
                ),
            ]
        )

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
        before_insert = datetime.now(tz=UTC)
        self._store_span_received_at(before_now(seconds=42.5))
        status = self._measure_ingestion_delay()
        delay = status.delay_seconds
        # Upper bound is intentionally loose to reduce flakiness.
        # ingested_at timestamp is inserted by snuba and we can't inject it in test.
        assert delay is not None
        assert 42.5 <= delay < 50
        last_ingested_at = status.last_ingested_at
        assert last_ingested_at is not None
        assert last_ingested_at > before_insert

    def test_returns_measured_value_multiple_spans(self) -> None:
        before_insert = datetime.now(tz=UTC)
        for i in range(100):
            self._store_span_received_at(before_now(seconds=i * 10))
        status = self._measure_ingestion_delay()
        delay = status.delay_seconds
        assert delay is not None
        assert 980 <= delay < 1000
        last_ingested_at = status.last_ingested_at
        assert last_ingested_at is not None
        assert last_ingested_at > before_insert

    def test_no_result_returns_none(self) -> None:
        assert self._measure_ingestion_delay() == NO_MEASUREMENT

    @mock.patch("sentry.ingestion_delay.query.snuba_rpc.table_rpc")
    def test_empty_response_is_a_failed_measurement(self, mock_table_rpc: mock.MagicMock) -> None:
        mock_table_rpc.return_value = []
        assert self._measure_ingestion_delay() == FAILED_MEASUREMENT

    @mock.patch("sentry.ingestion_delay.query.snuba_rpc.table_rpc")
    def test_measures_all_projects_in_organization(self, mock_table_rpc: mock.MagicMock) -> None:
        project = self.project
        other = self.create_project(organization=self.organization)
        mock_table_rpc.return_value = [self._response(delay_seconds=42.5)]
        assert self._measure_ingestion_delay().delay_seconds == 42.5
        request = mock_table_rpc.call_args[0][0][0]
        assert set(request.meta.project_ids) == {project.id, other.id}

    @mock.patch("sentry.ingestion_delay.query.snuba_rpc.table_rpc")
    def test_query_failure_does_not_propagate(self, mock_table_rpc: mock.MagicMock) -> None:
        mock_table_rpc.side_effect = Exception("snuba is down")
        assert self._measure_ingestion_delay() == FAILED_MEASUREMENT
