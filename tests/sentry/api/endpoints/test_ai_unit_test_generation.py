from unittest.mock import patch

from django.urls import reverse
from rest_framework.test import APIClient

from sentry.api.endpoints.ai_unit_test_generation import AIUnitTestGenerationEndpoint
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import no_silo_test


@no_silo_test
class AIUnitTestGenerationEndpointTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.owner = self.create_user(
            email="example@example.com", is_superuser=False, is_staff=True, is_active=True
        )
        self.org = self.create_organization(owner=self.owner)
        self.client = APIClient()
        self.client.force_authenticate(user=self.owner)
        self.repo_name = "example-repo"
        self.pull_request_number = "123"
        self.external_id = "456"
        # Construct the URL using the provided URL pattern
        self.url = reverse(
            "generate_unit_tests",
            kwargs={
                "org_slug": self.org.slug,
                "repo_name": self.repo_name,
                "pull_request_number": self.pull_request_number,
                "external_id": self.external_id,
            },
        )

    def test_post_success(self):
        with patch.object(
            AIUnitTestGenerationEndpoint, "_call_unit_test_generation"
        ) as mock_call_unit_test_generation:
            mock_call_unit_test_generation.return_value = "test-run-id"

            response = self.client.post(self.url)

            assert response.status_code == 202
            mock_call_unit_test_generation.assert_called_once_with(
                self.owner,
                owner=self.org.slug,
                name=self.repo_name,
                external_id=self.external_id,
                pr_id=int(self.pull_request_number),
            )

    def test_post_failure(self):
        with patch.object(
            AIUnitTestGenerationEndpoint, "_call_unit_test_generation"
        ) as mock_call_unit_test_generation:
            mock_call_unit_test_generation.side_effect = Exception("Test exception")

            response = self.client.post(self.url)

            assert response.status_code == 500
            assert response.data == {"detail": "Test generation failed to start."}
            mock_call_unit_test_generation.assert_called_once_with(
                self.owner,
                owner=self.org.slug,
                name=self.repo_name,
                external_id=self.external_id,
                pr_id=int(self.pull_request_number),
            )

    def test_post_invalid_pull_request_number(self):
        # Test with an invalid pull request number
        invalid_url = reverse(
            "generate_unit_tests",
            kwargs={
                "org_slug": self.org.slug,
                "repo_name": self.repo_name,
                "pull_request_number": "invalid-pr-number",  # invalid string
                "external_id": self.external_id,
            },
        )

        with patch.object(
            AIUnitTestGenerationEndpoint, "_call_unit_test_generation"
        ) as mock_call_unit_test_generation:
            response = self.client.post(invalid_url)

            assert response.status_code == 400
            assert response.data == {"detail": "Invalid pull request number."}
            mock_call_unit_test_generation.assert_not_called()
