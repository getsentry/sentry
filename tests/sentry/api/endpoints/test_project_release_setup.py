from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import Commit, ReleaseCommit, Repository
from sentry.testutils import APITestCase


class ProjectReleaseSetupCompletionTest(APITestCase):
    def test_simple(self):
        project = self.create_project()
        release = self.create_release(project, self.user)
        self.create_group(project=project, first_release=release)

        repo = Repository.objects.create(organization_id=project.organization_id, name=project.name)

        commit = Commit.objects.create(
            organization_id=project.organization_id, repository_id=repo.id, key="b" * 40
        )

        ReleaseCommit.objects.create(
            organization_id=project.organization_id, release=release, commit=commit, order=0
        )

        url = reverse(
            "sentry-api-0-project-releases-completion-status",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )

        self.login_as(user=self.user)

        response = self.client.get(url)
        assert response.status_code == 200, response.content
        assert len(response.data) == 4
        assert response.data[2]["step"] == "commit"
        assert response.data[2]["complete"] is True
        assert response.data[3]["step"] == "deploy"
        assert response.data[3]["complete"] is False
