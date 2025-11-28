import uuid
from unittest import mock
from unittest.mock import ANY, MagicMock, patch
from urllib.parse import quote

import orjson
from django.core import mail
from django.core.mail.message import EmailMultiAlternatives

import sentry
from sentry.analytics.events.alert_sent import AlertSentEvent
from sentry.digests.backends.base import Backend
from sentry.digests.backends.redis import RedisBackend
from sentry.digests.notifications import event_to_record
from sentry.mail.analytics import EmailNotificationSent
from sentry.models.projectownership import ProjectOwnership
from sentry.services.eventstore.models import Event, GroupEvent
from sentry.tasks.digests import deliver_digest
from sentry.testutils.cases import PerformanceIssueTestCase, SlackActivityNotificationTest, TestCase
from sentry.testutils.helpers.analytics import (
    assert_any_analytics_event,
    assert_last_analytics_event,
)
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.silo import assume_test_silo_mode_of
from sentry.testutils.skips import requires_snuba
from sentry.users.models.user_option import UserOption
from tests.sentry.issues.test_utils import OccurrenceTestMixin

pytestmark = [requires_snuba]

USER_COUNT = 2


class DigestNotificationTest(TestCase, OccurrenceTestMixin, PerformanceIssueTestCase):
    def add_event(self, fingerprint: str, backend: Backend, event_type: str = "error") -> None:
        event: Event | GroupEvent | None
        if event_type == "performance":
            event = self.create_performance_issue()
        elif event_type == "generic":
            event_id = uuid.uuid4().hex
            _, group_info = self.process_occurrence(
                event_id=event_id,
                project_id=self.project.id,
                event_data={
                    "timestamp": before_now(minutes=1).isoformat(),
                },
            )
            assert group_info is not None
            group = group_info.group
            event = group.get_latest_event()
        else:
            event = self.store_event(
                data={
                    "message": "oh no",
                    "timestamp": before_now(days=1).isoformat(),
                    "fingerprint": [fingerprint],
                },
                project_id=self.project.id,
            )

        assert event is not None
        backend.add(
            self.key, event_to_record(event, [self.rule]), increment_delay=0, maximum_delay=0
        )

    def run_test(
        self,
        event_count: int,
        performance_issues: bool = False,
        generic_issues: bool = False,
    ) -> None:
        with patch.object(sentry, "digests") as digests:
            backend = RedisBackend()
            digests.backend.digest = backend.digest

            for i in range(event_count):
                self.add_event(f"group-{i}", backend, "error")

            if performance_issues:
                self.add_event(f"group-{event_count+1}", backend, "performance")

            if generic_issues:
                self.add_event(f"group-{event_count+2}", backend, "generic")

            with self.tasks():
                deliver_digest(self.key)

            assert len(mail.outbox) == USER_COUNT

    def setUp(self) -> None:
        super().setUp()
        self.rule = self.create_project_rule(project=self.project)
        self.key = f"mail:p:{self.project.id}:IssueOwners::AllMembers"
        ProjectOwnership.objects.create(project_id=self.project.id, fallthrough=True)
        for i in range(USER_COUNT - 1):
            self.create_member(
                organization=self.organization,
                user=self.create_user(),
                role="member",
                teams=[self.team],
            )

    @patch("sentry.analytics.record")
    @patch("sentry.notifications.notifications.digest.logger")
    def test_sends_digest_to_every_member(
        self, mock_logger: MagicMock, mock_record: MagicMock
    ) -> None:
        """Test that each member of the project the events are created in receive a digest email notification"""
        event_count = 4
        self.run_test(event_count=event_count, performance_issues=True, generic_issues=True)
        assert f"{event_count + 2} new alerts since" in mail.outbox[0].subject
        assert "N+1 Query" in mail.outbox[0].body
        assert "oh no" in mail.outbox[0].body
        assert self.build_occurrence_data()["issue_title"] in mail.outbox[0].body
        message = mail.outbox[0]
        assert isinstance(message, EmailMultiAlternatives)
        assert isinstance(message.alternatives[0][0], str)
        assert "notification_uuid" in message.alternatives[0][0]
        assert_any_analytics_event(
            mock_record,
            EmailNotificationSent(
                category="digest",
                notification_uuid="ANY",
                alert_id=self.rule.id,
                project_id=self.project.id,
                organization_id=self.organization.id,
                id=0,
                actor_type="User",
                group_id=None,
                user_id=0,
            ),
            exclude_fields=[
                "id",
                "project_id",
                "actor_id",
                "user_id",
                "notification_uuid",
                "alert_id",
            ],
        )
        assert_last_analytics_event(
            mock_record,
            AlertSentEvent(
                organization_id=self.organization.id,
                project_id=self.project.id,
                provider="email",
                alert_id=self.rule.id,
                alert_type="issue_alert",
                external_id="ANY",
                notification_uuid="ANY",
            ),
            exclude_fields=["external_id", "notification_uuid"],
        )
        mock_logger.info.assert_called_with(
            "mail.adapter.notify_digest",
            extra={
                "project_id": self.project.id,
                "target_type": "IssueOwners",
                "target_identifier": None,
                "team_ids": ANY,
                "user_ids": ANY,
                "notification_uuid": ANY,
                "number_of_rules": ANY,
                "group_count": ANY,
            },
        )

    def test_sends_alert_rule_notification_to_each_member(self) -> None:
        """Test that if there is only one event it is sent as a regular alert rule notification"""
        self.run_test(event_count=1)

        # It is an alert rule notification, not a digest
        assert "new alerts since" not in mail.outbox[0].subject
        message = mail.outbox[0]
        assert isinstance(message, EmailMultiAlternatives)
        assert isinstance(message.alternatives[0][0], str)
        assert "notification_uuid" in message.alternatives[0][0]

    def test_digest_email_uses_user_timezone(self) -> None:
        self.organization.member_set.exclude(user_id=self.user.id).delete()

        # Create a user with Pacific timezone
        pacific_user = self.create_user(email="pacific@example.com")
        with assume_test_silo_mode_of(UserOption):
            UserOption.objects.create(
                user=pacific_user, key="timezone", value="America/Los_Angeles"
            )

        # Create member with this user
        self.create_member(
            organization=self.organization,
            user=pacific_user,
            role="member",
            teams=[self.team],
        )

        # Create events and send digest
        with patch.object(sentry, "digests") as digests:
            backend = RedisBackend()
            digests.backend.digest = backend.digest

            # Add 2 events
            for i in range(2):
                self.add_event(f"group-{i}", backend, "error")

            with self.tasks():
                deliver_digest(self.key)

        # Should have emails for both users (original self.user + pacific_user)
        assert len(mail.outbox) == 2

        # Find the email sent to our Pacific timezone user
        pacific_email = None
        utc_email = None
        for email in mail.outbox:
            if pacific_user.email in email.to:
                pacific_email = email
            elif self.user.email in email.to:
                utc_email = email

        assert pacific_email is not None, "Should have sent email to Pacific timezone user"
        assert utc_email is not None, "Should have sent email to UTC user"

        # Check that the Pacific timezone email uses PST/PDT formatting
        pacific_body = pacific_email.body
        utc_body = utc_email.body

        # Pacific email should show PST/PDT timezone
        assert (
            "PST" in pacific_body or "PDT" in pacific_body
        ), f"Pacific email should use Pacific timezone, but body was: {pacific_body}"

        # UTC email should show UTC timezone
        assert "UTC" in utc_body, f"UTC email should show UTC timezone, but body was: {utc_body}"

        # Check that subjects are also timezone-aware
        pacific_subject = pacific_email.subject
        utc_subject = utc_email.subject

        # The subjects should be different due to timezone formatting
        # (though the time difference might be small depending on when the test runs)
        # At minimum, they should both contain readable date information
        assert (
            "new alert" in pacific_subject.lower()
        ), f"Pacific subject should contain alert text: {pacific_subject}"
        assert (
            "new alert" in utc_subject.lower()
        ), f"UTC subject should contain alert text: {utc_subject}"


