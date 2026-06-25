from uuid import uuid4

from django.urls import reverse

from sentry.explore.models import (
    TraceItemAttributeContext,
    TraceItemAttributeTypes,
    TraceItemTypes,
)
from sentry.testutils.cases import APITestCase, BaseSpansTestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now


class OrganizationTraceItemAttributeContextEndpointTest(
    APITestCase, BaseSpansTestCase, SnubaTestCase
):
    viewname = "sentry-api-0-organization-trace-item-attribute-context"

    feature_flags = {
        "organizations:visibility-explore-view": True,
        "organizations:data-browsing-attribute-context": True,
    }

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

    def store_attribute(self, **tags: str) -> None:
        self.store_segment(
            self.project.id,
            uuid4().hex,
            uuid4().hex,
            organization_id=self.organization.id,
            timestamp=before_now(days=0, minutes=10).replace(microsecond=0),
            tags=tags,
        )

    def do_request(self, data, query=None, features=None):
        if features is None:
            features = self.feature_flags
        if query is None:
            query = {"project": self.project.id, "statsPeriod": "7d"}
        url = reverse(self.viewname, kwargs={"organization_id_or_slug": self.organization.slug})
        with self.feature(features):
            return self.client.post(
                url,
                data,
                format="json",
                QUERY_STRING="&".join(f"{key}={value}" for key, value in query.items()),
            )

    def test_creates_context(self) -> None:
        self.store_attribute(my_custom_attr="value")

        response = self.do_request(
            {
                "attributeKey": "my_custom_attr",
                "dataset": "spans",
                "attributeType": "string",
                "brief": "My custom attribute",
                "additionalContext": "Longer notes about the attribute.",
                "examples": ["value", "other"],
            }
        )

        assert response.status_code == 201, response.data
        assert response.data["attributeKey"] == "my_custom_attr"
        assert response.data["brief"] == "My custom attribute"
        assert response.data["additionalContext"] == "Longer notes about the attribute."
        assert response.data["examples"] == ["value", "other"]
        assert response.data["project"] == str(self.project.id)
        assert response.data["dataset"] == "spans"
        assert response.data["attributeType"] == "string"

        context = TraceItemAttributeContext.objects.get(
            organization=self.organization,
            project=self.project,
            attribute_key="my_custom_attr",
        )
        assert context.brief == "My custom attribute"
        assert context.additional_context == "Longer notes about the attribute."
        assert context.examples == ["value", "other"]
        assert context.item_type == TraceItemTypes.get_id_for_type_name("spans")
        assert context.attribute_type == TraceItemAttributeTypes.get_id_for_type_name("string")
        assert context.created_by_id == self.user.id
        assert context.updated_by_id == self.user.id
        assert context.last_received is not None

    def test_updates_existing_context(self) -> None:
        self.store_attribute(my_custom_attr="value")

        first = self.do_request(
            {
                "attributeKey": "my_custom_attr",
                "dataset": "spans",
                "attributeType": "string",
                "brief": "First",
            }
        )
        assert first.status_code == 201, first.data

        second = self.do_request(
            {
                "attributeKey": "my_custom_attr",
                "dataset": "spans",
                "attributeType": "string",
                "brief": "Second",
            }
        )
        assert second.status_code == 200, second.data
        assert second.data["id"] == first.data["id"]
        assert second.data["brief"] == "Second"

        assert (
            TraceItemAttributeContext.objects.filter(
                organization=self.organization, attribute_key="my_custom_attr"
            ).count()
            == 1
        )

    def test_org_wide_context(self) -> None:
        self.store_attribute(my_custom_attr="value")

        response = self.do_request(
            {
                "attributeKey": "my_custom_attr",
                "dataset": "spans",
                "attributeType": "string",
            },
            query={"project": -1, "statsPeriod": "7d"},
        )

        assert response.status_code == 201, response.data
        assert response.data["project"] is None
        context = TraceItemAttributeContext.objects.get(attribute_key="my_custom_attr")
        assert context.project_id is None

    def test_rejects_sentry_convention_attribute(self) -> None:
        self.store_attribute(my_custom_attr="value")

        response = self.do_request(
            {
                "attributeKey": "span.op",
                "dataset": "spans",
                "attributeType": "string",
            }
        )

        assert response.status_code == 400, response.data
        assert "sentry convention" in response.data["detail"]
        assert not TraceItemAttributeContext.objects.filter(attribute_key="span.op").exists()

    def test_rejects_nonexistent_attribute(self) -> None:
        self.store_attribute(my_custom_attr="value")

        response = self.do_request(
            {
                "attributeKey": "does.not.exist",
                "dataset": "spans",
                "attributeType": "string",
            }
        )

        assert response.status_code == 400, response.data
        assert "not found" in response.data["detail"]

    def test_requires_feature_flag(self) -> None:
        self.store_attribute(my_custom_attr="value")

        response = self.do_request(
            {
                "attributeKey": "my_custom_attr",
                "dataset": "spans",
                "attributeType": "string",
            },
            features={"organizations:visibility-explore-view": True},
        )

        assert response.status_code == 404

    def test_invalid_payload(self) -> None:
        response = self.do_request(
            {
                "dataset": "spans",
                "attributeType": "string",
            }
        )

        assert response.status_code == 400, response.data
        assert "attributeKey" in response.data
