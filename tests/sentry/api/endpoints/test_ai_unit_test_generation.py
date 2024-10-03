from unittest.mock import patch

from sentry.api.endpoints.ai_unit_test_generation import AIUnitTestGenerationEndpoint
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import no_silo_test


@no_silo_test
class AIUnitTestGenerationEndpointTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.owner = self.create_user(email="example@example.com", is_superuser=False)
        self.organization = self.create_organization(owner=self.owner, flags=0)

        self.repo_name = "example-repo"
        self.pull_request_number = "123"
        self.external_id = "456"
        self.url = f"/api/0/organizations/{self.organization.slug}/repo/{self.repo_name}/pr/{self.pull_request_number}/external/{self.external_id}/generate-unit-tests/"

    def test_post_success(self):
        with patch.object(
            AIUnitTestGenerationEndpoint, "_call_unit_test_generation"
        ) as mock_call_unit_test_generation:
            mock_call_unit_test_generation.return_value = "test-run-id"

            response = self.client.post(
                self.url,
            )

            assert response.status_code == 202
            mock_call_unit_test_generation.assert_called_once_with(
                self.owner,
                owner=self.organization.slug,
                name=self.repo_name,
                external_id=self.external_id,
                pr_id=int(self.pull_request_number),
            )

    def test_post_failure(self):
        with patch.object(
            AIUnitTestGenerationEndpoint, "_call_unit_test_generation"
        ) as mock_call_unit_test_generation:
            mock_call_unit_test_generation.side_effect = Exception("Test exception")

            response = self.client.post(
                self.url,
            )

            assert response.status_code == 404
            assert response.data == {"detail": "Test generation failed to start."}
            mock_call_unit_test_generation.assert_called_once_with(
                self.owner,
                owner=self.organization.slug,
                name=self.repo_name,
                external_id=self.external_id,
                pr_id=int(self.pull_request_number),
            )

    def test_post_invalid_pull_request_number(self):
        invalid_url = f"/api/0/organizations/{self.organization.slug}/repo/{self.repo_name}/pr/invalid-pr-number/external/{self.external_id}/generate-unit-tests/"

        with patch.object(
            AIUnitTestGenerationEndpoint, "_call_unit_test_generation"
        ) as mock_call_unit_test_generation:

            response = self.client.post(
                invalid_url,
            )

            assert response.status_code == 400
            assert response.data == {"detail": "Invalid pull request number."}
            mock_call_unit_test_generation.assert_not_called()
