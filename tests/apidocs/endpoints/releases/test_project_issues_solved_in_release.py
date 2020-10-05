from __future__ import absolute_import

from uuid import uuid1

from django.core.urlresolvers import reverse
from django.test.client import RequestFactory

from sentry.models import Commit, GroupLink, GroupResolution, ReleaseCommit, Repository
from tests.apidocs.util import APIDocsTestCase


class ProjectIssuesResolvedInReleaseEndpointTest(APIDocsTestCase):
    endpoint = "sentry-api-0-project-release-resolved"
    method = "get"

    def setUp(self):
        super(ProjectIssuesResolvedInReleaseEndpointTest, self).setUp()
        self.user = self.create_user()
        self.org = self.create_organization()
        self.team = self.create_team(organization=self.org)
        self.create_member(organization=self.org, user=self.user, teams=[self.team])
        self.project = self.create_project(teams=[self.team])
        self.release = self.create_release(project=self.project)
        self.group = self.create_group(project=self.project)
        self.login_as(self.user)

        repo = Repository.objects.create(organization_id=self.org.id, name=self.project.name)
        commit = Commit.objects.create(
            organization_id=self.org.id, repository_id=repo.id, key=uuid1().hex
        )
        commit2 = Commit.objects.create(
            organization_id=self.org.id, repository_id=repo.id, key=uuid1().hex
        )
        ReleaseCommit.objects.create(
            organization_id=self.org.id, release=self.release, commit=commit, order=1
        )
        ReleaseCommit.objects.create(
            organization_id=self.org.id, release=self.release, commit=commit2, order=0
        )
        GroupLink.objects.create(
            group_id=self.group.id,
            project_id=self.group.project_id,
            linked_type=GroupLink.LinkedType.commit,
            relationship=GroupLink.Relationship.resolves,
            linked_id=commit.id,
        )

        GroupResolution.objects.create(
            group=self.group, release=self.release, type=GroupResolution.Type.in_release,
        )
        self.url = reverse(
            "sentry-api-0-project-release-resolved",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
                "version": self.release.version,
            },
        )

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)
