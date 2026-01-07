from unittest.mock import patch

from django.urls import reverse

from sentry.models.auditlogentry import AuditLogEntry
from sentry.seer.autofix.constants import AutofixAutomationTuningSettings
from sentry.seer.autofix.utils import AutofixStoppingPoint
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode


class OrganizationAutofixAutomationSettingsEndpointTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.url = reverse(
            "sentry-api-0-organization-autofix-automation-settings",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )

    @patch(
        "sentry.seer.endpoints.organization_autofix_automation_settings.bulk_get_project_preferences"
    )
    def test_get_returns_default_settings_for_all_projects(self, mock_bulk_get_preferences):
        project1 = self.create_project(organization=self.organization, name="Project One")
        project2 = self.create_project(organization=self.organization, name="Project Two")

        mock_bulk_get_preferences.return_value = {}

        response = self.client.get(self.url, {})

        assert response.status_code == 200
        assert response.data == [
            {
                "projectId": project1.id,
                "autofixAutomationTuning": AutofixAutomationTuningSettings.OFF.value,
                "automatedRunStoppingPoint": AutofixStoppingPoint.CODE_CHANGES.value,
                "reposCount": 0,
            },
            {
                "projectId": project2.id,
                "autofixAutomationTuning": AutofixAutomationTuningSettings.OFF.value,
                "automatedRunStoppingPoint": AutofixStoppingPoint.CODE_CHANGES.value,
                "reposCount": 0,
            },
        ]

    @patch(
        "sentry.seer.endpoints.organization_autofix_automation_settings.bulk_get_project_preferences"
    )
    def test_get_returns_projects_matching_query(self, mock_bulk_get_preferences):
        project1 = self.create_project(organization=self.organization, name="Project One")
        project2 = self.create_project(organization=self.organization, name="Project Two")

        mock_bulk_get_preferences.return_value = {}

        # Search by name
        response = self.client.get(self.url, {"query": project1.name})
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["projectId"] == project1.id

        # Search by slug
        response = self.client.get(self.url, {"query": project2.slug})
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["projectId"] == project2.id

        # Search find any matches
        response = self.client.get(self.url, {"query": "Project"})
        assert response.status_code == 200
        assert len(response.data) == 2

        # Search finds no matches
        response = self.client.get(self.url, {"query": "nonexistent"})
        assert response.status_code == 200
        assert len(response.data) == 0

    @patch(
        "sentry.seer.endpoints.organization_autofix_automation_settings.bulk_get_project_preferences"
    )
    def test_get_paginates_results(self, mock_bulk_get_preferences):
        for i in range(5):
            self.create_project(organization=self.organization, slug=f"project-{i}")

        mock_bulk_get_preferences.return_value = {}

        response1 = self.client.get(self.url, {"per_page": "3"})
        assert response1.status_code == 200
        assert 'rel="previous"; results="false"' in response1.headers["Link"]
        assert 'rel="next"; results="true"' in response1.headers["Link"]

        response2 = self.client.get(self.url, {"per_page": "3", "cursor": "3:1:0"})
        assert response2.status_code == 200
        assert 'rel="previous"; results="true"' in response2.headers["Link"]
        assert 'rel="next"; results="false"' in response2.headers["Link"]

    @patch(
        "sentry.seer.endpoints.organization_autofix_automation_settings.bulk_get_project_preferences"
    )
    def test_get_reads_project_preferences(self, mock_bulk_get_preferences):
        project1 = self.create_project(organization=self.organization, name="Project One")
        project2 = self.create_project(organization=self.organization, name="Project Two")

        project1.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.MEDIUM.value
        )
        project2.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.HIGH.value
        )

        mock_bulk_get_preferences.return_value = {
            str(project1.id): {
                "automated_run_stopping_point": AutofixStoppingPoint.OPEN_PR.value,
                "repositories": [{"name": "test-repo", "owner": "test-owner"}],
            },
            str(project2.id): {
                "automated_run_stopping_point": AutofixStoppingPoint.OPEN_PR.value,
                "repositories": None,
            },
        }

        response = self.client.get(self.url)
        assert response.status_code == 200
        assert response.data == [
            {
                "projectId": project1.id,
                "autofixAutomationTuning": AutofixAutomationTuningSettings.MEDIUM.value,
                "automatedRunStoppingPoint": AutofixStoppingPoint.OPEN_PR.value,
                "reposCount": 1,
            },
            {
                "projectId": project2.id,
                "autofixAutomationTuning": AutofixAutomationTuningSettings.HIGH.value,
                "automatedRunStoppingPoint": AutofixStoppingPoint.OPEN_PR.value,
                "reposCount": 0,
            },
        ]

    @patch(
        "sentry.seer.endpoints.organization_autofix_automation_settings.bulk_set_project_preferences"
    )
    @patch(
        "sentry.seer.endpoints.organization_autofix_automation_settings.bulk_get_project_preferences"
    )
    def test_post_creates_project_preferences(
        self, mock_bulk_get_preferences, mock_bulk_set_preferences
    ):
        project = self.create_project(organization=self.organization)

        mock_bulk_get_preferences.return_value = {}

        response = self.client.post(
            self.url,
            {
                "projectIds": [project.id],
                "autofixAutomationTuning": AutofixAutomationTuningSettings.MEDIUM.value,
                "automatedRunStoppingPoint": AutofixStoppingPoint.OPEN_PR.value,
            },
        )
        assert response.status_code == 204

        project.refresh_from_db()
        assert (
            project.get_option("sentry:autofix_automation_tuning")
            == AutofixAutomationTuningSettings.MEDIUM.value
        )

        mock_bulk_set_preferences.assert_called_once()
        call_args = mock_bulk_set_preferences.call_args
        preferences = call_args[0][1]
        assert preferences == [
            {
                "organization_id": self.organization.id,
                "project_id": project.id,
                "repositories": [],
                "automated_run_stopping_point": AutofixStoppingPoint.OPEN_PR.value,
                "automation_handoff": None,
            }
        ]

    @patch(
        "sentry.seer.endpoints.organization_autofix_automation_settings.bulk_set_project_preferences"
    )
    @patch(
        "sentry.seer.endpoints.organization_autofix_automation_settings.bulk_get_project_preferences"
    )
    def test_post_updates_each_preference_field_independently(
        self, mock_bulk_get_preferences, mock_bulk_set_preferences
    ):
        project = self.create_project(organization=self.organization)
        assert (
            project.get_option("sentry:autofix_automation_tuning")
            == AutofixAutomationTuningSettings.OFF.value
        )

        mock_bulk_get_preferences.return_value = {}

        response = self.client.post(
            self.url,
            {
                "projectIds": [project.id],
                "autofixAutomationTuning": AutofixAutomationTuningSettings.MEDIUM.value,
            },
        )

        assert response.status_code == 204

        project.refresh_from_db()
        assert (
            project.get_option("sentry:autofix_automation_tuning")
            == AutofixAutomationTuningSettings.MEDIUM.value
        )
        mock_bulk_set_preferences.assert_not_called()

        response = self.client.post(
            self.url,
            {
                "projectIds": [project.id],
                "automatedRunStoppingPoint": AutofixStoppingPoint.OPEN_PR.value,
            },
        )

        project.refresh_from_db()
        assert (
            project.get_option("sentry:autofix_automation_tuning")
            == AutofixAutomationTuningSettings.MEDIUM.value
        )

        mock_bulk_set_preferences.assert_called_once()
        call_args = mock_bulk_set_preferences.call_args
        preferences = call_args[0][1]
        assert preferences == [
            {
                "organization_id": self.organization.id,
                "project_id": project.id,
                "repositories": [],
                "automated_run_stopping_point": AutofixStoppingPoint.OPEN_PR.value,
                "automation_handoff": None,
            }
        ]

    def test_post_requires_one_or_more_project_ids(self):
        response = self.client.post(
            self.url,
            {"automatedRunStoppingPoint": AutofixStoppingPoint.OPEN_PR.value},
        )
        assert response.status_code == 400

        response = self.client.post(
            self.url,
            {
                "projectIds": [],
                "automatedRunStoppingPoint": AutofixStoppingPoint.OPEN_PR.value,
            },
        )
        assert response.status_code == 400

    def test_post_rejects_invalid_project_ids(self):

        response = self.client.post(
            self.url,
            {
                "projectIds": [99999],
                "automatedRunStoppingPoint": AutofixStoppingPoint.OPEN_PR.value,
            },
        )
        assert response.status_code == 403

    def test_post_rejects_invalid_tuning(self):

        response = self.client.post(
            self.url,
            {
                "projectIds": [99999],
                "autofixAutomationTuning": "invalid",
            },
        )
        assert response.status_code == 400

    def test_post_rejects_invalid_stopping_point(self):

        response = self.client.post(
            self.url,
            {
                "projectIds": [99999],
                "automatedRunStoppingPoint": "invalid",
            },
        )
        assert response.status_code == 400

    def test_post_rejects_projects_not_in_organization(self):
        project = self.create_project(organization=self.organization)
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)

        # Rejects other org's project in projectIds
        response = self.client.post(
            self.url,
            {
                "projectIds": [project.id, other_project.id],
                "automatedRunStoppingPoint": AutofixStoppingPoint.OPEN_PR.value,
            },
        )
        assert response.status_code == 403

    @patch(
        "sentry.seer.endpoints.organization_autofix_automation_settings.bulk_set_project_preferences"
    )
    @patch(
        "sentry.seer.endpoints.organization_autofix_automation_settings.bulk_get_project_preferences"
    )
    def test_post_ignores_repo_mappings_not_in_project_ids(
        self, mock_bulk_get_preferences, mock_bulk_set_preferences
    ):
        project1 = self.create_project(organization=self.organization)
        project2 = self.create_project(organization=self.organization)

        mock_bulk_get_preferences.return_value = {}

        repo_data = {
            "provider": "github",
            "owner": "test-org",
            "name": "test-repo",
            "externalId": "12345",
        }

        response = self.client.post(
            self.url,
            {
                "projectIds": [project1.id],
                "projectRepoMappings": {
                    str(project1.id): [repo_data],
                    str(project2.id): [repo_data],
                },
            },
        )
        assert response.status_code == 204

        mock_bulk_set_preferences.assert_called_once()
        call_args = mock_bulk_set_preferences.call_args
        preferences = call_args[0][1]

        assert len(preferences) == 1
        assert preferences[0]["project_id"] == project1.id

    @patch(
        "sentry.seer.endpoints.organization_autofix_automation_settings.bulk_set_project_preferences"
    )
    @patch(
        "sentry.seer.endpoints.organization_autofix_automation_settings.bulk_get_project_preferences"
    )
    def test_post_updates_project_repo_mappings(
        self, mock_bulk_get_preferences, mock_bulk_set_preferences
    ):
        project = self.create_project(organization=self.organization)

        mock_bulk_get_preferences.return_value = {}

        repo_data = {
            "provider": "github",
            "owner": "test-org",
            "name": "test-repo",
            "externalId": "12345",
        }

        response = self.client.post(
            self.url,
            {
                "projectIds": [project.id],
                "autofixAutomationTuning": AutofixAutomationTuningSettings.MEDIUM.value,
                "automatedRunStoppingPoint": AutofixStoppingPoint.OPEN_PR.value,
                "projectRepoMappings": {
                    str(project.id): [repo_data],
                },
            },
        )
        assert response.status_code == 204

        project.refresh_from_db()
        assert (
            project.get_option("sentry:autofix_automation_tuning")
            == AutofixAutomationTuningSettings.MEDIUM.value
        )

        mock_bulk_set_preferences.assert_called_once()
        call_args = mock_bulk_set_preferences.call_args
        preferences = call_args[0][1]
        assert len(preferences) == 1
        assert preferences[0]["project_id"] == project.id
        assert preferences[0]["automated_run_stopping_point"] == AutofixStoppingPoint.OPEN_PR.value
        assert len(preferences[0]["repositories"]) == 1
        assert preferences[0]["repositories"][0]["name"] == "test-repo"
        assert preferences[0]["repositories"][0]["owner"] == "test-org"
        assert preferences[0]["repositories"][0]["external_id"] == "12345"

    @patch(
        "sentry.seer.endpoints.organization_autofix_automation_settings.bulk_set_project_preferences"
    )
    @patch(
        "sentry.seer.endpoints.organization_autofix_automation_settings.bulk_get_project_preferences"
    )
    def test_post_clears_repos_with_empty_list(
        self, mock_bulk_get_preferences, mock_bulk_set_preferences
    ):
        project = self.create_project(organization=self.organization)

        mock_bulk_get_preferences.return_value = {
            str(project.id): {
                "repositories": [{"name": "old-repo", "owner": "old-owner"}],
            }
        }

        response = self.client.post(
            self.url,
            {
                "projectIds": [project.id],
                "projectRepoMappings": {
                    str(project.id): [],
                },
            },
        )
        assert response.status_code == 204

        mock_bulk_set_preferences.assert_called_once()
        call_args = mock_bulk_set_preferences.call_args
        preferences = call_args[0][1]
        assert len(preferences) == 1
        assert preferences[0]["repositories"] == []

    @patch(
        "sentry.seer.endpoints.organization_autofix_automation_settings.bulk_set_project_preferences"
    )
    @patch(
        "sentry.seer.endpoints.organization_autofix_automation_settings.bulk_get_project_preferences"
    )
    def test_post_overwrites_existing_repos(
        self, mock_bulk_get_preferences, mock_bulk_set_preferences
    ):
        project = self.create_project(organization=self.organization)

        mock_bulk_get_preferences.return_value = {
            str(project.id): {
                "repositories": [{"name": "old-repo", "owner": "old-owner", "external_id": "111"}],
            }
        }

        new_repo_data = {
            "provider": "github",
            "owner": "new-owner",
            "name": "new-repo",
            "externalId": "222",
        }

        response = self.client.post(
            self.url,
            {
                "projectIds": [project.id],
                "projectRepoMappings": {
                    str(project.id): [new_repo_data],
                },
            },
        )
        assert response.status_code == 204

        mock_bulk_set_preferences.assert_called_once()
        call_args = mock_bulk_set_preferences.call_args
        preferences = call_args[0][1]
        assert len(preferences) == 1
        assert len(preferences[0]["repositories"]) == 1
        assert preferences[0]["repositories"][0]["name"] == "new-repo"
        assert preferences[0]["repositories"][0]["owner"] == "new-owner"
        assert preferences[0]["repositories"][0]["external_id"] == "222"

    @patch(
        "sentry.seer.endpoints.organization_autofix_automation_settings.bulk_set_project_preferences"
    )
    @patch(
        "sentry.seer.endpoints.organization_autofix_automation_settings.bulk_get_project_preferences"
    )
    def test_post_only_updates_projects_with_changes(
        self, mock_bulk_get_preferences, mock_bulk_set_preferences
    ):
        project1 = self.create_project(organization=self.organization)
        project2 = self.create_project(organization=self.organization)

        mock_bulk_get_preferences.return_value = {}

        repo_data = {
            "provider": "github",
            "owner": "test-org",
            "name": "test-repo",
            "externalId": "12345",
        }

        response = self.client.post(
            self.url,
            {
                "projectIds": [project1.id, project2.id],
                "projectRepoMappings": {
                    str(project1.id): [repo_data],
                },
            },
        )
        assert response.status_code == 204

        mock_bulk_set_preferences.assert_called_once()
        call_args = mock_bulk_set_preferences.call_args
        preferences = call_args[0][1]
        assert len(preferences) == 1
        assert preferences[0]["project_id"] == project1.id

    @patch(
        "sentry.seer.endpoints.organization_autofix_automation_settings.bulk_set_project_preferences"
    )
    @patch(
        "sentry.seer.endpoints.organization_autofix_automation_settings.bulk_get_project_preferences"
    )
    def test_post_appends_repos_when_append_flag_true(
        self, mock_bulk_get_preferences, mock_bulk_set_preferences
    ):
        project = self.create_project(organization=self.organization)

        mock_bulk_get_preferences.return_value = {
            str(project.id): {
                "repositories": [
                    {
                        "provider": "github",
                        "owner": "existing-owner",
                        "name": "existing-repo",
                        "external_id": "111",
                        "organization_id": self.organization.id,
                    }
                ],
            }
        }

        new_repo_data = {
            "provider": "github",
            "owner": "new-owner",
            "name": "new-repo",
            "externalId": "222",
            "organizationId": self.organization.id,
        }

        response = self.client.post(
            self.url,
            {
                "projectIds": [project.id],
                "projectRepoMappings": {
                    str(project.id): [new_repo_data],
                },
                "appendRepositories": True,
            },
        )
        assert response.status_code == 204

        mock_bulk_set_preferences.assert_called_once()
        call_args = mock_bulk_set_preferences.call_args
        preferences = call_args[0][1]
        assert len(preferences) == 1
        assert len(preferences[0]["repositories"]) == 2
        assert preferences[0]["repositories"][0]["external_id"] == "111"
        assert preferences[0]["repositories"][1]["external_id"] == "222"

    @patch(
        "sentry.seer.endpoints.organization_autofix_automation_settings.bulk_set_project_preferences"
    )
    @patch(
        "sentry.seer.endpoints.organization_autofix_automation_settings.bulk_get_project_preferences"
    )
    def test_post_append_skips_duplicates(
        self, mock_bulk_get_preferences, mock_bulk_set_preferences
    ):
        project = self.create_project(organization=self.organization)

        mock_bulk_get_preferences.return_value = {
            str(project.id): {
                "repositories": [
                    {
                        "provider": "github",
                        "owner": "existing-owner",
                        "name": "existing-repo",
                        "external_id": "111",
                        "organization_id": self.organization.id,
                    }
                ],
            }
        }

        # Include a duplicate (same organization_id, provider, external_id) and a new repo
        duplicate_repo = {
            "provider": "github",
            "owner": "different-owner",
            "name": "different-name",
            "externalId": "111",
            "organizationId": self.organization.id,
        }
        new_repo = {
            "provider": "github",
            "owner": "new-owner",
            "name": "new-repo",
            "externalId": "222",
            "organizationId": self.organization.id,
        }

        response = self.client.post(
            self.url,
            {
                "projectIds": [project.id],
                "projectRepoMappings": {
                    str(project.id): [duplicate_repo, new_repo],
                },
                "appendRepositories": True,
            },
        )
        assert response.status_code == 204

        mock_bulk_set_preferences.assert_called_once()
        call_args = mock_bulk_set_preferences.call_args
        preferences = call_args[0][1]
        assert len(preferences) == 1
        # Should only have 2 repos: the existing one and the new one (duplicate skipped)
        assert len(preferences[0]["repositories"]) == 2
        assert preferences[0]["repositories"][0]["external_id"] == "111"
        assert preferences[0]["repositories"][0]["owner"] == "existing-owner"
        assert preferences[0]["repositories"][1]["external_id"] == "222"

    @patch(
        "sentry.seer.endpoints.organization_autofix_automation_settings.bulk_set_project_preferences"
    )
    @patch(
        "sentry.seer.endpoints.organization_autofix_automation_settings.bulk_get_project_preferences"
    )
    def test_post_creates_audit_log(self, mock_bulk_get_preferences, mock_bulk_set_preferences):
        project1 = self.create_project(organization=self.organization)
        project2 = self.create_project(organization=self.organization)

        mock_bulk_get_preferences.return_value = {}

        with outbox_runner():
            response = self.client.post(
                self.url,
                {
                    "projectIds": [project1.id, project2.id],
                    "autofixAutomationTuning": AutofixAutomationTuningSettings.MEDIUM.value,
                    "automatedRunStoppingPoint": AutofixStoppingPoint.OPEN_PR.value,
                },
            )
        assert response.status_code == 204

        with assume_test_silo_mode(SiloMode.CONTROL):
            audit_log = AuditLogEntry.objects.filter(
                organization_id=self.organization.id,
            ).first()

            assert audit_log is not None
            assert audit_log.data["project_count"] == 2
            assert set(audit_log.data["project_ids"]) == {project1.id, project2.id}
            assert (
                audit_log.data["autofix_automation_tuning"]
                == AutofixAutomationTuningSettings.MEDIUM.value
            )
            assert (
                audit_log.data["automated_run_stopping_point"] == AutofixStoppingPoint.OPEN_PR.value
            )
