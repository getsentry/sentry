from sentry.testutils import APITestCase
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
