from sentry.testutils import APITestCase
from sentry.testutils.helpers import Feature
from sentry.testutils.silo import region_silo_test


@region_silo_test
class ProjectFilterDetailsTest(APITestCase):
    endpoint = "sentry-api-0-project-filters-details"
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

    def test_put_health_check_filter_business(self):
        """
        Tests that it accepts to set the health-check filter when the feature flag is enabled
        Tests that it accepts to set the health-check filter on plans that
        allow it ( business plan)
        """
        org = self.create_organization(name="baz", slug="1", owner=self.user)
        team = self.create_team(organization=org, name="foo", slug="foo")
        project = self.create_project(name="Bar", slug="bar", teams=[team])

        project.update_option("filters:health-check", "0")
        with Feature("organizations:health-check-filter"):
            self.get_success_response(
                org.slug, project.slug, "health-check", active=True, status_code=201
            )
        # option was changed by the request
        assert project.get_option("filters:health-check") == "1"

        project.update_option("filters:health-check", "1")
        with Feature("organizations:health-check-filter"):
            self.get_success_response(
                org.slug, project.slug, "health-check", active=False, status_code=201
            )
        # option was changed by the request
        assert project.get_option("filters:health-check") == "0"

    def test_put_health_check_filter_free_plan(self):
        """
        Tests that it does not accept to set the health-check filter on plans that
        do not allow it ( free plans)
        """
        org = self.create_organization(name="baz", slug="1", owner=self.user)
        team = self.create_team(organization=org, name="foo", slug="foo")
        project = self.create_project(name="Bar", slug="bar", teams=[team])

        project.update_option("filters:health-check", "0")
        with Feature({"organizations:health-check-filter": False}):
            resp = self.get_response(
                org.slug, project.slug, "health-check", active=True, status_code=201
            )
        # check we return error
        assert resp.status_code == 404
        # check we did not touch the option (the request did not change anything)
        assert project.get_option("filters:health-check") == "0"

    def test_put_legacy_browsers(self):
        org = self.create_organization(name="baz", slug="1", owner=self.user)
        team = self.create_team(organization=org, name="foo", slug="foo")
        project = self.create_project(name="Bar", slug="bar", teams=[team])

        project.update_option(
            "filters:legacy-browsers",
            [
                "ie10",
                "ie9",
                "android_pre_4",
                "ie_pre_9",
                "opera_pre_15",
                "safari_pre_6",
                "ie11",
                "opera_mini_pre_8",
            ],
        )

        new_subfilters = [
            "safari_pre_6",
            "opera_mini_pre_8",
            "ie10",
            "ie11",
            "opera_pre_15",
        ]

        self.get_success_response(
            org.slug,
            project.slug,
            "legacy-browsers",
            subfilters=new_subfilters,
            status_code=201,
        )

        assert set(project.get_option("filters:legacy-browsers")) == set(new_subfilters)
