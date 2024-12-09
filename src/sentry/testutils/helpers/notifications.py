from __future__ import annotations

import uuid
from collections.abc import Mapping, Sequence
from datetime import UTC, datetime
from typing import Any

from sentry.integrations.types import ExternalProviders
from sentry.issues.grouptype import (
    FeedbackGroup,
    PerformanceNPlusOneAPICallsGroupType,
    PerformanceNPlusOneGroupType,
    PerformanceRenderBlockingAssetSpanGroupType,
    PerformanceSlowDBQueryGroupType,
    ProfileFileIOGroupType,
)
from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
from sentry.models.group import Group
from sentry.notifications.notifications.base import BaseNotification
from sentry.notifications.utils.actions import MessageAction
from sentry.types.actor import Actor


class DummyNotification(BaseNotification):
    group: Group

    template_path = ""
    metrics_key = "dummy"
    reference = None

    def get_subject(self, context: Mapping[str, Any] | None = None) -> str:
        return "My Subject"

    def determine_recipients(self) -> list[Actor]:
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

    def get_message_actions(
        self, recipient: Actor, provider: ExternalProviders
    ) -> Sequence[MessageAction]:
        zombo_link = MessageAction(
            name="Go to Zombo.com",
            style="primary",
            url="http://zombo.com",
        )
        sentry_link = MessageAction(
            name="Sentry Link",
            label="Go to Sentry",
            style="primary",
            url="http://sentry.io",
        )
        return [zombo_link, sentry_link]


class AnotherDummyNotification(DummyNotification):
    def __init__(self, organization, some_value) -> None:
        super().__init__(organization)
        self.some_value = some_value


class DummyNotificationWithMoreFields(DummyNotification):
    group: Group

    def get_notification_title(
        self, provider: ExternalProviders, context: Mapping[str, Any] | None = None
    ) -> str:
        assert context is not None
        some_value = context["some_field"]
        return f"Notification Title with {some_value}"

    def build_notification_footer(self, *args):
        return "Notification Footer"

    def get_message_description(self, recipient: Actor, provider: ExternalProviders):
        return "Message Description"

    def get_title_link(self, *args):
        from sentry.integrations.messaging.message_builder import get_title_link

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
    datetime.now(UTC),
    "info",
    "/api/123/",
)
TEST_FEEDBACK_ISSUE_OCCURENCE = IssueOccurrence(
    id=uuid.uuid4().hex,
    project_id=1,
    event_id=uuid.uuid4().hex,
    fingerprint=["c" * 32],
    issue_title="User Feedback",
    subtitle="Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed vel aliquam velit, nec condimentum mi. Maecenas accumsan, nunc ac venenatis hendrerit, mi libero facilisis nunc, fringilla molestie dui est vulputate diam. Duis ac justo euismod, sagittis est at, bibendum purus. Praesent nec tortor vel ante accumsan lobortis. Morbi mollis augue nec dolor feugiat congue. Nullam eget blandit nisi. Sed in arcu odio. Aenean malesuada tortor quis felis dapibus congue.d",
    culprit="api/123",
    resource_id="1234",
    evidence_data={
        "contact_email": "test@test.com",
        "message": "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed vel aliquam velit, nec condimentum mi. Maecenas accumsan, nunc ac venenatis hendrerit, mi libero facilisis nunc, fringilla molestie dui est vulputate diam. Duis ac justo euismod, sagittis est at, bibendum purus. Praesent nec tortor vel ante accumsan lobortis. Morbi mollis augue nec dolor feugiat congue. Nullam eget blandit nisi. Sed in arcu odio. Aenean malesuada tortor quis felis dapibus congue.",
        "name": "Test Name",
    },
    evidence_display=[
        IssueEvidence("contact_email", "test@test.com", False),
        IssueEvidence(
            "message",
            "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed vel aliquam velit, nec condimentum mi. Maecenas accumsan, nunc ac venenatis hendrerit, mi libero facilisis nunc, fringilla molestie dui est vulputate diam. Duis ac justo euismod, sagittis est at, bibendum purus. Praesent nec tortor vel ante accumsan lobortis. Morbi mollis augue nec dolor feugiat congue. Nullam eget blandit nisi. Sed in arcu odio. Aenean malesuada tortor quis felis dapibus congue.",
            True,
        ),
        IssueEvidence("name", "Test Name", False),
    ],
    type=FeedbackGroup,
    detection_time=datetime.now(UTC),
    level="info",
)
TEST_PERF_ISSUE_OCCURRENCE = IssueOccurrence(
    uuid.uuid4().hex,
    1,
    uuid.uuid4().hex,
    ["some-fingerprint"],
    "N+1 Query",
    "it was bad",
    "1234",
    {"Test": 123},
    [
        IssueEvidence(
            "db",
            "db - SELECT `books_author`.`id`, `books_author`.`name` FROM `books_author` WHERE `books_author`.`id` = %s LIMIT 21",
            True,
        ),
    ],
    PerformanceNPlusOneGroupType,
    datetime.now(UTC),
    "info",
    "/api/123/",
)

