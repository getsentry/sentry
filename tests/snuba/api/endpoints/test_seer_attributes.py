from uuid import uuid4

from sentry.seer.assisted_query.traces_tools import (
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
            is_eap=True,
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
        assert result == {
            "fields": {
                "string": [
                    "span.description",
                    "project",
                    "transaction",
                ],
                "number": ["span.duration"],
            },
            "built_in_fields": [
                {"key": "id", "type": "string"},
                {"key": "project", "type": "string"},
                {"key": "span.description", "type": "string"},
                {"key": "span.op", "type": "string"},
                {"key": "timestamp", "type": "string"},
                {"key": "transaction", "type": "string"},
                {"key": "trace", "type": "string"},
                {"key": "is_transaction", "type": "string"},
                {"key": "sentry.normalized_description", "type": "string"},
                {"key": "release", "type": "string"},
                {"key": "project.id", "type": "string"},
                {"key": "sdk.name", "type": "string"},
                {"key": "sdk.version", "type": "string"},
                {"key": "span.system", "type": "string"},
                {"key": "span.category", "type": "string"},
                {"key": "span.duration", "type": "number"},
                {"key": "span.self_time", "type": "number"},
            ],
        }

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
                is_eap=True,
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
                is_eap=True,
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
            is_eap=True,
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

        assert result == {
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
