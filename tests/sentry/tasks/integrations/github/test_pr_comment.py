from sentry.models import Commit, GroupOwner, GroupOwnerType, PullRequest
from sentry.tasks.integrations.github import pr_comment
from sentry.testutils import TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format


class TestPrToIssueQuery(TestCase):
    def setUp(self):
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

    def add_pr_to_commit(self, commit: Commit):
        pr = PullRequest.objects.create(
            organization_id=commit.organization_id,
            repository_id=commit.repository_id,
            key=str(self.pr_key),
            author=commit.author,
            message="foo",
            title="bar",
            merge_commit_sha=commit.key,
        )
        self.pr_key += 1
        return pr

    def add_groupowner_to_commit(self, commit: Commit, project, user):
        event = self.store_event(data={}, project_id=project.id)
        groupowner = GroupOwner.objects.create(
            group=event.group,
            user_id=user.id,
            project=project,
            organization_id=commit.organization_id,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            context={"commitId": commit.id},
        )
        return groupowner

    def test_simple(self):
        """one pr with one issue"""
        commit = self.add_commit_to_repo(self.gh_repo, self.user, self.project)
        pr = self.add_pr_to_commit(commit)
        pr.date_added = iso_format(before_now(minutes=1))
        pr.save()
        groupowner = self.add_groupowner_to_commit(commit, self.project, self.user)

        results = pr_comment.pr_to_issue_query()

        assert results[0] == (self.gh_repo.id, pr.key, self.organization.id, [groupowner.id])
