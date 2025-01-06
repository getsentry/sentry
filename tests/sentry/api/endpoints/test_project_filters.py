from sentry.testutils.cases import APITestCase


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
        raise AssertionError(f"spec not found: {spec_id}")

    def test_get(self):
        org = self.create_organization(name="baz", slug="1", owner=self.user)
        team = self.create_team(organization=org, name="foo", slug="foo")
        project = self.create_project(name="Bar", slug="bar", teams=[team])

        project.update_option("filters:browser-extension", "0")
        response = self.get_success_response(org.slug, project.slug)

        self.insta_snapshot(response.data)

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
        assert health_check["active"] is False

        project.update_option("filters:filtered-transaction", "1")
        response = self.get_success_response(org.slug, project.slug)
        health_check = self.get_filter_spec(response.data, "filtered-transaction")
        assert health_check["active"] is True
