from datetime import timedelta
from uuid import uuid4

import pytest

from tests.sentry.uptime.endpoints.test_base import UptimeResultEAPTestCase
from tests.snuba.api.endpoints.test_organization_events import OrganizationEventsEndpointTestBase


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
            self.create_eap_uptime_result(
                check_status="success",
                http_status_code=200,
                region="us-east-1",
                scheduled_check_time=self.ten_mins_ago,
            ),
            self.create_eap_uptime_result(
                check_status="failure",
                http_status_code=500,
                region="us-west-2",
                scheduled_check_time=self.nine_mins_ago,
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
            self.create_eap_uptime_result(
                check_status="success",
                http_status_code=200,
                scheduled_check_time=self.ten_mins_ago,
            ),
            self.create_eap_uptime_result(
                check_status="failure",
                http_status_code=500,
                scheduled_check_time=self.nine_mins_ago,
            ),
            self.create_eap_uptime_result(
                check_status="success",
                http_status_code=201,
                scheduled_check_time=self.nine_mins_ago,
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
            self.create_eap_uptime_result(
                check_status="success",
                check_duration_us=150000,
                request_duration_us=125000,
                dns_lookup_duration_us=25000,
                tcp_connection_duration_us=15000,
                scheduled_check_time=self.ten_mins_ago,
            ),
            self.create_eap_uptime_result(
                check_status="failure",
                check_duration_us=30000000,
                request_duration_us=30000000,
                dns_lookup_duration_us=200000,
                tcp_connection_duration_us=25000,
                scheduled_check_time=self.nine_mins_ago,
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
            self.create_eap_uptime_result(
                check_status="success",
                http_status_code=200,
                dns_lookup_duration_us=15000,
                region="us-east-1",
                scheduled_check_time=self.ten_mins_ago,
            ),
            self.create_eap_uptime_result(
                check_status="failure",
                http_status_code=504,
                dns_lookup_duration_us=150000,
                region="us-east-1",
                scheduled_check_time=self.nine_mins_ago,
            ),
            self.create_eap_uptime_result(
                check_status="failure",
                http_status_code=500,
                dns_lookup_duration_us=20000,
                region="us-west-2",
                scheduled_check_time=self.nine_mins_ago,
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
            self.create_eap_uptime_result(
                check_id=check_id,
                request_sequence=0,
                check_status="success",
                http_status_code=301,
                request_url="http://example.com",
                trace_id=trace_id,
                scheduled_check_time=self.ten_mins_ago,
            ),
            self.create_eap_uptime_result(
                check_id=check_id,
                request_sequence=1,
                check_status="success",
                http_status_code=200,
                request_url="https://example.com",
                trace_id=trace_id,
                scheduled_check_time=self.ten_mins_ago,
            ),
            self.create_eap_uptime_result(
                check_id=uuid4().hex,
                request_sequence=0,
                check_status="success",
                http_status_code=200,
                request_url="https://other.com",
                scheduled_check_time=self.nine_mins_ago,
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
            self.create_eap_uptime_result(
                check_status="success",
                region="us-east-1",
                http_status_code=200,
                scheduled_check_time=self.ten_mins_ago,
            ),
            self.create_eap_uptime_result(
                check_status="failure",
                region="us-east-1",
                http_status_code=500,
                scheduled_check_time=self.nine_mins_ago,
            ),
            self.create_eap_uptime_result(
                check_status="success",
                region="us-west-2",
                http_status_code=200,
                scheduled_check_time=self.nine_mins_ago,
            ),
            self.create_eap_uptime_result(
                check_status="failure",
                region="us-west-2",
                http_status_code=503,
                scheduled_check_time=self.nine_mins_ago,
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
            self.create_eap_uptime_result(
                check_status="success",
                guid="check-1",
                scheduled_check_time=base_time,
            ),
            self.create_eap_uptime_result(
                check_status="success",
                guid="check-2",
                scheduled_check_time=base_time + timedelta(microseconds=1),
            ),
            self.create_eap_uptime_result(
                check_status="success",
                guid="check-3",
                scheduled_check_time=base_time + timedelta(microseconds=2),
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
