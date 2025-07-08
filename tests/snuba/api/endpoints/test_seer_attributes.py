from uuid import uuid4

from sentry.api.endpoints.seer_rpc import (
    get_attribute_names,
    get_attribute_values,
    get_attribute_values_with_substring,
    get_attributes_and_values,
)
from sentry.testutils.cases import BaseSpansTestCase
from sentry.testutils.helpers.datetime import before_now
from tests.snuba.api.endpoints.test_organization_trace_item_attributes import (
    OrganizationTraceItemAttributesEndpointTestBase,
)


class OrganizationTraceItemAttributesEndpointSpansTest(
    OrganizationTraceItemAttributesEndpointTestBase, BaseSpansTestCase
):
    def test_get_attribute_names(self):
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
        }

    def test_get_attribute_values(self):
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

        attribute_names = get_attribute_names(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            stats_period="7d",
        )

        result = get_attribute_values(
            fields=attribute_names["fields"]["string"],
            org_id=self.organization.id,
            project_ids=[self.project.id],
            stats_period="7d",
            sampled=False,
        )

        assert result == {
            "values": {
                "span.description": [
                    "bar",
                    "baz",
                    "foo",
                ],
                "transaction": [
                    "bar",
                    "baz",
                    "foo",
                ],
                "project": [],
            }
        }

    def test_get_attribute_values_with_substring(self):
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
            sampled=False,
        )

        assert result == {
            "values": {
                "transaction": {"bar", "baz"},
            }
        }

    def test_get_attributes_and_values(self):
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

        result = get_attributes_and_values(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            stats_period="7d",
            sampled=False,
        )

        assert result == {
            "attributes_and_values": [
                {
                    "test_tag": [
                        {"value": "foo", "count": 1.0},
                        {"value": "baz", "count": 1.0},
                        {"value": "bar", "count": 1.0},
                    ],
                },
                {
                    "another_tag": [
                        {"value": "another_value", "count": 1.0},
                    ],
                },
            ]
        }
