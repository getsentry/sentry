from datetime import timedelta
from unittest.mock import patch

import pytest
import responses
from django.utils import timezone

from sentry.integrations.github.integration import GitHubIntegrationProvider
from sentry.models import Commit, Group, GroupOwner, GroupOwnerType, PullRequest
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions.base import ApiError
from sentry.snuba.sessions_v2 import isoformat_z
from sentry.tasks.integrations.github import pr_comment
from sentry.tasks.integrations.github.pr_comment import (
    PullRequestIssue,
    get_comment_contents,
    get_top_5_issues_by_count,
)
from sentry.testutils import IntegrationTestCase, SnubaTestCase, TestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.helpers.datetime import before_now, iso_format


class GithubCommentTestCase(IntegrationTestCase):
    provider = GitHubIntegrationProvider

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
            date_added = iso_format(before_now(minutes=1))
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
        return pr

    def add_groupowner_to_commit(self, commit: Commit, project, user):
        event = self.store_event(
            data={
                "message": f"issue{self.fingerprint}",
                "fingerprint": [f"issue{self.fingerprint}"],
            },
            project_id=project.id,
        )
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


class TestPrToIssueQuery(GithubCommentTestCase):
    def test_simple(self):
        """one pr with one issue"""
        commit = self.add_commit_to_repo(self.gh_repo, self.user, self.project)
        pr = self.add_pr_to_commit(commit)
        groupowner = self.add_groupowner_to_commit(commit, self.project, self.user)

        results = pr_comment.pr_to_issue_query(pr.id)

        assert results[0] == (self.gh_repo.id, pr.key, self.organization.id, [groupowner.group_id])

    def test_multiple_issues(self):
        """one pr with multiple issues"""
        commit = self.add_commit_to_repo(self.gh_repo, self.user, self.project)
        pr = self.add_pr_to_commit(commit)
        groupowner_1 = self.add_groupowner_to_commit(commit, self.project, self.user)
        groupowner_2 = self.add_groupowner_to_commit(commit, self.project, self.user)
        groupowner_3 = self.add_groupowner_to_commit(commit, self.project, self.user)

        results = pr_comment.pr_to_issue_query(pr.id)

        assert results[0][0:3] == (self.gh_repo.id, pr.key, self.organization.id)
        assert (
            groupowner_1.group_id in results[0][3]
            and groupowner_2.group_id in results[0][3]
            and groupowner_3.group_id in results[0][3]
        )

    def test_multiple_prs(self):
        """multiple elligible PRs with one issue each"""
        commit_1 = self.add_commit_to_repo(self.gh_repo, self.user, self.project)
        commit_2 = self.add_commit_to_repo(self.gh_repo, self.user, self.project)
        pr_1 = self.add_pr_to_commit(commit_1)
        pr_2 = self.add_pr_to_commit(commit_2)
        groupowner_1 = self.add_groupowner_to_commit(commit_1, self.project, self.user)
        groupowner_2 = self.add_groupowner_to_commit(commit_2, self.project, self.user)

        results = pr_comment.pr_to_issue_query(pr_1.id)
        assert results[0] == (
            self.gh_repo.id,
            pr_1.key,
            self.organization.id,
            [groupowner_1.group_id],
        )

        results = pr_comment.pr_to_issue_query(pr_2.id)
        assert results[0] == (
            self.gh_repo.id,
            pr_2.key,
            self.organization.id,
            [groupowner_2.group_id],
        )

    def test_multiple_orgs(self):
        """Results should be across multiple orgs"""
        commit_1 = self.add_commit_to_repo(self.gh_repo, self.user, self.project)
        commit_2 = self.add_commit_to_repo(
            self.another_org_repo, self.another_org_user, self.another_org_project
        )
        pr_1 = self.add_pr_to_commit(commit_1)
        pr_2 = self.add_pr_to_commit(commit_2)
        groupowner_1 = self.add_groupowner_to_commit(commit_1, self.project, self.user)
        groupowner_2 = self.add_groupowner_to_commit(
            commit_2, self.another_org_project, self.another_org_user
        )

        results = pr_comment.pr_to_issue_query(pr_1.id)
        assert results[0] == (
            self.gh_repo.id,
            pr_1.key,
            self.organization.id,
            [groupowner_1.group_id],
        )
        results = pr_comment.pr_to_issue_query(pr_2.id)
        assert results[0] == (
            self.another_org_repo.id,
            pr_2.key,
            self.another_organization.id,
            [groupowner_2.group_id],
        )


