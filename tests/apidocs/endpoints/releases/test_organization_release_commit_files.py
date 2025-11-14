from typing import int
from django.test.client import RequestFactory
from django.urls import reverse

from fixtures.apidocs_test_case import APIDocsTestCase
from sentry.models.commit import Commit
from sentry.models.commitfilechange import CommitFileChange
from sentry.models.releasecommit import ReleaseCommit


class CommitFileChangeDocsTest(APIDocsTestCase):
    def setUp(self) -> None:
        project = self.create_project(name="foo")
        release = self.create_release(project=project, version="1")
        release.add_project(project)
        repo = self.create_repo(project=project, name=project.name)
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
            organization_id=project.organization_id,
            commit_id=commit.id,
            filename=".gitignore",
            type="M",
        )
        CommitFileChange.objects.create(
            organization_id=project.organization_id,
            commit_id=commit2.id,
            filename="/static/js/widget.js",
            type="A",
        )
        self.url = reverse(
            "sentry-api-0-release-commitfilechange",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "version": release.version,
            },
        )

        self.login_as(user=self.user)

    def test_get(self) -> None:
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)
