from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
import requests
from django.conf import settings
from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType
from sentry_protos.snuba.v1.trace_item_pb2 import AnyValue, TraceItem

from sentry.testutils.cases import BaseTestCase, scalar_to_any_value
from tests.snuba.api.endpoints.test_organization_events import OrganizationEventsEndpointTestBase


class UptimeResultEAPTestCase(BaseTestCase):
    def create_uptime_result(
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
        region="us-west",
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
        files = {
            f"uptime_{i}": result.SerializeToString() for i, result in enumerate(uptime_results)
        }
        response = requests.post(
            settings.SENTRY_SNUBA + "/tests/entities/eap_items/insert_bytes",
            files=files,
        )
        assert response.status_code == 200


class OrganizationEventsUptimeResultsEndpointTest(
    OrganizationEventsEndpointTestBase, UptimeResultEAPTestCase
):
    dataset = "uptime_results"

    def setUp(self):
        super().setUp()
        self.features = {
            "organizations:uptime-eap-enabled": True,
        }

    def build_expected_result(self, **kwargs):
        return {"id": None, "project.name": None, **kwargs}

    @pytest.mark.querybuilder
    def test_simple_uptime_query(self):
        results = [
            self.create_uptime_result(
                check_status="success",
                http_status_code=200,
                region="us-east-1",
                timestamp=self.ten_mins_ago,
            ),
            self.create_uptime_result(
                check_status="failure",
                http_status_code=500,
                region="us-west-2",
                timestamp=self.nine_mins_ago,
            ),
        ]
        self.store_uptime_results(results)

        response = self.do_request(
            {
                "field": ["check_status", "http_status_code", "region"],
                "query": "",
                "orderBy": "timestamp",
                "project": self.project.id,
                "dataset": self.dataset,
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert response.data["meta"]["dataset"] == self.dataset

        assert data == [
            self.build_expected_result(
                check_status="success", http_status_code=200, region="us-east-1"
            ),
            self.build_expected_result(
                check_status="failure", http_status_code=500, region="us-west-2"
            ),
        ]

    @pytest.mark.querybuilder
    def test_status_filter_query(self):
        results = [
            self.create_uptime_result(
                check_status="success",
                http_status_code=200,
                timestamp=self.ten_mins_ago,
            ),
            self.create_uptime_result(
                check_status="failure",
                http_status_code=500,
                timestamp=self.nine_mins_ago,
            ),
            self.create_uptime_result(
                check_status="success",
                http_status_code=201,
                timestamp=self.nine_mins_ago,
            ),
        ]
        self.store_uptime_results(results)

        response = self.do_request(
            {
                "field": ["check_status", "http_status_code"],
                "query": "check_status:success",
                "orderBy": "http_status_code",
                "project": self.project.id,
                "dataset": self.dataset,
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]

        assert data == [
            self.build_expected_result(check_status="success", http_status_code=200),
            self.build_expected_result(check_status="success", http_status_code=201),
        ]

    @pytest.mark.querybuilder
    def test_timing_fields_query(self):
        results = [
            self.create_uptime_result(
                check_status="success",
                check_duration_us=150000,
                request_duration_us=125000,
                dns_lookup_duration_us=25000,
                tcp_connection_duration_us=15000,
                timestamp=self.ten_mins_ago,
            ),
            self.create_uptime_result(
                check_status="failure",
                check_duration_us=30000000,
                request_duration_us=30000000,
                dns_lookup_duration_us=200000,
                tcp_connection_duration_us=25000,
                timestamp=self.nine_mins_ago,
            ),
        ]
        self.store_uptime_results(results)

        response = self.do_request(
            {
                "field": [
                    "check_status",
                    "check_duration_us",
                    "request_duration_us",
                    "dns_lookup_duration_us",
                    "tcp_connection_duration_us",
                ],
                "query": "",
                "orderBy": "check_duration_us",
                "project": self.project.id,
                "dataset": self.dataset,
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]

        assert data == [
            self.build_expected_result(
                check_status="success",
                check_duration_us=150000,
                request_duration_us=125000,
                dns_lookup_duration_us=25000,
                tcp_connection_duration_us=15000,
            ),
            self.build_expected_result(
                check_status="failure",
                check_duration_us=30000000,
                request_duration_us=30000000,
                dns_lookup_duration_us=200000,
                tcp_connection_duration_us=25000,
            ),
        ]

    @pytest.mark.querybuilder
    def test_cross_level_filter_query(self):
        results = [
            self.create_uptime_result(
                check_status="success",
                http_status_code=200,
                dns_lookup_duration_us=15000,
                region="us-east-1",
                timestamp=self.ten_mins_ago,
            ),
            self.create_uptime_result(
                check_status="failure",
                http_status_code=504,
                dns_lookup_duration_us=150000,
                region="us-east-1",
                timestamp=self.nine_mins_ago,
            ),
            self.create_uptime_result(
                check_status="failure",
                http_status_code=500,
                dns_lookup_duration_us=20000,
                region="us-west-2",
                timestamp=self.nine_mins_ago,
            ),
        ]
        self.store_uptime_results(results)

        response = self.do_request(
            {
                "field": ["check_status", "http_status_code", "dns_lookup_duration_us", "region"],
                "query": "check_status:failure AND dns_lookup_duration_us:>100000",
                "orderBy": "dns_lookup_duration_us",
                "project": self.project.id,
                "dataset": self.dataset,
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]

        assert data == [
            self.build_expected_result(
                check_status="failure",
                http_status_code=504,
                dns_lookup_duration_us=150000,
                region="us-east-1",
            ),
        ]

    @pytest.mark.querybuilder
    def test_redirect_sequence_query(self):
        """Test querying redirect chains using request_sequence."""
        check_id = uuid4().hex
        trace_id = uuid4().hex

        results = [
            self.create_uptime_result(
                check_id=check_id,
                request_sequence=0,
                check_status="success",
                http_status_code=301,
                request_url="http://example.com",
                trace_id=trace_id,
                timestamp=self.ten_mins_ago,
            ),
            self.create_uptime_result(
                check_id=check_id,
                request_sequence=1,
                check_status="success",
                http_status_code=200,
                request_url="https://example.com",
                trace_id=trace_id,
                timestamp=self.ten_mins_ago,
            ),
            self.create_uptime_result(
                check_id=uuid4().hex,
                request_sequence=0,
                check_status="success",
                http_status_code=200,
                request_url="https://other.com",
                timestamp=self.nine_mins_ago,
            ),
        ]
        self.store_uptime_results(results)

        response = self.do_request(
            {
                "field": ["check_id", "request_sequence", "http_status_code", "request_url"],
                "query": "request_sequence:>0",
                "orderBy": "request_sequence",
                "project": self.project.id,
                "dataset": self.dataset,
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]

        assert data == [
            self.build_expected_result(
                check_id=check_id,
                request_sequence=1,
                http_status_code=200,
                request_url="https://example.com",
            ),
        ]

    @pytest.mark.querybuilder
    def test_region_and_status_combination(self):
        results = [
            self.create_uptime_result(
                check_status="success",
                region="us-east-1",
                http_status_code=200,
                timestamp=self.ten_mins_ago,
            ),
            self.create_uptime_result(
                check_status="failure",
                region="us-east-1",
                http_status_code=500,
                timestamp=self.nine_mins_ago,
            ),
            self.create_uptime_result(
                check_status="success",
                region="us-west-2",
                http_status_code=200,
                timestamp=self.nine_mins_ago,
            ),
            self.create_uptime_result(
                check_status="failure",
                region="us-west-2",
                http_status_code=503,
                timestamp=self.nine_mins_ago,
            ),
        ]
        self.store_uptime_results(results)

        response = self.do_request(
            {
                "field": ["check_status", "region", "http_status_code"],
                "query": "region:us-east-1 AND check_status:failure",
                "orderBy": "http_status_code",
                "project": self.project.id,
                "dataset": self.dataset,
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]

        assert data == [
            self.build_expected_result(
                check_status="failure",
                region="us-east-1",
                http_status_code=500,
            ),
        ]

    @pytest.mark.querybuilder
    def test_timestamp_precision(self):
        """Test that timestamp precision is maintained in queries."""
        base_time = self.ten_mins_ago
        results = [
            self.create_uptime_result(
                check_status="success",
                guid="check-1",
                timestamp=base_time,
            ),
            self.create_uptime_result(
                check_status="success",
                guid="check-2",
                timestamp=base_time + timedelta(microseconds=1),
            ),
            self.create_uptime_result(
                check_status="success",
                guid="check-3",
                timestamp=base_time + timedelta(microseconds=2),
            ),
        ]
        self.store_uptime_results(results)

        response = self.do_request(
            {
                "field": ["guid", "timestamp"],
                "query": "",
                "orderBy": "timestamp",
                "project": self.project.id,
                "dataset": self.dataset,
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]

        guids = {result["guid"] for result in data}
        assert guids == {"check-1", "check-2", "check-3"}

        for result in data:
            assert result["timestamp"] is not None
            assert "T" in result["timestamp"]
