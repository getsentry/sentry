import logging
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest
import responses
from django.utils import timezone

from sentry.constants import ObjectStatus
from sentry.integrations.github.integration import GitHubIntegration, GitHubIntegrationProvider
from sentry.integrations.github.tasks.pr_comment import github_comment_workflow
from sentry.integrations.models.integration import Integration
from sentry.models.commit import Commit
from sentry.models.group import Group
from sentry.models.groupowner import GroupOwner, GroupOwnerType
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.pullrequest import (
    CommentType,
    PullRequest,
    PullRequestComment,
    PullRequestCommit,
)
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import ApiError
from sentry.tasks.commit_context import DEBOUNCE_PR_COMMENT_CACHE_KEY
from sentry.testutils.cases import IntegrationTestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.helpers.integrations import get_installation_of_type
from sentry.testutils.silo import assume_test_silo_mode_of
from sentry.testutils.skips import requires_snuba
from sentry.utils.cache import cache

pytestmark = [requires_snuba]


class GithubCommentTestCase(IntegrationTestCase):
    provider = GitHubIntegrationProvider
    base_url = "https://api.github.com"

    def setUp(self) -> None:
        super().setUp()
        self.installation = get_installation_of_type(
            GitHubIntegration, integration=self.integration, org_id=self.organization.id
        )
        self.pr_comment_workflow = self.installation.get_pr_comment_workflow()
        self.another_integration = self.create_integration(
            organization=self.organization, external_id="1", provider="gitlab"
        )
        self.another_org_user = self.create_user("foo@localhost")
        self.another_organization = self.create_organization(
            name="Foobar", owner=self.another_org_user
        )
        self.another_team = self.create_team(organization=self.organization, name="Mariachi Band")
        self.another_org_project = self.create_project(
            organization=self.another_organization, teams=[self.another_team], name="Bengal"
        )
        self.another_org_integration = self.create_integration(
            organization=self.another_organization, external_id="1", provider="github"
        )
        self.user_to_commit_author_map = {
            self.user: self.create_commit_author(project=self.project, user=self.user),
            self.another_org_user: self.create_commit_author(
                project=self.another_org_project, user=self.another_org_user
            ),
        }
        self.gh_repo = self.create_repo(
            name="getsentry/sentry",
            provider="integrations:github",
            integration_id=self.integration.id,
            project=self.project,
            url="https://github.com/getsentry/sentry",
        )
        self.not_gh_repo = self.create_repo(
            name="getsentry/santry",
            provider="integrations:gitlab",
            integration_id=self.another_integration.id,
            project=self.project,
            url="https://gitlab.com/getsentry/santry",
        )
        self.another_org_repo = self.create_repo(
            name="getsentry/sentree",
            provider="integrations:github",
            integration_id=self.another_org_integration.id,
            project=self.another_org_project,
            url="https://github.com/getsentry/sentree",
        )
        self.pr_key = 1
        self.commit_sha = 1
        self.fingerprint = 1
        patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1").start()

    def add_commit_to_repo(self, repo, user, project):
        if user not in self.user_to_commit_author_map:
            self.user_to_commit_author_map[user] = self.create_commit_author(
                project=repo.project, user=user
            )
        commit = self.create_commit(
            project=project,
            repo=repo,
            author=self.user_to_commit_author_map[user],
            key=str(self.commit_sha),
            message=str(self.commit_sha),
        )
        self.commit_sha += 1
        return commit

    def add_pr_to_commit(self, commit: Commit, date_added=None):
        if date_added is None:
            date_added = before_now(minutes=1)
        pr = PullRequest.objects.create(
            organization_id=commit.organization_id,
            repository_id=commit.repository_id,
            key=str(self.pr_key),
            author=commit.author,
            message="foo",
            title="bar",
            merge_commit_sha=commit.key,
            date_added=date_added,
        )
        self.pr_key += 1
        self.add_branch_commit_to_pr(commit, pr)
        return pr

    def add_branch_commit_to_pr(self, commit: Commit, pr: PullRequest):
        pr_commit = PullRequestCommit.objects.create(pull_request=pr, commit=commit)
        return pr_commit

    def add_groupowner_to_commit(self, commit: Commit, project, user):
        event = self.store_event(
            data={
                "message": f"issue {self.fingerprint}",
                "culprit": f"issue{self.fingerprint}",
                "fingerprint": [f"issue{self.fingerprint}"],
            },
            project_id=project.id,
        )
        assert event.group is not None
        self.fingerprint += 1
        groupowner = GroupOwner.objects.create(
            group=event.group,
            user_id=user.id,
            project=project,
            organization_id=commit.organization_id,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            context={"commitId": commit.id},
        )
        return groupowner

    def create_pr_issues(self, gh_repo=None):
        if gh_repo is None:
            gh_repo = self.gh_repo

        commit_1 = self.add_commit_to_repo(gh_repo, self.user, self.project)
        pr = self.add_pr_to_commit(commit_1)
        self.add_groupowner_to_commit(commit_1, self.project, self.user)
        self.add_groupowner_to_commit(commit_1, self.another_org_project, self.another_org_user)

        return pr


