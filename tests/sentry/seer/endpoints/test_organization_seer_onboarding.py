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
        self.project1 = self.create_project(organization=self.org)
        self.project2 = self.create_project(organization=self.org)
        self.login_as(user=self.user)
        self.path = reverse("sentry-api-0-organization-seer-onboarding", args=[self.org.slug])

    @patch("sentry.seer.endpoints.organization_seer_onboarding.onboarding_seer_settings_update")
    def test_post_success(self, mock_onboarding_update) -> None:
        response = self.client.post(
            self.path,
            {
                "autofix": {
                    "fixes": True,
                    "prCreation": True,
                    "projectRepoMapping": {
                        str(self.project1.id): [
                            {
                                "provider": "github",
                                "owner": "sentry",
                                "name": "sentry",
                                "externalId": "1234567890",
                                "organizationId": "1234567890",
                                "integrationId": "1234567890",
                                "branchName": "my-branch",
                                "branchOverrides": [
                                    {
                                        "tagName": "my-tag",
                                        "tagValue": "my-value",
                                        "branchName": "my-branch",
                                    }
                                ],
                                "instructions": "my-instructions",
                                "baseCommitSha": "1234567890",
                                "providerRaw": "github",
                            },
                            {
                                "provider": "github-enterprise",
                                "owner": "sentry-test",
                                "name": "sentry-test",
                                "externalId": "0987654321",
                            },
                        ],
                        str(self.project2.id): [
                            {
                                "provider": "github",
                                "owner": "sentry",
                                "name": "sentry",
                                "externalId": "1029384756",
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
                self.project1.id: [
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
                self.project2.id: [
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
    def test_post_empty_project_repo_mapping_success(self, mock_onboarding_update) -> None:
        response = self.client.post(
            self.path,
            {
                "autofix": {
                    "fixes": True,
                    "prCreation": True,
                    "projectRepoMapping": {},
                },
            },
        )

        assert response.status_code == 204
        mock_onboarding_update.assert_called_once_with(
            organization_id=self.org.id,
            is_rca_enabled=True,
            is_auto_open_prs_enabled=True,
            project_repo_dict={},
        )

    @patch("sentry.seer.endpoints.organization_seer_onboarding.onboarding_seer_settings_update")
    def test_post_empty_success(self, mock_onboarding_update) -> None:
        response = self.client.post(
            self.path,
            {
                "autofix": {
                    "fixes": False,
                    "prCreation": False,
                    "projectRepoMapping": {},
                },
            },
        )

        assert response.status_code == 204
        mock_onboarding_update.assert_called_once_with(
            organization_id=self.org.id,
            is_rca_enabled=False,
            is_auto_open_prs_enabled=False,
            project_repo_dict={},
        )

    @patch("sentry.seer.endpoints.organization_seer_onboarding.onboarding_seer_settings_update")
    def test_post_pr_creation_enabled_with_fixes_disabled_fails(
        self, mock_onboarding_update
    ) -> None:
        response = self.client.post(
            self.path,
            {
                "autofix": {
                    "fixes": False,
                    "prCreation": True,
                    "projectRepoMapping": {},
                },
            },
        )

        assert response.status_code == 400
        mock_onboarding_update.assert_not_called()
        assert response.json() == {
            "autofix": {"prCreation": ["PR creation cannot be enabled when fixes is disabled."]}
        }

    @patch("sentry.seer.endpoints.organization_seer_onboarding.onboarding_seer_settings_update")
    def test_post_missing_required_fields(self, mock_onboarding_update) -> None:
        response = self.client.post(
            self.path,
            {
                "autofix": {
                    "fixes": True,
                },
            },
        )

        assert response.status_code == 400
        mock_onboarding_update.assert_not_called()
        assert response.json() == {
            "autofix": {
                "prCreation": ["This field is required."],
                "projectRepoMapping": ["This field is required."],
            }
        }

    @patch("sentry.seer.endpoints.organization_seer_onboarding.onboarding_seer_settings_update")
    def test_post_invalid_project_id(self, mock_onboarding_update) -> None:
        response = self.client.post(
            self.path,
            {
                "autofix": {
                    "fixes": True,
                    "prCreation": True,
                    "projectRepoMapping": {
                        "invalid_project_id": [
                            {
                                "provider": "github",
                                "owner": "sentry",
                                "name": "sentry",
                                "externalId": "1234567890",
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
                "projectRepoMapping": [
                    "Invalid project ID: invalid_project_id. Must be a positive integer."
                ]
            }
        }

    @patch("sentry.seer.endpoints.organization_seer_onboarding.onboarding_seer_settings_update")
    def test_post_invalid_project_repo_mapping(self, mock_onboarding_update) -> None:
        response = self.client.post(
            self.path,
            {
                "autofix": {
                    "fixes": True,
                    "prCreation": True,
                    "projectRepoMapping": {
                        str(self.project1.id): {
                            "provider": "github",
                            "owner": "sentry",
                            "name": "sentry",
                            "externalId": "1234567890",
                        }
                    },
                },
            },
        )

        assert response.status_code == 400
        mock_onboarding_update.assert_not_called()
        assert response.json() == {
            "autofix": {
                "projectRepoMapping": [
                    f"Expected a list of repositories for project {self.project1.id}"
                ],
            }
        }

    @patch("sentry.seer.endpoints.organization_seer_onboarding.onboarding_seer_settings_update")
    def test_post_handles_exceptions(self, mock_onboarding_update) -> None:
        mock_onboarding_update.side_effect = Exception("Test exception")
        response = self.client.post(
            self.path,
            {
                "autofix": {
                    "fixes": True,
                    "prCreation": True,
                    "projectRepoMapping": {
                        str(self.project1.id): [
                            {
                                "provider": "github",
                                "owner": "sentry",
                                "name": "sentry",
                                "externalId": "1234567890",
                            },
                        ],
                    },
                },
            },
        )

        assert response.status_code == 500
        mock_onboarding_update.assert_called_once()

    @patch("sentry.seer.endpoints.organization_seer_onboarding.onboarding_seer_settings_update")
    def test_project_from_other_organization_forbidden(self, mock_onboarding_update) -> None:
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        response = self.client.post(
            self.path,
            {
                "autofix": {
                    "fixes": True,
                    "prCreation": True,
                    "projectRepoMapping": {
                        str(self.project1.id): [
                            {
                                "provider": "github",
                                "owner": "sentry",
                                "name": "sentry",
                                "externalId": "1234567890",
                            },
                        ],
                        str(other_project.id): [
                            {
                                "provider": "github",
                                "owner": "sentry",
                                "name": "sentry",
                                "externalId": "1234567890",
                            },
                        ],
                    },
                },
            },
        )

        assert response.status_code == 403
        mock_onboarding_update.assert_not_called()
        assert response.json() == {"detail": "You do not have permission to perform this action."}

    @patch("sentry.seer.endpoints.organization_seer_onboarding.onboarding_seer_settings_update")
    def test_negative_project_id(self, mock_onboarding_update) -> None:
        response = self.client.post(
            self.path,
            {
                "autofix": {
                    "fixes": True,
                    "prCreation": True,
                    "projectRepoMapping": {
                        "-1": [
                            {
                                "provider": "github",
                                "owner": "sentry",
                                "name": "sentry",
                                "externalId": "1234567890",
                            },
                        ],
                    },
                }
            },
        )

        assert response.status_code == 400
        mock_onboarding_update.assert_not_called()
        assert response.json() == {
            "autofix": {
                "projectRepoMapping": ["Invalid project ID: -1. Must be a positive integer."]
            }
        }
