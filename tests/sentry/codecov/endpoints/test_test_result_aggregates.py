from unittest.mock import Mock, patch

from django.urls import reverse

from sentry.testutils.cases import APITestCase


class TestResultsAggregatesEndpointTest(APITestCase):
    endpoint = "sentry-api-0-test-results-aggregates"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    def reverse_url(self, owner="testowner", repository="testrepo"):
        """Custom reverse URL method to handle required URL parameters"""
        return reverse(
            self.endpoint,
            kwargs={
                "owner": owner,
                "repository": repository,
            },
        )

    @patch(
        "sentry.codecov.endpoints.TestResultsAggregates.test_results_aggregates.CodecovApiClient"
    )
    def test_get_returns_mock_response(self, mock_codecov_client_class):
        mock_graphql_response = {
            "data": {
                "owner": {
                    "repository": {
                        "__typename": "Repository",
                        "testAnalytics": {
                            "testResultsAggregates": {
                                "totalDuration": 100,
                                "totalDurationPercentChange": 10,
                                "slowestTestsDuration": 100,
                                "slowestTestsDurationPercentChange": 10,
                                "totalSlowTests": 100,
                                "totalSlowTestsPercentChange": 10,
                                "totalFails": 100,
                                "totalFailsPercentChange": 10,
                                "totalSkips": 100,
                                "totalSkipsPercentChange": 10,
                            }
                        },
                    }
                }
            }
        }

        mock_codecov_client_instance = Mock()
        mock_response = Mock()
        mock_response.json.return_value = mock_graphql_response
        mock_codecov_client_instance.query.return_value = mock_response
        mock_codecov_client_class.return_value = mock_codecov_client_instance

        url = self.reverse_url()
        response = self.client.get(url)

        mock_codecov_client_class.assert_called_once_with(git_provider_org="codecov")
        assert mock_codecov_client_instance.query.call_count == 1
        assert response.status_code == 200

        assert response.data["totalDuration"] == 100
        assert response.data["totalDurationPercentChange"] == 10
        assert response.data["slowestTestsDuration"] == 100
        assert response.data["slowestTestsDurationPercentChange"] == 10
        assert response.data["totalSlowTests"] == 100
        assert response.data["totalSlowTestsPercentChange"] == 10
        assert response.data["totalFails"] == 100
        assert response.data["totalFailsPercentChange"] == 10
        assert response.data["totalSkips"] == 100
        assert response.data["totalSkipsPercentChange"] == 10
