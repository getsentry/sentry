from typing import int
from sentry_kafka_schemas.schema_types.ingest_spans_v1 import SpanEvent


def build_mock_span(project_id, *, span_op=None, is_segment=False, attributes=None, **kwargs):
    span: SpanEvent = {
        "is_segment": is_segment,
        "parent_span_id": None,
        "project_id": project_id,
        "organization_id": 1,
        "received": 1707953019.044972,
        "retention_days": 90,
        "attributes": {
            "sentry.duration": {"value": 0.107, "type": "double"},
            "sentry.environment": {"value": "development", "type": "string"},
            "sentry.release": {
                "value": "backend@24.2.0.dev0+699ce0cd1281cc3c7275d0a474a595375c769ae8",
                "type": "string",
            },
            "sentry.platform": {"value": "python", "type": "string"},
            "sentry.op": {"value": span_op or "base.dispatch.sleep", "type": "string"},
            "sentry.segment.id": {"value": "a49b42af9fb69da0", "type": "string"},
            "sentry.profile_id": {"type": "string", "value": "dbae2b82559649a1a34a2878134a007b"},
            **(attributes or {}),
        },
        "span_id": "a49b42af9fb69da0",
        "start_timestamp": 1707953018.865,
        "end_timestamp": 1707953018.972,
        "trace_id": "94576097f3a64b68b85a59c7d4e3ee2a",
        "name": "OrganizationNPlusOne",
        "status": "ok",
    }

    span.update(**kwargs)  # type:ignore[call-arg]
    return span
