from __future__ import annotations

from datetime import datetime, timedelta
from unittest.mock import Mock, patch

from django.utils import timezone

from sentry.constants import ObjectStatus
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.models.grouplink import GroupLink
from sentry.models.pullrequest import PullRequest, PullRequestLifecycleState
from sentry.models.repository import Repository
from sentry.testutils.cases import APITestCase
from sentry.types.activity import ActivityType


class GroupPullRequestsEndpointTest(APITestCase):
    feature_name = "organizations:issue-details-linked-pull-requests"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.group = self.create_group()
        self.repo = self.create_repo(
            project=self.group.project,
            name="getsentry/sentry",
            provider="integrations:github",
            integration_id=123,
            url="https://github.com/getsentry/sentry",
        )
        self.path = (
            f"/api/0/organizations/{self.organization.slug}/issues/{self.group.id}/pull-requests/"
        )

    def create_linked_pull_request(
        self,
        *,
        key: str,
        title: str = "Fix issue details",
        linked_delta: timedelta = timedelta(days=1),
        relationship: int = GroupLink.Relationship.resolves,
        linked_type: int = GroupLink.LinkedType.pull_request,
        group: Group | None = None,
        repo: Repository | None = None,
        state: PullRequestLifecycleState | None = None,
        draft: bool | None = None,
        merged_at: datetime | None = None,
    ) -> tuple[PullRequest, GroupLink]:
        group = group or self.group
        repo = repo or self.repo
        pull_request = self.create_pull_request(
            repository_id=repo.id,
            organization_id=group.project.organization_id,
            key=key,
            title=title,
            author=self.create_commit_author(project=group.project, user=self.user),
        )
        updates = {
            key: value
            for key, value in {
                "state": state,
                "draft": draft,
                "merged_at": merged_at,
            }.items()
            if value is not None
        }
        if updates:
            pull_request.update(**updates)
        link = GroupLink.objects.create(
            group_id=group.id,
            project_id=group.project_id,
            linked_type=linked_type,
            linked_id=pull_request.id,
            relationship=relationship,
            datetime=timezone.now() - linked_delta,
        )
        return pull_request, link

    def test_feature_disabled(self) -> None:
        self.create_linked_pull_request(key="1")

        response = self.client.get(self.path)

        assert response.status_code == 404

    def test_empty_response(self) -> None:
        with self.feature(self.feature_name):
            response = self.client.get(self.path)

        assert response.status_code == 200
        assert response.data == {"pullRequests": []}

    def test_returns_resolving_pull_requests(self) -> None:
        newer_pr, newer_link = self.create_linked_pull_request(
            key="1", title="Newer PR", linked_delta=timedelta(days=2)
        )
        self.create_linked_pull_request(key="2", title="Old PR", linked_delta=timedelta(days=91))
        self.create_linked_pull_request(
            key="3",
            title="Referenced PR",
            relationship=GroupLink.Relationship.references,
        )
        self.create_linked_pull_request(
            key="4",
            title="Commit link",
            linked_type=GroupLink.LinkedType.commit,
        )
        Activity.objects.create(
            group=self.group,
            project=self.group.project,
            type=ActivityType.SET_RESOLVED_IN_PULL_REQUEST.value,
            data={"pull_request": newer_pr.id + 1000},
        )

        with self.feature(self.feature_name):
            response = self.client.get(self.path)

        assert response.status_code == 200
        assert [item["id"] for item in response.data["pullRequests"]] == ["1", "2"]
        assert response.data["pullRequests"][0]["title"] == "Newer PR"
        assert response.data["pullRequests"][0]["repository"]["name"] == "getsentry/sentry"
        assert (
            response.data["pullRequests"][0]["externalUrl"]
            == f"https://github.com/getsentry/sentry/pull/{newer_pr.key}"
        )
        assert response.data["pullRequests"][0]["dateLinked"] == newer_link.datetime
        assert "author" in response.data["pullRequests"][0]

    def test_limits_to_five_most_recent_pull_requests(self) -> None:
        for index in range(6):
            self.create_linked_pull_request(
                key=str(index + 1),
                linked_delta=timedelta(days=index + 1),
            )

        with self.feature(self.feature_name):
            response = self.client.get(self.path)

        assert response.status_code == 200
        assert [item["id"] for item in response.data["pullRequests"]] == [
            "1",
            "2",
            "3",
            "4",
            "5",
        ]

    def test_ignores_invalid_pull_request_and_repository_before_applying_limit(self) -> None:
        deleted_pull_request, _ = self.create_linked_pull_request(
            key="deleted-pr",
            linked_delta=timedelta(hours=1),
        )
        deleted_pull_request.delete()

        deleted_repo = self.create_repo(
            project=self.group.project,
            name="getsentry/deleted",
            provider="integrations:github",
            integration_id=456,
        )
        self.create_linked_pull_request(
            key="deleted-repo",
            linked_delta=timedelta(hours=2),
            repo=deleted_repo,
        )
        deleted_repo.delete()

        disabled_repo = self.create_repo(
            project=self.group.project,
            name="getsentry/disabled",
            provider="integrations:github",
            integration_id=789,
        )
        disabled_repo.status = ObjectStatus.DISABLED
        disabled_repo.save(update_fields=["status"])
        self.create_linked_pull_request(
            key="disabled-repo",
            linked_delta=timedelta(hours=3),
            repo=disabled_repo,
        )

        for index in range(6):
            self.create_linked_pull_request(
                key=str(index + 1),
                linked_delta=timedelta(days=index + 1),
            )

        with self.feature(self.feature_name):
            response = self.client.get(self.path)

        assert response.status_code == 200
        assert [item["id"] for item in response.data["pullRequests"]] == [
            "1",
            "2",
            "3",
            "4",
            "5",
        ]

    def test_ignores_pull_requests_with_repositories_in_other_orgs(self) -> None:
        other_org = self.create_organization(owner=self.user)
        other_project = self.create_project(organization=other_org)
        other_repo = self.create_repo(
            project=other_project,
            name="getsentry/other",
            provider="integrations:github",
            integration_id=456,
        )
        pull_request = self.create_pull_request(
            repository_id=other_repo.id,
            organization_id=self.group.project.organization_id,
            key="1",
            title="Wrong repo org",
        )
        GroupLink.objects.create(
            group_id=self.group.id,
            project_id=self.group.project_id,
            linked_type=GroupLink.LinkedType.pull_request,
            linked_id=pull_request.id,
            relationship=GroupLink.Relationship.resolves,
            datetime=timezone.now() - timedelta(days=1),
        )

        with self.feature(self.feature_name):
            response = self.client.get(self.path)

        assert response.status_code == 200
        assert response.data == {"pullRequests": []}

    @patch("sentry.issues.endpoints.group_pull_requests.integration_service.get_integration")
    def test_status_derivation_prefers_stored_lifecycle_fields(
        self, mock_get_integration: Mock
    ) -> None:
        self.create_linked_pull_request(
            key="1",
            linked_delta=timedelta(days=5),
            state=PullRequestLifecycleState.OPEN,
            draft=False,
        )
        self.create_linked_pull_request(
            key="2",
            linked_delta=timedelta(days=4),
            state=PullRequestLifecycleState.OPEN,
            draft=True,
        )
        self.create_linked_pull_request(
            key="3",
            linked_delta=timedelta(days=3),
            state=PullRequestLifecycleState.CLOSED,
        )
        self.create_linked_pull_request(
            key="4",
            linked_delta=timedelta(days=2),
            state=PullRequestLifecycleState.MERGED,
            merged_at=timezone.now(),
        )

        with self.feature(self.feature_name):
            response = self.client.get(self.path)

        assert response.status_code == 200
        assert [item["status"] for item in response.data["pullRequests"]] == [
            "merged",
            "closed",
            "draft",
            "open",
        ]
        mock_get_integration.assert_not_called()

    @patch("sentry.issues.endpoints.group_pull_requests.integration_service.get_integration")
    def test_closed_draft_pull_request_status_returns_closed(
        self, mock_get_integration: Mock
    ) -> None:
        self.create_linked_pull_request(
            key="1",
            state=PullRequestLifecycleState.CLOSED,
            draft=True,
        )

        with self.feature(self.feature_name):
            response = self.client.get(self.path)

        assert response.status_code == 200
        assert response.data["pullRequests"][0]["status"] == "closed"
        mock_get_integration.assert_not_called()

    @patch("sentry.issues.endpoints.group_pull_requests.integration_service.get_integration")
    def test_missing_webhook_state_falls_back_to_provider(self, mock_get_integration: Mock) -> None:
        self.repo.config = {"name": "getsentry/sentry-from-config"}
        self.repo.save(update_fields=["config"])

        self.create_linked_pull_request(key="1")

        client = Mock()
        client.get_pull_request.return_value = {"state": "closed", "merged": True}
        installation = Mock()
        installation.get_client.return_value = client
        integration = Mock()
        integration.get_installation.return_value = installation
        mock_get_integration.return_value = integration

        with self.feature(self.feature_name):
            response = self.client.get(self.path)

        assert response.status_code == 200
        assert response.data["pullRequests"][0]["status"] == "merged"
        client.get_pull_request.assert_called_once_with("getsentry/sentry-from-config", "1")
        mock_get_integration.assert_called_once_with(
            integration_id=self.repo.integration_id,
            organization_id=self.group.project.organization_id,
            status=ObjectStatus.ACTIVE,
        )

    @patch("sentry.issues.endpoints.group_pull_requests.integration_service.get_integration")
    def test_open_status_with_unknown_draft_falls_back_to_provider(
        self, mock_get_integration: Mock
    ) -> None:
        self.create_linked_pull_request(
            key="1",
            state=PullRequestLifecycleState.OPEN,
        )

        client = Mock()
        client.get_pull_request.return_value = {"state": "open", "draft": True}
        installation = Mock()
        installation.get_client.return_value = client
        integration = Mock()
        integration.get_installation.return_value = installation
        mock_get_integration.return_value = integration

        with self.feature(self.feature_name):
            response = self.client.get(self.path)

        assert response.status_code == 200
        assert response.data["pullRequests"][0]["status"] == "draft"

    @patch("sentry.issues.endpoints.group_pull_requests.integration_service.get_integration")
    def test_missing_webhook_state_returns_unknown_when_provider_unavailable(
        self, mock_get_integration: Mock
    ) -> None:
        self.create_linked_pull_request(key="1")
        mock_get_integration.return_value = None

        with self.feature(self.feature_name):
            response = self.client.get(self.path)

        assert response.status_code == 200
        assert response.data["pullRequests"][0]["status"] == "unknown"