class TestPrToIssueQuery(GithubCommentTestCase):
    def test_simple(self) -> None:
        """one pr with one issue"""
        commit = self.add_commit_to_repo(self.gh_repo, self.user, self.project)
        pr = self.add_pr_to_commit(commit)
        groupowner = self.add_groupowner_to_commit(commit, self.project, self.user)

        results = self.pr_comment_workflow.get_issue_ids_from_pr(pr=pr)

        assert results == [groupowner.group_id]

    def test_multiple_issues(self) -> None:
        """one pr with multiple issues"""
        commit = self.add_commit_to_repo(self.gh_repo, self.user, self.project)
        pr = self.add_pr_to_commit(commit)
        groupowner_1 = self.add_groupowner_to_commit(commit, self.project, self.user)
        groupowner_2 = self.add_groupowner_to_commit(commit, self.project, self.user)
        groupowner_3 = self.add_groupowner_to_commit(commit, self.project, self.user)

        results = self.pr_comment_workflow.get_issue_ids_from_pr(pr=pr)

        assert results == [groupowner_1.group_id, groupowner_2.group_id, groupowner_3.group_id]

    def test_multiple_prs(self) -> None:
        """multiple eligible PRs with one issue each"""
        commit_1 = self.add_commit_to_repo(self.gh_repo, self.user, self.project)
        commit_2 = self.add_commit_to_repo(self.gh_repo, self.user, self.project)
        pr_1 = self.add_pr_to_commit(commit_1)
        pr_2 = self.add_pr_to_commit(commit_2)
        groupowner_1 = self.add_groupowner_to_commit(commit_1, self.project, self.user)
        groupowner_2 = self.add_groupowner_to_commit(commit_2, self.project, self.user)

        results = self.pr_comment_workflow.get_issue_ids_from_pr(pr=pr_1)
        assert results == [groupowner_1.group_id]

        results = self.pr_comment_workflow.get_issue_ids_from_pr(pr=pr_2)
        assert results == [groupowner_2.group_id]

    def test_multiple_commits(self) -> None:
        """Multiple eligible commits with one issue each"""
        commit_1 = self.add_commit_to_repo(self.gh_repo, self.user, self.project)
        commit_2 = self.add_commit_to_repo(self.gh_repo, self.user, self.project)
        pr = self.add_pr_to_commit(commit_1)
        self.add_branch_commit_to_pr(commit_2, pr)
        groupowner_1 = self.add_groupowner_to_commit(commit_1, self.project, self.user)
        groupowner_2 = self.add_groupowner_to_commit(commit_2, self.project, self.user)
        results = self.pr_comment_workflow.get_issue_ids_from_pr(pr=pr)
        assert results == [groupowner_1.group_id, groupowner_2.group_id]


