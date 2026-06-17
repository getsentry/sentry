from drf_spectacular.utils import OpenApiExample

from sentry.api.endpoints.organization_trace_item_attributes_types import TraceItemAttributeKey

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


class TraceItemAttributeExamples:
    LIST_TRACE_ITEM_ATTRIBUTES = [
        OpenApiExample(
            "Return a list of trace item attribute keys",
            value=[DEVICE_CLASS, BATCH_SIZE],
            response_only=True,
            status_codes=["200"],
        )
    ]
