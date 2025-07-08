from uuid import uuid4

import pytest
from django.urls import NoReverseMatch, reverse

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

    def test_no_projects(self):
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

    def test_bad_ids(self):
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

        # Invalid trace id
        with pytest.raises(NoReverseMatch):
            self.url = reverse(
                self.url_name,
                kwargs={
                    "organization_id_or_slug": self.project.organization.slug,
                    "trace_id": "not-a-trace",
                },
            )

    def test_simple(self):
        self.load_trace(is_eap=True)
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

    def test_no_team(self):
        self.load_trace(is_eap=True)
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

    def test_with_errors(self):
        self.load_trace(is_eap=True)
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

    def test_with_default(self):
        self.load_trace(is_eap=True)
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