class TestTop5IssuesByCount(GithubCommentTestCase, SnubaTestCase):
    def test_simple(self) -> None:
        group1 = [
            self.store_event(
                {"fingerprint": ["group-1"], "timestamp": before_now(days=1).isoformat()},
                project_id=self.project.id,
            )
            for _ in range(3)
        ][0].group.id
        group2 = [
            self.store_event(
                {"fingerprint": ["group-2"], "timestamp": before_now(days=1).isoformat()},
                project_id=self.project.id,
            )
            for _ in range(6)
        ][0].group.id
        group3 = [
            self.store_event(
                {"fingerprint": ["group-3"], "timestamp": before_now(days=1).isoformat()},
                project_id=self.project.id,
            )
            for _ in range(4)
        ][0].group.id
        res = self.pr_comment_workflow.get_top_5_issues_by_count(
            [group1, group2, group3], self.project
        )
        assert [issue["group_id"] for issue in res] == [group2, group3, group1]

    def test_over_5_issues(self) -> None:
        issue_ids = [
            self.store_event(
                {"fingerprint": [f"group-{idx}"], "timestamp": before_now(days=1).isoformat()},
                project_id=self.project.id,
            ).group.id
            for idx in range(6)
        ]
        res = self.pr_comment_workflow.get_top_5_issues_by_count(issue_ids, self.project)
        assert len(res) == 5

    def test_ignore_info_level_issues(self) -> None:
        group1 = [
            self.store_event(
                {
                    "fingerprint": ["group-1"],
                    "timestamp": before_now(days=1).isoformat(),
                    "level": logging.INFO,
                },
                project_id=self.project.id,
            )
            for _ in range(3)
        ][0].group.id
        group2 = [
            self.store_event(
                {"fingerprint": ["group-2"], "timestamp": before_now(days=1).isoformat()},
                project_id=self.project.id,
            )
            for _ in range(6)
        ][0].group.id
        group3 = [
            self.store_event(
                {
                    "fingerprint": ["group-3"],
                    "timestamp": before_now(days=1).isoformat(),
                    "level": logging.INFO,
                },
                project_id=self.project.id,
            )
            for _ in range(4)
        ][0].group.id
        res = self.pr_comment_workflow.get_top_5_issues_by_count(
            [group1, group2, group3], self.project
        )
        assert [issue["group_id"] for issue in res] == [group2]

    def test_do_not_ignore_other_issues(self) -> None:
        group1 = [
            self.store_event(
                {
                    "fingerprint": ["group-1"],
                    "timestamp": before_now(days=1).isoformat(),
                    "level": logging.ERROR,
                },
                project_id=self.project.id,
            )
            for _ in range(3)
        ][0].group.id
        group2 = [
            self.store_event(
                {
                    "fingerprint": ["group-2"],
                    "timestamp": before_now(days=1).isoformat(),
                    "level": logging.INFO,
                },
                project_id=self.project.id,
            )
            for _ in range(6)
        ][0].group.id
        group3 = [
            self.store_event(
                {
                    "fingerprint": ["group-3"],
                    "timestamp": before_now(days=1).isoformat(),
                    "level": logging.DEBUG,
                },
                project_id=self.project.id,
            )
            for _ in range(4)
        ][0].group.id
        res = self.pr_comment_workflow.get_top_5_issues_by_count(
            [group1, group2, group3], self.project
        )
        assert [issue["group_id"] for issue in res] == [group3, group1]


class TestGetCommentBody(GithubCommentTestCase):
    def test_simple(self) -> None:
        ev1 = self.store_event(
            data={
                "message": "issue 1",
                "culprit": "issue1",
                "fingerprint": ["group-1"],
                "environment": "dev",
            },
            project_id=self.project.id,
        )
        assert ev1.group is not None
        ev2 = self.store_event(
            data={"message": "issue 2", "culprit": "issue2", "fingerprint": ["group-2"]},
            project_id=self.project.id,
        )
        assert ev2.group is not None
        ev3 = self.store_event(
            data={
                "message": "issue 3",
                "culprit": "issue3",
                "fingerprint": ["group-3"],
                "environment": "prod",
            },
            project_id=self.project.id,
        )
        assert ev3.group is not None
        formatted_comment = self.pr_comment_workflow.get_comment_body(
            [ev1.group.id, ev2.group.id, ev3.group.id]
        )

        expected_comment = f"""## Issues attributed to commits in this pull request
This pull request was merged and Sentry observed the following issues:

* ‼️ [**issue 1**](http://testserver/organizations/{self.organization.slug}/issues/{ev1.group.id}/?referrer=github-pr-bot) in `dev`

* ‼️ [**issue 2**](http://testserver/organizations/{self.organization.slug}/issues/{ev2.group.id}/?referrer=github-pr-bot)

* ‼️ [**issue 3**](http://testserver/organizations/{self.organization.slug}/issues/{ev3.group.id}/?referrer=github-pr-bot) in `prod`
"""
        assert formatted_comment == expected_comment


