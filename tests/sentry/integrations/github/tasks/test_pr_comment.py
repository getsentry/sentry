import logging
from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import pytest
import responses
from django.utils import timezone

from sentry.constants import ObjectStatus
from sentry.integrations.github.integration import GitHubIntegrationProvider
from sentry.integrations.github.tasks.pr_comment import (
    format_comment,
    get_comment_contents,
    get_top_5_issues_by_count,
    github_comment_reactions,
    github_comment_workflow,
    pr_to_issue_query,
)
from sentry.integrations.github.tasks.utils import PullRequestIssue
from sentry.integrations.models.integration import Integration
from sentry.models.commit import Commit
from sentry.models.group import Group
from sentry.models.groupowner import GroupOwner, GroupOwnerType
from sentry.models.options.organization_option import OrganizationOption
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
from sentry.testutils.cases import IntegrationTestCase, SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.silo import assume_test_silo_mode_of
from sentry.testutils.skips import requires_snuba
from sentry.utils.cache import cache

pytestmark = [requires_snuba]


class GithubCommentTestCase(IntegrationTestCase):
    provider = GitHubIntegrationProvider
    base_url = "https://api.github.com"

    def setUp(self):
        super().setUp()
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
    def test_simple(self):
        """one pr with one issue"""
        commit = self.add_commit_to_repo(self.gh_repo, self.user, self.project)
        pr = self.add_pr_to_commit(commit)
        groupowner = self.add_groupowner_to_commit(commit, self.project, self.user)

        results = pr_to_issue_query(pr.id)

        assert results[0] == (self.gh_repo.id, pr.key, self.organization.id, [groupowner.group_id])

    def test_multiple_issues(self):
        """one pr with multiple issues"""
        commit = self.add_commit_to_repo(self.gh_repo, self.user, self.project)
        pr = self.add_pr_to_commit(commit)
        groupowner_1 = self.add_groupowner_to_commit(commit, self.project, self.user)
        groupowner_2 = self.add_groupowner_to_commit(commit, self.project, self.user)
        groupowner_3 = self.add_groupowner_to_commit(commit, self.project, self.user)

        results = pr_to_issue_query(pr.id)

        assert results[0][0:3] == (self.gh_repo.id, pr.key, self.organization.id)
        assert (
            groupowner_1.group_id in results[0][3]
            and groupowner_2.group_id in results[0][3]
            and groupowner_3.group_id in results[0][3]
        )

    def test_multiple_prs(self):
        """multiple eligible PRs with one issue each"""
        commit_1 = self.add_commit_to_repo(self.gh_repo, self.user, self.project)
        commit_2 = self.add_commit_to_repo(self.gh_repo, self.user, self.project)
        pr_1 = self.add_pr_to_commit(commit_1)
        pr_2 = self.add_pr_to_commit(commit_2)
        groupowner_1 = self.add_groupowner_to_commit(commit_1, self.project, self.user)
        groupowner_2 = self.add_groupowner_to_commit(commit_2, self.project, self.user)

        results = pr_to_issue_query(pr_1.id)
        assert results[0] == (
            self.gh_repo.id,
            pr_1.key,
            self.organization.id,
            [groupowner_1.group_id],
        )

        results = pr_to_issue_query(pr_2.id)
        assert results[0] == (
            self.gh_repo.id,
            pr_2.key,
            self.organization.id,
            [groupowner_2.group_id],
        )

    def test_multiple_commits(self):
        """Multiple eligible commits with one issue each"""
        commit_1 = self.add_commit_to_repo(self.gh_repo, self.user, self.project)
        commit_2 = self.add_commit_to_repo(self.gh_repo, self.user, self.project)
        pr = self.add_pr_to_commit(commit_1)
        self.add_branch_commit_to_pr(commit_2, pr)
        groupowner_1 = self.add_groupowner_to_commit(commit_1, self.project, self.user)
        groupowner_2 = self.add_groupowner_to_commit(commit_2, self.project, self.user)
        results = pr_to_issue_query(pr.id)
        assert results[0] == (
            self.gh_repo.id,
            pr.key,
            self.organization.id,
            [groupowner_1.group_id, groupowner_2.group_id],
        )


