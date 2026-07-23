from django.urls import reverse

from sentry.explore.models import (
    TraceItemAttributeValueContext,
    TraceItemTypes,
    TraceMetricTypes,
)
from sentry.search.eap.trace_metrics.types import TraceMetricType
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

    def store_metric(self, metric_name: str, metric_type: TraceMetricType = "counter") -> None:
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
            query = {"project": self.project.id}
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
        # Context is always org-level for now, even though a project was passed.
        assert response.data["project"] is None
        assert response.data["brief"] == "Checkout requests"
        assert response.data["additionalContext"] == "Longer notes about the metric."

        context = TraceItemAttributeValueContext.objects.get(
            organization=self.organization,
            project=None,
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

    def test_infers_type_when_single(self) -> None:
        self.store_metric("checkout.requests", "counter")

        # metricType is optional: with a single stored type it is inferred.
        response = self.do_request(
            "checkout.requests",
            {
                "brief": "Checkout requests",
            },
        )

        assert response.status_code == 201, response.data
        assert response.data["attributeType"] == "counter"

    def test_requires_type_when_multiple(self) -> None:
        self.store_eap_items(
            [
                self.create_trace_metric(
                    "checkout.requests", 1, "counter", timestamp=before_now(minutes=10)
                ),
                self.create_trace_metric(
                    "checkout.requests", 1, "gauge", timestamp=before_now(minutes=10)
                ),
            ]
        )

        # Ambiguous: the name exists under two types, so metricType is required.
        ambiguous = self.do_request(
            "checkout.requests",
            {
                "brief": "Checkout requests",
            },
        )
        assert ambiguous.status_code == 400, ambiguous.data
        assert "multiple types" in ambiguous.data["detail"]

        # Passing the type disambiguates.
        resolved = self.do_request(
            "checkout.requests",
            {
                "metricType": "gauge",
                "brief": "Checkout requests",
            },
        )
        assert resolved.status_code == 201, resolved.data
        assert resolved.data["attributeType"] == "gauge"

    def test_rejects_type_not_in_storage(self) -> None:
        self.store_metric("checkout.requests", "counter")

        # The name exists, but not under the requested type.
        response = self.do_request(
            "checkout.requests",
            {
                "metricType": "gauge",
                "brief": "Checkout requests",
            },
        )

        assert response.status_code == 400, response.data
        assert "not found" in response.data["detail"]

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

    def test_writes_org_level_for_multiple_projects(self) -> None:
        # Any project selection (including multiple projects) writes org-level
        # context — the project scope is not used.
        other_project = self.create_project(organization=self.organization)
        self.store_metric("checkout.requests")

        url = reverse(
            self.viewname,
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "metric": "checkout.requests",
            },
        )
        with self.feature(self.feature_flags):
            response = self.client.put(
                url,
                {"metricType": "counter", "brief": "Checkout requests"},
                format="json",
                QUERY_STRING=f"project={self.project.id}&project={other_project.id}",
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

    def test_ignores_unknown_stored_type(self) -> None:
        # A stored type outside counter/gauge/distribution must not resolve to a
        # null attribute_type — the metric is treated as not found instead.
        self.store_eap_items(
            [
                self.create_trace_metric(
                    "weird.metric",
                    1,
                    "histogram",  # type: ignore[arg-type]
                    timestamp=before_now(minutes=10),
                )
            ]
        )

        response = self.do_request(
            "weird.metric",
            {
                "brief": "Weird metric",
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
        # `brief` is required, so an empty body is rejected.
        response = self.do_request("checkout.requests", {})

        assert response.status_code == 400, response.data
        assert "brief" in response.data

    def test_member_role_can_write_context(self) -> None:
        # Authoring metric context is scoped to `event:write`, which the base
        # member role has, rather than `org:write` (Manager/Owner only).
        self.store_metric("checkout.requests")

        member = self.create_user(is_superuser=False)
        self.create_member(
            user=member, organization=self.organization, role="member", teams=[self.team]
        )
        self.login_as(member)

        response = self.do_request(
            "checkout.requests",
            {
                "metricType": "counter",
                "brief": "Checkout requests",
            },
        )

        assert response.status_code == 201, response.data
