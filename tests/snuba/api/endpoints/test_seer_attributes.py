from uuid import uuid4

from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey

from sentry.api.endpoints.seer_rpc import get_attribute_names, get_attribute_values
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
            "fields": [
                {
                    "key": "span.description",
                    "type": AttributeKey.Type.TYPE_STRING,
                },
                {
                    "key": "transaction",
                    "type": AttributeKey.Type.TYPE_STRING,
                },
                {
                    "key": "project",
                    "type": AttributeKey.Type.TYPE_STRING,
                },
                {
                    "key": "span.duration",
                    "type": AttributeKey.Type.TYPE_DOUBLE,
                },
            ]
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
            fields=attribute_names["fields"],
            org_id=self.organization.id,
            project_ids=[self.project.id],
            stats_period="7d",
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
                "span.duration": [],
            }
        }