SAMPLE_TO_OCCURRENCE_MAP = {
    "transaction-slow-db-query": IssueOccurrence(
        uuid.uuid4().hex,
        1,
        uuid.uuid4().hex,
        ["ad800f7f33d223e714d718cb4e7d3ce1"],
        "Slow DB Query",
        'SELECT "marketing_information"."id", "marketing_information"."email", "marketing_information"."subscribed", "marketing_information"."updated_at", "marketing_information"."category", "marketing_information"."opted_out" FROM "marketing_information" WHERE "marketing_information"."email" IN (SELECT U0."email" FROM "users" U0 WHERE U0."user_id" = %s)',
        None,
        {
            "op": "db",
            "cause_span_ids": [],
            "parent_span_ids": [],
            "offender_span_ids": [
                "b3da1046fed392a3",
            ],
            "transaction_name": "",
            "num_repeating_spans": "1",
            "repeating_spans": 'SELECT "marketing_information"."id", "marketing_information"."email", "marketing_information"."subscribed", "marketing_information"."updated_at", "marketing_information"."category", "marketing_information"."opted_out" FROM "marketing_information" WHERE "marketing_information"."email" IN (SELECT U0."email" FROM "users" U0 WHERE U0."user_id" = %s)',
            "repeating_spans_compact": 'SELECT "marketing_information"."id", "marketing_information"."email", "marketing_information"."subscribed", "marketing_information"."updated_at", "marketing_information"."category", "marketing_information"."opted_out" FROM "marketing_information" WHERE "marketing_information"."email" IN (SELECT U0."email" FROM "users" U0 WHERE U0."user_id" = %s)',
        },
        [],
        PerformanceSlowDBQueryGroupType,
        datetime.now(UTC),
        "info",
        "/api/marketing-info/",
    ),
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
            "transaction_name": "/",
            "num_repeating_spans": "14",
            "repeating_spans": "/author/278/book",
            "repeating_spans_compact": "/author/278/book",
            "parameters": ["{book_id: 96,44,22,43,79,50,55,48,90,69,1,36,78,67}"],
        },
        [],
        PerformanceNPlusOneAPICallsGroupType,
        datetime.now(UTC),
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
            "transaction_name": "/books/",
            "op": "db",
            "parent_span_ids": ["8dd7a5869a4f4583"],
            "parent_span": "django.view - index",
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
            "repeating_spans": "db - SELECT `books_author`.`id`, `books_author`.`name` FROM `books_author` WHERE `books_author`.`id` = %s LIMIT 21",
            "repeating_spans_compact": "SELECT `books_author`.`id`, `books_author`.`name` FROM `books_author` WHERE `books_author`.`id` = %s LIMIT 21",
            "num_repeating_spans": "10",
        },
        [],
        PerformanceNPlusOneGroupType,
        datetime.now(UTC),
        "info",
        "/books/",
    ),
    "transaction-render-blocking-asset": IssueOccurrence(
        uuid.uuid4().hex,
        1,
        uuid.uuid4().hex,
        ["9cef2831e86bdad927f4f2d0639e09a7eb9642f6"],
        "Large Render Blocking Asset",
        "/asset.js",
        None,
        {
            "op": "resource.script",
            "parent_span_ids": [],
            "cause_span_ids": [],
            "offender_span_ids": ["5b35bf3458d54fd7"],
            "transaction_name": "",
            "slow_span_description": "/asset.js",
            "slow_span_duration": 1000.0,
            "transaction_duration": 172422171096.56,
            "fcp": 2500.0,
            "repeating_spans": "resource.script - /asset.js",
            "repeating_spans_compact": "/asset.js",
        },
        [],
        PerformanceRenderBlockingAssetSpanGroupType,
        datetime.now(UTC),
        "info",
        "/render-blocking-asset/",
    ),
}
