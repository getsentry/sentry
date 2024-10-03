from unittest.mock import ANY, patch

from django.urls import reverse

from sentry.testutils.cases import APITestCase


class AIUnitTestGenerationEndpointTest(APITestCase):
    endpoint = "sentry-api-0-generate-unit-tests"
    method = "post"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.repo_name = "example-repo"
        self.pull_request_number = "123"
        self.external_id = "456"

        self.url = reverse(
            self.endpoint,
            kwargs={
                "organization_id_or_slug": self.project.organization.slug,
                "repo_name": self.repo_name,
                "pull_request_number": self.pull_request_number,
                "externalid": self.external_id,
            },
        )

    @patch(
        "sentry.api.endpoints.ai_unit_test_generation.AIUnitTestGenerationEndpoint._call_unit_test_generation",
        return_value="test-run-id",
    )
    def test_post_success(self, mock_call_unit_test_generation):

        response = self.client.post(
            self.url,
        )

        assert response.status_code == 202
        mock_call_unit_test_generation.assert_called_once_with(
            ANY,
            owner=self.organization.slug,
            name=self.repo_name,
            external_id=self.external_id,
            pr_id=int(self.pull_request_number),
        )
