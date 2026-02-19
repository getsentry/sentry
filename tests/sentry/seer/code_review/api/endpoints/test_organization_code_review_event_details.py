from datetime import timedelta
from typing import Any

from django.urls import reverse
from django.utils import timezone

from sentry.models.code_review_event import CodeReviewEvent, CodeReviewEventStatus
from sentry.testutils.cases import APITestCase


class OrganizationCodeReviewPRDetailsTest(APITestCase):
    endpoint = "sentry-api-0-organization-code-review-pr-details"

    def setUp(self) -> None:
        super().setUp()
        self.repo = self.create_repo(
            project=self.project, name="owner/repo", external_id="gh-12345"
        )
        self.login_as(user=self.user)

    def _create_event(self, **kwargs: Any) -> CodeReviewEvent:
        kwargs.setdefault("pr_number", 42)
        return self.create_code_review_event(
            organization=self.organization,
            repository=self.repo,
            **kwargs,
        )

    def test_requires_feature_flag(self) -> None:
        self._create_event()
        url = reverse(self.endpoint, args=[self.organization.slug, self.repo.id, 42])
        response = self.client.get(url)
        assert response.status_code == 404

    def test_returns_pr_details_with_events(self) -> None:
        self._create_event(pr_title="Fix a bug", pr_number=42)
        self._create_event(pr_title="Fix a bug", pr_number=42, trigger="on_new_commit")

        with self.feature("organizations:pr-review-dashboard"):
            url = reverse(self.endpoint, args=[self.organization.slug, self.repo.id, 42])
            response = self.client.get(url)

        assert response.status_code == 200
        assert response.data["prTitle"] == "Fix a bug"
        assert response.data["prNumber"] == 42
        assert response.data["repositoryName"] == "owner/repo"
        assert response.data["repositoryId"] == str(self.repo.id)
        assert len(response.data["events"]) == 2

    def test_returns_404_for_nonexistent_pr(self) -> None:
        with self.feature("organizations:pr-review-dashboard"):
            url = reverse(self.endpoint, args=[self.organization.slug, self.repo.id, 99999])
            response = self.client.get(url)

        assert response.status_code == 404

    def test_does_not_leak_cross_org(self) -> None:
        other_org = self.create_organization(owner=self.create_user())
        other_repo = self.create_repo(
            project=self.create_project(organization=other_org), name="other/repo"
        )
        self.create_code_review_event(
            organization=other_org,
            repository=other_repo,
            pr_number=42,
        )

        with self.feature("organizations:pr-review-dashboard"):
            url = reverse(self.endpoint, args=[self.organization.slug, other_repo.id, 42])
            response = self.client.get(url)

        assert response.status_code == 404

    def test_events_ordered_by_time_descending(self) -> None:
        e1 = self._create_event(pr_number=42, trigger="on_ready_for_review")
        e2 = self._create_event(pr_number=42, trigger="on_new_commit")

        with self.feature("organizations:pr-review-dashboard"):
            url = reverse(self.endpoint, args=[self.organization.slug, self.repo.id, 42])
            response = self.client.get(url)

        assert response.status_code == 200
        event_ids = [e["id"] for e in response.data["events"]]
        # Most recent first (e2 was created after e1)
        assert event_ids == [str(e2.id), str(e1.id)]

    def test_returns_summary(self) -> None:
        now = timezone.now()

        self._create_event(
            pr_number=42,
            status=CodeReviewEventStatus.REVIEW_COMPLETED,
            comments_posted=3,
            sent_to_seer_at=now - timedelta(seconds=10),
            review_completed_at=now,
        )
        self._create_event(
            pr_number=42,
            status=CodeReviewEventStatus.REVIEW_COMPLETED,
            comments_posted=1,
            sent_to_seer_at=now - timedelta(seconds=20),
            review_completed_at=now,
        )
        self._create_event(
            pr_number=42,
            status=CodeReviewEventStatus.REVIEW_FAILED,
        )
        self._create_event(
            pr_number=42,
            status=CodeReviewEventStatus.PREFLIGHT_DENIED,
            denial_reason="pr_too_large",
        )
        self._create_event(
            pr_number=42,
            status=CodeReviewEventStatus.WEBHOOK_FILTERED,
        )

        with self.feature("organizations:pr-review-dashboard"):
            url = reverse(self.endpoint, args=[self.organization.slug, self.repo.id, 42])
            response = self.client.get(url)

        assert response.status_code == 200
        summary = response.data["summary"]
        assert summary["totalReviews"] == 2
        assert summary["totalFailed"] == 1
        assert summary["totalSkipped"] == 2
        assert summary["totalComments"] == 4
        # avg of 10s and 20s = 15s = 15000ms
        assert summary["avgReviewDurationMs"] == 15000
