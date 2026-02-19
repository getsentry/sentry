from sentry.models.code_review_event import CodeReviewEventStatus
from sentry.seer.code_review.event_recorder import (
    create_event_record,
    find_event_by_trigger_id,
    update_event_status,
)
from sentry.testutils.cases import TestCase


class TestCreateEventRecord(TestCase):
    def test_creates_pull_request_event(self) -> None:
        repo = self.create_repo(project=self.project, name="owner/repo")
        event_payload = {
            "pull_request": {
                "number": 42,
                "title": "Fix the bug",
                "user": {"login": "testuser"},
                "html_url": "https://github.com/owner/repo/pull/42",
                "updated_at": "2026-01-15T10:30:00Z",
                "head": {"sha": "abc123def456"},
            },
            "sender": {"login": "triggeruser"},
        }

        record = create_event_record(
            organization_id=self.organization.id,
            repository_id=repo.id,
            raw_event_type="pull_request",
            raw_event_action="opened",
            trigger_id="abc-123",
            event=event_payload,
            status=CodeReviewEventStatus.WEBHOOK_RECEIVED,
        )

        assert record is not None
        assert record.organization_id == self.organization.id
        assert record.repository_id == repo.id
        assert record.pr_number == 42
        assert record.pr_title == "Fix the bug"
        assert record.pr_author == "testuser"
        assert record.pr_url == "https://github.com/owner/repo/pull/42"
        assert record.raw_event_type == "pull_request"
        assert record.raw_event_action == "opened"
        assert record.trigger_id == "abc-123"
        assert record.trigger == "pr_opened"
        assert record.trigger_user == "triggeruser"
        assert record.trigger_at is not None
        assert record.target_commit_sha == "abc123def456"
        assert record.status == CodeReviewEventStatus.WEBHOOK_RECEIVED
        assert record.webhook_received_at is not None

    def test_creates_issue_comment_event(self) -> None:
        repo = self.create_repo(project=self.project, name="owner/repo")
        event_payload = {
            "issue": {
                "number": 99,
                "title": "Some PR",
                "user": {"login": "commenter"},
                "pull_request": {
                    "html_url": "https://github.com/owner/repo/pull/99",
                },
            },
            "comment": {
                "created_at": "2026-01-15T11:00:00Z",
            },
            "sender": {"login": "commenter"},
        }

        record = create_event_record(
            organization_id=self.organization.id,
            repository_id=repo.id,
            raw_event_type="issue_comment",
            raw_event_action="created",
            trigger_id="def-456",
            event=event_payload,
            status=CodeReviewEventStatus.WEBHOOK_RECEIVED,
        )

        assert record is not None
        assert record.pr_number == 99
        assert record.pr_title == "Some PR"
        assert record.pr_author == "commenter"
        assert record.trigger == "comment_command"
        assert record.trigger_user == "commenter"
        assert record.trigger_at is not None

    def test_creates_preflight_denied_event(self) -> None:
        repo = self.create_repo(project=self.project)

        record = create_event_record(
            organization_id=self.organization.id,
            repository_id=repo.id,
            raw_event_type="pull_request",
            raw_event_action="opened",
            trigger_id="ghi-789",
            event={
                "pull_request": {
                    "number": 10,
                    "title": "Denied PR",
                    "user": {"login": "author"},
                    "html_url": "https://github.com/owner/repo/pull/10",
                    "head": {"sha": "denied123"},
                },
            },
            status=CodeReviewEventStatus.PREFLIGHT_DENIED,
            denial_reason="Feature not enabled",
        )

        assert record is not None
        assert record.status == CodeReviewEventStatus.PREFLIGHT_DENIED
        assert record.denial_reason == "Feature not enabled"
        assert record.preflight_completed_at is not None
        assert record.webhook_received_at is not None
        assert record.target_commit_sha == "denied123"
        assert record.pr_number == 10

    def test_returns_none_on_duplicate_delivery_id(self) -> None:
        repo = self.create_repo(project=self.project)

        create_event_record(
            organization_id=self.organization.id,
            repository_id=repo.id,
            raw_event_type="pull_request",
            raw_event_action="opened",
            trigger_id="duplicate-id",
            event={"pull_request": {}},
            status=CodeReviewEventStatus.WEBHOOK_RECEIVED,
        )

        result = create_event_record(
            organization_id=self.organization.id,
            repository_id=repo.id,
            raw_event_type="pull_request",
            raw_event_action="opened",
            trigger_id="duplicate-id",
            event={"pull_request": {}},
            status=CodeReviewEventStatus.WEBHOOK_RECEIVED,
        )

        assert result is None

    def test_creates_event_with_null_delivery_id(self) -> None:
        repo = self.create_repo(project=self.project)

        record = create_event_record(
            organization_id=self.organization.id,
            repository_id=repo.id,
            raw_event_type="pull_request",
            raw_event_action="opened",
            trigger_id=None,
            event={"pull_request": {}},
            status=CodeReviewEventStatus.WEBHOOK_RECEIVED,
        )

        assert record is not None
        assert record.trigger_id is None


