from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
class ProjectFilterDetailsTest(APITestCase):
    endpoint = "sentry-api-0-project-filters-details"
    method = "put"

    def setUp(self):
        super().setUp()
        self.org = self.create_organization(name="baz", slug="1", owner=self.user)
        self.team = self.create_team(organization=self.org, name="foo", slug="foo")
        self.project = self.create_project(name="Bar", slug="bar", teams=[self.team])
        self.subfilters = [
            "safari_pre_6",
            "ie11",
            "opera_pre_15",
        ]
        self.login_as(user=self.user)

    def test_put(self):
        self.project.update_option("filters:browser-extensions", "0")
        response = self.get_success_response(
            self.org.slug, self.project.slug, "browser-extensions", active=True, status_code=200
        )

        assert response.data["active"] is True
        assert self.project.get_option("filters:browser-extensions") == "1"

    def test_put_health_check_filter(self):
        self.project.update_option("filters:filtered-transaction", "0")
        response = self.get_success_response(
            self.org.slug, self.project.slug, "filtered-transaction", active=True, status_code=200
        )

        assert response.data == {
            "id": "filtered-transaction",
            "active": True,
            "description": "Filter transactions that match most common naming patterns for health checks.",
            "name": "Filter out health check transactions",
        }
        # option was changed by the request
        assert self.project.get_option("filters:filtered-transaction") == "1"

        response = self.get_success_response(
            self.org.slug, self.project.slug, "filtered-transaction", active=False, status_code=200
        )

        assert response.data["active"] is False
        # option was changed by the request
        assert self.project.get_option("filters:filtered-transaction") == "0"

    def test_put_legacy_browsers_off_to_on(self):
        assert self.project.get_option("filters:legacy-browsers") == []

        response = self.get_success_response(
            self.org.slug,
            self.project.slug,
            "legacy-browsers",
            subfilters=self.subfilters,
            status_code=200,
        )

        assert set(response.data["active"]) == set(self.subfilters)
        assert set(self.project.get_option("filters:legacy-browsers")) == set(self.subfilters)

    def test_put_legacy_browsers_on_to_off(self):
        self.project.update_option("filters:filtered-transaction", self.subfilters)
        response = self.get_success_response(
            self.org.slug,
            self.project.slug,
            "legacy-browsers",
            subfilters=[],
            status_code=200,
        )

        assert response.data["active"] == []
        assert self.project.get_option("filters:legacy-browsers") == []

    def test_put_legacy_browsers_must_be_list(self):
        response = self.get_error_response(
            self.org.slug,
            self.project.slug,
            "legacy-browsers",
            subfilters=False,
            status_code=400,
        )

        assert str(response.data["subfilters"][0]) == "Please provide a valid list."
