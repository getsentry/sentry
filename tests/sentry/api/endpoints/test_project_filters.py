from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class ProjectFiltersTest(APITestCase):
    endpoint = "sentry-api-0-project-filters"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.team = self.create_team(organization=self.organization, name="foo", slug="foo")
        self.project = self.create_project(name="Bar", slug="bar", teams=[self.team])

    def get_filter_spec(self, response_data, spec_id):
        """
        looks in a successful response data for the specified spec_id and returns it (if found)
        """
        for spec in response_data:
            if spec["id"] == spec_id:
                return spec
        return None

    def test_get(self):
        self.project.update_option("filters:browser-extension", "0")
        response = self.get_success_response(self.organization.slug, self.project.slug)

        filter_responses = {
            "browser-extensions": False,
            "localhost": False,
            "filtered-transaction": True,
            "legacy-browsers": [],
            "web-crawlers": False,
        }
        for filter in response.data:
            assert filter.keys() == {"id", "active", "description", "name", "hello"}
            assert filter["active"] == filter_responses[filter["id"]]

    def test_health_check_filter(self):
        """
        Tests setting health check filters ( aka filtered-transactions)
        """
        self.project.update_option("filters:filtered-transaction", "0")
        response = self.get_success_response(self.organization.slug, self.project.slug)
        health_check = self.get_filter_spec(response.data, "filtered-transaction")
        assert health_check is not None
        assert health_check["active"] is False

        self.project.update_option("filters:filtered-transaction", "1")
        response = self.get_success_response(self.organization.slug, self.project.slug)
        health_check = self.get_filter_spec(response.data, "filtered-transaction")
        assert health_check is not None
        assert health_check["active"] is True
