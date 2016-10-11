from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import Commit, Release, ReleaseCommit, Repository
from sentry.testutils import APITestCase


class ReleaseCommitsListTest(APITestCase):
    def test_simple(self):
        project = self.create_project(
            name='foo',
        )
        release = Release.objects.create(
            project=project,
            version='1',
        )
        repo = Repository.objects.create(
            organization_id=project.organization_id,
            name=project.name,
        )
        commit = Commit.objects.create(
            organization_id=project.organization_id,
            repository_id=repo.id,
            key='a' * 40,
        )
        commit2 = Commit.objects.create(
            organization_id=project.organization_id,
            repository_id=repo.id,
            key='b' * 40,
        )
        ReleaseCommit.objects.create(
            project_id=project.id,
            release=release,
            commit=commit,
            order=1,
        )
        ReleaseCommit.objects.create(
            project_id=project.id,
            release=release,
            commit=commit2,
            order=0,
        )
        url = reverse('sentry-api-0-release-commits', kwargs={
            'organization_slug': project.organization.slug,
            'project_slug': project.slug,
            'version': release.version,
        })

        self.login_as(user=self.user)

        response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert response.data[0]['id'] == commit2.key
        assert response.data[1]['id'] == commit.key
