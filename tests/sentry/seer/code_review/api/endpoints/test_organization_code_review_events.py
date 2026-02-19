from typing import Any

from django.urls import reverse
from rest_framework.test import APIClient

from sentry.models.code_review_event import CodeReviewEvent, CodeReviewEventStatus
from sentry.testutils.cases import APITestCase


class OrganizationCodeReviewPRsTest(APITestCase):
    endpoint = "sentry-api-0-organization-code-review-prs"

    def setUp(self) -> None:
        super().setUp()
        self.repo = self.create_repo(project=self.project, name="owner/repo")
        self.login_as(user=self.user)

    def _create_event(self, **kwargs: Any) -> CodeReviewEvent:
        kwargs.setdefault("pr_number", 42)
        return self.create_code_review_event(
            organization=self.organization,
            repository=self.repo,
            **kwargs,
        )

    def test_requires_feature_flag(self) -> None:
        url = reverse(self.endpoint, args=[self.organization.slug])
        response = self.client.get(url)
        assert response.status_code == 404

    def test_lists_prs_grouped(self) -> None:
        self._create_event(pr_number=1, pr_title="First PR")
        self._create_event(pr_number=1, pr_title="First PR")
        self._create_event(pr_number=2, pr_title="Second PR")

        with self.feature("organizations:pr-review-dashboard"):
            url = reverse(self.endpoint, args=[self.organization.slug])
            response = self.client.get(url)

        assert response.status_code == 200
        assert len(response.data) == 2

        # Results are ordered by last_activity descending
        pr_numbers = {row["prNumber"] for row in response.data}
        assert pr_numbers == {1, 2}

        # PR #1 should have 2 events
        pr1 = next(row for row in response.data if row["prNumber"] == 1)
        assert pr1["eventCount"] == 2

        # PR #2 should have 1 event
        pr2 = next(row for row in response.data if row["prNumber"] == 2)
        assert pr2["eventCount"] == 1

    def test_aggregates_comments(self) -> None:
        self._create_event(pr_number=1, comments_posted=3)
        self._create_event(pr_number=1, comments_posted=2)

        with self.feature("organizations:pr-review-dashboard"):
            url = reverse(self.endpoint, args=[self.organization.slug])
            response = self.client.get(url)

        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["totalComments"] == 5

    def test_returns_latest_event_metadata(self) -> None:
        self._create_event(
            pr_number=1,
            pr_title="Old title",
            status=CodeReviewEventStatus.SENT_TO_SEER,
            trigger="on_ready_for_review",
        )
        self._create_event(
            pr_number=1,
            pr_title="New title",
            status=CodeReviewEventStatus.REVIEW_COMPLETED,
            trigger="on_new_commit",
        )

        with self.feature("organizations:pr-review-dashboard"):
            url = reverse(self.endpoint, args=[self.organization.slug])
            response = self.client.get(url)

        assert response.status_code == 200
        assert len(response.data) == 1
        pr = response.data[0]
        assert pr["prTitle"] == "New title"
        assert pr["latestStatus"] == "review_completed"
        assert pr["latestTrigger"] == "on_new_commit"

    def test_filters_by_pr_state(self) -> None:
        self._create_event(pr_number=1, pr_state="open")
        self._create_event(pr_number=2, pr_state="merged")
        self._create_event(pr_number=3, pr_state="closed")

        with self.feature("organizations:pr-review-dashboard"):
            url = reverse(self.endpoint, args=[self.organization.slug])
            response = self.client.get(url, {"prState": "open"})

        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["prNumber"] == 1

    def test_filters_by_trigger_type(self) -> None:
        self._create_event(pr_number=1, trigger="on_ready_for_review")
        self._create_event(pr_number=2, trigger="on_new_commit")

        with self.feature("organizations:pr-review-dashboard"):
            url = reverse(self.endpoint, args=[self.organization.slug])
            response = self.client.get(url, {"triggerType": "on_ready_for_review"})

        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["prNumber"] == 1

    def test_filters_by_repository_id(self) -> None:
        other_repo = self.create_repo(project=self.project, name="other/repo")
        self._create_event(pr_number=1)
        self.create_code_review_event(
            organization=self.organization, repository=other_repo, pr_number=2
        )

        with self.feature("organizations:pr-review-dashboard"):
            url = reverse(self.endpoint, args=[self.organization.slug])
            response = self.client.get(url, {"repositoryId": str(self.repo.id)})

        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["prNumber"] == 1

    def test_does_not_leak_cross_org(self) -> None:
        other_org = self.create_organization(owner=self.create_user())
        other_repo = self.create_repo(
            project=self.create_project(organization=other_org), name="other/repo"
        )
        self.create_code_review_event(
            organization=other_org,
            repository=other_repo,
            pr_number=99,
        )
        self._create_event(pr_number=1)

        with self.feature("organizations:pr-review-dashboard"):
            url = reverse(self.endpoint, args=[self.organization.slug])
            response = self.client.get(url)

        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["prNumber"] == 1

    def test_serializes_repository_name(self) -> None:
        self._create_event(pr_number=1)

        with self.feature("organizations:pr-review-dashboard"):
            url = reverse(self.endpoint, args=[self.organization.slug])
            response = self.client.get(url)

        assert response.status_code == 200
        assert response.data[0]["repositoryName"] == "owner/repo"

    def test_unauthenticated_returns_401(self) -> None:
        anon_client = APIClient()
        with self.feature("organizations:pr-review-dashboard"):
            url = reverse(self.endpoint, args=[self.organization.slug])
            response = anon_client.get(url)

        assert response.status_code == 401
