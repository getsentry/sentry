from sentry.testutils import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class ProjectFilterDetailsTest(APITestCase):
    endpoint = "sentry-api-0-project-filters"
    method = "put"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    def test_put(self):
        org = self.create_organization(name="baz", slug="1", owner=self.user)
        team = self.create_team(organization=org, name="foo", slug="foo")
        project = self.create_project(name="Bar", slug="bar", teams=[team])

        project.update_option("filters:browser-extensions", "0")
        self.get_success_response(
            org.slug, project.slug, "browser-extensions", active=True, status_code=201
        )

        assert project.get_option("filters:browser-extensions") == "1"
