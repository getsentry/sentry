from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime, timedelta
from unittest.mock import Mock, patch

from django.utils import timezone

from sentry.constants import ObjectStatus
from sentry.integrations.source_code_management.status_check import (
    AggregateChecksStatus,
    AggregateReviewStatus,
    PullRequestStatusClient,
    PullRequestStatusRequest,
    PullRequestStatusResult,
)
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.models.grouplink import GroupLink
from sentry.models.pullrequest import (
    PullRequest,
    PullRequestAttribution,
    PullRequestAttributionSignalType,
    PullRequestAttributionSource,
    PullRequestLifecycleState,
)
from sentry.models.repository import Repository
from sentry.tasks.merge import merge_groups
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.types.activity import ActivityType


class PullRequestStatusClientFake(PullRequestStatusClient):
    """A client reporting checks and review state per pull request key."""

    def __init__(
        self,
        status_by_key: dict[str, PullRequestStatusResult] | None = None,
        error: Exception | None = None,
    ) -> None:
        self.status_by_key = status_by_key or {}
        self.error = error
        self.requested_keys: list[str] = []
        self.requested_include_files: list[bool] = []
        self.request_count = 0

    def get_pull_request_statuses(
        self, pull_requests: Sequence[PullRequestStatusRequest]
    ) -> dict[PullRequestStatusRequest, PullRequestStatusResult]:
        self.request_count += 1
        self.requested_keys.extend(pull_request.pull_number for pull_request in pull_requests)
        self.requested_include_files.extend(
            pull_request.include_files for pull_request in pull_requests
        )
        if self.error is not None:
            raise self.error
        return {
            pull_request: self.status_by_key.get(
                pull_request.pull_number, PullRequestStatusResult()
            )
            for pull_request in pull_requests
        }


class UnsupportedClient:
    """A client that cannot report checks or review state, like the non-GitHub providers."""


