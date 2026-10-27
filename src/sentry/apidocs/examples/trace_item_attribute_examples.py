from datetime import datetime

from drf_spectacular.utils import OpenApiExample

from sentry.api.endpoints.organization_trace_item_attributes_types import (
    RankedAttributesResponse,
    TraceItemAttributeKey,
    TraceItemAttributeValidateResponse,
)
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

VALIDATED_ATTRIBUTES: TraceItemAttributeValidateResponse = {
    "attributes": {
        "span.duration": {"valid": True, "type": "number"},
        "payment.provider": {"valid": True, "type": "string"},
        "not.a.real.attr": {"valid": False, "error": "Unknown attribute: not.a.real.attr"},
    }
}

RANKED_ATTRIBUTES: RankedAttributesResponse = {
    "rankedAttributes": [
        {
            "attributeName": "browser.name",
            "cohort1": [{"label": "Safari", "value": 812.0}, {"label": "Chrome", "value": 95.0}],
            "cohort2": [{"label": "Chrome", "value": 6120.0}, {"label": "Safari", "value": 410.0}],
            "order": {"rrr": 0},
        },
        {
            "attributeName": "span.op",
            "cohort1": [{"label": "http.client", "value": 907.0}],
            "cohort2": [
                {"label": "http.client", "value": 3102.0},
                {"label": "db", "value": 3428.0},
            ],
            "order": {"rrr": 1},
        },
    ],
    "rankingInfo": {"function": "p95(span.duration)", "value": 1204.5, "above": True},
    "cohort1Total": 907,
    "cohort2Total": 6530,
}

TRACE_LOGS = {
    "data": [
        {
            "id": "99083e5c2ee246be1242ee264d20fd58",
            "project.id": 4505281256090153,
            "trace": "a9f3c1e2b4d5467890abcdef12345678",
            "severity_number": 9,
            "severity": "INFO",
            "timestamp": "2026-09-01T12:00:00+00:00",
            "timestamp_precise": 1.756728000123e18,
            "message": "Payment processed",
        }
    ],
    "meta": {
        "fields": {
            "id": "string",
            "project.id": "string",
            "trace": "string",
            "severity_number": "integer",
            "severity": "string",
            "timestamp": "string",
            "timestamp_precise": "number",
            "message": "string",
        },
        "full_scan": True,
        "bytes_scanned": 255,
        "routingHint": "eyJ2IjogMSwgInRpZXIiOiAxfQ==",
    },
    "confidence": [{}],
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

    VALIDATE_TRACE_ITEM_ATTRIBUTES = [
        OpenApiExample(
            "Validate a list of attribute names",
            value=VALIDATED_ATTRIBUTES,
            response_only=True,
            status_codes=["200"],
        )
    ]

    LIST_RANKED_ATTRIBUTES = [
        OpenApiExample(
            "Rank span attributes for slow spans",
            value=RANKED_ATTRIBUTES,
            response_only=True,
            status_codes=["200"],
        )
    ]

    LIST_TRACE_LOGS = [
        OpenApiExample(
            "List the logs in a trace",
            value=TRACE_LOGS,
            response_only=True,
            status_codes=["200"],
        )
    ]
