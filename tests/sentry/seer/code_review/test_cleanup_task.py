from datetime import timedelta

from django.utils import timezone

from sentry.models.code_review_event import CodeReviewEvent, CodeReviewEventStatus
from sentry.seer.code_review.tasks import RETENTION_DAYS, cleanup_old_code_review_events
from sentry.testutils.cases import TestCase


class TestCleanupOldCodeReviewEvents(TestCase):
    def test_deletes_old_events(self) -> None:
        repo = self.create_repo(project=self.project)
        old_event = self.create_code_review_event(organization=self.organization, repository=repo)
        # Manually set date_added to beyond retention period
        CodeReviewEvent.objects.filter(id=old_event.id).update(
            date_added=timezone.now() - timedelta(days=RETENTION_DAYS + 1)
        )

        cleanup_old_code_review_events()

        assert not CodeReviewEvent.objects.filter(id=old_event.id).exists()

    def test_keeps_recent_events(self) -> None:
        repo = self.create_repo(project=self.project)
        recent_event = self.create_code_review_event(
            organization=self.organization, repository=repo
        )

        cleanup_old_code_review_events()

        assert CodeReviewEvent.objects.filter(id=recent_event.id).exists()

    def test_handles_no_events(self) -> None:
        # Should not raise
        cleanup_old_code_review_events()

    def test_mixed_old_and_new(self) -> None:
        repo = self.create_repo(project=self.project)

        old_event = self.create_code_review_event(organization=self.organization, repository=repo)
        CodeReviewEvent.objects.filter(id=old_event.id).update(
            date_added=timezone.now() - timedelta(days=RETENTION_DAYS + 10)
        )

        new_event = self.create_code_review_event(
            organization=self.organization,
            repository=repo,
            raw_event_action="synchronize",
            status=CodeReviewEventStatus.SENT_TO_SEER,
        )

        cleanup_old_code_review_events()

        assert not CodeReviewEvent.objects.filter(id=old_event.id).exists()
        assert CodeReviewEvent.objects.filter(id=new_event.id).exists()