class GroupPullRequestsEndpointTest(APITestCase):
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
        self.expanded_path = f"{self.path}?expand=checksAndReview"

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

    def set_provider_client[T](self, mock_get_integration: Mock, client: T) -> T:
        installation = Mock()
        installation.get_client.return_value = client
        integration = Mock()
        integration.get_installation.return_value = installation
        mock_get_integration.return_value = integration
        return client

    def set_provider_pull_request_response(
        self, mock_get_integration: Mock, response: dict[str, object]
    ) -> Mock:
        client = Mock()
        client.get_pull_request.return_value = response
        return self.set_provider_client(mock_get_integration, client)

    def get_checks_and_review(self, *, expand: bool = True) -> list[tuple[str | None, str | None]]:
        """The (checksStatus, reviewStatus) pair of each pull request, in response order."""
        response = self.client.get(self.expanded_path if expand else self.path)
        assert response.status_code == 200
        return [
            (item["checksStatus"], item["reviewStatus"]) for item in response.data["pullRequests"]
        ]

    def test_empty_response(self) -> None:
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
        assert response.data["pullRequests"][0]["attribution"] is None

    def test_limits_to_five_most_recent_pull_requests(self) -> None:
        for index in range(6):
            self.create_linked_pull_request(
                key=str(index + 1),
                linked_delta=timedelta(days=index + 1),
            )

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

        response = self.client.get(self.path)

        assert response.status_code == 200
        assert response.data == {"pullRequests": []}

    def test_returns_display_pull_request_attribution(self) -> None:
        delegated_pull_request, _ = self.create_linked_pull_request(key="1")
        PullRequestAttribution.objects.create(
            pull_request=delegated_pull_request,
            signal_type=PullRequestAttributionSignalType.SEER_DELEGATED_CLAUDE_CODE,
            source=PullRequestAttributionSource.SEER_DATA,
        )
        PullRequestAttribution.objects.create(
            pull_request=delegated_pull_request,
            signal_type=PullRequestAttributionSignalType.SENTRY_APP,
            source=PullRequestAttributionSource.SEER_DATA,
        )

        sentry_app_pull_request, _ = self.create_linked_pull_request(key="2")
        PullRequestAttribution.objects.create(
            pull_request=sentry_app_pull_request,
            signal_type=PullRequestAttributionSignalType.SENTRY_APP,
            source=PullRequestAttributionSource.WEBHOOK_DATA,
        )
        PullRequestAttribution.objects.create(
            pull_request=sentry_app_pull_request,
            signal_type=PullRequestAttributionSignalType.SENTRY_APP,
            source=PullRequestAttributionSource.SEER_DATA,
        )

        response = self.client.get(self.path)

        assert response.status_code == 200
        attribution_by_id = {
            item["id"]: item["attribution"] for item in response.data["pullRequests"]
        }
        assert attribution_by_id["1"] == {
            "type": "seer",
            "id": "seer",
            "agent": "claude_code",
        }
        assert attribution_by_id["2"] == {
            "type": "seer",
            "id": "seer",
            "agent": None,
        }

    def test_returns_pull_request_after_issues_are_merged(self) -> None:
        surviving_group = self.create_group(project=self.group.project)
        self.create_linked_pull_request(key="1")

        response = self.client.get(self.path)
        assert response.status_code == 200
        assert [item["id"] for item in response.data["pullRequests"]] == ["1"]

        with self.tasks():
            merge_groups([self.group.id], surviving_group.id)

        response = self.client.get(
            f"/api/0/organizations/{self.organization.slug}/issues/"
            f"{surviving_group.id}/pull-requests/"
        )

        assert response.status_code == 200
        assert [item["id"] for item in response.data["pullRequests"]] == ["1"]

    def test_ignores_invalid_display_pull_request_attribution(self) -> None:
        pull_request, _ = self.create_linked_pull_request(key="1")
        PullRequestAttribution.objects.create(
            pull_request=pull_request,
            signal_type=PullRequestAttributionSignalType.SEER_DELEGATED_CURSOR,
            source=PullRequestAttributionSource.SEER_DATA,
            is_valid=False,
        )
        PullRequestAttribution.objects.create(
            pull_request=pull_request,
            signal_type=PullRequestAttributionSignalType.MCP,
            source=PullRequestAttributionSource.WEBHOOK_DATA,
        )

        response = self.client.get(self.path)

        assert response.status_code == 200
        assert response.data["pullRequests"][0]["attribution"] is None

    @patch(
        "sentry.integrations.source_code_management.pull_request_status_batch.integration_service.get_integration"
    )
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
            draft=True,
        )
        self.create_linked_pull_request(
            key="4",
            linked_delta=timedelta(days=2),
            state=PullRequestLifecycleState.MERGED,
            merged_at=timezone.now(),
        )

        response = self.client.get(self.path)

        assert response.status_code == 200
        assert [item["status"] for item in response.data["pullRequests"]] == [
            "merged",
            "closed",
            "draft",
            "open",
        ]
        mock_get_integration.assert_not_called()

    @patch(
        "sentry.integrations.source_code_management.pull_request_status_batch.integration_service.get_integration"
    )
    def test_incomplete_stored_status_falls_back_to_provider(
        self, mock_get_integration: Mock
    ) -> None:
        self.repo.config = {"name": "getsentry/sentry-from-config"}
        self.repo.save(update_fields=["config"])

        self.create_linked_pull_request(key="1", linked_delta=timedelta(days=2))
        self.create_linked_pull_request(
            key="2",
            linked_delta=timedelta(days=1),
            state=PullRequestLifecycleState.OPEN,
        )

        client = self.set_provider_pull_request_response(mock_get_integration, {})
        client.get_pull_request.side_effect = lambda _repo, key: {
            "1": {"state": "closed", "merged": True},
            "2": {"state": "open", "draft": True},
        }[key]

        response = self.client.get(self.path)

        assert response.status_code == 200
        assert [item["status"] for item in response.data["pullRequests"]] == ["draft", "merged"]
        assert {call.args[0] for call in client.get_pull_request.call_args_list} == {
            "getsentry/sentry-from-config"
        }
        assert mock_get_integration.call_count == 2
        assert all(
            call.kwargs
            == {
                "integration_id": self.repo.integration_id,
                "organization_id": self.group.project.organization_id,
                "status": ObjectStatus.ACTIVE,
            }
            for call in mock_get_integration.call_args_list
        )

    @patch(
        "sentry.integrations.source_code_management.pull_request_status_batch.integration_service.get_integration"
    )
    def test_provider_status_fetch_failure_returns_unknown(
        self, mock_get_integration: Mock
    ) -> None:
        self.create_linked_pull_request(key="1")
        client = self.set_provider_pull_request_response(mock_get_integration, {})
        client.get_pull_request.side_effect = RuntimeError("nope")

        response = self.client.get(self.path)

        assert response.status_code == 200
        assert response.data["pullRequests"][0]["status"] == "unknown"

    def test_checks_and_review_absent_without_feature(self) -> None:
        self.create_linked_pull_request(key="1", state=PullRequestLifecycleState.OPEN, draft=False)

        with patch(
            "sentry.integrations.source_code_management.pull_request_status_batch.integration_service.get_integration"
        ) as mock_get_integration:
            assert self.get_checks_and_review() == [(None, None)]

        # Both gates skip the provider request itself, not just the response field.
        mock_get_integration.assert_not_called()

    @with_feature("organizations:issue-pr-checks-status")
    def test_checks_and_review_absent_without_expand(self) -> None:
        self.create_linked_pull_request(key="1", state=PullRequestLifecycleState.OPEN, draft=False)

        with patch(
            "sentry.integrations.source_code_management.pull_request_status_batch.integration_service.get_integration"
        ) as mock_get_integration:
            assert self.get_checks_and_review(expand=False) == [(None, None)]

        mock_get_integration.assert_not_called()

    @with_feature("organizations:issue-pr-checks-status")
    @patch(
        "sentry.integrations.source_code_management.pull_request_status_batch.integration_service.get_integration"
    )
    def test_checks_and_review_for_open_pull_requests(self, mock_get_integration: Mock) -> None:
        self.create_linked_pull_request(
            key="1",
            linked_delta=timedelta(days=2),
            state=PullRequestLifecycleState.OPEN,
            draft=False,
        )
        self.create_linked_pull_request(
            key="2",
            linked_delta=timedelta(days=1),
            state=PullRequestLifecycleState.OPEN,
            draft=True,
        )
        # "3" has no entry, standing in for a repository with no CI configured.
        self.create_linked_pull_request(
            key="3",
            linked_delta=timedelta(hours=1),
            state=PullRequestLifecycleState.OPEN,
            draft=False,
        )
        client = self.set_provider_client(
            mock_get_integration,
            PullRequestStatusClientFake(
                {
                    "1": PullRequestStatusResult(
                        checks=AggregateChecksStatus.FAILURE,
                        review=AggregateReviewStatus.CHANGES_REQUESTED,
                    ),
                    "2": PullRequestStatusResult(
                        checks=AggregateChecksStatus.SUCCESS,
                        review=AggregateReviewStatus.APPROVED,
                    ),
                }
            ),
        )

        assert self.get_checks_and_review() == [
            (None, None),
            ("success", "approved"),
            ("failure", "changes_requested"),
        ]
        assert set(client.requested_keys) == {"1", "2", "3"}
        assert client.requested_include_files == [False, False, False]
        assert client.request_count == 1
        assert mock_get_integration.call_count == 1

    @with_feature("organizations:issue-pr-checks-status")
    @patch(
        "sentry.integrations.source_code_management.pull_request_status_batch.integration_service.get_integration"
    )
    def test_checks_and_review_skipped_for_finished_pull_requests(
        self, mock_get_integration: Mock
    ) -> None:
        self.create_linked_pull_request(
            key="1",
            linked_delta=timedelta(days=2),
            state=PullRequestLifecycleState.MERGED,
            merged_at=timezone.now(),
        )
        self.create_linked_pull_request(
            key="2",
            linked_delta=timedelta(days=1),
            state=PullRequestLifecycleState.CLOSED,
        )
        client = self.set_provider_client(mock_get_integration, PullRequestStatusClientFake())

        assert self.get_checks_and_review() == [(None, None), (None, None)]
        assert client.requested_keys == []

    @with_feature("organizations:issue-pr-checks-status")
    @patch(
        "sentry.integrations.source_code_management.pull_request_status_batch.integration_service.get_integration"
    )
    def test_checks_and_review_fetch_failure_is_not_fatal(self, mock_get_integration: Mock) -> None:
        pull_request, _ = self.create_linked_pull_request(
            key="1", state=PullRequestLifecycleState.OPEN, draft=False
        )
        self.set_provider_client(
            mock_get_integration, PullRequestStatusClientFake(error=RuntimeError("nope"))
        )

        response = self.client.get(self.expanded_path)

        assert response.status_code == 200
        assert response.data["pullRequests"][0]["checksStatus"] is None
        assert response.data["pullRequests"][0]["reviewStatus"] is None
        # The rest of the pull request still serializes.
        assert response.data["pullRequests"][0]["id"] == pull_request.key
        assert response.data["pullRequests"][0]["status"] == "open"

    @with_feature("organizations:issue-pr-checks-status")
    @patch("sentry.integrations.source_code_management.pull_request_status_batch.logger")
    @patch(
        "sentry.integrations.source_code_management.pull_request_status_batch.integration_service.get_integration"
    )
    def test_checks_and_review_without_client_support(
        self, mock_get_integration: Mock, mock_logger: Mock
    ) -> None:
        self.create_linked_pull_request(key="1", state=PullRequestLifecycleState.OPEN, draft=False)
        self.set_provider_client(mock_get_integration, UnsupportedClient())

        assert self.get_checks_and_review() == [(None, None)]
        # Nothing logged, so the capability check produced the None rather than a
        # swallowed AttributeError.
        mock_logger.info.assert_not_called()

    @with_feature("organizations:issue-pr-checks-status")
    @patch(
        "sentry.integrations.source_code_management.pull_request_status_batch.integration_service.get_integration"
    )
    def test_checks_and_review_without_integration(self, mock_get_integration: Mock) -> None:
        self.create_linked_pull_request(key="1", state=PullRequestLifecycleState.OPEN, draft=False)
        mock_get_integration.return_value = None

        assert self.get_checks_and_review() == [(None, None)]
