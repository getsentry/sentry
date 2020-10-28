from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import Commit, Repository
from sentry.testutils import APITestCase


class OrganizationRepositoryCommitsTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name="baz")
        repo = Repository.objects.create(name="example", organization_id=org.id)
        commit = Commit.objects.create(repository_id=repo.id, organization_id=org.id, key="a" * 40)

        repo2 = Repository.objects.create(name="example2", organization_id=org.id)
        Commit.objects.create(repository_id=repo2.id, organization_id=org.id, key="b" * 40)

        url = reverse("sentry-api-0-organization-repository-commits", args=[org.slug, repo.id])
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["id"] == commit.key
