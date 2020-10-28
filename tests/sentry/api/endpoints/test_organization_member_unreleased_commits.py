from __future__ import absolute_import

import six

from datetime import datetime
from django.utils import timezone

from sentry.testutils import APITestCase


class OrganizationMemberUnreleasedCommitsTest(APITestCase):
    def test_simple(self):
        user = self.create_user("foo@example.com")
        org = self.create_organization(name="foo")
        team = self.create_team(name="foo", organization=org)
        self.create_member(organization=org, user=user, role="admin", teams=[team])
        project = self.create_project(name="foo", organization=org, teams=[team])

        repo = self.create_repo(project)
        repo2 = self.create_repo(project)

        # we first need to create a release attached to a repository, or that repository
        # will never be included
        release = self.create_release(project)
        author = self.create_commit_author(project=project, user=user)

        # note: passing 'release' to create_commit causes it to bind ReleaseCommit
        self.create_commit(
            project=project,
            repo=repo,
            release=release,
            author=author,
            date_added=datetime(2015, 1, 1, tzinfo=timezone.utc),
        )

        # create a commit associated with an unreleased repo -- which should not appear
        self.create_commit(
            project=project,
            repo=repo2,
            author=author,
            date_added=datetime(2015, 1, 2, tzinfo=timezone.utc),
        )

        # create several unreleased commits associated with repo
        unreleased_commit = self.create_commit(
            project=project,
            repo=repo,
            author=author,
            date_added=datetime(2015, 1, 2, tzinfo=timezone.utc),
        )
        unreleased_commit2 = self.create_commit(
            project=project,
            repo=repo,
            author=author,
            date_added=datetime(2015, 1, 3, tzinfo=timezone.utc),
        )
        self.create_commit(
            project=project, repo=repo, date_added=datetime(2015, 1, 3, tzinfo=timezone.utc)
        )

        path = u"/api/0/organizations/{}/members/me/unreleased-commits/".format(org.slug)

        self.login_as(user)

        resp = self.client.get(path)

        assert resp.status_code == 200
        assert len(resp.data["commits"]) == 2
        assert resp.data["commits"][0]["id"] == unreleased_commit2.key
        assert resp.data["commits"][1]["id"] == unreleased_commit.key
        assert len(resp.data["repositories"]) == 1
        assert six.text_type(repo.id) in resp.data["repositories"]
