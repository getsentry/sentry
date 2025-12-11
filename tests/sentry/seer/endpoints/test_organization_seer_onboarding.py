from __future__ import annotations

from unittest.mock import patch

from django.urls import reverse

from sentry.seer.models import BranchOverride, SeerRepoDefinition
from sentry.testutils.cases import APITestCase


class OrganizationSeerOnboardingEndpointTest(APITestCase):
    """Tests for the /organizations/<org>/seer/onboarding/ endpoint"""

    def setUp(self) -> None:
        self.user = self.create_user()
        self.org = self.create_organization(owner=self.user)
        self.login_as(user=self.user)
        self.path = reverse("sentry-api-0-organization-seer-onboarding", args=[self.org.slug])

    @patch("sentry.seer.endpoints.organization_seer_onboarding.onboarding_seer_settings_update")
    def test_post_success(self, mock_onboarding_update) -> None:
        response = self.client.post(
            self.path,
            {
                "autofix": {
                    "enable_root_cause_analysis": True,
                    "auto_open_prs": True,
                    "project_repo_mapping": {
                        "1": [
                            {
                                "provider": "github",
                                "owner": "sentry",
                                "name": "sentry",
                                "external_id": "1234567890",
                                "organization_id": "1234567890",
                                "integration_id": "1234567890",
                                "branch_name": "my-branch",
                                "branch_overrides": [
                                    {
                                        "tag_name": "my-tag",
                                        "tag_value": "my-value",
                                        "branch_name": "my-branch",
                                    }
                                ],
                                "instructions": "my-instructions",
                                "base_commit_sha": "1234567890",
                                "provider_raw": "github",
                            },
                            {
                                "provider": "github-enterprise",
                                "owner": "sentry-test",
                                "name": "sentry-test",
                                "external_id": "0987654321",
                            },
                        ],
                        "2": [
                            {
                                "provider": "github",
                                "owner": "sentry",
                                "name": "sentry",
                                "external_id": "1029384756",
                            },
                        ],
                    },
                },
            },
        )

        assert response.status_code == 204

        mock_onboarding_update.assert_called_once_with(
            organization_id=self.org.id,
            is_rca_enabled=True,
            is_auto_open_prs_enabled=True,
            project_repo_dict={
                1: [
                    SeerRepoDefinition(
                        provider="github",
                        owner="sentry",
                        name="sentry",
                        external_id="1234567890",
                        organization_id=1234567890,
                        integration_id="1234567890",
                        branch_name="my-branch",
                        branch_overrides=[
                            BranchOverride(
                                tag_name="my-tag",
                                tag_value="my-value",
                                branch_name="my-branch",
                            )
                        ],
                        instructions="my-instructions",
                        base_commit_sha="1234567890",
                        provider_raw="github",
                    ),
                    SeerRepoDefinition(
                        provider="github-enterprise",
                        owner="sentry-test",
                        name="sentry-test",
                        external_id="0987654321",
                        organization_id=None,
                        integration_id=None,
                        branch_name=None,
                        branch_overrides=[],
                        instructions=None,
                        base_commit_sha=None,
                        provider_raw=None,
                    ),
                ],
                2: [
                    SeerRepoDefinition(
                        provider="github",
                        owner="sentry",
                        name="sentry",
                        external_id="1029384756",
                        organization_id=None,
                        integration_id=None,
                        branch_name=None,
                        branch_overrides=[],
                        instructions=None,
                        base_commit_sha=None,
                        provider_raw=None,
                    )
                ],
            },
        )

    @patch("sentry.seer.endpoints.organization_seer_onboarding.onboarding_seer_settings_update")
    def test_post_missing_required_fields(self, mock_onboarding_update) -> None:
        response = self.client.post(
            self.path,
            {
                "autofix": {
                    "enable_root_cause_analysis": True,
                },
            },
        )

        assert response.status_code == 400
        mock_onboarding_update.assert_not_called()
        assert response.json() == {
            "autofix": {
                "auto_open_prs": ["This field is required."],
                "project_repo_mapping": ["This field is required."],
            }
        }

    @patch("sentry.seer.endpoints.organization_seer_onboarding.onboarding_seer_settings_update")
    def test_post_invalid_project_id(self, mock_onboarding_update) -> None:
        response = self.client.post(
            self.path,
            {
                "autofix": {
                    "enable_root_cause_analysis": True,
                    "auto_open_prs": True,
                    "project_repo_mapping": {
                        "invalid": [
                            {
                                "provider": "github",
                                "owner": "sentry",
                                "name": "sentry",
                                "external_id": "1234567890",
                            },
                        ],
                    },
                },
            },
        )

        assert response.status_code == 400
        mock_onboarding_update.assert_not_called()
        assert response.json() == {
            "autofix": {
                "project_repo_mapping": ["Invalid project ID: invalid. Must be an integer."]
            }
        }

    @patch("sentry.seer.endpoints.organization_seer_onboarding.onboarding_seer_settings_update")
    def test_post_invalid_repo_data(self, mock_onboarding_update) -> None:
        response = self.client.post(
            self.path,
            {
                "autofix": {
                    "enable_root_cause_analysis": True,
                    "auto_open_prs": True,
                    "project_repo_mapping": {
                        "1": {
                            "provider": "github",
                            "owner": "sentry",
                            "name": "sentry",
                            "external_id": "1234567890",
                        }
                    },
                },
            },
        )

        assert response.status_code == 400
        mock_onboarding_update.assert_not_called()
        assert response.json() == {
            "autofix": {
                "project_repo_mapping": ["Expected a list of repositories for project 1"],
            }
        }

    @patch("sentry.seer.endpoints.organization_seer_onboarding.onboarding_seer_settings_update")
    def test_post_handles_exceptions(self, mock_onboarding_update) -> None:
        mock_onboarding_update.side_effect = Exception("Test exception")
        response = self.client.post(
            self.path,
            {
                "autofix": {
                    "enable_root_cause_analysis": True,
                    "auto_open_prs": True,
                    "project_repo_mapping": {
                        "1": [
                            {
                                "provider": "github",
                                "owner": "sentry",
                                "name": "sentry",
                                "external_id": "1234567890",
                            },
                        ],
                    },
                },
            },
        )

        assert response.status_code == 500
        mock_onboarding_update.assert_called_once()
        assert response.json() == {"detail": "Failed to update Seer settings. Please try again."}
