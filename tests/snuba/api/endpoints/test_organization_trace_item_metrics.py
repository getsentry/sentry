from django.urls import reverse

from sentry.explore.models import (
    TraceItemAttributeValueContext,
    TraceItemTypes,
    TraceMetricTypes,
)
from sentry.search.eap.trace_metrics.types import TraceMetricType
from sentry.testutils.cases import APITestCase, SnubaTestCase, TraceMetricsTestCase
from sentry.testutils.helpers.datetime import before_now


class OrganizationTraceItemMetricsEndpointTest(APITestCase, TraceMetricsTestCase, SnubaTestCase):
    viewname = "sentry-api-0-organization-trace-item-metrics"

    feature_flags = {
        "organizations:visibility-explore-view": True,
        "organizations:tracemetrics-enabled": True,
        "organizations:data-browsing-attribute-context": True,
    }

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

    def store_metric(
        self,
        metric_name: str,
        metric_type: TraceMetricType = "counter",
        metric_unit: str | None = None,
    ) -> None:
        timestamp = before_now(minutes=10)
        self.store_eap_items(
            [
                self.create_trace_metric(
                    metric_name,
                    1,
                    metric_type,
                    metric_unit=metric_unit,
                    timestamp=timestamp,
                    # Real ingestion sets this; the fixture must too for max(timestamp_precise).
                    attributes={"sentry.timestamp_precise": int(timestamp.timestamp() * 1e9)},
                )
            ]
        )

    def create_context(self, value, metric_type=TraceMetricTypes.COUNTER, project=..., **kwargs):
        return TraceItemAttributeValueContext.objects.create(
            organization=self.organization,
            project=self.project if project is ... else project,
            attribute_name="metric.name",
            attribute_value=value,
            attribute_type=metric_type,
            item_type=TraceItemTypes.TRACEMETRICS,
            created_by_id=self.user.id,
            **kwargs,
        )

    def do_request(self, query=None, features=None):
        if features is None:
            features = self.feature_flags
        if query is None:
            query = {"project": self.project.id}
        url = reverse(self.viewname, kwargs={"organization_id_or_slug": self.organization.slug})
        with self.feature(features):
            return self.client.get(
                url,
                QUERY_STRING="&".join(f"{name}={value}" for name, value in query.items()),
            )

    def test_lists_metrics(self) -> None:
        self.store_metric("checkout.requests", "counter")
        self.store_metric("checkout.requests", "counter")
        self.store_metric("checkout.latency", "distribution", metric_unit="millisecond")

        response = self.do_request()

        assert response.status_code == 200, response.data
        by_name = {row["name"]: row for row in response.data}
        assert set(by_name) == {"checkout.requests", "checkout.latency"}

        requests = by_name["checkout.requests"]
        assert requests["type"] == "counter"
        assert requests["unit"] is None
        assert requests["count"] == 2
        assert requests["lastSeen"] is not None
        assert "context" not in requests

        latency = by_name["checkout.latency"]
        assert latency["type"] == "distribution"
        assert latency["unit"] == "millisecond"
        assert latency["count"] == 1

    def test_query_filters_metrics(self) -> None:
        self.store_metric("checkout.requests", "counter")
        self.store_metric("checkout.latency", "distribution")

        response = self.do_request(
            query={"project": self.project.id, "query": "metric.name:checkout.requests"}
        )

        assert response.status_code == 200, response.data
        assert [row["name"] for row in response.data] == ["checkout.requests"]

    def test_sort_by_count(self) -> None:
        self.store_metric("low.count", "counter")
        for _ in range(3):
            self.store_metric("high.count", "counter")

        desc = self.do_request(query={"project": self.project.id, "sort": "-count"})
        assert desc.status_code == 200, desc.data
        assert [row["name"] for row in desc.data] == ["high.count", "low.count"]

        asc = self.do_request(query={"project": self.project.id, "sort": "count"})
        assert asc.status_code == 200, asc.data
        assert [row["name"] for row in asc.data] == ["low.count", "high.count"]

    def test_rejects_invalid_sort(self) -> None:
        self.store_metric("checkout.requests", "counter")

        response = self.do_request(query={"project": self.project.id, "sort": "bogus"})

        assert response.status_code == 400, response.data
        assert "sort" in response.data

    def test_context_only_filters_to_metrics_with_context(self) -> None:
        self.store_metric("has.context", "counter")
        self.store_metric("no.context", "counter")
        self.create_context("has.context", project=None, brief="Described")

        response = self.do_request(query={"project": self.project.id, "contextOnly": "1"})

        assert response.status_code == 200, response.data
        assert [row["name"] for row in response.data] == ["has.context"]
        assert response.data[0]["context"] == {"brief": "Described"}

    def test_context_only_empty_when_no_context(self) -> None:
        self.store_metric("no.context", "counter")

        response = self.do_request(query={"project": self.project.id, "contextOnly": "1"})

        assert response.status_code == 200, response.data
        assert response.data == []

    def test_context_only_matches_unicode_name(self) -> None:
        # A unicode metric name must still match the IN filter (regression: json
        # escaping would emit \uXXXX, which the search grammar doesn't decode).
        self.store_metric("café.requests", "counter")
        self.create_context("café.requests", project=None, brief="Café")

        response = self.do_request(query={"project": self.project.id, "contextOnly": "1"})

        assert response.status_code == 200, response.data
        assert [row["name"] for row in response.data] == ["café.requests"]

    def test_context_only_drops_type_without_context(self) -> None:
        # Same name exists as counter and gauge, but only the counter has context.
        # The name filter returns both; the gauge (no context) must be dropped.
        self.store_metric("checkout.requests", "counter")
        self.store_metric("checkout.requests", "gauge")
        self.create_context(
            "checkout.requests", metric_type=TraceMetricTypes.COUNTER, project=None, brief="Counter"
        )

        response = self.do_request(query={"project": self.project.id, "contextOnly": "1"})

        assert response.status_code == 200, response.data
        assert [(row["type"], "context" in row) for row in response.data] == [("counter", True)]

    def test_context_only_ignored_without_feature(self) -> None:
        self.store_metric("has.context", "counter")
        self.store_metric("no.context", "counter")
        self.create_context("has.context", project=None, brief="Described")

        response = self.do_request(
            query={"project": self.project.id, "contextOnly": "1"},
            features={
                "organizations:visibility-explore-view": True,
                "organizations:tracemetrics-enabled": True,
            },
        )

        assert response.status_code == 200, response.data
        assert {row["name"] for row in response.data} == {"has.context", "no.context"}

    def test_expand_context(self) -> None:
        self.store_metric("checkout.requests", "counter")
        self.create_context(
            "checkout.requests",
            project=None,
            brief="Checkout requests",
            additional_context="Longer notes.",
        )

        response = self.do_request(
            query={"project": self.project.id, "expand": "context"},
        )

        assert response.status_code == 200, response.data
        metric = response.data[0]
        assert metric["context"] == {
            "brief": "Checkout requests",
            "details": ["Longer notes."],
        }

    def test_context_only_matches_metric_type(self) -> None:
        self.store_metric("checkout.requests", "counter")
        # Org-wide context stored for a gauge of the same name — must not attach
        # to the counter.
        self.create_context(
            "checkout.requests",
            metric_type=TraceMetricTypes.GAUGE,
            project=None,
            brief="Gauge brief",
        )

        response = self.do_request(
            query={"project": self.project.id, "expand": "context"},
        )

        assert response.status_code == 200, response.data
        assert "context" not in response.data[0]

    def test_context_requires_expand(self) -> None:
        self.store_metric("checkout.requests", "counter")
        self.create_context("checkout.requests", project=None, brief="Checkout requests")

        response = self.do_request(query={"project": self.project.id})

        assert response.status_code == 200, response.data
        assert "context" not in response.data[0]

    def test_context_requires_feature_flag(self) -> None:
        self.store_metric("checkout.requests", "counter")
        self.create_context("checkout.requests", project=None, brief="Checkout requests")

        response = self.do_request(
            query={"project": self.project.id, "expand": "context"},
            features={
                "organizations:visibility-explore-view": True,
                "organizations:tracemetrics-enabled": True,
            },
        )

        assert response.status_code == 200, response.data
        assert "context" not in response.data[0]

    def test_invalid_query_returns_400(self) -> None:
        self.store_metric("checkout.requests", "counter")

        response = self.do_request(
            query={"project": self.project.id, "query": "metric.name:foo("},
        )

        assert response.status_code == 400, response.data
        assert "detail" in response.data

    def test_requires_feature_flag(self) -> None:
        self.store_metric("checkout.requests", "counter")

        response = self.do_request(features={})

        assert response.status_code == 404
