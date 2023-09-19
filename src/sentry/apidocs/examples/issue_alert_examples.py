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

    # TODO: can i reuse the sample used for creating a rule?
    GET_PROJECT_RULE = []

    UPDATE_PROJECT_RULE = []
