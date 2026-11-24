from datetime import datetime

from drf_spectacular.utils import OpenApiExample

from sentry.api.serializers.models.userreport_with_group import (
    UserReportWithGroupSerializerResponse,
)

USER_FEEDBACK: UserReportWithGroupSerializerResponse = {
    "comments": "It broke!",
    "dateCreated": datetime.fromisoformat("2018-11-06T21:20:11.468Z"),
    "email": "jane@example.com",
    "event": {
        "eventID": "14bad9a2e3774046977a21440ddb39b2",
        "id": "14bad9a2e3774046977a21440ddb39b2",
    },
    "eventID": "14bad9a2e3774046977a21440ddb39b2",
    "id": "1",
    "issue": None,
    "name": "Jane Smith",
    "user": None,
}


class UserFeedbackExamples:
    LIST_USER_FEEDBACK = [
        OpenApiExample(
            "Return a list of user feedback items within a project",
            value=[USER_FEEDBACK],
            response_only=True,
            status_codes=["200"],
        )
    ]
    SUBMIT_USER_FEEDBACK = [
        OpenApiExample(
            "Submit user feedback for an event",
            value={
                "event_id": "14bad9a2e3774046977a21440ddb39b2",
                "name": "Jane Schmidt",
                "email": "jane@empowerplant.io",
                "comments": "It broke!",
            },
            request_only=True,
        ),
        OpenApiExample(
            "Return the submitted user feedback",
            value=USER_FEEDBACK,
            response_only=True,
            status_codes=["200"],
        ),
    ]
