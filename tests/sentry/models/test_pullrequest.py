from __future__ import absolute_import

from hashlib import sha1
from uuid import uuid4

from sentry.models import Commit, Repository, PullRequest, PullRequestCommit
from sentry.testutils import TestCase


class FindReferencedGroupsTest(TestCase):
    def test_multiple_matches_basic(self):
        group = self.create_group()
        group2 = self.create_group()

        repo = Repository.objects.create(
            name='example',
            organization_id=self.group.organization.id,
        )

        commit = Commit.objects.create(
            key=sha1(uuid4().hex).hexdigest(),
            repository_id=repo.id,
            organization_id=group.organization.id,
            message='Foo Biz\n\nFixes {}'.format(
                group.qualified_short_id,
            ),
        )

        groups = commit.find_referenced_groups()
        assert len(groups) == 1
        assert group in groups

        pr = PullRequest.objects.create(
            key="1",
            repository_id=repo.id,
            organization_id=group.organization.id,
            title="very cool PR to fix the thing",
            message='Foo Biz\n\nFixes {}'.format(
                group2.qualified_short_id,
            ),
        )

        groups = pr.find_referenced_groups()
        assert len(groups) == 1
        assert group2 in groups


class SetCommitsTest(TestCase):
    def test_simple(self):
        org = self.organization

        repo = Repository.objects.create(
            name='example',
            organization_id=org.id,
        )

        commit = Commit.objects.create(
            key=sha1(uuid4().hex).hexdigest(),
            repository_id=repo.id,
            organization_id=org.id,
            message='',
        )
        commit2 = Commit.objects.create(
            key=sha1(uuid4().hex).hexdigest(),
            repository_id=repo.id,
            organization_id=org.id,
            message='',
        )
        commit3 = Commit.objects.create(
            key=sha1(uuid4().hex).hexdigest(),
            repository_id=repo.id,
            organization_id=org.id,
            message='',
        )

        pr = PullRequest.objects.create(
            key='1',
            repository_id=repo.id,
            organization_id=org.id,
            title='',
            message=''
        )

        # add initial commits
        pr.set_commits([commit, commit2])

        pr_commits = set(PullRequestCommit.objects.filter(
            pull_request=pr,
        ).values_list('commit', flat=True))
        assert len(pr_commits) == 2
        assert commit.id in pr_commits
        assert commit2.id in pr_commits

        # add a commit
        pr.set_commits([commit, commit2, commit3])
        pr_commits = set(PullRequestCommit.objects.filter(
            pull_request=pr,
        ).values_list('commit', flat=True))
        assert len(pr_commits) == 3
        assert commit.id in pr_commits
        assert commit2.id in pr_commits
        assert commit3.id in pr_commits

        # remove a commit
        pr.set_commits([commit2, commit3])
        pr_commits = set(PullRequestCommit.objects.filter(
            pull_request=pr,
        ).values_list('commit', flat=True))
        assert len(pr_commits) == 2
        assert commit2.id in pr_commits
        assert commit3.id in pr_commits
