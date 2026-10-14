from drf_spectacular.utils import OpenApiExample

flag_log_example = {
    "id": 1,
    "action": "updated",
    "createdAt": "2024-01-01T05:12:33.000000+00:00",
    "createdBy": "jane.doe@example.com",
    "createdByType": "email",
    "flag": "new-checkout-flow",
    "provider": "launchdarkly",
    "tags": {"environment": "production"},
}


class FlagExamples:
    LIST_FLAG_LOGS = [
        OpenApiExample(
            "List an organization's flag logs",
            value={"data": [flag_log_example]},
            status_codes=["200"],
            response_only=True,
        )
    ]

    GET_FLAG_LOG = [
        OpenApiExample(
            "Retrieve a flag log",
            value={"data": flag_log_example},
            status_codes=["200"],
            response_only=True,
        )
    ]
