from datetime import datetime

from drf_spectacular.utils import OpenApiExample

from sentry.api.endpoints.organization_trace_item_attributes_types import TraceItemAttributeKey
from sentry.api.serializers.models.trace_item_attribute_context import (
    TraceItemAttributeContextResponse,
)
from sentry.api.serializers.models.trace_item_attribute_value_context import (
    TraceItemAttributeValueContextResponse,
)

DEVICE_CLASS: TraceItemAttributeKey = {
    "key": "device.class",
    "name": "device.class",
    "attributeSource": {"source_type": "sentry"},
    "attributeType": "string",
}

BATCH_SIZE: TraceItemAttributeKey = {
    "key": "tags[Batch Size,number]",
    "name": "Batch Size",
    "attributeSource": {"source_type": "user"},
    "attributeType": "number",
}

PAYMENT_PROVIDER_CONTEXT: TraceItemAttributeContextResponse = {
    "id": "42",
    "attributeKey": "payment.provider",
    "dataset": "spans",
    "attributeType": "string",
    "project": "4505281256090153",
    "brief": "The payment processor that handled the checkout request.",
    "additionalContext": "Only set on spans emitted by the checkout service.",
    "examples": ["stripe", "adyen", "paypal"],
    "dateCreated": datetime.fromisoformat("2026-09-01T12:00:00.000000Z"),
    "dateUpdated": datetime.fromisoformat("2026-09-02T08:30:00.000000Z"),
}

CHECKOUT_DURATION_CONTEXT: TraceItemAttributeValueContextResponse = {
    "id": "7",
    "attributeName": "metric.name",
    "attributeValue": "checkout.duration",
    "dataset": "tracemetrics",
    "attributeType": "distribution",
    "brief": "End-to-end time to complete a checkout, in milliseconds.",
    "additionalContext": None,
    "dateCreated": datetime.fromisoformat("2026-09-01T12:00:00.000000Z"),
    "dateUpdated": datetime.fromisoformat("2026-09-01T12:00:00.000000Z"),
}


class TraceItemAttributeExamples:
    LIST_TRACE_ITEM_ATTRIBUTES = [
        OpenApiExample(
            "Return a list of trace item attribute keys",
            value=[DEVICE_CLASS, BATCH_SIZE],
            response_only=True,
            status_codes=["200"],
        )
    ]

    UPDATE_TRACE_ITEM_ATTRIBUTE_CONTEXT = [
        OpenApiExample(
            "Create or update the context for a custom attribute",
            value=PAYMENT_PROVIDER_CONTEXT,
            response_only=True,
            status_codes=["200", "201"],
        )
    ]

    UPDATE_TRACE_ITEM_METRIC_CONTEXT = [
        OpenApiExample(
            "Create or update the context for a trace metric",
            value=CHECKOUT_DURATION_CONTEXT,
            response_only=True,
            status_codes=["200", "201"],
        )
    ]
