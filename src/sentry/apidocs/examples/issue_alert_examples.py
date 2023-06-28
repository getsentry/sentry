from drf_spectacular.utils import OpenApiExample


class IssueAlertExamples:
    GENERIC_SUCCESS_RESPONSE = [
        OpenApiExample(
            "Successful response",
            value={},
            status_codes=["200"],
            response_only=True,
        )
    ]
