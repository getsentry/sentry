from collections.abc import Iterator
from datetime import timedelta
from smtplib import SMTPDataError
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from django.core.cache import cache

from sentry.issues.action_log.types import GroupActionType
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
from sentry.models.activity import Activity
from sentry.models.groupsubscription import GroupSubscription
from sentry.silo.base import SiloMode
from sentry.tasks.email import (
    EmailSendInProgress,
    TemporaryEmailError,
    _dedupe_key,
    process_inbound_email,
    send_email,
    send_email_control,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import assume_test_silo_mode
from sentry.testutils.skips import requires_snuba
from sentry.types.activity import ActivityType


@requires_snuba
class ProcessInboundEmailTest(TestCase):
    def test_invalid_text(self) -> None:
        group = self.create_group()

        for payload in ("", " \t\n", "hello\x00world"):
            process_inbound_email(mailfrom=self.user.email, group_id=group.id, payload=payload)

        assert not Activity.objects.filter(group=group, type=ActivityType.NOTE.value).exists()

    @with_feature("projects:issue-action-log-write-to-db")
    def test_duplicate_delivery(self) -> None:
        group = self.create_group()

        process_inbound_email(
            mailfrom=self.user.email, group_id=group.id, payload=" \thello world!\n"
        )
        # Email delivery remains idempotent beyond the API's one-hour window.
        original = Activity.objects.get(group=group, type=ActivityType.NOTE.value)
        original.update(datetime=original.datetime - timedelta(hours=2))
        process_inbound_email(mailfrom=self.user.email, group_id=group.id, payload="hello world!")

        activity = Activity.objects.get(group=group, type=ActivityType.NOTE.value)
        assert activity.data == {"text": "hello world!"}
        entry = GroupActionLogEntry.objects.get(group_id=group.id, type=GroupActionType.COMMENT)
        assert entry.data == {"comment_id": activity.id, "text": None, "mentions": None}
        assert entry.source == "email"
        assert entry.actor_id == self.user.id

    def test_simple(self) -> None:
        group = self.create_group()
        integration = self.create_integration(
            organization=group.organization, provider="example", external_id="123456"
        )
        self.create_integration_external_issue(group=group, integration=integration, key="APP-123")

        with (
            patch("sentry.issues.comments.create_external_comment.apply_async") as sync_comment,
            patch("sentry.issues.comments.comment_created.send_robust") as comment_created,
        ):
            process_inbound_email(
                mailfrom=self.user.email, group_id=group.id, payload="hello world!"
            )

        activity = Activity.objects.get(group=group, type=ActivityType.NOTE.value)
        assert activity.user_id == self.user.id
        assert activity.data["text"] == "hello world!"
        assert not GroupSubscription.objects.filter(group=group, user_id=self.user.id).exists()
        sync_comment.assert_not_called()
        comment_created.assert_not_called()

    def test_handle_unknown_address(self) -> None:
        group = self.create_group()

        process_inbound_email(
            mailfrom="invalid@example.com", group_id=group.id, payload="hello world!"
        )

        assert not Activity.objects.filter(group=group, type=ActivityType.NOTE.value).exists()


def _message() -> dict[str, Any]:
    return {
        "subject": "Subject",
        "body": "Body",
        "from_email": "sentry@example.com",
        "to": ["user@example.com"],
        "cc": [],
        "bcc": [],
        "attachments": [],
        "headers": {"Message-Id": "<20261102120000.1.42@example.com>"},
        "reply_to": [],
        "alternatives": [],
    }


@patch("sentry.tasks.email.send_messages")
class TestSendEmailDedupe:
    @pytest.fixture(autouse=True)
    def _setup(self) -> Iterator[None]:
        cache.clear()
        with override_options({"mail.send-dedupe.enabled": True}):
            yield
        cache.clear()

    def test_same_message_is_sent_once(self, send_messages: MagicMock) -> None:
        send_email(message=_message())
        send_email(message=_message())

        assert send_messages.call_count == 1

    def test_duplicate_is_recorded_once(self, send_messages: MagicMock) -> None:
        send_email(message=_message())
        with patch("sentry.tasks.email._record_dedupe") as record_dedupe:
            send_email(message=_message())

        record_dedupe.assert_called_once_with("duplicate")

    def test_failed_send_releases_claim_for_retry(self, send_messages: MagicMock) -> None:
        send_messages.side_effect = [SMTPDataError(421, b"try again"), 1]

        with pytest.raises(TemporaryEmailError):
            send_email(message=_message())
        send_email(message=_message())

        assert send_messages.call_count == 2

    def test_send_in_progress_retries_instead_of_skipping(self, send_messages: MagicMock) -> None:
        message = _message()
        key = _dedupe_key(message["headers"]["Message-Id"])
        cache.add(key, "sending", 90)

        with pytest.raises(EmailSendInProgress):
            send_email(message=_message())

        assert send_messages.call_count == 0

    def test_cache_error_sends_anyway(self, send_messages: MagicMock) -> None:
        with patch("sentry.tasks.email.cache") as broken_cache:
            broken_cache.add.side_effect = ConnectionError
            broken_cache.set.side_effect = ConnectionError
            send_email(message=_message())
            send_email(message=_message())

        assert send_messages.call_count == 2

    def test_message_without_message_id_is_reported_and_sent(
        self, send_messages: MagicMock
    ) -> None:
        message = _message()
        message["headers"] = {}

        with (
            patch("sentry.tasks.email.logger.error") as log_error,
            patch("sentry.tasks.email._claim_send") as claim_send,
        ):
            send_email(message=message)
            send_email(message=message)

        assert send_messages.call_count == 2
        assert log_error.call_count == 2
        claim_send.assert_not_called()

    def test_disabled_option_sends_duplicates(self, send_messages: MagicMock) -> None:
        with (
            override_options({"mail.send-dedupe.enabled": False}),
            patch("sentry.tasks.email._dedupe_key") as dedupe_key,
        ):
            send_email(message=_message())
            send_email(message=_message())

        assert send_messages.call_count == 2
        dedupe_key.assert_not_called()

    def test_control_silo_task_is_not_deduped(self, send_messages: MagicMock) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            send_email_control(message=_message())
            send_email_control(message=_message())

        assert send_messages.call_count == 2
