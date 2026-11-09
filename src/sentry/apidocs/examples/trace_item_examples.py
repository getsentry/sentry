from drf_spectacular.utils import OpenApiExample

SPAN = {
    "itemId": "8873a98879faf06d",
    "timestamp": "2025-01-01T12:00:00Z",
    "attributes": [
        {"name": "is_transaction", "type": "bool", "value": True},
        {"name": "span.duration", "type": "float", "value": 132.5},
        {"name": "project_id", "type": "int", "value": "4505281256090153"},
        {"name": "span.op", "type": "str", "value": "http.server"},
        {"name": "transaction", "type": "str", "value": "GET /api/checkout/"},
    ],
    "meta": {},
    "links": [
        {
            "itemId": "e3c58cb0bd2d4c89",
            "traceId": "d099bf9ad5a143cf8f83a98081d0ed3b",
            "sampled": True,
            "attributes": [{"name": "sentry.link.type", "value": "previous_trace", "type": "str"}],
        }
    ],
}

LOG = {
    "itemId": "0197fb2a5c5e7d72a8a3a6c94e8f2b1d",
    "timestamp": "2025-01-01T12:00:00Z",
    "attributes": [
        {"name": "severity_number", "type": "int", "value": "9"},
        {"name": "message", "type": "str", "value": "Payment processed for order 1234..."},
        {"name": "severity", "type": "str", "value": "info"},
        {"name": "trace", "type": "str", "value": "d099bf9ad5a143cf8f83a98081d0ed3b"},
    ],
    "meta": {"message": {"length": 300, "reason": "value too long"}},
    "links": None,
}


class TraceItemExamples:
    RETRIEVE_TRACE_ITEM = [
        OpenApiExample(
            "Retrieve a span",
            value=SPAN,
            response_only=True,
            status_codes=["200"],
        ),
        OpenApiExample(
            "Retrieve a log",
            value=LOG,
            response_only=True,
            status_codes=["200"],
        ),
    ]
