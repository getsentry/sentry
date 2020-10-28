# -*- coding: utf-8 -*-

from __future__ import absolute_import


from sentry.api.serializers import serialize
from sentry.models import Activity, PullRequest, Commit, GroupStatus
from sentry.testutils import TestCase


class GroupActivityTestCase(TestCase):
    def test_pr_activity(self):
        self.org = self.create_organization(name="Rowdy Tiger")
        user = self.create_user()
        group = self.create_group(status=GroupStatus.UNRESOLVED)
        repo = self.create_repo(self.project, name="organization-bar")
        pr = PullRequest.objects.create(
            organization_id=self.org.id,
            repository_id=repo.id,
            key=5,
            title="aaaa",
            message="kartoffel",
        )

        activity = Activity.objects.create(
            project_id=group.project_id,
            group=group,
            type=Activity.SET_RESOLVED_IN_PULL_REQUEST,
            ident=pr.id,
            user=user,
            data={"pull_request": pr.id},
        )

        result = serialize([activity], user)[0]["data"]
        pull_request = result["pullRequest"]
        assert pull_request["repository"]["name"] == "organization-bar"
        assert pull_request["message"] == "kartoffel"

    def test_commit_activity(self):
        self.org = self.create_organization(name="Rowdy Tiger")
        user = self.create_user()
        group = self.create_group(status=GroupStatus.UNRESOLVED)
        repo = self.create_repo(self.project, name="organization-bar")

        commit = Commit.objects.create(
            organization_id=self.org.id, repository_id=repo.id, key="11111111", message="gemuse"
        )

        activity = Activity.objects.create(
            project_id=group.project_id,
            group=group,
            type=Activity.SET_RESOLVED_IN_COMMIT,
            ident=commit.id,
            user=user,
            data={"commit": commit.id},
        )

        result = serialize([activity], user)[0]["data"]
        commit = result["commit"]
        assert commit["repository"]["name"] == "organization-bar"
        assert commit["message"] == "gemuse"
