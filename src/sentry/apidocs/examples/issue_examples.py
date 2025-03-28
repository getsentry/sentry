from datetime import datetime

from drf_spectacular.utils import OpenApiExample

from sentry.api.serializers.models.group_stream import StreamGroupSerializerSnubaResponse

SIMPLE_ISSUE: StreamGroupSerializerSnubaResponse = {
    "annotations": [],
    "assignedTo": {"id": "1", "name": "John Doe", "email": "john.doe@example.com"},
    "count": 150,
    "culprit": "raven.scripts.runner in main",
    "firstSeen": datetime.fromisoformat("2018-11-06T21:19:55Z"),
    "hasSeen": False,
    "id": "1",
    "isBookmarked": False,
    "isPublic": False,
    "isSubscribed": True,
    "lastSeen": datetime.fromisoformat("2018-11-06T21:19:55Z"),
    "level": "error",
    "logger": None,
    "metadata": {"title": "This is an example Python exception"},
    "numComments": 0,
    "permalink": "https://sentry.io/the-interstellar-jurisdiction/pump-station/issues/1/",
    "project": {"id": "2", "name": "Pump Station", "slug": "pump-station"},
    "shareId": None,
    "shortId": "PUMP-STATION-1",
    "stats": {
        "24h": [
            [1541455200.0, 473],
            [1541458800.0, 914],
            [1541462400.0, 991],
            [1541466000.0, 925],
            [1541469600.0, 881],
            [1541473200.0, 182],
            [1541476800.0, 490],
            [1541480400.0, 820],
            [1541484000.0, 322],
            [1541487600.0, 836],
            [1541491200.0, 565],
            [1541494800.0, 758],
            [1541498400.0, 880],
            [1541502000.0, 677],
            [1541505600.0, 381],
            [1541509200.0, 814],
            [1541512800.0, 329],
            [1541516400.0, 446],
            [1541520000.0, 731],
            [1541523600.0, 111],
            [1541527200.0, 926],
            [1541530800.0, 772],
            [1541534400.0, 400],
            [1541538000.0, 943],
        ]
    },
    "status": "unresolved",
    "statusDetails": {},
    "subscriptionDetails": None,
    "title": "This is an example Python exception",
    "type": "default",
    "userCount": 0,
}


class IssueExamples:
    ORGANIZATION_GROUP_INDEX = [
        OpenApiExample(
            "Return a list of issues for an organization",
            value=[SIMPLE_ISSUE],
            response_only=True,
            status_codes=["200"],
        )
    ]
