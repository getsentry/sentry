from uuid import uuid4

import pytest
from django.urls import NoReverseMatch, reverse

from sentry.testutils.cases import UptimeResultEAPTestCase
from sentry.testutils.helpers.datetime import before_now
from tests.snuba.api.endpoints.test_organization_events_trace import (
    OrganizationEventsTraceEndpointBase,
)


class OrganizationEventsTraceMetaEndpointTest(OrganizationEventsTraceEndpointBase):
    url_name = "sentry-api-0-organization-trace-meta"

    def client_get(self, data, url=None):
        if url is None:
            url = self.url
        return self.client.get(
            url,
            data,
            format="json",
        )

    def test_no_projects(self) -> None:
        user = self.create_user()
        org = self.create_organization(owner=user)
        self.login_as(user=user)

        url = reverse(
            self.url_name,
            kwargs={"organization_id_or_slug": org.slug, "trace_id": uuid4().hex},
        )

        with self.feature(self.FEATURES):
            response = self.client.get(
                url,
                format="json",
            )

        assert response.status_code == 404, response.content

    def test_bad_ids(self) -> None:
        # Fake trace id
        self.url = reverse(
            self.url_name,
            kwargs={
                "organization_id_or_slug": self.project.organization.slug,
                "trace_id": uuid4().hex,
            },
        )

        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                format="json",
            )

        assert response.status_code == 200, response.content
        data = response.data
        assert data["errors"] == 0
        assert data["performance_issues"] == 0
        assert data["span_count"] == 0
        assert data["span_count_map"] == {}
        assert "uptime_checks" not in data  # Should not be present without include_uptime param

        # Invalid trace id
        with pytest.raises(NoReverseMatch):
            self.url = reverse(
                self.url_name,
                kwargs={
                    "organization_id_or_slug": self.project.organization.slug,
                    "trace_id": "not-a-trace",
                },
            )

    def test_simple(self) -> None:
        self.load_trace()
        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"project": -1},
                format="json",
            )
        assert response.status_code == 200, response.content
        data = response.data
        assert data["errors"] == 0
        assert data["performance_issues"] == 2
        assert data["span_count"] == 19
        assert data["span_count_map"]["http.server"] == 19

    def test_no_team(self) -> None:
        self.load_trace()
        self.team.delete()
        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                format="json",
            )
        assert response.status_code == 200, response.content
        data = response.data
        assert data["errors"] == 0
        assert data["performance_issues"] == 2
        assert data["span_count"] == 19
        assert data["span_count_map"]["http.server"] == 19

    def test_with_errors(self) -> None:
        self.load_trace()
        self.load_errors(self.gen1_project, self.gen1_span_ids[0])
        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"project": -1},
                format="json",
            )
        assert response.status_code == 200, response.content
        data = response.data
        assert data["errors"] == 3
        assert data["performance_issues"] == 2
        assert data["span_count"] == 19
        assert data["span_count_map"]["http.server"] == 19

    def test_with_default(self) -> None:
        self.load_trace()
        self.load_default()
        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"project": -1},
                format="json",
            )
        assert response.status_code == 200, response.content
        data = response.data
        assert data["errors"] == 1
        assert data["performance_issues"] == 2
        assert data["span_count"] == 19
        assert data["span_count_map"]["http.server"] == 19
        assert len(data["transaction_child_count_map"]) == 8

    def test_with_invalid_date(self) -> None:
        self.load_trace()
        self.load_default()
        with self.options({"system.event-retention-days": 10}):
            with self.feature(self.FEATURES):
                response = self.client.get(
                    self.url,
                    data={"project": -1, "timestamp": before_now(days=120).timestamp()},
                    format="json",
                )
        assert response.status_code == 400, response.content


class OrganizationTraceMetaUptimeTest(OrganizationEventsTraceEndpointBase, UptimeResultEAPTestCase):
    url_name = "sentry-api-0-organization-trace-meta"
    FEATURES = ["organizations:trace-spans-format"]

    def create_uptime_check(self, trace_id=None, **kwargs):
        defaults = {
            "trace_id": trace_id or self.trace_id,
            "scheduled_check_time": self.day_ago,
        }
        defaults.update(kwargs)
        return self.create_eap_uptime_result(**defaults)

    def test_trace_meta_without_uptime_param(self) -> None:
        """Test that uptime_checks field is NOT present when include_uptime is not set"""
        self.load_trace()
        uptime_result = self.create_uptime_check()
        self.store_uptime_results([uptime_result])
        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"project": -1},
                format="json",
            )

        assert response.status_code == 200
        data = response.data
        assert "uptime_checks" not in data
        assert data["errors"] == 0
        assert data["performance_issues"] == 2
        assert data["span_count"] == 19

    def test_trace_meta_with_uptime_param(self) -> None:
        """Test that uptime_checks shows correct count when include_uptime=1"""
        self.load_trace()

        uptime_results = [
            self.create_uptime_check(check_status="success"),
            self.create_uptime_check(check_status="failure"),
            self.create_uptime_check(check_status="success"),
        ]
        self.store_uptime_results(uptime_results)

        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"project": "-1", "include_uptime": "1"},
                format="json",
            )

        assert response.status_code == 200
        data = response.data
        assert "uptime_checks" in data
        assert data["uptime_checks"] == 3
        assert data["errors"] == 0
        assert data["performance_issues"] == 2
        assert data["span_count"] == 19

    def test_trace_meta_no_uptime_results(self) -> None:
        """Test that uptime_checks is 0 when there are no uptime results"""
        self.load_trace()

        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"project": "-1", "include_uptime": "1"},
                format="json",
            )

        assert response.status_code == 200
        data = response.data
        assert "uptime_checks" in data
        assert data["uptime_checks"] == 0
        assert data["errors"] == 0
        assert data["performance_issues"] == 2
        assert data["span_count"] == 19

    def test_trace_meta_different_trace_id(self) -> None:
        """Test that uptime results from different traces are not counted"""
        self.load_trace()
        other_trace_id = uuid4().hex
        uptime_result = self.create_uptime_check(trace_id=other_trace_id)
        self.store_uptime_results([uptime_result])

        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"project": "-1", "include_uptime": "1"},
                format="json",
            )
        assert response.status_code == 200
        data = response.data
        assert "uptime_checks" in data
        assert data["uptime_checks"] == 0
