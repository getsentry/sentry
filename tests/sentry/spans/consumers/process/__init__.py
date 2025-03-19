def build_mock_span(project_id, span_op=None, **kwargs):
    span = {
        "description": "OrganizationNPlusOne",
        "duration_ms": 107,
        "event_id": "61ccae71d70f45bb9b1f2ccb7f7a49ec",
        "exclusive_time_ms": 107.359,
        "is_segment": True,
        "parent_span_id": "b35b839c02985f33",
        "profile_id": "dbae2b82559649a1a34a2878134a007b",
        "project_id": project_id,
        "organization_id": 1,
        "received": 1707953019.044972,
        "retention_days": 90,
        "segment_id": "a49b42af9fb69da0",
        "sentry_tags": {
            "browser.name": "Google Chrome",
            "environment": "development",
            "op": span_op or "base.dispatch.sleep",
            "release": "backend@24.2.0.dev0+699ce0cd1281cc3c7275d0a474a595375c769ae8",
            "transaction": "/api/0/organizations/{organization_id_or_slug}/n-plus-one/",
            "transaction.method": "GET",
            "transaction.op": "http.server",
            "user": "id:1",
            "platform": "python",
        },
        "span_id": "a49b42af9fb69da0",
        "start_timestamp_ms": 1707953018865,
        "start_timestamp_precise": 1707953018.865,
        "end_timestamp_precise": 1707953018.972,
        "trace_id": "94576097f3a64b68b85a59c7d4e3ee2a",
    }

    span.update(**kwargs)
    return span
