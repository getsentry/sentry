from unittest import mock

from sentry.testutils import APITestCase
from sentry.testutils.silo import customer_silo_test


@customer_silo_test
class OrganizationVitalsOverviewTest(APITestCase):
    endpoint = "sentry-api-0-organization-vitals-overview"

    def setUp(self):
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.organization.flags.allow_joinleave = False
        self.organization.save()
        self.team = self.create_team(organization=self.organization)
        self.team2 = self.create_team(organization=self.organization)
        self.project = self.create_project(
            organization=self.organization, teams=[self.team], slug="web_project"
        )
        self.project2 = self.create_project(
            organization=self.organization, teams=[self.team2], slug="mobile_project"
        )
        self.login_as(user=self.user)

    def mock_discover_query(self, selected_columns, **kwargs):
        if "project_id" in selected_columns:
            return {
                "data": [
                    {
                        "project_id": self.project.id,
                        "p75_measurements_fcp": 1000,
                        "p75_measurements_lcp": 2000,
                        "p75_measurements_app_start_warm": None,
                        "p75_measurements_app_start_cold": None,
                        "count_if_measurements_fcp_greaterOrEquals_0": 10,
                        "count_if_measurements_lcp_greaterOrEquals_0": 20,
                        "count_if_measurements_app_start_warm_greaterOrEquals_0": 0,
                        "count_if_measurements_app_start_cold_greaterOrEquals_0": 0,
                    },
                    {
                        "project_id": self.project2.id,
                        "p75_measurements_fcp": None,
                        "p75_measurements_lcp": None,
                        "p75_measurements_app_start_warm": 3000,
                        "p75_measurements_app_start_cold": 5000,
                        "count_if_measurements_fcp_greaterOrEquals_0": 0,
                        "count_if_measurements_lcp_greaterOrEquals_0": 0,
                        "count_if_measurements_app_start_warm_greaterOrEquals_0": 30,
                        "count_if_measurements_app_start_cold_greaterOrEquals_0": 40,
                    },
                ]
            }
        return {
            "data": [
                {
                    "p75_measurements_fcp": 1000,
                    "p75_measurements_lcp": 2000,
                    "p75_measurements_app_start_warm": 3000,
                    "p75_measurements_app_start_cold": 5000,
                    "count_if_measurements_fcp_greaterOrEquals_0": 10,
                    "count_if_measurements_lcp_greaterOrEquals_0": 20,
                    "count_if_measurements_app_start_warm_greaterOrEquals_0": 30,
                    "count_if_measurements_app_start_cold_greaterOrEquals_0": 40,
                }
            ]
        }

    @mock.patch("sentry.api.endpoints.organization_vitals_overview.experiments.get", return_value=1)
    @mock.patch(
        "sentry.api.endpoints.organization_vitals_overview.discover.query",
    )
    def test_simple(self, mock_query, mock_experiment_get):
        mock_query.side_effect = self.mock_discover_query
        response = self.get_response(self.organization.slug)
        assert response.status_code == 200
        assert response.data == {
            "FCP": 1000,
            "LCP": 2000,
            "appStartWarm": 3000,
            "appStartCold": 5000,
            "fcpCount": 10,
            "lcpCount": 20,
            "appWarmStartCount": 30,
            "appColdStartCount": 40,
            "projectData": [
                {
                    "projectId": self.project.id,
                    "FCP": 1000,
                    "LCP": 2000,
                    "appStartWarm": None,
                    "appStartCold": None,
                    "fcpCount": 10,
                    "lcpCount": 20,
                    "appWarmStartCount": 0,
                    "appColdStartCount": 0,
                },
                {
                    "projectId": self.project2.id,
                    "FCP": None,
                    "LCP": None,
                    "appStartWarm": 3000,
                    "appStartCold": 5000,
                    "fcpCount": 0,
                    "lcpCount": 0,
                    "appWarmStartCount": 30,
                    "appColdStartCount": 40,
                },
            ],
        }
        assert mock_query.call_count == 2
        assert set(mock_query.call_args.kwargs["params"]["project_id"]) == {
            self.project.id,
            self.project2.id,
        }
        mock_experiment_get.assert_called_once_with(
            "VitalsAlertExperiment", self.organization, self.user
        )

    @mock.patch("sentry.api.endpoints.organization_vitals_overview.experiments.get", return_value=0)
    @mock.patch("sentry.api.endpoints.organization_vitals_overview.discover.query")
    def test_no_experiment(self, mock_query, mock_experiment_get):
        response = self.get_response(self.organization.slug)
        assert response.status_code == 404
        assert mock_query.call_count == 0
        mock_experiment_get.assert_called_once_with(
            "VitalsAlertExperiment", self.organization, self.user
        )

    @mock.patch("sentry.api.endpoints.organization_vitals_overview.experiments.get", return_value=1)
    @mock.patch(
        "sentry.api.endpoints.organization_vitals_overview.discover.query",
        return_value={"data": []},
    )
    def test_no_data(self, mock_query, mock_experiment_get):
        response = self.get_response(self.organization.slug)
        assert response.status_code == 200
        assert response.data == {
            "FCP": None,
            "LCP": None,
            "appStartWarm": None,
            "appStartCold": None,
            "fcpCount": 0,
            "lcpCount": 0,
            "appColdStartCount": 0,
            "appWarmStartCount": 0,
            "projectData": [],
        }
        # only call org level discover query
        assert mock_query.call_count == 1
        assert set(mock_query.call_args.kwargs["params"]["project_id"]) == {
            self.project.id,
            self.project2.id,
        }
        mock_experiment_get.assert_called_once_with(
            "VitalsAlertExperiment", self.organization, self.user
        )

    @mock.patch("sentry.api.endpoints.organization_vitals_overview.experiments.get", return_value=1)
    @mock.patch(
        "sentry.api.endpoints.organization_vitals_overview.discover.query",
    )
    def test_limited_access(self, mock_query, mock_experiment_get):
        user2 = self.create_user()
        self.create_member(user=user2, organization=self.organization)
        self.create_team_membership(user=user2, team=self.team)
        self.login_as(user=user2)
        mock_query.side_effect = self.mock_discover_query
        response = self.get_response(self.organization.slug)
        assert response.status_code == 200
        assert response.data == {
            "FCP": 1000,
            "LCP": 2000,
            "appStartWarm": 3000,
            "appStartCold": 5000,
            "fcpCount": 10,
            "lcpCount": 20,
            "appWarmStartCount": 30,
            "appColdStartCount": 40,
            "projectData": [
                {
                    "projectId": self.project.id,
                    "FCP": 1000,
                    "LCP": 2000,
                    "appStartWarm": None,
                    "appStartCold": None,
                    "fcpCount": 10,
                    "lcpCount": 20,
                    "appWarmStartCount": 0,
                    "appColdStartCount": 0,
                },
            ],
        }

    @mock.patch("sentry.api.endpoints.organization_vitals_overview.experiments.get", return_value=1)
    @mock.patch(
        "sentry.api.endpoints.organization_vitals_overview.discover.query",
    )
    def test_max_projects(self, mock_query, mock_experiment_get):
        user2 = self.create_user()
        self.create_member(user=user2, organization=self.organization)
        self.create_team_membership(user=user2, team=self.team)
        self.login_as(user=user2)
        with self.settings(ORGANIZATION_VITALS_OVERVIEW_PROJECT_LIMIT=1):
            response = self.get_response(self.organization.slug)
        assert response.status_code == 200
        assert response.data == {
            "FCP": None,
            "LCP": None,
            "appStartWarm": None,
            "appStartCold": None,
            "fcpCount": 0,
            "lcpCount": 0,
            "appColdStartCount": 0,
            "appWarmStartCount": 0,
            "projectData": [],
        }
        assert mock_query.call_count == 0

    @mock.patch("sentry.api.endpoints.organization_vitals_overview.experiments.get", return_value=1)
    @mock.patch(
        "sentry.api.endpoints.organization_vitals_overview.discover.query",
    )
    def test_with_cache(self, mock_query, mock_experiment_get):
        mock_query.side_effect = self.mock_discover_query
        self.get_response(self.organization.slug)
        # call again to hit the cache
        response = self.get_response(self.organization.slug)
        assert response.status_code == 200
        assert response.data == {
            "FCP": 1000,
            "LCP": 2000,
            "appStartWarm": 3000,
            "appStartCold": 5000,
            "fcpCount": 10,
            "lcpCount": 20,
            "appWarmStartCount": 30,
            "appColdStartCount": 40,
            "projectData": [
                {
                    "projectId": self.project.id,
                    "FCP": 1000,
                    "LCP": 2000,
                    "appStartWarm": None,
                    "appStartCold": None,
                    "fcpCount": 10,
                    "lcpCount": 20,
                    "appWarmStartCount": 0,
                    "appColdStartCount": 0,
                },
                {
                    "projectId": self.project2.id,
                    "FCP": None,
                    "LCP": None,
                    "appStartWarm": 3000,
                    "appStartCold": 5000,
                    "fcpCount": 0,
                    "lcpCount": 0,
                    "appWarmStartCount": 30,
                    "appColdStartCount": 40,
                },
            ],
        }
        assert mock_query.call_count == 2
        assert set(mock_query.call_args.kwargs["params"]["project_id"]) == {
            self.project.id,
            self.project2.id,
        }
        mock_experiment_get.assert_called_with(
            "VitalsAlertExperiment", self.organization, self.user
        )
        assert mock_experiment_get.call_count == 2
