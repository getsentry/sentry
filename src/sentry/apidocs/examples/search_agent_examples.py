from drf_spectacular.utils import OpenApiExample

TRANSLATE_RESPONSE = {
    "responses": [
        {
            "query": "span.op:http.client span.duration:>1s",
            "group_by": ["span.description"],
            "visualization": [
                {"chart_type": 1, "y_axes": ["p95(span.duration)"], "interval": None}
            ],
            "sort": "-p95(span.duration)",
            "stats_period": "24h",
            "start": None,
            "end": None,
            "mode": "aggregates",
            "result_count": 12,
            "span_query": None,
            "log_query": None,
            "metric_query": None,
        }
    ],
    "unsupported_reason": None,
    "run_id": 12345,
    "project_ids": [1],
    "reflection": None,
}


class SearchAgentExamples:
    START_RESPONSE = [
        OpenApiExample(
            name="Search Agent Started",
            value={"run_id": 12345, "sentry_run_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479"},
            response_only=True,
            status_codes=["200"],
        ),
    ]

    STATE_RESPONSE = [
        OpenApiExample(
            name="Search Agent Processing",
            value={
                "session": {
                    "run_id": 12345,
                    "org_id": 1,
                    "org_slug": "my-org",
                    "natural_language_query": "slowest http requests in the last day",
                    "strategy": "Traces",
                    "status": "processing",
                    "current_step": {"key": "test_query"},
                    "completed_steps": [{"key": "fetch_tag_values"}],
                    "final_query": None,
                    "unsupported_reason": None,
                    "final_response": None,
                    "updated_at": "2026-09-25T15:00:02.000000Z",
                    "created_at": "2026-09-25T15:00:00.000000Z",
                },
                "sentry_run_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
            },
            response_only=True,
            status_codes=["200"],
        ),
        OpenApiExample(
            name="Search Agent Completed",
            value={
                "session": {
                    "run_id": 12345,
                    "org_id": 1,
                    "org_slug": "my-org",
                    "natural_language_query": "slowest http requests in the last day",
                    "strategy": "Traces",
                    "status": "completed",
                    "current_step": None,
                    "completed_steps": [{"key": "fetch_tag_values"}, {"key": "test_query"}],
                    "final_query": "span.op:http.client span.duration:>1s",
                    "unsupported_reason": None,
                    "final_response": TRANSLATE_RESPONSE,
                    "updated_at": "2026-09-25T15:00:09.000000Z",
                    "created_at": "2026-09-25T15:00:00.000000Z",
                },
                "sentry_run_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
            },
            response_only=True,
            status_codes=["200"],
        ),
    ]

    TRANSLATE_RESPONSE = [
        OpenApiExample(
            name="Translated Query",
            value=TRANSLATE_RESPONSE,
            response_only=True,
            status_codes=["200"],
        ),
    ]