class TestTop5IssuesByCount(TestCase, SnubaTestCase):
    def test_simple(self):
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
        res = get_top_5_issues_by_count([group1, group2, group3], self.project)
        assert [issue["group_id"] for issue in res] == [group2, group3, group1]

    def test_over_5_issues(self):
        issue_ids = [
            self.store_event(
                {"fingerprint": [f"group-{idx}"], "timestamp": before_now(days=1).isoformat()},
                project_id=self.project.id,
            ).group.id
            for idx in range(6)
        ]
        res = get_top_5_issues_by_count(issue_ids, self.project)
        assert len(res) == 5

    def test_ignore_info_level_issues(self):
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
        res = get_top_5_issues_by_count([group1, group2, group3], self.project)
        assert [issue["group_id"] for issue in res] == [group2]

    def test_do_not_ignore_other_issues(self):
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
        res = get_top_5_issues_by_count([group1, group2, group3], self.project)
        assert [issue["group_id"] for issue in res] == [group3, group1]


class TestCommentBuilderQueries(GithubCommentTestCase):
    def test_simple(self):
        ev1 = self.store_event(
            data={"message": "issue 1", "culprit": "issue1", "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        assert ev1.group is not None
        ev2 = self.store_event(
            data={"message": "issue 2", "culprit": "issue2", "fingerprint": ["group-2"]},
            project_id=self.project.id,
        )
        assert ev2.group is not None
        ev3 = self.store_event(
            data={"message": "issue 3", "culprit": "issue3", "fingerprint": ["group-3"]},
            project_id=self.project.id,
        )
        assert ev3.group is not None
        comment_contents = get_comment_contents([ev1.group.id, ev2.group.id, ev3.group.id])
        assert (
            PullRequestIssue(
                title="issue 1",
                subtitle="issue1",
                url=f"http://testserver/organizations/{self.organization.slug}/issues/{ev1.group.id}/",
            )
            in comment_contents
        )
        assert (
            PullRequestIssue(
                title="issue 2",
                subtitle="issue2",
                url=f"http://testserver/organizations/{self.organization.slug}/issues/{ev2.group.id}/",
            )
            in comment_contents
        )
        assert (
            PullRequestIssue(
                title="issue 3",
                subtitle="issue3",
                url=f"http://testserver/organizations/{self.organization.slug}/issues/{ev3.group.id}/",
            )
            in comment_contents
        )


class TestFormatComment(TestCase):
    def test_format_comment(self):
        issues = [
            PullRequestIssue(
                title="TypeError",
                subtitle="sentry.tasks.derive_code_mappings.derive_code_mappings",
                url="https://sentry.sentry.io/issues/",
            ),
            PullRequestIssue(
                title="KafkaException",
                subtitle="query_subscription_consumer_process_message",
                url="https://sentry.sentry.io/stats/",
            ),
        ]

        formatted_comment = format_comment(issues)
        expected_comment = "## Suspect Issues\nThis pull request was deployed and Sentry observed the following issues:\n\n- ‼️ **TypeError** `sentry.tasks.derive_code_mappings.derive_code_m...` [View Issue](https://sentry.sentry.io/issues/?referrer=github-pr-bot)\n- ‼️ **KafkaException** `query_subscription_consumer_process_message` [View Issue](https://sentry.sentry.io/stats/?referrer=github-pr-bot)\n\n<sub>Did you find this useful? React with a 👍 or 👎</sub>"
        assert formatted_comment == expected_comment


class TestCommentWorkflow(GithubCommentTestCase):
    def setUp(self):
        super().setUp()
        self.user_id = "user_1"
        self.app_id = "app_1"
        self.pr = self.create_pr_issues()
        self.cache_key = DEBOUNCE_PR_COMMENT_CACHE_KEY(self.pr.id)

    @patch("sentry.integrations.github.tasks.pr_comment.get_top_5_issues_by_count")
    @patch("sentry.integrations.source_code_management.commit_context.metrics")
    @responses.activate
    def test_comment_workflow(self, mock_metrics, mock_issues):
        group_objs = Group.objects.order_by("id").all()
        groups = [g.id for g in group_objs]
        titles = [g.title for g in group_objs]
        culprits = [g.culprit for g in group_objs]
        mock_issues.return_value = [{"group_id": id, "event_count": 10} for id in groups]

        responses.add(
            responses.POST,
            self.base_url + "/repos/getsentry/sentry/issues/1/comments",
            json={"id": 1},
            headers={"X-Ratelimit-Limit": "60", "X-Ratelimit-Remaining": "59"},
        )

        github_comment_workflow(self.pr.id, self.project.id)

        assert (
            f'"body": "## Suspect Issues\\nThis pull request was deployed and Sentry observed the following issues:\\n\\n- \\u203c\\ufe0f **{titles[0]}** `{culprits[0]}` [View Issue](http://testserver/organizations/foo/issues/{groups[0]}/?referrer=github-pr-bot)\\n- \\u203c\\ufe0f **{titles[1]}** `{culprits[1]}` [View Issue](http://testserver/organizations/foobar/issues/{groups[1]}/?referrer=github-pr-bot)\\n\\n<sub>Did you find this useful? React with a \\ud83d\\udc4d or \\ud83d\\udc4e</sub>"'.encode()
            in responses.calls[0].request.body
        )
        pull_request_comment_query = PullRequestComment.objects.all()
        assert len(pull_request_comment_query) == 1
        assert pull_request_comment_query[0].external_id == 1
        assert pull_request_comment_query[0].comment_type == CommentType.MERGED_PR
        mock_metrics.incr.assert_called_with("github.pr_comment.comment_created")

    @patch("sentry.integrations.github.tasks.pr_comment.get_top_5_issues_by_count")
    @patch("sentry.integrations.source_code_management.commit_context.metrics")
    @responses.activate
    @freeze_time(datetime(2023, 6, 8, 0, 0, 0, tzinfo=UTC))
    def test_comment_workflow_updates_comment(self, mock_metrics, mock_issues):
        groups = [g.id for g in Group.objects.all()]
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
            f'"body": "## Suspect Issues\\nThis pull request was deployed and Sentry observed the following issues:\\n\\n- \\u203c\\ufe0f **issue 1** `issue1` [View Issue](http://testserver/organizations/foo/issues/{groups[0]}/?referrer=github-pr-bot)\\n- \\u203c\\ufe0f **issue 2** `issue2` [View Issue](http://testserver/organizations/foobar/issues/{groups[1]}/?referrer=github-pr-bot)\\n\\n<sub>Did you find this useful? React with a \\ud83d\\udc4d or \\ud83d\\udc4e</sub>"'.encode()
            in responses.calls[0].request.body
        )
        pull_request_comment.refresh_from_db()
        assert pull_request_comment.group_ids == [g.id for g in Group.objects.all()]
        assert pull_request_comment.updated_at == timezone.now()
        mock_metrics.incr.assert_called_with("github.pr_comment.comment_updated")

    @patch("sentry.integrations.github.tasks.pr_comment.get_top_5_issues_by_count")
    @patch("sentry.integrations.github.tasks.pr_comment.metrics")
    @responses.activate
    def test_comment_workflow_api_error(self, mock_metrics, mock_issues):
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
            mock_metrics.incr.assert_called_with("github.pr_comment.api_error")

        pr_2 = self.create_pr_issues()
        cache_key = DEBOUNCE_PR_COMMENT_CACHE_KEY(pr_2.id)
        cache.set(cache_key, True, timedelta(minutes=5).total_seconds())

        # does not raise ApiError for locked issue
        github_comment_workflow(pr_2.id, self.project.id)
        assert cache.get(cache_key) is None
        mock_metrics.incr.assert_called_with(
            "github.pr_comment.error", tags={"type": "issue_locked_error"}
        )

        pr_3 = self.create_pr_issues()
        cache_key = DEBOUNCE_PR_COMMENT_CACHE_KEY(pr_3.id)
        cache.set(cache_key, True, timedelta(minutes=5).total_seconds())

        # does not raise ApiError for rate limited error
        github_comment_workflow(pr_3.id, self.project.id)
        assert cache.get(cache_key) is None
        mock_metrics.incr.assert_called_with(
            "github.pr_comment.error", tags={"type": "rate_limited_error"}
        )

    @patch(
        "sentry.integrations.github.tasks.pr_comment.pr_to_issue_query",
        return_value=[(0, 0, 0, [])],
    )
    @patch("sentry.integrations.github.tasks.pr_comment.get_top_5_issues_by_count")
    @patch("sentry.integrations.github.tasks.pr_comment.metrics")
    def test_comment_workflow_missing_org(self, mock_metrics, mock_issues, mock_issue_query):
        # Organization.DoesNotExist should trigger the cache to release the key
        cache.set(self.cache_key, True, timedelta(minutes=5).total_seconds())
        github_comment_workflow(self.pr.id, self.project.id)

        assert not mock_issues.called
        assert cache.get(self.cache_key) is None
        mock_metrics.incr.assert_called_with(
            "github.pr_comment.error", tags={"type": "missing_org"}
        )

    @patch("sentry.integrations.github.tasks.pr_comment.get_top_5_issues_by_count")
    def test_comment_workflow_missing_org_option(self, mock_issues):
        OrganizationOption.objects.set_value(
            organization=self.organization, key="sentry:github_pr_bot", value=False
        )
        github_comment_workflow(self.pr.id, self.project.id)

        assert not mock_issues.called

    @patch("sentry.integrations.github.tasks.pr_comment.get_top_5_issues_by_count")
    @patch("sentry.models.Project.objects.get_from_cache")
    @patch("sentry.integrations.github.tasks.pr_comment.metrics")
    def test_comment_workflow_missing_project(self, mock_metrics, mock_project, mock_issues):
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
        "sentry.integrations.github.tasks.pr_comment.get_top_5_issues_by_count",
    )
    @patch("sentry.models.Repository.objects")
    @patch("sentry.integrations.github.tasks.pr_comment.format_comment")
    @patch("sentry.integrations.github.tasks.pr_comment.metrics")
    def test_comment_workflow_missing_repo(
        self, mock_metrics, mock_format_comment, mock_repository, mock_issues
    ):
        # Repository.DoesNotExist should trigger the cache to release the key
        cache.set(self.cache_key, True, timedelta(minutes=5).total_seconds())

        mock_repository.get.side_effect = Repository.DoesNotExist
        github_comment_workflow(self.pr.id, self.project.id)

        mock_issues.return_value = [
            {"group_id": g.id, "event_count": 10} for g in Group.objects.all()
        ]

        assert mock_issues.called
        assert not mock_format_comment.called
        assert cache.get(self.cache_key) is None
        mock_metrics.incr.assert_called_with(
            "github.pr_comment.error", tags={"type": "missing_repo"}
        )

    @patch(
        "sentry.integrations.github.tasks.pr_comment.get_top_5_issues_by_count",
    )
    @patch("sentry.integrations.github.tasks.pr_comment.format_comment")
    @patch("sentry.integrations.github.tasks.pr_comment.metrics")
    def test_comment_workflow_missing_integration(
        self, mock_metrics, mock_format_comment, mock_issues
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

        assert mock_issues.called
        assert not mock_format_comment.called
        assert cache.get(self.cache_key) is None
        mock_metrics.incr.assert_called_with(
            "github.pr_comment.error", tags={"type": "missing_integration"}
        )

    @patch("sentry.integrations.github.tasks.pr_comment.get_top_5_issues_by_count")
    @patch("sentry.integrations.github.tasks.pr_comment.format_comment")
    @responses.activate
    def test_comment_workflow_no_issues(self, mock_format_comment, mock_issues):
        mock_issues.return_value = []

        github_comment_workflow(self.pr.id, self.project.id)

        assert mock_issues.called
        assert not mock_format_comment.called


class TestCommentReactionsTask(GithubCommentTestCase):
    base_url = "https://api.github.com"

    def setUp(self):
        super().setUp()
        self.user_id = "user_1"
        self.app_id = "app_1"
        self.pr = self.create_pr_issues()
        self.comment = PullRequestComment.objects.create(
            external_id="2",
            pull_request=self.pr,
            created_at=timezone.now(),
            updated_at=timezone.now(),
            group_ids=[4, 5],
        )
        self.expired_pr = self.create_pr_issues()
        self.expired_pr.date_added = timezone.now() - timedelta(days=35)
        self.expired_pr.save()
        self.comment_reactions = {
            "reactions": {
                "url": "abcdef",
                "hooray": 1,
                "+1": 2,
                "-1": 0,
            }
        }

    @patch("sentry.integrations.github.tasks.pr_comment.metrics")
    @responses.activate
    def test_comment_reactions_task(self, mock_metrics):
        old_comment = PullRequestComment.objects.create(
            external_id="1",
            pull_request=self.expired_pr,
            created_at=timezone.now() - timedelta(days=35),
            updated_at=timezone.now() - timedelta(days=35),
            group_ids=[1, 2, 3],
        )

        responses.add(
            responses.GET,
            self.base_url + "/repos/getsentry/sentry/issues/comments/2",
            json=self.comment_reactions,
        )

        github_comment_reactions()

        old_comment.refresh_from_db()
        assert old_comment.reactions is None

        self.comment.refresh_from_db()
        stored_reactions = self.comment_reactions["reactions"]
        del stored_reactions["url"]
        assert self.comment.reactions == stored_reactions

        mock_metrics.incr.assert_called_with("pr_comment.comment_reactions.success")

    @patch("sentry.integrations.github.tasks.pr_comment.metrics")
    @responses.activate
    def test_comment_reactions_task_missing_repo(self, mock_metrics):
        self.gh_repo.delete()

        responses.add(
            responses.GET,
            self.base_url + "/repos/getsentry/sentry/issues/comments/2",
            status=400,
            json={},
        )

        github_comment_reactions()

        self.comment.refresh_from_db()
        assert self.comment.reactions is None
        mock_metrics.incr.assert_called_with("pr_comment.comment_reactions.missing_repo")

    @patch("sentry.integrations.github.tasks.pr_comment.metrics")
    @responses.activate
    def test_comment_reactions_task_missing_integration(self, mock_metrics):
        # invalid integration id
        self.gh_repo.integration_id = 0
        self.gh_repo.save()

        responses.add(
            responses.GET,
            self.base_url + "/repos/getsentry/sentry/issues/comments/2",
            status=400,
            json={},
        )

        github_comment_reactions()

        self.comment.refresh_from_db()
        assert self.comment.reactions is None
        mock_metrics.incr.assert_called_with("pr_comment.comment_reactions.missing_integration")

    @patch("sentry.integrations.github.tasks.pr_comment.metrics")
    @responses.activate
    def test_comment_reactions_task_api_error_one(self, mock_metrics):
        gh_repo = self.create_repo(
            name="getsentry/santry",
            provider="integrations:github",
            integration_id=self.integration.id,
            project=self.project,
            url="https://github.com/getsentry/santry",
        )
        no_error_comment = PullRequestComment.objects.create(
            external_id="3",
            pull_request=self.create_pr_issues(gh_repo=gh_repo),
            created_at=timezone.now(),
            updated_at=timezone.now(),
            group_ids=[7, 8],
        )

        responses.add(
            responses.GET,
            self.base_url + "/repos/getsentry/sentry/issues/comments/2",
            status=400,
            json={},
        )
        responses.add(
            responses.GET,
            self.base_url + "/repos/getsentry/santry/issues/comments/3",
            json=self.comment_reactions,
        )

        github_comment_reactions()

        self.comment.refresh_from_db()
        assert self.comment.reactions is None

        no_error_comment.refresh_from_db()
        stored_reactions = self.comment_reactions["reactions"]
        del stored_reactions["url"]
        assert no_error_comment.reactions == stored_reactions

        # assert the last metric emitted is a success
        mock_metrics.incr.assert_called_with("pr_comment.comment_reactions.success")

    @patch("sentry.integrations.github.tasks.pr_comment.metrics")
    @responses.activate
    def test_comment_reactions_task_api_error_rate_limited(self, mock_metrics):
        responses.add(
            responses.GET,
            self.base_url + "/repos/getsentry/sentry/issues/comments/2",
            status=400,
            json={
                "message": "API rate limit exceeded",
                "documentation_url": "https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting",
            },
        )

        github_comment_reactions()

        self.comment.refresh_from_db()
        assert self.comment.reactions is None
        mock_metrics.incr.assert_called_with("pr_comment.comment_reactions.rate_limited_error")

    @patch("sentry.integrations.github.tasks.pr_comment.metrics")
    @responses.activate
    def test_comment_reactions_task_api_error_404(self, mock_metrics):
        responses.add(
            responses.GET,
            self.base_url + "/repos/getsentry/sentry/issues/comments/2",
            status=404,
            json={},
        )

        github_comment_reactions()

        self.comment.refresh_from_db()
        assert self.comment.reactions is None
        mock_metrics.incr.assert_called_with("pr_comment.comment_reactions.not_found_error")
