from sentry.sentry_apps.metrics import SentryAppEventType

MOCK_RUN_ID = 123
MOCK_SEER_WEBHOOKS = {
    SentryAppEventType.SEER_ROOT_CAUSE_COMPLETED: {
        "run_id": MOCK_RUN_ID,
        "root_cause": {
            "description": "Test description",
            "steps": [{"title": "Step 1"}, {"title": "Step 2"}],
        },
    },
    SentryAppEventType.SEER_SOLUTION_COMPLETED: {
        "run_id": MOCK_RUN_ID,
        "solution": {
            "description": "Test description",
            "steps": [{"title": "Step 1"}, {"title": "Step 2"}],
        },
    },
    SentryAppEventType.SEER_CODING_COMPLETED: {
        "run_id": MOCK_RUN_ID,
        "changes": [
            {
                "repo_name": "Test repo",
                "diff": "Test diff",
                "title": "Test title",
                "description": "Test description",
            }
        ],
    },
    SentryAppEventType.SEER_PR_CREATED: {
        "run_id": MOCK_RUN_ID,
        "pull_requests": [
            {
                "pull_request": {
                    "pr_number": 123,
                    "pr_url": "https://github.com/owner/repo/pull/123",
                },
            }
        ],
    },
}
