from datetime import datetime

from drf_spectacular.utils import OpenApiExample

from sentry.api.helpers.group_index.types import MutateIssueResponse
from sentry.api.serializers.models.group import GroupDetailsResponse
from sentry.api.serializers.models.group_stream import StreamGroupSerializerSnubaResponse

SIMPLE_ISSUE: StreamGroupSerializerSnubaResponse = {
    "annotations": [],
    "assignedTo": {"type": "user", "id": "1", "name": "John Doe", "email": "john.doe@example.com"},
    "count": "150",
    "culprit": "raven.scripts.runner in main",
    "firstSeen": datetime.fromisoformat("2018-11-06T21:19:55Z"),
    "filtered": None,
    "inbox": {
        "reason": 0,
        "reason_details": None,
        "date_added": datetime.fromisoformat("2018-11-06T21:19:55Z"),
    },
    "hasSeen": False,
    "id": "1",
    "isBookmarked": False,
    "isPublic": False,
    "isSubscribed": True,
    "lastSeen": datetime.fromisoformat("2018-12-06T21:19:55Z"),
    "level": "error",
    "logger": None,
    "metadata": {"title": "This is an example Python exception"},
    "numComments": 0,
    "permalink": "https://sentry.io/the-interstellar-jurisdiction/pump-station/issues/1/",
    "project": {"id": "2", "name": "Pump Station", "slug": "pump-station", "platform": "python"},
    "shareId": "123def456abc",
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
    "priority": "medium",
    "priorityLockedAt": None,
    "owners": {
        "type": "user",
        "owner": "1",
        "date_added": datetime.fromisoformat("2018-11-06T21:19:55Z"),
    },
    "platform": "python",
    "lifetime": {
        "count": "150",
        "userCount": 0,
        "firstSeen": datetime.fromisoformat("2018-11-06T21:19:55Z"),
        "lastSeen": datetime.fromisoformat("2018-12-06T21:19:55Z"),
    },
    "seerAutofixLastTriggered": None,
    "seerExplorerAutofixLastTriggered": None,
    "seerFixabilityScore": None,
    "status": "ignored",
    "substatus": "archived_until_condition_met",
    "statusDetails": {},
    "subscriptionDetails": None,
    "title": "This is an example Python exception",
    "type": "default",
    "userCount": 0,
    "integrationIssues": [],
    "sentryAppIssues": [],
    "isUnhandled": False,
    "issueCategory": "performance",
    "issueType": "performance_n_plus_one_db_queries",
    "sessionCount": 0,
    "latestEventHasAttachments": False,
    "matchingEventId": None,
    "matchingEventEnvironment": None,
    "derivedData": {
        "blocker": "none",
        "progress": "fix_applied",
        "status": "open",
        "viewCount": 42,
        "hasOpenFixPr": False,
        "isAssigned": True,
        "hasRootCause": True,
        "lastCompletedAutofixStep": "pr_created",
        "lastProgressedAt": datetime.fromisoformat("2018-12-06T21:19:55Z"),
    },
}

MUTATE_ISSUE_RESULT: MutateIssueResponse = {
    "assignedTo": {"type": "user", "id": "1", "name": "John Doe", "email": "john.doe@example.com"},
    "discard": False,
    "hasSeen": True,
    "inbox": True,
    "isBookmarked": False,
    "isPublic": True,
    "isSubscribed": True,
    "merge": {
        "children": ["11", "12", "13"],
        "parent": "10",
    },
    "priority": "medium",
    "shareId": "123def456abc",
    "status": "ignored",
    "statusDetails": {
        "ignoreDuration": 100,
        "ignoreCount": 10,
        "ignoreWindow": 60,
        "ignoreUserCount": 10,
        "ignoreUserWindow": 60,
        "inNextRelease": False,
        "inRelease": "1.0.0",
        "inCommit": {
            "commit": "123def456abc",
            "repository": "getsentry/sentry",
        },
    },
    "subscriptionDetails": {
        "disabled": False,
        "reason": "mentioned",
    },
    "substatus": "archived_until_condition_met",
}


GROUP_DETAILS: GroupDetailsResponse = {
    "id": "1",
    "shareId": "123def456abc",
    "shortId": "PUMP-STATION-1",
    "title": "This is an example Python exception",
    "culprit": "raven.scripts.runner in main",
    "permalink": "https://sentry.io/the-interstellar-jurisdiction/pump-station/issues/1/",
    "logger": None,
    "level": "error",
    "status": "unresolved",
    "statusDetails": {},
    "substatus": "ongoing",
    "isPublic": False,
    "platform": "python",
    "priority": "medium",
    "priorityLockedAt": None,
    "seerFixabilityScore": None,
    "seerAutofixLastTriggered": None,
    "seerExplorerAutofixLastTriggered": None,
    "project": {"id": "2", "name": "Pump Station", "slug": "pump-station", "platform": "python"},
    "type": "default",
    "issueType": "error",
    "issueCategory": "error",
    "metadata": {"title": "This is an example Python exception"},
    "numComments": 0,
    "assignedTo": {"type": "user", "id": "1", "name": "John Doe", "email": "john.doe@example.com"},
    "isBookmarked": False,
    "isSubscribed": True,
    "subscriptionDetails": None,
    "hasSeen": False,
    "annotations": [],
    "count": "150",
    "userCount": 12,
    "firstSeen": datetime.fromisoformat("2018-11-06T21:19:55Z"),
    "lastSeen": datetime.fromisoformat("2018-12-06T21:19:55Z"),
    # Always added by the detail view
    "activity": [
        {
            "data": {},
            "dateCreated": "2018-11-06T21:19:55Z",
            "id": "0",
            "type": "first_seen",
            "user": None,
        }
    ],
    "seenBy": [],
    "userReportCount": 0,
    "participants": [],
    # Default-included unless suppressed via `?collapse=...`
    "firstRelease": {
        "version": "17642328ead24b51867165985996d04b29310337",
        "shortVersion": "1764232",
        "dateCreated": "2018-11-06T21:19:55.146Z",
        "dateReleased": None,
        "ref": None,
        "url": None,
    },
    "lastRelease": None,
    "tags": [
        {"key": "browser", "name": "Browser", "totalValues": 150},
        {"key": "level", "name": "Level", "totalValues": 150},
    ],
    "stats": {
        "24h": [[1541451600.0, 557], [1541455200.0, 473]],
        "30d": [[1538870400.0, 565], [1538956800.0, 12862]],
    },
}


class IssueExamples:
    ORGANIZATION_GROUP_INDEX_GET = [
        OpenApiExample(
            "Return a list of issues for an organization",
            value=[SIMPLE_ISSUE],
            response_only=True,
            status_codes=["200"],
        )
    ]
    ORGANIZATION_GROUP_INDEX_PUT = [
        OpenApiExample(
            "Return the update results for issues in an organization",
            value=MUTATE_ISSUE_RESULT,
            response_only=True,
            status_codes=["200"],
        )
    ]
    GROUP_DETAILS = [
        OpenApiExample(
            "Return an issue",
            value=GROUP_DETAILS,
            response_only=True,
            status_codes=["200"],
        )
    ]
