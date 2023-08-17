from sentry.testutils.cases import APITestCase
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

        assert response.data == [
            {
                "id": "browser-extensions",
                "active": False,
                "description": "Certain browser extensions will inject inline scripts and are known to cause errors.",
                "name": "Filter out errors known to be caused by browser extensions",
                "hello": "browser-extensions - Filter out errors known to be caused by browser extensions",
            },
            {
                "id": "localhost",
                "active": False,
                "description": "This applies to both IPv4 (``127.0.0.1``) and IPv6 (``::1``) addresses.",
                "name": "Filter out events coming from localhost",
                "hello": "localhost - Filter out events coming from localhost",
            },
            {
                "id": "filtered-transaction",
                "active": True,
                "description": "Filter transactions that match most common naming patterns for health checks.",
                "name": "Filter out health check transactions",
                "hello": "filtered-transaction - Filter out health check transactions",
            },
            {
                "id": "legacy-browsers",
                "active": [],
                "description": "Older browsers often give less accurate information, and while they may report valid issues, the context to understand them is incorrect or missing.",
                "name": "Filter out known errors from legacy browsers",
                "hello": "legacy-browsers - Filter out known errors from legacy browsers",
            },
            {
                "id": "web-crawlers",
                "active": False,
                "description": "Some crawlers may execute pages in incompatible ways which then cause errors that are unlikely to be seen by a normal user.",
                "name": "Filter out known web crawlers",
                "hello": "web-crawlers - Filter out known web crawlers",
            },
        ]

    def test_health_check_filter(self):
        """
        Tests setting health check filters ( aka filtered-transactions)
        """
        org = self.create_organization(name="baz", slug="1", owner=self.user)
        team = self.create_team(organization=org, name="foo", slug="foo")
        project = self.create_project(name="Bar", slug="bar", teams=[team])

        project.update_option("filters:filtered-transaction", "0")
        response = self.get_success_response(org.slug, project.slug)
        health_check = self.get_filter_spec(response.data, "filtered-transaction")
        assert health_check is not None
        assert health_check["active"] is False

        project.update_option("filters:filtered-transaction", "1")
        response = self.get_success_response(org.slug, project.slug)
        health_check = self.get_filter_spec(response.data, "filtered-transaction")
        assert health_check is not None
        assert health_check["active"] is True
