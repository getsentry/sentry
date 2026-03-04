from __future__ import annotations

import time
from datetime import datetime, timedelta
from datetime import timezone as dt_timezone

from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import (
    Column,
    TraceItemTableRequest,
)
from sentry_protos.snuba.v1.request_common_pb2 import PageToken, RequestMeta, TraceItemType
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey, AttributeValue
from sentry_protos.snuba.v1.trace_item_filter_pb2 import ComparisonFilter, TraceItemFilter

from sentry.processing_errors.eap.producer import produce_processing_errors_to_eap
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.utils import snuba_rpc


class ProcessingErrorEAPIntegrationTest(TestCase, SnubaTestCase):
    """
    Integration test that produces processing errors through the real
    Kafka producer and queries them back from Snuba to verify the full
    round-trip. This catches missing or invalid TraceItem fields that
    unit tests with mocked producers miss.
    """

    def test_write_and_read_round_trip(self) -> None:
        event_id = "a" * 32
        event_data = {
            "event_id": event_id,
            "timestamp": int(datetime.now(dt_timezone.utc).timestamp()),
            "received": int(datetime.now(dt_timezone.utc).timestamp()),
            "contexts": {"trace": {"trace_id": "b" * 32}},
            "platform": "javascript",
            "release": "1.0.0",
            "sdk": {"name": "sentry.javascript.browser", "version": "7.0.0"},
        }
        errors = [
            {"type": "js_no_source", "symbolicator_type": "missing_sourcemap"},
        ]

        produce_processing_errors_to_eap(self.project, event_data, errors)

        event_filter = TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="event_id", type=AttributeKey.Type.TYPE_STRING),
                op=ComparisonFilter.OP_EQUALS,
                value=AttributeValue(val_str=event_id),
            )
        )

        now = datetime.now(dt_timezone.utc)

        start_proto = Timestamp()
        start_proto.FromDatetime(now - timedelta(hours=1))
        end_proto = Timestamp()
        end_proto.FromDatetime(now + timedelta(hours=1))

        rpc_request = TraceItemTableRequest(
            meta=RequestMeta(
                referrer="test.processing_errors.integration",
                organization_id=self.organization.id,
                project_ids=[self.project.id],
                trace_item_type=TraceItemType.TRACE_ITEM_TYPE_PROCESSING_ERROR,
                start_timestamp=start_proto,
                end_timestamp=end_proto,
            ),
            columns=[
                Column(
                    label="event_id",
                    key=AttributeKey(name="event_id", type=AttributeKey.Type.TYPE_STRING),
                ),
                Column(
                    label="error_type",
                    key=AttributeKey(name="error_type", type=AttributeKey.Type.TYPE_STRING),
                ),
                Column(
                    label="platform",
                    key=AttributeKey(name="platform", type=AttributeKey.Type.TYPE_STRING),
                ),
            ],
            filter=event_filter,
            limit=10,
            page_token=PageToken(offset=0),
        )

        found = False
        for _attempt in range(20):
            time.sleep(0.5)
            responses = snuba_rpc.table_rpc([rpc_request])
            response = responses[0]

            if response.column_values and response.column_values[0].results:
                found = True
                break

        assert found, "Processing error not found in Snuba after 20 attempts"

        columns = {cv.attribute_name: idx for idx, cv in enumerate(response.column_values)}
        assert response.column_values[columns["event_id"]].results[0].val_str == event_id
        assert response.column_values[columns["error_type"]].results[0].val_str == "js_no_source"
        assert response.column_values[columns["platform"]].results[0].val_str == "javascript"
