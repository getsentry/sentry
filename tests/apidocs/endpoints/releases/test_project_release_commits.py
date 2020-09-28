from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.test.client import RequestFactory

from sentry.models import Commit, Release, ReleaseCommit, Repository
from tests.apidocs.util import APIDocsTestCase


class ProjectReleaseCommitsListDocsTest(APIDocsTestCase):
    def setUp(self):
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
        self.url = reverse(
            "sentry-api-0-project-release-commits",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "version": release.version,
            },
        )

        self.login_as(user=self.user)

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)
