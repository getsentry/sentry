from typing import Any

from django.urls import reverse

from sentry.models.code_review_event import CodeReviewEvent, CodeReviewEventStatus
from sentry.testutils.cases import APITestCase


class OrganizationCodeReviewStatsTest(APITestCase):
    endpoint = "sentry-api-0-organization-code-review-stats"

    def setUp(self) -> None:
        super().setUp()
        self.repo = self.create_repo(project=self.project, name="owner/repo")
        self.login_as(user=self.user)

    def _create_event(self, **kwargs: Any) -> CodeReviewEvent:
        return self.create_code_review_event(
            organization=self.organization,
            repository=self.repo,
            **kwargs,
        )

    def test_requires_feature_flag(self) -> None:
        url = reverse(self.endpoint, args=[self.organization.slug])
        response = self.client.get(url)
        assert response.status_code == 404

    def test_returns_pr_level_stats(self) -> None:
        # PR #1: reviewed (has completed event)
        self._create_event(
            pr_number=1,
            pr_author="alice",
            status=CodeReviewEventStatus.REVIEW_COMPLETED,
            comments_posted=3,
        )
        # PR #1: second review run
        self._create_event(
            pr_number=1,
            pr_author="alice",
            status=CodeReviewEventStatus.REVIEW_COMPLETED,
            comments_posted=2,
        )
        # PR #2: reviewed
        self._create_event(
            pr_number=2,
            pr_author="alice",
            status=CodeReviewEventStatus.REVIEW_COMPLETED,
            comments_posted=1,
        )
        # PR #3: skipped (only has preflight_denied, never reviewed)
        self._create_event(
            pr_number=3, pr_author="bob", status=CodeReviewEventStatus.PREFLIGHT_DENIED
        )
        # PR #4: skipped via webhook_filtered
        self._create_event(
            pr_number=4, pr_author="bob", status=CodeReviewEventStatus.WEBHOOK_FILTERED
        )
        # PR #5: was skipped once but then reviewed — counts as reviewed, not skipped
        self._create_event(
            pr_number=5, pr_author="charlie", status=CodeReviewEventStatus.PREFLIGHT_DENIED
        )
        self._create_event(
            pr_number=5,
            pr_author="charlie",
            status=CodeReviewEventStatus.REVIEW_COMPLETED,
            comments_posted=4,
        )

        with self.feature("organizations:pr-review-dashboard"):
            url = reverse(self.endpoint, args=[self.organization.slug])
            response = self.client.get(url)

        assert response.status_code == 200
        stats = response.data["stats"]
        assert stats["totalPrs"] == 5
        assert stats["totalReviews"] == 4  # PR1 x2, PR2 x1, PR5 x1
        assert stats["totalComments"] == 10  # 3+2+1+4
        assert stats["skippedPrs"] == 2  # PRs 3, 4
        assert stats["totalAuthors"] == 3
        assert stats["topAuthors"][0] == {"author": "alice", "prCount": 2}
        assert stats["topAuthors"][1] == {"author": "bob", "prCount": 2}
        assert stats["topAuthors"][2] == {"author": "charlie", "prCount": 1}

    def test_returns_time_series(self) -> None:
        self._create_event(
            pr_number=1, status=CodeReviewEventStatus.REVIEW_COMPLETED, comments_posted=2
        )
        self._create_event(pr_number=2, status=CodeReviewEventStatus.PREFLIGHT_DENIED)

        with self.feature("organizations:pr-review-dashboard"):
            url = reverse(self.endpoint, args=[self.organization.slug])
            response = self.client.get(url)

        assert response.status_code == 200
        assert len(response.data["timeSeries"]) >= 1
        entry = response.data["timeSeries"][0]
        assert "date" in entry
        assert "reviewed" in entry
        assert "skipped" in entry
        assert "comments" in entry

    def test_returns_repositories(self) -> None:
        self._create_event(pr_number=1)

        with self.feature("organizations:pr-review-dashboard"):
            url = reverse(self.endpoint, args=[self.organization.slug])
            response = self.client.get(url)

        assert response.status_code == 200
        repos = response.data["repositories"]
        assert len(repos) == 1
        assert repos[0]["id"] == str(self.repo.id)
        assert repos[0]["name"] == "owner/repo"

    def test_repositories_unaffected_by_repo_filter(self) -> None:
        other_repo = self.create_repo(project=self.project, name="other/repo")
        self._create_event(pr_number=1)
        self.create_code_review_event(
            organization=self.organization, repository=other_repo, pr_number=2
        )

        with self.feature("organizations:pr-review-dashboard"):
            url = reverse(self.endpoint, args=[self.organization.slug])
            response = self.client.get(url, {"repositoryId": str(self.repo.id)})

        # Stats are filtered but repository list shows all repos
        assert response.data["stats"]["totalPrs"] == 1
        assert len(response.data["repositories"]) == 2

    def test_empty_stats(self) -> None:
        with self.feature("organizations:pr-review-dashboard"):
            url = reverse(self.endpoint, args=[self.organization.slug])
            response = self.client.get(url)

        assert response.status_code == 200
        assert response.data["repositories"] == []
        stats = response.data["stats"]
        assert stats["totalPrs"] == 0
        assert stats["totalReviews"] == 0
        assert stats["totalComments"] == 0
        assert stats["skippedPrs"] == 0
        assert stats["totalAuthors"] == 0
        assert stats["topAuthors"] == []

    def test_does_not_leak_cross_org(self) -> None:
        other_org = self.create_organization(owner=self.create_user())
        other_repo = self.create_repo(
            project=self.create_project(organization=other_org), name="other/repo"
        )
        self.create_code_review_event(
            organization=other_org,
            repository=other_repo,
            pr_number=1,
            comments_posted=10,
        )

        with self.feature("organizations:pr-review-dashboard"):
            url = reverse(self.endpoint, args=[self.organization.slug])
            response = self.client.get(url)

        assert response.status_code == 200
        assert response.data["stats"]["totalPrs"] == 0

    def test_filters_by_repository_id(self) -> None:
        other_repo = self.create_repo(project=self.project, name="other/repo")
        self._create_event(
            pr_number=1,
            status=CodeReviewEventStatus.REVIEW_COMPLETED,
            comments_posted=5,
        )
        self.create_code_review_event(
            organization=self.organization,
            repository=other_repo,
            pr_number=2,
            status=CodeReviewEventStatus.REVIEW_COMPLETED,
            comments_posted=3,
        )

        with self.feature("organizations:pr-review-dashboard"):
            url = reverse(self.endpoint, args=[self.organization.slug])
            response = self.client.get(url, {"repositoryId": str(self.repo.id)})

        assert response.status_code == 200
        assert response.data["stats"]["totalPrs"] == 1
        assert response.data["stats"]["totalReviews"] == 1
