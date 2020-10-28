from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import Commit, CommitFileChange, Release, ReleaseCommit, Repository
from sentry.testutils import APITestCase


class CommitFileChangeTest(APITestCase):
    def test_simple(self):
        project = self.create_project(name="foo")
        release = Release.objects.create(organization_id=project.organization_id, version="1")
        release.add_project(project)
        repo = Repository.objects.create(organization_id=project.organization_id, name=project.name)
        commit = Commit.objects.create(
            organization_id=project.organization_id, repository_id=repo.id, key="a" * 40
        )
        commit2 = Commit.objects.create(
            organization_id=project.organization_id, repository_id=repo.id, key="b" * 40
        )
        ReleaseCommit.objects.create(
            organization_id=project.organization_id, release=release, commit=commit, order=1
        )
        ReleaseCommit.objects.create(
            organization_id=project.organization_id, release=release, commit=commit2, order=0
        )
        CommitFileChange.objects.create(
            organization_id=project.organization_id, commit=commit, filename=".gitignore", type="M"
        )
        CommitFileChange.objects.create(
            organization_id=project.organization_id,
            commit=commit2,
            filename="/static/js/widget.js",
            type="A",
        )
        url = reverse(
            "sentry-api-0-release-commitfilechange",
            kwargs={"organization_slug": project.organization.slug, "version": release.version},
        )

        self.login_as(user=self.user)

        response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert response.data[0]["filename"] == ".gitignore"
        assert response.data[1]["filename"] == "/static/js/widget.js"
