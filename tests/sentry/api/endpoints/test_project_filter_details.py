from __future__ import absolute_import

from sentry.testutils import APITestCase


class ProjectFilterDetailsTest(APITestCase):
    def test_put(self):
        self.login_as(user=self.user)
        org = self.create_organization(name="baz", slug="1", owner=self.user)
        team = self.create_team(organization=org, name="foo", slug="foo")
        project = self.create_project(name="Bar", slug="bar", teams=[team])
        url = "/api/0/projects/%s/%s/filters/browser-extensions/" % (org.slug, project.slug)

        project.update_option("filters:browser-extensions", "0")
        response = self.client.put(url, format="json", data={"active": True})
        assert response.status_code == 201

        assert project.get_option("filters:browser-extensions") == "1"
