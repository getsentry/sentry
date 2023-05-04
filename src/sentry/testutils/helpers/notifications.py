from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Iterable, Mapping

from sentry.issues.grouptype import PerformanceNPlusOneGroupType, ProfileFileIOGroupType
from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
from sentry.models import Team, User
from sentry.notifications.notifications.base import BaseNotification
from sentry.services.hybrid_cloud.user import RpcUser
from sentry.types.integrations import ExternalProviders
from sentry.utils.dates import ensure_aware


class DummyNotification(BaseNotification):
    template_path = ""
    metrics_key = "dummy"
    reference = None

    def get_subject(self, context: Mapping[str, Any] | None = None) -> str:
        pass

    def determine_recipients(self) -> Iterable[Team | RpcUser]:
        return []

    def build_attachment_title(self, *args):
        return "My Title"

    def get_title_link(self, *args):
        return None

    def get_notification_title(
        self, provider: ExternalProviders, context: Mapping[str, Any] | None = None
    ) -> str:
        return "Notification Title"

    def record_notification_sent(self, *args):
        pass

    def build_notification_footer(self, *args) -> str:
        return ""

    def get_participants(self):
        return []


class AnotherDummyNotification(DummyNotification):
    def __init__(self, organization, some_value) -> None:
        super().__init__(organization)
        self.some_value = some_value


class DummyNotificationWithMoreFields(DummyNotification):
    def get_notification_title(
        self, provider: ExternalProviders, context: Mapping[str, Any] | None = None
    ) -> str:
        some_value = context["some_field"]
        return f"Notification Title with {some_value}"

    def build_notification_footer(self, *args):
        return "Notification Footer"

    def get_message_description(self, recipient: User | Team, provider: ExternalProviders):
        return "Message Description"

    def get_title_link(self, *args):
        from sentry.integrations.message_builder import get_title_link

        return get_title_link(self.group, None, False, True, self)


TEST_ISSUE_OCCURRENCE = IssueOccurrence(
    uuid.uuid4().hex,
    1,
    uuid.uuid4().hex,
    ["some-fingerprint"],
    "something bad happened",
    "it was bad",
    "1234",
    {"Test": 123},
    [
        IssueEvidence("Attention", "Very important information!!!", True),
        IssueEvidence("Evidence 2", "Not important", False),
        IssueEvidence("Evidence 3", "Nobody cares about this", False),
    ],
    ProfileFileIOGroupType,
    ensure_aware(datetime.now()),
    "info",
    "/api/123/",
)

SAMPLE_TO_OCCURRENCE_MAP = {
    "transaction-n-plus-one-api-call": IssueOccurrence(
        uuid.uuid4().hex,
        1,
        uuid.uuid4().hex,
        ["e714d718cb4e7d3ce1ad800f7f33d223"],
        "N+1 API Call",
        "SELECT `books_author`.`id`, `books_author`.`name` FROM `books_author` WHERE `books_author`.`id` = %s LIMIT 21",
        None,
        {
            "op": "http.client",
            "cause_span_ids": [],
            "parent_span_ids": ["829d17842d952371"],
            "offender_span_ids": [
                "b2af9392df36fa1f",
                "a39c22ce65e378cc",
                "ae58828e4fdd0bba",
                "8869e7e96076fa88",
                "ac71c2e69245f37d",
                "8e7189a4f1e24ac3",
                "ba5183ea752ce85a",
                "a530576977ba0714",
                "bd5f728e61f667cf",
                "9e87e2127c3a3136",
                "b38bff8a7d07b1bc",
                "ae5b2d34409bb315",
                "918be77fbfd326ca",
                "afa8a8b18afbad59",
            ],
            "alert_subtitle": "GET http://127.0.0.1:3000/author/278/book?book_id=96",
            "transaction_name": "/",
            "num_repeating_spans": "14",
            "repeating_spans": "/author/278/book",
            "parameters": ["{book_id: 96,44,22,43,79,50,55,48,90,69,1,36,78,67}"],
        },
        [],
        PerformanceNPlusOneGroupType,
        ensure_aware(datetime.now()),
        "info",
        "/books/",
    ),
    "transaction-n-plus-one": IssueOccurrence(
        uuid.uuid4().hex,
        1,
        uuid.uuid4().hex,
        ["e714d718cb4e7d3ce1ad800f7f33d223"],
        "N+1 Query",
        "SELECT `books_author`.`id`, `books_author`.`name` FROM `books_author` WHERE `books_author`.`id` = %s LIMIT 21",
        None,
        {
            "op": "db",
            "parent_span_ids": ["8dd7a5869a4f4583"],
            "cause_span_ids": ["9179e43ae844b174"],
            "offender_span_ids": [
                "b8be6138369491dd",
                "b2d4826e7b618f1b",
                "b3fdeea42536dbf1",
                "b409e78a092e642f",
                "86d2ede57bbf48d4",
                "8e554c84cdc9731e",
                "94d6230f3f910e12",
                "a210b87a2191ceb6",
                "88a5ccaf25b9bd8f",
                "bb32cf50fc56b296",
            ],
        },
        [],
        PerformanceNPlusOneGroupType,
        ensure_aware(datetime.now()),
        "info",
        "/books/",
    ),
    "transaction-consecutive-db-queries": "",
    "transaction-render-blocking-asset": "",
}

