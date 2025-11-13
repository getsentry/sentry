import logging
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest
import responses
from django.utils import timezone

from fixtures.gitlab import GitLabTestCase
from sentry.integrations.gitlab.integration import GitlabIntegration
from sentry.integrations.source_code_management.tasks import pr_comment_workflow
from sentry.models.commit import Commit
from sentry.models.group import Group
from sentry.models.groupowner import GroupOwner, GroupOwnerType
from sentry.models.pullrequest import (
    CommentType,
    PullRequest,
    PullRequestComment,
    PullRequestCommit,
)
from sentry.shared_integrations.exceptions import ApiError
from sentry.tasks.commit_context import DEBOUNCE_PR_COMMENT_CACHE_KEY
from sentry.testutils.cases import SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.helpers.integrations import get_installation_of_type
from sentry.utils import json
from sentry.utils.cache import cache


class GitlabCommentTestCase(GitLabTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.installation = get_installation_of_type(
            GitlabIntegration, integration=self.integration, org_id=self.organization.id
        )
        self.pr_comment_workflow = self.installation.get_pr_comment_workflow()
        self.another_integration = self.create_integration(
            organization=self.organization, external_id="1", provider="github"
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
            organization=self.another_organization, external_id="1", provider="gitlab"
        )
        self.user_to_commit_author_map = {
            self.user: self.create_commit_author(project=self.project, user=self.user),
            self.another_org_user: self.create_commit_author(
                project=self.another_org_project, user=self.another_org_user
            ),
        }
        self.repo = self.create_gitlab_repo(name="Get Sentry / Example Repo", external_id=123)
        self.pr_key = 1
        self.commit_sha = 1
        self.fingerprint = 1

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

    def create_pr_issues(self, repo=None):
        if repo is None:
            repo = self.repo

        commit_1 = self.add_commit_to_repo(repo, self.user, self.project)
        pr = self.add_pr_to_commit(commit_1)
        self.add_groupowner_to_commit(commit_1, self.project, self.user)
        self.add_groupowner_to_commit(commit_1, self.another_org_project, self.another_org_user)

        return pr


class TestPrToIssueQuery(GitlabCommentTestCase):
    def test_simple(self) -> None:
        """one pr with one issue"""
        commit = self.add_commit_to_repo(self.repo, self.user, self.project)
        pr = self.add_pr_to_commit(commit)
        groupowner = self.add_groupowner_to_commit(commit, self.project, self.user)

        results = self.pr_comment_workflow.get_issue_ids_from_pr(pr=pr)

        assert results == [groupowner.group_id]

    def test_multiple_issues(self) -> None:
        """one pr with multiple issues"""
        commit = self.add_commit_to_repo(self.repo, self.user, self.project)
        pr = self.add_pr_to_commit(commit)
        groupowner_1 = self.add_groupowner_to_commit(commit, self.project, self.user)
        groupowner_2 = self.add_groupowner_to_commit(commit, self.project, self.user)
        groupowner_3 = self.add_groupowner_to_commit(commit, self.project, self.user)

        results = self.pr_comment_workflow.get_issue_ids_from_pr(pr=pr)

        assert results == [groupowner_1.group_id, groupowner_2.group_id, groupowner_3.group_id]

    def test_multiple_prs(self) -> None:
        """multiple eligible PRs with one issue each"""
        commit_1 = self.add_commit_to_repo(self.repo, self.user, self.project)
        commit_2 = self.add_commit_to_repo(self.repo, self.user, self.project)
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
        commit_1 = self.add_commit_to_repo(self.repo, self.user, self.project)
        commit_2 = self.add_commit_to_repo(self.repo, self.user, self.project)
        pr = self.add_pr_to_commit(commit_1)
        self.add_branch_commit_to_pr(commit_2, pr)
        groupowner_1 = self.add_groupowner_to_commit(commit_1, self.project, self.user)
        groupowner_2 = self.add_groupowner_to_commit(commit_2, self.project, self.user)
        results = self.pr_comment_workflow.get_issue_ids_from_pr(pr=pr)
        assert results == [groupowner_1.group_id, groupowner_2.group_id]


class TestTop5IssuesByCount(SnubaTestCase, GitlabCommentTestCase):
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


class TestGetCommentBody(GitlabCommentTestCase):
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

        expected_comment = f"""## Issues attributed to commits in this merge request
The following issues were detected after merging:

* ‼️ [**{ev1.group.title}**](http://testserver/organizations/{self.organization.slug}/issues/{ev1.group.id}/?referrer=gitlab-pr-bot) in `dev`

* ‼️ [**{ev2.group.title}**](http://testserver/organizations/{self.organization.slug}/issues/{ev2.group.id}/?referrer=gitlab-pr-bot)

* ‼️ [**{ev3.group.title}**](http://testserver/organizations/{self.organization.slug}/issues/{ev3.group.id}/?referrer=gitlab-pr-bot) in `prod`
"""
        assert formatted_comment == expected_comment


class TestCommentWorkflow(GitlabCommentTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.user_id = "user_1"
        self.app_id = "app_1"
        self.pr = self.create_pr_issues()
        self.cache_key = DEBOUNCE_PR_COMMENT_CACHE_KEY(self.pr.id)

    @patch(
        "sentry.integrations.gitlab.integration.GitlabPRCommentWorkflow.get_top_5_issues_by_count"
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
            "https://example.gitlab.com/api/v4/projects/123/merge_requests/1/notes",
            json={"id": 1},
        )

        pr_comment_workflow(self.pr.id, self.project.id)

        request_body = json.loads(responses.calls[0].request.body)
        assert request_body == {
            "body": f"""\
## Issues attributed to commits in this merge request
The following issues were detected after merging:

* ‼️ [**{titles[0]}**](http://testserver/organizations/{self.organization.slug}/issues/{groups[0]}/?referrer=gitlab-pr-bot)

* ‼️ [**{titles[1]}**](http://testserver/organizations/{self.another_organization.slug}/issues/{groups[1]}/?referrer=gitlab-pr-bot)
"""
        }

        pull_request_comment_query = PullRequestComment.objects.all()
        assert len(pull_request_comment_query) == 1
        assert pull_request_comment_query[0].external_id == 1
        assert pull_request_comment_query[0].comment_type == CommentType.MERGED_PR
        mock_metrics.incr.assert_called_with("gitlab.pr_comment.comment_created")

    @patch(
        "sentry.integrations.gitlab.integration.GitlabPRCommentWorkflow.get_top_5_issues_by_count"
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
            responses.PUT,
            "https://example.gitlab.com/api/v4/projects/123/merge_requests/1/notes/1",
            json={"id": 1},
        )

        pr_comment_workflow(self.pr.id, self.project.id)

        request_body = json.loads(responses.calls[0].request.body)
        assert request_body == {
            "body": f"""\
## Issues attributed to commits in this merge request
The following issues were detected after merging:

* ‼️ [**{titles[0]}**](http://testserver/organizations/{self.organization.slug}/issues/{groups[0]}/?referrer=gitlab-pr-bot)

* ‼️ [**{titles[1]}**](http://testserver/organizations/{self.another_organization.slug}/issues/{groups[1]}/?referrer=gitlab-pr-bot)
"""
        }

        pull_request_comment.refresh_from_db()
        assert pull_request_comment.group_ids == groups
        assert pull_request_comment.updated_at == timezone.now()
        mock_metrics.incr.assert_called_with("gitlab.pr_comment.comment_updated")

    @patch(
        "sentry.integrations.gitlab.integration.GitlabPRCommentWorkflow.get_top_5_issues_by_count"
    )
    @patch("sentry.integrations.source_code_management.tasks.metrics")
    @patch("sentry.integrations.gitlab.integration.metrics")
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
            "https://example.gitlab.com/api/v4/projects/123/merge_requests/1/notes",
            status=400,
            json={"id": 1},
        )
        responses.add(
            responses.POST,
            "https://example.gitlab.com/api/v4/projects/123/merge_requests/2/notes",
            status=429,
            json={},
        )

        with pytest.raises(ApiError):
            pr_comment_workflow(self.pr.id, self.project.id)
        assert cache.get(self.cache_key) is None
        mock_metrics.incr.assert_called_with("gitlab.pr_comment.error", tags={"type": "api_error"})

        pr_2 = self.create_pr_issues()
        cache_key = DEBOUNCE_PR_COMMENT_CACHE_KEY(pr_2.id)
        cache.set(cache_key, True, timedelta(minutes=5).total_seconds())

        # does not raise ApiError for rate limited error
        pr_comment_workflow(pr_2.id, self.project.id)
        assert cache.get(cache_key) is None
        mock_integration_metrics.incr.assert_called_with(
            "gitlab.pr_comment.error", tags={"type": "rate_limited_error"}
        )

    @patch(
        "sentry.integrations.gitlab.integration.GitlabPRCommentWorkflow.get_top_5_issues_by_count"
    )
    @patch("sentry.integrations.gitlab.integration.GitlabPRCommentWorkflow.get_comment_body")
    @responses.activate
    def test_comment_workflow_no_issues(
        self, mock_get_comment_body: MagicMock, mock_issues: MagicMock
    ) -> None:
        mock_issues.return_value = []

        pr_comment_workflow(self.pr.id, self.project.id)

        assert mock_issues.called
        assert not mock_get_comment_body.called