class DigestSlackNotification(SlackActivityNotificationTest):
    @mock.patch.object(sentry, "digests")
    def test_slack_digest_notification_block(self, digests: MagicMock) -> None:
        """
        Test that with digests and block kkit enabled, but Slack notification settings
        (and not email settings), we send a properly formatted Slack notification
        """
        ProjectOwnership.objects.create(project_id=self.project.id, fallthrough=True)
        backend = RedisBackend()
        digests.backend.digest = backend.digest
        digests.enabled.return_value = True
        timestamp_raw = before_now(days=1).replace(microsecond=0)
        timestamp_secs = int(timestamp_raw.timestamp())
        timestamp = timestamp_raw.isoformat()
        key = f"slack:p:{self.project.id}:IssueOwners::AllMembers"
        rule = self.create_project_rule(project=self.project)
        event1 = self.store_event(
            data={
                "timestamp": timestamp,
                "message": "Hello world",
                "level": "error",
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        )

        event2 = self.store_event(
            data={
                "timestamp": timestamp,
                "message": "Goodbye world",
                "level": "error",
                "fingerprint": ["group-2"],
            },
            project_id=self.project.id,
        )
        notification_uuid = str(uuid.uuid4())
        backend.add(
            key,
            event_to_record(event1, [rule], notification_uuid),
            increment_delay=0,
            maximum_delay=0,
        )
        backend.add(
            key,
            event_to_record(event2, [rule], notification_uuid),
            increment_delay=0,
            maximum_delay=0,
        )
        with self.tasks():
            deliver_digest(key)

        assert self.mock_post.call_count == 1
        blocks = orjson.loads(self.mock_post.call_args.kwargs["blocks"])
        fallback_text = self.mock_post.call_args.kwargs["text"]
        assert (
            fallback_text
            == f"<!date^{timestamp_secs}^2 issues detected {{date_pretty}} in| Digest Report for> <http://testserver/organizations/{self.organization.slug}/projects/{self.project.slug}/|{self.project.name}>"
        )
        assert len(blocks) == 9
        assert blocks[0]["text"]["text"] == fallback_text

        assert event1.group
        event1_alert_title = f":red_circle: <http://testserver/organizations/{self.organization.slug}/issues/{event1.group.id}/?referrer=digest-slack&notification_uuid={notification_uuid}&alert_rule_id={rule.id}&alert_type=issue|*{event1.group.title}*>"

        assert event2.group
        event2_alert_title = f":red_circle: <http://testserver/organizations/{self.organization.slug}/issues/{event2.group.id}/?referrer=digest-slack&notification_uuid={notification_uuid}&alert_rule_id={rule.id}&alert_type=issue|*{event2.group.title}*>"

        # digest order not definitive
        try:
            assert blocks[1]["text"]["text"] == event1_alert_title
            assert blocks[5]["text"]["text"] == event2_alert_title
        except AssertionError:
            assert blocks[1]["text"]["text"] == event2_alert_title
            assert blocks[5]["text"]["text"] == event1_alert_title

        assert (
            blocks[3]["elements"][0]["text"]
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/?referrer=digest-slack-user&notification_uuid={notification_uuid}|Notification Settings>"
        )
        assert (
            blocks[7]["elements"][0]["text"]
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/?referrer=digest-slack-user&notification_uuid={notification_uuid}|Notification Settings>"
        )

    @mock.patch.object(sentry, "digests")
    def test_slack_digest_notification_truncates_at_48_blocks(self, digests: MagicMock) -> None:
        """
        Test that digest notifications are truncated to 48 blocks to respect Slack's 50 block limit.
        With 13+ events generating ~53 blocks, we truncate to 48 content blocks + 1 warning block + 1 title block.
        """
        ProjectOwnership.objects.create(project_id=self.project.id, fallthrough=True)
        backend = RedisBackend()
        digests.backend.digest = backend.digest
        digests.enabled.return_value = True
        timestamp = before_now(days=1).isoformat()
        key = f"slack:p:{self.project.id}:IssueOwners::AllMembers"
        rule = self.create_project_rule(project=self.project)
        notification_uuid = str(uuid.uuid4())

        # Create 13 events to exceed 49 blocks (assuming each event generates ~4 blocks)
        for i in range(13):
            event = self.store_event(
                data={
                    "timestamp": timestamp,
                    "message": f"Error message {i}",
                    "level": "error",
                    "fingerprint": [f"group-{i}"],
                },
                project_id=self.project.id,
            )
            backend.add(
                key,
                event_to_record(event, [rule], notification_uuid),
                increment_delay=0,
                maximum_delay=0,
            )

        with self.tasks():
            deliver_digest(key)

        assert self.mock_post.call_count == 1
        blocks = orjson.loads(self.mock_post.call_args.kwargs["blocks"])

        # Should be truncated (< 50 blocks to respect Slack's limit)
        assert len(blocks) < 50

        # Last block should be truncation warning with issue count
        last_block = blocks[-1]
        assert last_block["type"] == "context"
        warning_text = last_block["elements"][0]["text"]
        warning_text_lower = warning_text.lower()

        assert "showing" in warning_text_lower
        # Should show X issues out of Y where X < 13 and Y = 13
        assert "/13" in warning_text
        assert "view all issues in sentry" in warning_text_lower

        # Check URL components and values (URL-encoded)
        assert f"/organizations/{self.organization.slug}/issues/" in warning_text_lower
        assert f"project={self.project.id}" in warning_text_lower
        # Timestamps are URL-encoded in the link
        encoded_timestamp = quote(timestamp, safe="")
        assert f"start={encoded_timestamp.lower()}" in warning_text_lower
        assert f"end={encoded_timestamp.lower()}" in warning_text_lower
