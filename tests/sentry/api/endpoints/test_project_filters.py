from __future__ import absolute_import

from sentry.testutils import APITestCase


class ProjectFiltersTest(APITestCase):
    def test_get(self):
        self.login_as(user=self.user)
        org = self.create_organization(name="baz", slug="1", owner=self.user)
        team = self.create_team(organization=org, name="foo", slug="foo")
        project = self.create_project(name="Bar", slug="bar", teams=[team])
        url = "/api/0/projects/%s/%s/filters/" % (org.slug, project.slug)

        project.update_option("filters:browser-extension", "0")
        response = self.client.get(url)
        assert response.status_code == 200

        self.insta_snapshot(response.data)
