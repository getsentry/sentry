from unittest import mock

from sentry.testutils import APITestCase


class OrganizationVitalsOverviewTest(APITestCase):
    endpoint = "sentry-api-0-organization-vitals-overview"

    def setUp(self):
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)
        self.login_as(user=self.user)

    @mock.patch("sentry.api.endpoints.organization_vitals_overview.experiments.get", return_value=1)
    @mock.patch("sentry.api.endpoints.organization_vitals_overview.discover.query")
    def test_simple(self, mock_query, mock_experiment_get):
        mock_query.return_value = {
            "data": [
                {
                    "p75_measurements_fcp": 1000,
                    "p75_measurements_lcp": 2000,
                    "measurements.app_start_warm": 3000,
                    "measurements.app_start_cold": 5000,
                }
            ]
        }
        response = self.get_response(self.organization.slug)
        assert response.status_code == 200
        assert response.data == {
            "FCP": 1000,
            "LCP": 2000,
            "appStartWarm": 3000,
            "appStartCold": 5000,
        }
        assert mock_query.call_count == 1
        assert mock_query.call_args.kwargs["params"]["project_id"] == [self.project.id]
        mock_experiment_get.assert_called_once_with(
            "VitalsAlertExperiment", self.organization, self.user
        )

    @mock.patch("sentry.api.endpoints.organization_vitals_overview.experiments.get", return_value=0)
    @mock.patch("sentry.api.endpoints.organization_vitals_overview.discover.query")
    def test_no_experiment(self, mock_query, mock_experiment_get):
        mock_query.return_value = {
            "data": [
                {
                    "p75_measurements_fcp": 1000,
                    "p75_measurements_lcp": 2000,
                    "measurements.app_start_warm": 3000,
                    "measurements.app_start_cold": 5000,
                }
            ]
        }
        response = self.get_response(self.organization.slug)
        assert response.status_code == 404
        assert mock_query.call_count == 0
        mock_experiment_get.assert_called_once_with(
            "VitalsAlertExperiment", self.organization, self.user
        )