class TestCommentWorkflow(GithubCommentTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.user_id = "user_1"
        self.app_id = "app_1"
        self.pr = self.create_pr_issues()
        self.cache_key = DEBOUNCE_PR_COMMENT_CACHE_KEY(self.pr.id)

    @patch(
        "sentry.integrations.github.integration.GitHubPRCommentWorkflow.get_top_5_issues_by_count"
    )
    @patch("sentry.integrations.source_code_management.commit_context.metrics")
    @responses.activate
    def test_comment_workflow(self, mock_metrics: MagicMock, mock_issues: MagicMock) -> None:
        group_objs = Group.objects.order_by("id").all()
        groups = [g.id for g in group_objs]
        titles = [g.title for g in group_objs]
        mock_issues.return_value = [{"group_id": id, "event_count": 10} for id in groups]

        responses.add(
            responses.POST,
            self.base_url + "/repos/getsentry/sentry/issues/1/comments",
            json={"id": 1},
            headers={"X-Ratelimit-Limit": "60", "X-Ratelimit-Remaining": "59"},
        )

        github_comment_workflow(self.pr.id, self.project.id)

        assert (
            f'"body": "## Issues attributed to commits in this pull request\\nThis pull request was merged and Sentry observed the following issues:\\n\\n* \\u203c\\ufe0f [**{titles[0]}**](http://testserver/organizations/foo/issues/{groups[0]}/?referrer=github-pr-bot)\\n\\n* \\u203c\\ufe0f [**{titles[1]}**](http://testserver/organizations/foobar/issues/{groups[1]}/?referrer=github-pr-bot)\\n"'.encode()
            in responses.calls[0].request.body
        )
        pull_request_comment_query = PullRequestComment.objects.all()
        assert len(pull_request_comment_query) == 1
        assert pull_request_comment_query[0].external_id == 1
        assert pull_request_comment_query[0].comment_type == CommentType.MERGED_PR
        mock_metrics.incr.assert_called_with("github.pr_comment.comment_created")

    @patch(
        "sentry.integrations.github.integration.GitHubPRCommentWorkflow.get_top_5_issues_by_count"
    )
    @patch("sentry.integrations.source_code_management.commit_context.metrics")
    @responses.activate
    @freeze_time(datetime(2023, 6, 8, 0, 0, 0, tzinfo=UTC))
    def test_comment_workflow_updates_comment(
        self, mock_metrics: MagicMock, mock_issues: MagicMock
    ) -> None:
        group_objs = Group.objects.order_by("id").all()
        groups = [g.id for g in group_objs]
        titles = [g.title for g in group_objs]
        mock_issues.return_value = [{"group_id": id, "event_count": 10} for id in groups]
        pull_request_comment = PullRequestComment.objects.create(
            external_id=1,
            pull_request_id=self.pr.id,
            created_at=timezone.now() - timedelta(hours=1),
            updated_at=timezone.now() - timedelta(hours=1),
            group_ids=[1, 2, 3, 4],
        )

        # An Open PR comment should not affect the rest of the test as the filter should ignore it.
        PullRequestComment.objects.create(
            external_id=2,
            pull_request_id=self.pr.id,
            created_at=timezone.now() - timedelta(hours=1),
            updated_at=timezone.now() - timedelta(hours=1),
            group_ids=[],
            comment_type=CommentType.OPEN_PR,
        )

        responses.add(
            responses.PATCH,
            self.base_url + "/repos/getsentry/sentry/issues/comments/1",
            json={"id": 1},
            headers={"X-Ratelimit-Limit": "60", "X-Ratelimit-Remaining": "59"},
        )

        github_comment_workflow(self.pr.id, self.project.id)

        assert (
            f'"body": "## Issues attributed to commits in this pull request\\nThis pull request was merged and Sentry observed the following issues:\\n\\n* \\u203c\\ufe0f [**{titles[0]}**](http://testserver/organizations/foo/issues/{groups[0]}/?referrer=github-pr-bot)\\n\\n* \\u203c\\ufe0f [**{titles[1]}**](http://testserver/organizations/foobar/issues/{groups[1]}/?referrer=github-pr-bot)\\n"'.encode()
            in responses.calls[0].request.body
        )
        pull_request_comment.refresh_from_db()
        assert pull_request_comment.group_ids == groups
        assert pull_request_comment.updated_at == timezone.now()
        mock_metrics.incr.assert_called_with("github.pr_comment.comment_updated")

    @patch(
        "sentry.integrations.github.integration.GitHubPRCommentWorkflow.get_top_5_issues_by_count"
    )
    @patch("sentry.integrations.source_code_management.tasks.metrics")
    @patch("sentry.integrations.github.integration.metrics")
    @responses.activate
    def test_comment_workflow_api_error(
        self, mock_integration_metrics: MagicMock, mock_metrics: MagicMock, mock_issues: MagicMock
    ) -> None:
        cache.set(self.cache_key, True, timedelta(minutes=5).total_seconds())
        mock_issues.return_value = [
            {"group_id": g.id, "event_count": 10} for g in Group.objects.all()
        ]

        responses.add(
            responses.POST,
            self.base_url + "/repos/getsentry/sentry/issues/1/comments",
            status=400,
            json={"id": 1},
        )
        responses.add(
            responses.POST,
            self.base_url + "/repos/getsentry/sentry/issues/2/comments",
            status=400,
            json={
                "message": "Unable to create comment because issue is locked.",
                "documentation_url": "https://docs.github.com/articles/locking-conversations/",
            },
        )
        responses.add(
            responses.POST,
            self.base_url + "/repos/getsentry/sentry/issues/3/comments",
            status=400,
            json={
                "message": "API rate limit exceeded",
                "documentation_url": "https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting",
            },
        )

        with pytest.raises(ApiError):
            github_comment_workflow(self.pr.id, self.project.id)
        assert cache.get(self.cache_key) is None
        mock_metrics.incr.assert_called_with("github.pr_comment.error", tags={"type": "api_error"})

        pr_2 = self.create_pr_issues()
        cache_key = DEBOUNCE_PR_COMMENT_CACHE_KEY(pr_2.id)
        cache.set(cache_key, True, timedelta(minutes=5).total_seconds())

        # does not raise ApiError for locked issue
        github_comment_workflow(pr_2.id, self.project.id)
        assert cache.get(cache_key) is None
        mock_integration_metrics.incr.assert_called_with(
            "github.pr_comment.error", tags={"type": "issue_locked_error"}
        )

        pr_3 = self.create_pr_issues()
        cache_key = DEBOUNCE_PR_COMMENT_CACHE_KEY(pr_3.id)
        cache.set(cache_key, True, timedelta(minutes=5).total_seconds())

        # does not raise ApiError for rate limited error
        github_comment_workflow(pr_3.id, self.project.id)
        assert cache.get(cache_key) is None
        mock_integration_metrics.incr.assert_called_with(
            "github.pr_comment.error", tags={"type": "rate_limited_error"}
        )

    @patch(
        "sentry.integrations.github.integration.GitHubPRCommentWorkflow.get_issue_ids_from_pr",
        return_value=[],
    )
    @patch(
        "sentry.integrations.github.integration.GitHubPRCommentWorkflow.get_top_5_issues_by_count"
    )
    @patch("sentry.integrations.source_code_management.tasks.metrics")
    @patch("sentry.models.Organization.objects")
    def test_comment_workflow_missing_org(
        self, mock_repository, mock_metrics, mock_issues, mock_issue_query
    ):
        # Organization.DoesNotExist should trigger the cache to release the key
        cache.set(self.cache_key, True, timedelta(minutes=5).total_seconds())

        mock_repository.get_from_cache.side_effect = Organization.DoesNotExist

        github_comment_workflow(self.pr.id, self.project.id)

        assert not mock_issues.called
        assert cache.get(self.cache_key) is None
        mock_metrics.incr.assert_called_with(
            "source_code_management.pr_comment.error", tags={"type": "missing_org"}
        )

    @patch(
        "sentry.integrations.github.integration.GitHubPRCommentWorkflow.get_top_5_issues_by_count"
    )
    def test_comment_workflow_missing_org_option(self, mock_issues: MagicMock) -> None:
        OrganizationOption.objects.set_value(
            organization=self.organization, key="sentry:github_pr_bot", value=False
        )
        github_comment_workflow(self.pr.id, self.project.id)

        assert not mock_issues.called

    @patch(
        "sentry.integrations.github.integration.GitHubPRCommentWorkflow.get_top_5_issues_by_count"
    )
    @patch("sentry.models.Project.objects.get_from_cache")
    @patch("sentry.integrations.source_code_management.tasks.metrics")
    def test_comment_workflow_missing_project(
        self, mock_metrics: MagicMock, mock_project: MagicMock, mock_issues: MagicMock
    ) -> None:
        # Project.DoesNotExist should trigger the cache to release the key
        cache.set(self.cache_key, True, timedelta(minutes=5).total_seconds())

        mock_project.side_effect = Project.DoesNotExist

        github_comment_workflow(self.pr.id, self.project.id)

        assert not mock_issues.called
        assert cache.get(self.cache_key) is None
        mock_metrics.incr.assert_called_with(
            "github.pr_comment.error", tags={"type": "missing_project"}
        )

    @patch(
        "sentry.integrations.github.integration.GitHubPRCommentWorkflow.get_top_5_issues_by_count"
    )
    @patch("sentry.models.Repository.objects")
    @patch("sentry.integrations.github.integration.GitHubPRCommentWorkflow.get_comment_body")
    @patch("sentry.integrations.source_code_management.tasks.metrics")
    def test_comment_workflow_missing_repo(
        self, mock_metrics, mock_get_comment_body, mock_repository, mock_issues
    ):
        # Repository.DoesNotExist should trigger the cache to release the key
        cache.set(self.cache_key, True, timedelta(minutes=5).total_seconds())

        mock_repository.get.side_effect = Repository.DoesNotExist
        github_comment_workflow(self.pr.id, self.project.id)

        mock_issues.return_value = [
            {"group_id": g.id, "event_count": 10} for g in Group.objects.all()
        ]

        assert not mock_issues.called
        assert not mock_get_comment_body.called
        assert cache.get(self.cache_key) is None
        mock_metrics.incr.assert_called_with(
            "source_code_management.pr_comment.error", tags={"type": "missing_repo"}
        )

    @patch(
        "sentry.integrations.github.integration.GitHubPRCommentWorkflow.get_top_5_issues_by_count"
    )
    @patch("sentry.integrations.github.integration.GitHubPRCommentWorkflow.get_comment_body")
    @patch("sentry.integrations.source_code_management.tasks.metrics")
    def test_comment_workflow_missing_integration(
        self, mock_metrics, mock_get_comment_body, mock_issues
    ):
        # missing integration should trigger the cache to release the key
        cache.set(self.cache_key, True, timedelta(minutes=5).total_seconds())

        # inactive integration
        with assume_test_silo_mode_of(Integration):
            self.integration.update(status=ObjectStatus.DISABLED)

        mock_issues.return_value = [
            {"group_id": g.id, "event_count": 10} for g in Group.objects.all()
        ]

        github_comment_workflow(self.pr.id, self.project.id)

        assert not mock_issues.called
        assert not mock_get_comment_body.called
        assert cache.get(self.cache_key) is None
        mock_metrics.incr.assert_called_with(
            "source_code_management.pr_comment.error", tags={"type": "missing_integration"}
        )

    @patch(
        "sentry.integrations.github.integration.GitHubPRCommentWorkflow.get_top_5_issues_by_count"
    )
    @patch("sentry.integrations.github.integration.GitHubPRCommentWorkflow.get_comment_body")
    @responses.activate
    def test_comment_workflow_no_issues(
        self, mock_get_comment_body: MagicMock, mock_issues: MagicMock
    ) -> None:
        mock_issues.return_value = []

        github_comment_workflow(self.pr.id, self.project.id)

        assert mock_issues.called
        assert not mock_get_comment_body.called
