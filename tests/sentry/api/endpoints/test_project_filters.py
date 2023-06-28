from sentry.testutils import APITestCase
from sentry.testutils.helpers import Feature
from sentry.testutils.silo import region_silo_test


@region_silo_test
class ProjectFiltersTest(APITestCase):
    endpoint = "sentry-api-0-project-filters"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    def get_filter_spec(self, response_data, spec_id):
        """
        looks in a successful response data for the specified spec_id and returns it (if found)
        """
        for spec in response_data:
            if spec["id"] == spec_id:
                return spec
        return None

    def test_get(self):
        org = self.create_organization(name="baz", slug="1", owner=self.user)
        team = self.create_team(organization=org, name="foo", slug="foo")
        project = self.create_project(name="Bar", slug="bar", teams=[team])

        project.update_option("filters:browser-extension", "0")
        response = self.get_success_response(org.slug, project.slug)

        self.insta_snapshot(response.data)

    def test_get_business(self):
        """
        Test business plans return health-check-filter
        :return:
        """
        org = self.create_organization(name="baz", slug="1", owner=self.user)
        team = self.create_team(organization=org, name="foo", slug="foo")
        project = self.create_project(name="Bar", slug="bar", teams=[team])

        project.update_option("filters:health-check", "0")
        with Feature("organizations:health-check-filter"):
            response = self.get_success_response(org.slug, project.slug)
        health_check = self.get_filter_spec(response.data, "health-check")
        assert health_check is not None
        assert health_check["active"] is False

        project.update_option("filters:health-check", "1")
        with Feature("organizations:health-check-filter"):
            response = self.get_success_response(org.slug, project.slug)
        health_check = self.get_filter_spec(response.data, "health-check")
        assert health_check is not None
        assert health_check["active"] is True

    def test_free_plan(self):
        """
        Tests plans not having "filters:health-check" feature do not return health-check specs
        """
        org = self.create_organization(name="baz", slug="1", owner=self.user)
        team = self.create_team(organization=org, name="foo", slug="foo")
        project = self.create_project(name="Bar", slug="bar", teams=[team])

        # we shouldn't return health check information even if the option is set for the project
        # (presumably the user has downgraded from a business plan)
        project.update_option("filters:health-check", "1")
        with Feature({"organizations:health-check-filter": False}):
            response = self.get_success_response(org.slug, project.slug)
        health_check = self.get_filter_spec(response.data, "health-check")
        assert health_check is None
