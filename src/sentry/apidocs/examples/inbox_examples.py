from drf_spectacular.utils import OpenApiExample

INBOX_EVENT = {
    "id": "123",
    "type": "issue.user_mentioned",
    "actor": {
        "type": "user",
        "id": "42",
        "name": "Alex Example",
        "avatar": None,
    },
    "data": {"commentId": "456"},
    "summary": "Mentioned you in a comment",
    "isUnread": True,
    "dateAdded": "2024-01-15T12:00:00Z",
}

INBOX_ITEM = {
    "id": "1",
    "subjectType": "issue",
    "subjectId": "789",
    "title": "TypeError: Cannot read properties of undefined",
    "url": "https://org-slug.sentry.io/inbox/issue/789/",
    "subtitle": "Mentioned you in a comment",
    "eventTypes": ["issue.user_mentioned"],
    "eventCount": 1,
    "unreadEventCount": 1,
    "latestEvent": INBOX_EVENT,
    "isUnread": True,
    "lastActivityAt": "2024-01-15T12:00:00Z",
    "lastReadAt": None,
}


class InboxExamples:
    LIST_ITEMS = [
        OpenApiExample("List personal inbox items", value=[INBOX_ITEM], response_only=True)
    ]
    LIST_EVENTS = [OpenApiExample("List inbox events", value=[INBOX_EVENT], response_only=True)]
    COUNT_ITEMS = [
        OpenApiExample("Count personal inbox items", value={"count": 1}, response_only=True)
    ]
    UPDATE_ITEMS = [
        OpenApiExample("Update personal inbox items", value={"updatedCount": 1}, response_only=True)
    ]
