from sentry.testutils import APITestCase


class ProjectFiltersTest(APITestCase):
    endpoint = "sentry-api-0-project-filters"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    def test_get(self):
        org = self.create_organization(name="baz", slug="1", owner=self.user)
        team = self.create_team(organization=org, name="foo", slug="foo")
        project = self.create_project(name="Bar", slug="bar", teams=[team])

        project.update_option("filters:browser-extension", "0")
        response = self.get_valid_response(org.slug, project.slug)

        self.insta_snapshot(response.data)