class TestUpdateEventStatus(TestCase):
    def test_updates_status(self) -> None:
        repo = self.create_repo(project=self.project)
        record = self.create_code_review_event(
            organization=self.organization,
            repository=repo,
            status=CodeReviewEventStatus.WEBHOOK_RECEIVED,
        )

        update_event_status(record, CodeReviewEventStatus.TASK_ENQUEUED)

        record.refresh_from_db()
        assert record.status == CodeReviewEventStatus.TASK_ENQUEUED
        assert record.task_enqueued_at is not None

    def test_updates_status_with_denial_reason(self) -> None:
        repo = self.create_repo(project=self.project)
        record = self.create_code_review_event(
            organization=self.organization,
            repository=repo,
            status=CodeReviewEventStatus.WEBHOOK_RECEIVED,
        )

        update_event_status(
            record,
            CodeReviewEventStatus.WEBHOOK_FILTERED,
            denial_reason="Unsupported action",
        )

        record.refresh_from_db()
        assert record.status == CodeReviewEventStatus.WEBHOOK_FILTERED
        assert record.denial_reason == "Unsupported action"

    def test_handles_none_record(self) -> None:
        # Should not raise
        update_event_status(None, CodeReviewEventStatus.TASK_ENQUEUED)


class TestFindEventByDeliveryId(TestCase):
    def test_finds_existing_event(self) -> None:
        repo = self.create_repo(project=self.project)
        record = self.create_code_review_event(
            organization=self.organization,
            repository=repo,
            trigger_id="find-me-123",
            status=CodeReviewEventStatus.WEBHOOK_RECEIVED,
        )

        found = find_event_by_trigger_id("find-me-123")
        assert found is not None
        assert found.id == record.id

    def test_returns_none_for_nonexistent(self) -> None:
        result = find_event_by_trigger_id("does-not-exist")
        assert result is None

    def test_returns_none_for_empty_string(self) -> None:
        result = find_event_by_trigger_id("")
        assert result is None


class TestStatusToTimestampMapping(TestCase):
    def test_all_status_timestamp_mappings(self) -> None:
        """Each status that has a timestamp gets it set correctly on create."""
        repo = self.create_repo(project=self.project)

        status_timestamp_pairs = [
            (CodeReviewEventStatus.WEBHOOK_RECEIVED, "webhook_received_at"),
            (CodeReviewEventStatus.TASK_ENQUEUED, "task_enqueued_at"),
            (CodeReviewEventStatus.SENT_TO_SEER, "sent_to_seer_at"),
            (CodeReviewEventStatus.REVIEW_STARTED, "review_started_at"),
            (CodeReviewEventStatus.REVIEW_COMPLETED, "review_completed_at"),
        ]

        for status, field_name in status_timestamp_pairs:
            record = create_event_record(
                organization_id=self.organization.id,
                repository_id=repo.id,
                raw_event_type="pull_request",
                raw_event_action="opened",
                trigger_id=None,
                event={"pull_request": {}},
                status=status,
            )
            assert record is not None
            assert getattr(record, field_name) is not None, (
                f"Expected {field_name} to be set for status {status}"
            )
