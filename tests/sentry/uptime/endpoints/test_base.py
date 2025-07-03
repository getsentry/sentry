from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
import requests
from django.conf import settings
from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType
from sentry_protos.snuba.v1.trace_item_pb2 import AnyValue, TraceItem

from sentry.testutils.cases import BaseTestCase, scalar_to_any_value
from sentry.testutils.skips import requires_snuba

MOCK_DATETIME = datetime.now(tz=timezone.utc) - timedelta(days=1)


@pytest.mark.snuba
@requires_snuba
@pytest.mark.usefixtures("reset_snuba")
class UptimeResultEAPTestCase(BaseTestCase):
    """Test case for creating and storing EAP uptime results."""

    def create_eap_uptime_result(
        self,
        *,
        organization=None,
        project=None,
        scheduled_check_time=None,
        trace_id=None,
        guid=None,
        subscription_id=None,
        check_id=None,
        check_status="success",
        incident_status=None,
        region="default",
        http_status_code=200,
        request_type="GET",
        request_url="https://example.com",
        request_sequence=0,
        check_duration_us=150000,
        request_duration_us=125000,
        dns_lookup_duration_us=None,
        tcp_connection_duration_us=None,
        tls_handshake_duration_us=None,
        time_to_first_byte_duration_us=None,
        send_request_duration_us=None,
        receive_response_duration_us=None,
        request_body_size_bytes=0,
        response_body_size_bytes=1024,
        status_reason_type=None,
        status_reason_description=None,
    ) -> TraceItem:
        if organization is None:
            organization = self.organization
        if project is None:
            project = self.project
        if scheduled_check_time is None:
            scheduled_check_time = datetime.now(timezone.utc) - timedelta(minutes=1)
        if trace_id is None:
            trace_id = uuid4().hex
        if guid is None:
            guid = uuid4().hex
        if subscription_id is None:
            subscription_id = f"sub-{uuid4().hex[:8]}"

        attributes_data = {
            "guid": guid,
            "subscription_id": subscription_id,
            "check_status": check_status,
            "region": region,
            "http_status_code": http_status_code,
            "request_type": request_type,
            "request_url": request_url,
            "request_sequence": request_sequence,
            "check_duration_us": check_duration_us,
            "request_duration_us": request_duration_us,
            "request_body_size_bytes": request_body_size_bytes,
            "response_body_size_bytes": response_body_size_bytes,
        }

        if check_id is not None:
            attributes_data["check_id"] = check_id

        timing_fields = {
            "dns_lookup_duration_us": dns_lookup_duration_us,
            "tcp_connection_duration_us": tcp_connection_duration_us,
            "tls_handshake_duration_us": tls_handshake_duration_us,
            "time_to_first_byte_duration_us": time_to_first_byte_duration_us,
            "send_request_duration_us": send_request_duration_us,
            "receive_response_duration_us": receive_response_duration_us,
        }
        for field, value in timing_fields.items():
            if value is not None:
                attributes_data[field] = value

        if status_reason_type is not None:
            attributes_data["status_reason_type"] = status_reason_type
        if status_reason_description is not None:
            attributes_data["status_reason_description"] = status_reason_description

        if incident_status is not None:
            attributes_data["incident_status"] = incident_status.value

        attributes_proto = {}
        for k, v in attributes_data.items():
            if v is not None:
                attributes_proto[k] = scalar_to_any_value(v)

        timestamp_proto = Timestamp()
        timestamp_proto.FromDatetime(scheduled_check_time)

        attributes_proto["scheduled_check_time_us"] = AnyValue(
            int_value=int(scheduled_check_time.timestamp() * 1_000_000)
        )
        attributes_proto["actual_check_time_us"] = AnyValue(
            int_value=int(scheduled_check_time.timestamp() * 1_000_000) + 5000
        )

        return TraceItem(
            organization_id=organization.id,
            project_id=project.id,
            item_type=TraceItemType.TRACE_ITEM_TYPE_UPTIME_RESULT,
            timestamp=timestamp_proto,
            trace_id=trace_id,
            item_id=uuid4().bytes,
            received=timestamp_proto,
            retention_days=90,
            attributes=attributes_proto,
        )

    def store_uptime_results(self, uptime_results):
        """Store uptime results in the EAP dataset."""
        files = {
            f"uptime_{i}": result.SerializeToString() for i, result in enumerate(uptime_results)
        }
        response = requests.post(
            settings.SENTRY_SNUBA + "/tests/entities/eap_items/insert_bytes",
            files=files,
        )
        assert response.status_code == 200
