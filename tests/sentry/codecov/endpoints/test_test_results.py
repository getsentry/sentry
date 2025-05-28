from unittest.mock import patch

from django.urls import reverse

from sentry.testutils.cases import APITestCase


class TestResultsEndpointTest(APITestCase):
    endpoint = "sentry-api-0-test-results"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    def reverse_url(self, owner="testowner", repository="testrepo", commit="testcommit"):
        """Custom reverse URL method to handle required URL parameters"""
        return reverse(
            self.endpoint,
            kwargs={
                "owner": owner,
                "repository": repository,
                "commit": commit,
            },
        )

    @patch(
        "sentry.codecov.endpoints.TestResults.test_results.TestResultsEndpoint.permission_classes",
        (),
    )
    def test_get_returns_mock_response(self):
        """Test that GET request returns the expected mock GraphQL response structure"""
        url = self.reverse_url()
        response = self.client.get(url)

        # With permissions bypassed, we should get a 200 response
        assert response.status_code == 200

        # Validate the response structure
        assert isinstance(response.data, list)
        # The sample response should contain 2 test result items
        assert len(response.data) == 2

        # Verify the first result has expected fields and values
        first_result = response.data[0]
        expected_fields = [
            "updatedAt",
            "name",
            "avgDuration",
            "failureRate",
            "flakeRate",
            "commitsFailed",
            "totalFailCount",
            "totalFlakyFailCount",
            "totalSkipCount",
            "totalPassCount",
            "lastDuration",
        ]
        for field in expected_fields:
            assert field in first_result, f"Missing field: {field}"
