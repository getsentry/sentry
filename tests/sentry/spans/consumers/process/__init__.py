def build_mock_span(project_id, span_op=None, is_segment=False, sentry_tags=None, **kwargs):
    span = {
        "description": "OrganizationNPlusOne",
        "duration_ms": 107,
        "is_segment": is_segment,
        "is_remote": is_segment,
        "parent_span_id": None,
        "profile_id": "dbae2b82559649a1a34a2878134a007b",
        "project_id": project_id,
        "organization_id": 1,
        "received": 1707953019.044972,
        "retention_days": 90,
        "segment_id": "a49b42af9fb69da0",
        "sentry_tags": {
            "environment": "development",
            "op": span_op or "base.dispatch.sleep",
            "release": "backend@24.2.0.dev0+699ce0cd1281cc3c7275d0a474a595375c769ae8",
            "platform": "python",
            **(sentry_tags or {}),
        },
        "span_id": "a49b42af9fb69da0",
        "start_timestamp_ms": 1707953018865,
        "start_timestamp_precise": 1707953018.865,
        "end_timestamp_precise": 1707953018.972,
        "trace_id": "94576097f3a64b68b85a59c7d4e3ee2a",
    }

    span.update(**kwargs)
    return span
