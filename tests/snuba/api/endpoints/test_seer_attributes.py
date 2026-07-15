from uuid import uuid4

from sentry.seer.assisted_query.traces_tools import (
    _get_built_in_fields,
    get_attribute_names,
    get_attribute_values_with_substring,
)
from sentry.seer.endpoints.seer_rpc import get_attributes_and_values
from sentry.testutils.cases import BaseSpansTestCase
from sentry.testutils.helpers.datetime import before_now
from tests.snuba.api.endpoints.test_organization_trace_item_attributes import (
    OrganizationTraceItemAttributesEndpointTestBase,
)


class OrganizationTraceItemAttributesEndpointSpansTest(
    OrganizationTraceItemAttributesEndpointTestBase, BaseSpansTestCase
):
    def test_get_attribute_names(self) -> None:
        self.store_segment(
            self.project.id,
            uuid4().hex,
            uuid4().hex,
            span_id=uuid4().hex[:16],
            organization_id=self.organization.id,
            parent_span_id=None,
            timestamp=before_now(days=0, minutes=10).replace(microsecond=0),
            transaction="foo",
            duration=100,
            exclusive_time=100,
        )

        with self.feature(
            [
                "organizations:visibility-explore-view",
            ]
        ):
            result = get_attribute_names(
                org_id=self.organization.id,
                project_ids=[self.project.id],
                stats_period="7d",
            )
        assert result.dict() == {
            "fields": {
                "string": [
                    "transaction",
                    "span.description",
                    "device.class",
                    "span.module",
                    "project",
                ],
                "number": ["span.duration"],
            },
            "built_in_fields": [
                {"key": "id", "type": "string", "context": None},
                {"key": "project", "type": "string", "context": None},
                {"key": "span.description", "type": "string", "context": None},
                {"key": "span.op", "type": "string", "context": None},
                {"key": "timestamp", "type": "string", "context": None},
                {"key": "transaction", "type": "string", "context": None},
                {"key": "trace", "type": "string", "context": None},
                {"key": "is_transaction", "type": "string", "context": None},
                {"key": "sentry.normalized_description", "type": "string", "context": None},
                {"key": "release", "type": "string", "context": None},
                {"key": "project.id", "type": "string", "context": None},
                {"key": "sdk.name", "type": "string", "context": None},
                {"key": "sdk.version", "type": "string", "context": None},
                {"key": "span.system", "type": "string", "context": None},
                {"key": "span.category", "type": "string", "context": None},
                {"key": "span.duration", "type": "number", "context": None},
                {"key": "span.self_time", "type": "number", "context": None},
            ],
        }

    def test_get_attribute_names_with_context(self) -> None:
        self.store_segment(
            self.project.id,
            uuid4().hex,
            uuid4().hex,
            span_id=uuid4().hex[:16],
            organization_id=self.organization.id,
            parent_span_id=None,
            timestamp=before_now(days=0, minutes=10).replace(microsecond=0),
            transaction="foo",
            duration=100,
            exclusive_time=100,
        )

        with self.feature(
            [
                "organizations:visibility-explore-view",
                "organizations:data-browsing-attribute-context",
            ]
        ):
            result = get_attribute_names(
                org_id=self.organization.id,
                project_ids=[self.project.id],
                stats_period="7d",
                include_context=True,
            )

        built_in_by_key = {field.key: field for field in result.built_in_fields}

        # A deprecated built-in attribute surfaces its conventions context,
        # including the replacement attribute.
        transaction_context = built_in_by_key["transaction"].context
        assert transaction_context is not None
        assert transaction_context["isDeprecated"] is True
        assert transaction_context["replacementAttribute"] == "sentry.segment.name"
        assert transaction_context["brief"]

        # Built-in fields that aren't returned by the public endpoint (e.g. no
        # data for them) carry no context.
        assert built_in_by_key["span.self_time"].context is None

        # Convention-backed attributes that aren't hardcoded built-ins (e.g.
        # device.class) are still surfaced in built_in_fields with their context.
        assert "device.class" not in {f["key"] for f in _get_built_in_fields("spans")}
        device_class_context = built_in_by_key["device.class"].context
        assert device_class_context is not None
        assert device_class_context["isConvention"] is True
        assert device_class_context["brief"]

        # Sentry-defined attributes that aren't conventions (e.g. span.description)
        # carry context too, marked isConvention=False.
        span_description_context = built_in_by_key["span.description"].context
        assert span_description_context is not None
        assert span_description_context["isConvention"] is False
        assert span_description_context["brief"]

        # Context is either None or populated, never an empty dict (the endpoint
        # attaches an empty context to attributes without convention metadata).
        for field in result.built_in_fields:
            assert field.context is None or field.context != {}

    def test_get_attribute_values_with_substring(self) -> None:
        for transaction in ["foo", "bar", "baz"]:
            self.store_segment(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=uuid4().hex[:16],
                organization_id=self.organization.id,
                parent_span_id=None,
                timestamp=before_now(days=0, minutes=10).replace(microsecond=0),
                transaction=transaction,
                duration=100,
                exclusive_time=100,
            )

        with self.feature(
            [
                "organizations:visibility-explore-view",
            ]
        ):
            result = get_attribute_values_with_substring(
                org_id=self.organization.id,
                project_ids=[self.project.id],
                stats_period="7d",
                fields_with_substrings=[
                    {
                        "field": "transaction",
                        "substring": "ba",
                    },
                    {
                        "field": "transaction",
                        "substring": "b",
                    },
                ],
            )

        assert result == {
            "transaction": ["bar", "baz"],
        }

    def test_get_attributes_and_values(self) -> None:
        for tag_value in ["foo", "bar", "baz"]:
            self.store_segment(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=uuid4().hex[:16],
                organization_id=self.organization.id,
                parent_span_id=None,
                timestamp=before_now(days=0, minutes=10).replace(microsecond=0),
                tags={"test_tag": tag_value},
                duration=100,
                exclusive_time=100,
            )

        self.store_segment(
            self.project.id,
            uuid4().hex,
            uuid4().hex,
            span_id=uuid4().hex[:16],
            organization_id=self.organization.id,
            parent_span_id=None,
            timestamp=before_now(days=0, minutes=10).replace(microsecond=0),
            tags={"another_tag": "another_value"},
            duration=100,
            exclusive_time=100,
        )

        with self.feature(
            [
                "organizations:visibility-explore-view",
            ]
        ):
            result = get_attributes_and_values(
                org_id=self.organization.id,
                project_ids=[self.project.id],
                stats_period="7d",
                sampled=False,
                attributes_ignored=[
                    "sentry.segment_id",
                    "sentry.event_id",
                    "sentry.raw_description",
                    "sentry.transaction",
                ],
            )

        assert result.dict() == {
            "attributes_and_values": {
                "test_tag": [
                    {"value": "foo", "count": 1.0},
                    {"value": "baz", "count": 1.0},
                    {"value": "bar", "count": 1.0},
                ],
                "another_tag": [
                    {"value": "another_value", "count": 1.0},
                ],
            },
        }

    def test_get_attribute_values_with_substring_empty_field_list(self) -> None:
        """Test handling of empty fields_with_substrings list"""
        result = get_attribute_values_with_substring(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            stats_period="7d",
            fields_with_substrings=[],
        )

        expected: dict = {}
        assert result == expected