class TestTop5IssuesByCount(TestCase, SnubaTestCase):
    def test_simple(self):
        group1 = [
            self.store_event(
                {"fingerprint": ["group-1"], "timestamp": iso_format(before_now(days=1))},
                project_id=self.project.id,
            )
            for _ in range(3)
        ][0].group.id
        group2 = [
            self.store_event(
                {"fingerprint": ["group-2"], "timestamp": iso_format(before_now(days=1))},
                project_id=self.project.id,
            )
            for _ in range(6)
        ][0].group.id
        group3 = [
            self.store_event(
                {"fingerprint": ["group-3"], "timestamp": iso_format(before_now(days=1))},
                project_id=self.project.id,
            )
            for _ in range(4)
        ][0].group.id
        res = get_top_5_issues_by_count([group1, group2, group3], self.project)
        assert [issue["group_id"] for issue in res] == [group2, group3, group1]

    def test_over_5_issues(self):
        issue_ids = [
            self.store_event(
                {"fingerprint": [f"group-{idx}"], "timestamp": iso_format(before_now(days=1))},
                project_id=self.project.id,
            ).group.id
            for idx in range(6)
        ]
        res = get_top_5_issues_by_count(issue_ids, self.project)
        assert len(res) == 5


class TestCommentBuilderQueries(GithubCommentTestCase):
    def test_simple(self):
        ev1 = self.store_event(
            data={"message": "issue1", "fingerprint": ["group-1"]}, project_id=self.project.id
        )
        ev2 = self.store_event(
            data={"message": "issue2", "fingerprint": ["group-2"]}, project_id=self.project.id
        )
        ev3 = self.store_event(
            data={"message": "issue3", "fingerprint": ["group-3"]}, project_id=self.project.id
        )
        comment_contents = get_comment_contents([ev1.group.id, ev2.group.id, ev3.group.id])
        assert comment_contents[0] == PullRequestIssue(
            title="issue1",
            subtitle="issue1",
            url=f"http://testserver/organizations/{self.organization.slug}/issues/{ev1.group.id}/",
        )
        assert comment_contents[1] == PullRequestIssue(
            title="issue2",
            subtitle="issue2",
            url=f"http://testserver/organizations/{self.organization.slug}/issues/{ev2.group.id}/",
        )
        assert comment_contents[2] == PullRequestIssue(
            title="issue3",
            subtitle="issue3",
            url=f"http://testserver/organizations/{self.organization.slug}/issues/{ev3.group.id}/",
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

        formatted_comment = pr_comment.format_comment(issues)
        expected_comment = "## Suspect Issues\nThis pull request has been deployed and Sentry has observed the following issues:\n\n- ‼️ **TypeError** `sentry.tasks.derive_code_mappings.derive_code_m...` [View Issue](https://sentry.sentry.io/issues/)\n- ‼️ **KafkaException** `query_subscription_consumer_process_message` [View Issue](https://sentry.sentry.io/stats/)\n\n<sub>Did you find this useful? React with a 👍 or 👎</sub>"
        assert formatted_comment == expected_comment


class TestCommentWorkflow(GithubCommentTestCase):
    base_url = "https://api.github.com"

    def setUp(self):
        super().setUp()
        self.installation_id = "github:1"
        self.user_id = "user_1"
        self.app_id = "app_1"
        self.access_token = "xxxxx-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"
        self.expires_at = isoformat_z(timezone.now() + timedelta(days=365))

    def create_pr_issues(self):
        commit_1 = self.add_commit_to_repo(self.gh_repo, self.user, self.project)
        pr = self.add_pr_to_commit(commit_1)
        self.add_groupowner_to_commit(commit_1, self.project, self.user)
        self.add_groupowner_to_commit(commit_1, self.another_org_project, self.another_org_user)

        return pr

    @patch("sentry.tasks.integrations.github.pr_comment.get_top_5_issues_by_count")
    @patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @with_feature("organizations:pr-comment-bot")
    @responses.activate
    def test_comment_workflow(self, get_jwt, mock_issues):
        pr = self.create_pr_issues()

        groups = [g.id for g in Group.objects.all()]
        mock_issues.return_value = [{"group_id": id, "event_count": 10} for id in groups]

        responses.add(
            responses.POST,
            self.base_url + f"/app/installations/{self.installation_id}/access_tokens",
            json={"token": self.access_token, "expires_at": self.expires_at},
        )
        responses.add(
            responses.POST,
            self.base_url + "/repos/getsentry/sentry/issues/1/comments",
            json={"id": 1},
        )

        pr_comment.comment_workflow(pr_id=pr.id)

        assert (
            responses.calls[1].request.body
            == f'{{"body": "## Suspect Issues\\nThis pull request has been deployed and Sentry has observed the following issues:\\n\\n- \\u203c\\ufe0f **issue1** `issue1` [View Issue](http://testserver/organizations/foo/issues/{groups[0]}/)\\n- \\u203c\\ufe0f **issue2** `issue2` [View Issue](http://testserver/organizations/foobar/issues/{groups[1]}/)\\n\\n<sub>Did you find this useful? React with a \\ud83d\\udc4d or \\ud83d\\udc4e</sub>"}}'.encode()
        )

    @patch("sentry.tasks.integrations.github.pr_comment.get_top_5_issues_by_count")
    @patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @with_feature("organizations:pr-comment-bot")
    @responses.activate
    def test_comment_workflow_raises_error(self, get_jwt, mock_issues):
        pr = self.create_pr_issues()

        groups = [g.id for g in Group.objects.all()]
        mock_issues.return_value = [{"group_id": id, "event_count": 10} for id in groups]

        responses.add(
            responses.POST,
            self.base_url + f"/app/installations/{self.installation_id}/access_tokens",
            json={"token": self.access_token, "expires_at": self.expires_at},
        )
        responses.add(
            responses.POST,
            self.base_url + "/repos/getsentry/sentry/issues/1/comments",
            status=400,
            json={"id": 1},
        )

        with pytest.raises(ApiError):
            pr_comment.comment_workflow(pr_id=pr.id)

    @patch(
        "sentry.tasks.integrations.github.pr_comment.pr_to_issue_query",
        return_value=[(0, 0, 0, [])],
    )
    @patch("sentry.tasks.integrations.github.pr_comment.get_top_5_issues_by_count")
    def test_comment_workflow_missing_org(self, mock_issues, mock_issue_query):
        pr = self.create_pr_issues()
        pr_comment.comment_workflow(pr_id=pr.id)

        assert not mock_issues.called

    @patch("sentry.tasks.integrations.github.pr_comment.get_top_5_issues_by_count")
    def test_comment_workflow_missing_feature_flag(self, mock_issues):
        pr = self.create_pr_issues()

        pr_comment.comment_workflow(pr_id=pr.id)

        assert not mock_issues.called

    @patch("sentry.tasks.integrations.github.pr_comment.get_top_5_issues_by_count")
    @patch("sentry.models.Group.objects.get_from_cache")
    @with_feature("organizations:pr-comment-bot")
    def test_comment_workflow_missing_group(self, mock_group, mock_issues):
        pr = self.create_pr_issues()

        mock_group.side_effect = Group.DoesNotExist

        pr_comment.comment_workflow(pr_id=pr.id)

        assert not mock_issues.called

    @patch(
        "sentry.tasks.integrations.github.pr_comment.get_top_5_issues_by_count",
    )
    @patch("sentry.models.Repository.objects")
    @patch("sentry.tasks.integrations.github.pr_comment.format_comment")
    @with_feature("organizations:pr-comment-bot")
    def test_comment_workflow_missing_repo(self, mock_format_comment, mock_repository, mock_issues):
        pr = self.create_pr_issues()

        mock_repository.get.side_effect = Repository.DoesNotExist
        pr_comment.comment_workflow(pr_id=pr.id)

        mock_issues.return_value = [
            {"group_id": g.id, "event_count": 10} for g in Group.objects.all()
        ]

        assert mock_issues.called
        assert not mock_format_comment.called

    @patch(
        "sentry.tasks.integrations.github.pr_comment.get_top_5_issues_by_count",
    )
    @patch("sentry.tasks.integrations.github.pr_comment.format_comment")
    @with_feature("organizations:pr-comment-bot")
    def test_comment_workflow_missing_integration(self, mock_format_comment, mock_issues):
        pr = self.create_pr_issues()

        # invalid integration id
        self.gh_repo.integration_id = 0
        self.gh_repo.save()

        mock_issues.return_value = [
            {"group_id": g.id, "event_count": 10} for g in Group.objects.all()
        ]

        pr_comment.comment_workflow(pr_id=pr.id)

        assert mock_issues.called
        assert not mock_format_comment.called