# n+1 db
# {
#     "id": "9c8afb0c5d0c448284815c9c737742e3",
#     "project_id": 1,
#     "event_id": "44f1419e73884cd2b45c79918f4b6dc4",
#     "fingerprint": ["e714d718cb4e7d3ce1ad800f7f33d223"],
#     "issue_title": "N+1 Query",
#     "subtitle": "SELECT `books_author`.`id`, `books_author`.`name` FROM `books_author` WHERE `books_author`.`id` = %s LIMIT 21",
#     "resource_id": None,
#     "evidence_data": {
#         "op": "db",
#         "parent_span_ids": ["8dd7a5869a4f4583"],
#         "cause_span_ids": ["9179e43ae844b174"],
#         "offender_span_ids": [
#             "b8be6138369491dd",
#             "b2d4826e7b618f1b",
#             "b3fdeea42536dbf1",
#             "b409e78a092e642f",
#             "86d2ede57bbf48d4",
#             "8e554c84cdc9731e",
#             "94d6230f3f910e12",
#             "a210b87a2191ceb6",
#             "88a5ccaf25b9bd8f",
#             "bb32cf50fc56b296",
#         ],
#     },
#     "evidence_display": [],
#     "type": 1006,
#     "detection_time": 1683208385.572844,
#     "level": "info",
#     "culprit": "/books/",
# }

# large render blocking asset
# {'id': '9bbb3762b00f473694fd45fe099b3e3c', 'project_id': 1, 'event_id': '44f1419e73884cd2b45c79918f4b6dc4', 'fingerprint': ['cee27ceca4253e3ce4c29b682837fc90'], 'issue_title': 'Large Render Blocking Asset', 'subtitle': '/asset.js', 'resource_id': None, 'evidence_data': {'op': 'resource.script', 'parent_span_ids': [], 'cause_span_ids': [], 'offender_span_ids': ['5b35bf3458d54fd7']}, 'evidence_display': [], 'type': 1004, 'detection_time': 1683208463.412438, 'level': 'info', 'culprit': '/render-blocking-asset/'}

# digest
# 13:54:43 server      | {'id': 'b30693fc7f7149d9b86169c1c47a7388', 'project_id': 1, 'event_id': '44f1419e73884cd2b45c79918f4b6dc4', 'fingerprint': ['e714d718cb4e7d3ce1ad800f7f33d223'], 'issue_title': 'N+1 Query', 'subtitle': 'SELECT `books_author`.`id`, `books_author`.`name` FROM `books_author` WHERE `books_author`.`id` = %s LIMIT 21', 'resource_id': None, 'evidence_data': {'op': 'db', 'parent_span_ids': ['8dd7a5869a4f4583'], 'cause_span_ids': ['9179e43ae844b174'], 'offender_span_ids': ['b8be6138369491dd', 'b2d4826e7b618f1b', 'b3fdeea42536dbf1', 'b409e78a092e642f', '86d2ede57bbf48d4', '8e554c84cdc9731e', '94d6230f3f910e12', 'a210b87a2191ceb6', '88a5ccaf25b9bd8f', 'bb32cf50fc56b296']}, 'evidence_display': [], 'type': 1006, 'detection_time': 1683208483.492408, 'level': 'info', 'culprit': '/books/'}
# 13:54:43 server      | 13:54:43 [INFO] sentry.eventstream.base: post_process.skip.raw_event (event_id='44f1419e73884cd2b45c79918f4b6dc4')
# 13:54:43 server      | 13:54:43 [INFO] sentry.testutils.helpers.features: Flag defaulting to True: 'organizations:transaction-metrics-extraction'
# 13:54:43 server      | HAI
# 13:54:43 server      | {'id': 'ebb0ea953ce94c8cbac8b8f626be2675', 'project_id': 1, 'event_id': '44f1419e73884cd2b45c79918f4b6dc4', 'fingerprint': ['e714d718cb4e7d3ce1ad800f7f33d223'], 'issue_title': 'N+1 Query', 'subtitle': 'SELECT `books_author`.`id`, `books_author`.`name` FROM `books_author` WHERE `books_author`.`id` = %s LIMIT 21', 'resource_id': None, 'evidence_data': {'op': 'db', 'parent_span_ids': ['8dd7a5869a4f4583'], 'cause_span_ids': ['9179e43ae844b174'], 'offender_span_ids': ['b8be6138369491dd', 'b2d4826e7b618f1b', 'b3fdeea42536dbf1', 'b409e78a092e642f', '86d2ede57bbf48d4', '8e554c84cdc9731e', '94d6230f3f910e12', 'a210b87a2191ceb6', '88a5ccaf25b9bd8f', 'bb32cf50fc56b296']}, 'evidence_display': [], 'type': 1006, 'detection_time': 1683208483.61836, 'level': 'info', 'culprit': '/books/'}
