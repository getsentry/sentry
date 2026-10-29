from drf_spectacular.utils import OpenApiExample

WORKFLOW_RUNS_RESPONSE = [
    OpenApiExample(
        name="Successful workflow run",
        value={
            "runs": [
                {
                    "id": "101",
                    "configId": "10",
                    "strategy": "breached_metric_investigation",
                    "status": "complete",
                    "dateAdded": "2025-01-01T10:00:00Z",
                    "dateUpdated": "2025-01-01T10:02:00Z",
                    "dateCompleted": "2025-01-01T10:02:00Z",
                    "executions": [
                        {
                            "id": "201",
                            "seerRunId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
                            "status": "complete",
                            "dateAdded": "2025-01-01T10:00:10Z",
                            "dateUpdated": "2025-01-01T10:02:00Z",
                            "dateCompleted": "2025-01-01T10:02:00Z",
                        }
                    ],
                }
            ]
        },
        response_only=True,
        status_codes=["200"],
    ),
    OpenApiExample(
        name="Workflow run with an error",
        value={
            "runs": [
                {
                    "id": "102",
                    "configId": "10",
                    "strategy": "breached_metric_investigation",
                    "status": "failed",
                    "dateAdded": "2025-01-02T10:00:00Z",
                    "dateUpdated": "2025-01-02T10:00:20Z",
                    "dateCompleted": "2025-01-02T10:00:20Z",
                    "error": {"code": "unknown", "message": "No error details are available."},
                    "executions": [
                        {
                            "id": "202",
                            "seerRunId": None,
                            "status": "failed",
                            "dateAdded": "2025-01-02T10:00:10Z",
                            "dateUpdated": "2025-01-02T10:00:20Z",
                            "dateCompleted": "2025-01-02T10:00:20Z",
                            "error": {
                                "code": "dispatch_failed",
                                "message": "Could not start execution.",
                            },
                        }
                    ],
                }
            ]
        },
        response_only=True,
        status_codes=["200"],
    ),
    OpenApiExample(
        name="Invalid config filter",
        value={"detail": {"config": ["A valid integer is required."]}},
        response_only=True,
        status_codes=["400"],
    ),
]
