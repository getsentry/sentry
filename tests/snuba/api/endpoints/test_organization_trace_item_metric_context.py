from django.urls import reverse

from sentry.explore.models import (
    TraceItemAttributeValueContext,
    TraceItemTypes,
    TraceMetricTypes,
)
from sentry.testutils.cases import APITestCase, SnubaTestCase, TraceMetricsTestCase
from sentry.testutils.helpers.datetime import before_now


class OrganizationTraceItemMetricContextEndpointTest(
    APITestCase, TraceMetricsTestCase, SnubaTestCase
):
    viewname = "sentry-api-0-organization-trace-item-metric-context"

    feature_flags = {
        "organizations:visibility-explore-view": True,
        "organizations:tracemetrics-enabled": True,
        "organizations:data-browsing-attribute-context": True,
    }

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

    def store_metric(self, metric_name: str, metric_type: str = "counter") -> None:
        self.store_eap_items(
            [
                self.create_trace_metric(
                    metric_name,
                    1,
                    metric_type,
                    timestamp=before_now(minutes=10),
                )
            ]
        )

    def do_request(self, metric, data, query=None, features=None):
        if features is None:
            features = self.feature_flags
        if query is None:
            query = {"project": self.project.id, "statsPeriod": "7d"}
        url = reverse(
            self.viewname,
            kwargs={"organization_id_or_slug": self.organization.slug, "metric": metric},
        )
        with self.feature(features):
            return self.client.put(
                url,
                data,
                format="json",
                QUERY_STRING="&".join(f"{name}={value}" for name, value in query.items()),
            )

    def test_creates_context(self) -> None:
        self.store_metric("checkout.requests")

        response = self.do_request(
            "checkout.requests",
            {
                "metricType": "counter",
                "brief": "Checkout requests",
                "additionalContext": "Longer notes about the metric.",
            },
        )

        assert response.status_code == 201, response.data
        assert response.data["attributeName"] == "metric.name"
        assert response.data["attributeValue"] == "checkout.requests"
        assert response.data["dataset"] == "tracemetrics"
        assert response.data["attributeType"] == "counter"
        assert response.data["project"] == str(self.project.id)
        assert response.data["brief"] == "Checkout requests"
        assert response.data["additionalContext"] == "Longer notes about the metric."

        context = TraceItemAttributeValueContext.objects.get(
            organization=self.organization,
            project=self.project,
            attribute_value="checkout.requests",
        )
        assert context.attribute_name == "metric.name"
        assert context.brief == "Checkout requests"
        assert context.additional_context == "Longer notes about the metric."
        assert context.item_type == TraceItemTypes.get_id_for_type_name("tracemetrics")
        assert context.attribute_type == TraceMetricTypes.get_id_for_type_name("counter")
        assert context.created_by_id == self.user.id
        assert context.updated_by_id == self.user.id

    def test_updates_existing_context(self) -> None:
        self.store_metric("checkout.requests")

        first = self.do_request(
            "checkout.requests",
            {
                "metricType": "counter",
                "brief": "First",
                "additionalContext": "Longer notes about the metric.",
            },
        )
        assert first.status_code == 201, first.data

        # A brief-only follow-up must not clear the stored optional fields.
        second = self.do_request(
            "checkout.requests",
            {
                "metricType": "counter",
                "brief": "Second",
            },
        )
        assert second.status_code == 200, second.data
        assert second.data["id"] == first.data["id"]
        assert second.data["brief"] == "Second"
        assert second.data["additionalContext"] == "Longer notes about the metric."

        assert (
            TraceItemAttributeValueContext.objects.filter(
                organization=self.organization, attribute_value="checkout.requests"
            ).count()
            == 1
        )

    def test_requires_brief(self) -> None:
        self.store_metric("checkout.requests")

        response = self.do_request(
            "checkout.requests",
            {
                "metricType": "counter",
            },
        )

        assert response.status_code == 400, response.data
        assert "brief" in response.data

    def test_requires_metric_type(self) -> None:
        self.store_metric("checkout.requests")

        response = self.do_request(
            "checkout.requests",
            {
                "brief": "Checkout requests",
            },
        )

        assert response.status_code == 400, response.data
        assert "metricType" in response.data

    def test_rejects_invalid_metric_type(self) -> None:
        self.store_metric("checkout.requests")

        response = self.do_request(
            "checkout.requests",
            {
                "metricType": "histogram",
                "brief": "Checkout requests",
            },
        )

        assert response.status_code == 400, response.data
        assert "metricType" in response.data

    def test_org_wide_context(self) -> None:
        self.store_metric("checkout.requests")

        response = self.do_request(
            "checkout.requests",
            {
                "metricType": "counter",
                "brief": "Checkout requests",
            },
            query={"project": -1, "statsPeriod": "7d"},
        )

        assert response.status_code == 201, response.data
        assert response.data["project"] is None
        context = TraceItemAttributeValueContext.objects.get(attribute_value="checkout.requests")
        assert context.project_id is None

    def test_org_wide_context_all_projects_sentinel(self) -> None:
        self.store_metric("checkout.requests")

        # `$all` is the other all-projects sentinel and must also scope org-wide.
        response = self.do_request(
            "checkout.requests",
            {
                "metricType": "counter",
                "brief": "Checkout requests",
            },
            query={"project": "$all", "statsPeriod": "7d"},
        )

        assert response.status_code == 201, response.data
        assert response.data["project"] is None
        context = TraceItemAttributeValueContext.objects.get(attribute_value="checkout.requests")
        assert context.project_id is None

    def test_rejects_nonexistent_metric(self) -> None:
        self.store_metric("checkout.requests")

        response = self.do_request(
            "does.not.exist",
            {
                "metricType": "counter",
                "brief": "Checkout requests",
            },
        )

        assert response.status_code == 400, response.data
        assert "not found" in response.data["detail"]

    def test_requires_feature_flag(self) -> None:
        self.store_metric("checkout.requests")

        response = self.do_request(
            "checkout.requests",
            {
                "metricType": "counter",
                "brief": "Checkout requests",
            },
            features={"organizations:visibility-explore-view": True},
        )

        assert response.status_code == 404

    def test_invalid_payload(self) -> None:
        response = self.do_request(
            "checkout.requests",
            {
                "brief": "Checkout requests",
            },
        )

        assert response.status_code == 400, response.data
        assert "metricType" in response.data
