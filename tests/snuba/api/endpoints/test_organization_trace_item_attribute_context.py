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

    def do_request(self, key, data, query=None, features=None):
        if features is None:
            features = self.feature_flags
        if query is None:
            query = {"project": self.project.id, "statsPeriod": "7d"}
        url = reverse(
            self.viewname,
            kwargs={"organization_id_or_slug": self.organization.slug, "key": key},
        )
        with self.feature(features):
            return self.client.put(
                url,
                data,
                format="json",
                QUERY_STRING="&".join(f"{name}={value}" for name, value in query.items()),
            )

    def test_creates_context(self) -> None:
        self.store_attribute(my_custom_attr="value")

        response = self.do_request(
            "my_custom_attr",
            {
                "dataset": "spans",
                "attributeType": "string",
                "brief": "My custom attribute",
                "additionalContext": "Longer notes about the attribute.",
                "examples": ["value", "other"],
            },
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

    def test_updates_existing_context(self) -> None:
        self.store_attribute(my_custom_attr="value")

        first = self.do_request(
            "my_custom_attr",
            {
                "dataset": "spans",
                "attributeType": "string",
                "brief": "First",
                "additionalContext": "Longer notes about the attribute.",
                "examples": ["value", "other"],
            },
        )
        assert first.status_code == 201, first.data

        # A brief-only follow-up must not clear the stored optional fields.
        second = self.do_request(
            "my_custom_attr",
            {
                "dataset": "spans",
                "attributeType": "string",
                "brief": "Second",
            },
        )
        assert second.status_code == 200, second.data
        assert second.data["id"] == first.data["id"]
        assert second.data["brief"] == "Second"
        assert second.data["additionalContext"] == "Longer notes about the attribute."
        assert second.data["examples"] == ["value", "other"]

        assert (
            TraceItemAttributeContext.objects.filter(
                organization=self.organization, attribute_key="my_custom_attr"
            ).count()
            == 1
        )

    def test_canonicalizes_typed_tag_syntax(self) -> None:
        self.store_attribute(my_custom_attr="value")

        # Typed-tag syntax and the bare key canonicalize to the same stored row.
        typed = self.do_request(
            "tags[my_custom_attr,string]",
            {
                "dataset": "spans",
                "attributeType": "string",
                "brief": "From typed syntax",
            },
        )
        assert typed.status_code == 201, typed.data
        assert typed.data["attributeKey"] == "my_custom_attr"

        bare = self.do_request(
            "my_custom_attr",
            {
                "dataset": "spans",
                "attributeType": "string",
                "brief": "From bare key",
            },
        )
        assert bare.status_code == 200, bare.data
        assert bare.data["id"] == typed.data["id"]
        assert bare.data["brief"] == "From bare key"

        assert (
            TraceItemAttributeContext.objects.filter(
                organization=self.organization, attribute_key="my_custom_attr"
            ).count()
            == 1
        )

    def test_requires_brief(self) -> None:
        self.store_attribute(my_custom_attr="value")

        response = self.do_request(
            "my_custom_attr",
            {
                "dataset": "spans",
                "attributeType": "string",
            },
        )

        assert response.status_code == 400, response.data
        assert "brief" in response.data

    def test_org_wide_context(self) -> None:
        self.store_attribute(my_custom_attr="value")

        response = self.do_request(
            "my_custom_attr",
            {
                "dataset": "spans",
                "attributeType": "string",
                "brief": "My custom attribute",
            },
            query={"project": -1, "statsPeriod": "7d"},
        )

        assert response.status_code == 201, response.data
        assert response.data["project"] is None
        context = TraceItemAttributeContext.objects.get(attribute_key="my_custom_attr")
        assert context.project_id is None

    def test_org_wide_context_all_projects_sentinel(self) -> None:
        self.store_attribute(my_custom_attr="value")

        # `$all` is the other all-projects sentinel and must also scope org-wide.
        response = self.do_request(
            "my_custom_attr",
            {
                "dataset": "spans",
                "attributeType": "string",
                "brief": "My custom attribute",
            },
            query={"project": "$all", "statsPeriod": "7d"},
        )

        assert response.status_code == 201, response.data
        assert response.data["project"] is None
        context = TraceItemAttributeContext.objects.get(attribute_key="my_custom_attr")
        assert context.project_id is None

    def test_rejects_sentry_convention_attribute(self) -> None:
        self.store_attribute(my_custom_attr="value")

        response = self.do_request(
            "span.op",
            {
                "dataset": "spans",
                "attributeType": "string",
                "brief": "My custom attribute",
            },
        )

        assert response.status_code == 400, response.data
        assert "reserved sentry attribute" in response.data["detail"]
        assert not TraceItemAttributeContext.objects.filter(attribute_key="span.op").exists()

    def test_rejects_sentry_convention_internal_name(self) -> None:
        self.store_attribute(my_custom_attr="value")

        # The internal name must be rejected the same as the public alias.
        response = self.do_request(
            "sentry.op",
            {
                "dataset": "spans",
                "attributeType": "string",
                "brief": "My custom attribute",
            },
        )

        assert response.status_code == 400, response.data
        assert "reserved sentry attribute" in response.data["detail"]

    def test_rejects_sentry_defined_column_without_convention(self) -> None:
        self.store_attribute(my_custom_attr="value")

        # `span.duration` is a Sentry-defined column absent from conventions, still reserved.
        response = self.do_request(
            "span.duration",
            {
                "dataset": "spans",
                "attributeType": "number",
                "brief": "My custom attribute",
            },
        )

        assert response.status_code == 400, response.data
        assert "reserved sentry attribute" in response.data["detail"]

    def test_rejects_nonexistent_attribute(self) -> None:
        self.store_attribute(my_custom_attr="value")

        response = self.do_request(
            "does.not.exist",
            {
                "dataset": "spans",
                "attributeType": "string",
                "brief": "My custom attribute",
            },
        )

        assert response.status_code == 400, response.data
        assert "not found" in response.data["detail"]

    def test_requires_feature_flag(self) -> None:
        self.store_attribute(my_custom_attr="value")

        response = self.do_request(
            "my_custom_attr",
            {
                "dataset": "spans",
                "attributeType": "string",
                "brief": "My custom attribute",
            },
            features={"organizations:visibility-explore-view": True},
        )

        assert response.status_code == 404

    def test_invalid_payload(self) -> None:
        # `dataset` is required in the body.
        response = self.do_request(
            "my_custom_attr",
            {
                "attributeType": "string",
                "brief": "My custom attribute",
            },
        )

        assert response.status_code == 400, response.data
        assert "dataset" in response.data

    def test_member_role_can_write_context(self) -> None:
        # Authoring attribute context is scoped to `event:write`, which the
        # base member role has, rather than `org:write` (Manager/Owner only).
        self.store_attribute(my_custom_attr="value")

        member = self.create_user(is_superuser=False)
        self.create_member(
            user=member, organization=self.organization, role="member", teams=[self.team]
        )
        self.login_as(member)

        response = self.do_request(
            "my_custom_attr",
            {
                "dataset": "spans",
                "attributeType": "string",
                "brief": "My custom attribute",
            },
        )

        assert response.status_code == 201, response.data
