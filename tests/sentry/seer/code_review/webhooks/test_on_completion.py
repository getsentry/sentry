from sentry.models.code_review_event import CodeReviewEventStatus
from sentry.seer.code_review.webhooks.on_completion import process_pr_review_status_update
from sentry.testutils.cases import TestCase


class TestProcessPrReviewCompletion(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.repo = self.create_repo(project=self.project, name="owner/repo")

    def test_updates_event_on_completion(self) -> None:
        record = self.create_code_review_event(
            organization=self.organization,
            repository=self.repo,
            trigger_id="match-by-delivery",
            pr_number=42,
            status=CodeReviewEventStatus.SENT_TO_SEER,
        )

        process_pr_review_status_update(
            organization_id=self.organization.id,
            payload={
                "trigger_id": "match-by-delivery",
                "repository_id": self.repo.id,
                "seer_run_id": "seer-run-001",
                "status": "completed",
                "comments_posted": 3,
            },
        )

        record.refresh_from_db()
        assert record.status == CodeReviewEventStatus.REVIEW_COMPLETED
        assert record.seer_run_id == "seer-run-001"
        assert record.comments_posted == 3

    def test_no_op_when_missing_required_fields(self) -> None:
        # Should not raise — just logs a warning and returns
        process_pr_review_status_update(
            organization_id=self.organization.id,
            payload={
                "trigger_id": "some-trigger",
                # repository_id intentionally omitted
                "seer_run_id": "seer-run-002",
                "status": "completed",
            },
        )

    def test_no_op_when_trigger_id_not_found(self) -> None:
        # Should not raise — just logs a warning and returns
        process_pr_review_status_update(
            organization_id=self.organization.id,
            payload={
                "trigger_id": "does-not-exist",
                "repository_id": self.repo.id,
                "seer_run_id": "seer-run-003",
                "status": "completed",
                "comments_posted": 0,
            },
        )

    def test_maps_failed_status(self) -> None:
        record = self.create_code_review_event(
            organization=self.organization,
            repository=self.repo,
            trigger_id="fail-delivery",
            pr_number=10,
            status=CodeReviewEventStatus.SENT_TO_SEER,
        )

        process_pr_review_status_update(
            organization_id=self.organization.id,
            payload={
                "trigger_id": "fail-delivery",
                "repository_id": self.repo.id,
                "seer_run_id": "seer-run-004",
                "status": "failed",
                "comments_posted": 0,
                "error_message": "Seer internal error",
            },
        )

        record.refresh_from_db()
        assert record.status == CodeReviewEventStatus.REVIEW_FAILED
        assert record.review_result == {"error_message": "Seer internal error"}

    def test_maps_started_status(self) -> None:
        record = self.create_code_review_event(
            organization=self.organization,
            repository=self.repo,
            trigger_id="started-delivery",
            pr_number=11,
            status=CodeReviewEventStatus.SENT_TO_SEER,
        )

        process_pr_review_status_update(
            organization_id=self.organization.id,
            payload={
                "trigger_id": "started-delivery",
                "repository_id": self.repo.id,
                "seer_run_id": "seer-run-005",
                "status": "started",
                "comments_posted": 0,
                "started_at": "2026-01-15T10:00:00+00:00",
            },
        )

        record.refresh_from_db()
        assert record.status == CodeReviewEventStatus.REVIEW_STARTED
        assert record.review_started_at is not None

    def test_parses_timestamps(self) -> None:
        record = self.create_code_review_event(
            organization=self.organization,
            repository=self.repo,
            trigger_id="ts-delivery",
            pr_number=12,
            status=CodeReviewEventStatus.SENT_TO_SEER,
        )

        process_pr_review_status_update(
            organization_id=self.organization.id,
            payload={
                "trigger_id": "ts-delivery",
                "repository_id": self.repo.id,
                "seer_run_id": "seer-run-006",
                "status": "completed",
                "comments_posted": 5,
                "started_at": "2026-01-15T10:00:00+00:00",
                "completed_at": "2026-01-15T10:05:00+00:00",
            },
        )

        record.refresh_from_db()
        assert record.review_started_at is not None
        assert record.review_completed_at is not None

    def test_ignores_invalid_timestamps(self) -> None:
        record = self.create_code_review_event(
            organization=self.organization,
            repository=self.repo,
            trigger_id="bad-ts-delivery",
            pr_number=13,
            status=CodeReviewEventStatus.SENT_TO_SEER,
        )

        process_pr_review_status_update(
            organization_id=self.organization.id,
            payload={
                "trigger_id": "bad-ts-delivery",
                "repository_id": self.repo.id,
                "seer_run_id": "seer-run-007",
                "status": "completed",
                "comments_posted": 0,
                "started_at": "not-a-date",
                "completed_at": "also-not-a-date",
            },
        )

        record.refresh_from_db()
        assert record.status == CodeReviewEventStatus.REVIEW_COMPLETED
        assert record.review_started_at is None
        assert record.review_completed_at is None
