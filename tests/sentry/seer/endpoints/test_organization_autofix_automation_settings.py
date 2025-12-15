from unittest.mock import patch

from django.urls import reverse

from sentry.seer.autofix.constants import AutofixAutomationTuningSettings
from sentry.seer.autofix.utils import AutofixStoppingPoint
from sentry.testutils.cases import APITestCase


class OrganizationAutofixAutomationSettingsEndpointTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.url = reverse(
            "sentry-api-0-organization-autofix-automation-settings",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )

    @patch(
        "sentry.seer.endpoints.organization_autofix_automation_settings.bulk_set_project_preferences"
    )
    @patch(
        "sentry.seer.endpoints.organization_autofix_automation_settings.bulk_get_project_preferences"
    )
    def test_put_fixes_enabled_sets_medium_tuning(
        self, mock_bulk_get_preferences, mock_bulk_set_preferences
    ):
        mock_bulk_get_preferences.return_value = {}
        project1 = self.create_project(organization=self.organization)
        project2 = self.create_project(organization=self.organization)

        response = self.client.put(
            self.url,
            data={
                "projectIds": [project1.id, project2.id],
                "fixes": True,
            },
            format="json",
        )

        assert response.status_code == 204

        project1.refresh_from_db()
        project2.refresh_from_db()
        assert (
            project1.get_option("sentry:autofix_automation_tuning")
            == AutofixAutomationTuningSettings.MEDIUM.value
        )
        assert (
            project2.get_option("sentry:autofix_automation_tuning")
            == AutofixAutomationTuningSettings.MEDIUM.value
        )

        mock_bulk_set_preferences.assert_called_once()
        call_args = mock_bulk_set_preferences.call_args
        assert call_args[0][0] == self.organization.id
        preferences = call_args[0][1]
        assert len(preferences) == 2
        for pref in preferences:
            assert pref["automated_run_stopping_point"] == AutofixStoppingPoint.CODE_CHANGES.value

    @patch(
        "sentry.seer.endpoints.organization_autofix_automation_settings.bulk_set_project_preferences"
    )
    @patch(
        "sentry.seer.endpoints.organization_autofix_automation_settings.bulk_get_project_preferences"
    )
    def test_put_fixes_and_pr_creation_enabled(
        self, mock_bulk_get_preferences, mock_bulk_set_preferences
    ):
        mock_bulk_get_preferences.return_value = {}
        project = self.create_project(organization=self.organization)

        response = self.client.put(
            self.url,
            data={
                "projectIds": [project.id],
                "fixes": True,
                "pr_creation": True,
            },
            format="json",
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
        assert preferences[0]["automated_run_stopping_point"] == AutofixStoppingPoint.OPEN_PR.value

    @patch(
        "sentry.seer.endpoints.organization_autofix_automation_settings.bulk_set_project_preferences"
    )
    @patch(
        "sentry.seer.endpoints.organization_autofix_automation_settings.bulk_get_project_preferences"
    )
    def test_put_fixes_disabled_sets_off_tuning(
        self, mock_bulk_get_preferences, mock_bulk_set_preferences
    ):
        mock_bulk_get_preferences.return_value = {}
        project = self.create_project(organization=self.organization)

        response = self.client.put(
            self.url,
            data={
                "projectIds": [project.id],
                "fixes": False,
            },
            format="json",
        )

        assert response.status_code == 204

        project.refresh_from_db()
        assert (
            project.get_option("sentry:autofix_automation_tuning")
            == AutofixAutomationTuningSettings.OFF.value
        )

    @patch(
        "sentry.seer.endpoints.organization_autofix_automation_settings.bulk_set_project_preferences"
    )
    @patch(
        "sentry.seer.endpoints.organization_autofix_automation_settings.bulk_get_project_preferences"
    )
    def test_put_preserves_existing_preferences(
        self, mock_bulk_get_preferences, mock_bulk_set_preferences
    ):
        project = self.create_project(organization=self.organization)
        existing_repos = [{"name": "existing-repo", "owner": "existing-owner"}]
        mock_bulk_get_preferences.return_value = {
            str(project.id): {
                "organization_id": self.organization.id,
                "project_id": project.id,
                "repositories": existing_repos,
                "automated_run_stopping_point": AutofixStoppingPoint.ROOT_CAUSE.value,
            }
        }

        response = self.client.put(
            self.url,
            data={
                "projectIds": [project.id],
                "fixes": True,
                "pr_creation": True,
            },
            format="json",
        )

        assert response.status_code == 204

        mock_bulk_set_preferences.assert_called_once()
        call_args = mock_bulk_set_preferences.call_args
        preferences = call_args[0][1]
        assert preferences[0]["repositories"] == existing_repos
        assert preferences[0]["automated_run_stopping_point"] == AutofixStoppingPoint.OPEN_PR.value

    def test_put_pr_creation_without_fixes_fails(self):
        project = self.create_project(organization=self.organization)

        response = self.client.put(
            self.url,
            data={
                "projectIds": [project.id],
                "fixes": False,
                "pr_creation": True,
            },
            format="json",
        )

        assert response.status_code == 400
        assert "pr_creation" in response.data

    def test_put_empty_project_ids(self):
        response = self.client.put(
            self.url,
            data={
                "projectIds": [],
                "fixes": True,
            },
            format="json",
        )

        assert response.status_code == 400

    def test_put_missing_fixes_field(self):
        project = self.create_project(organization=self.organization)

        response = self.client.put(
            self.url,
            data={
                "projectIds": [project.id],
            },
            format="json",
        )

        assert response.status_code == 400
        assert "fixes" in response.data

    def test_put_project_not_in_organization(self):
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)

        response = self.client.put(
            self.url,
            data={
                "projectIds": [other_project.id],
                "fixes": True,
            },
            format="json",
        )

        assert response.status_code == 403

    @patch(
        "sentry.seer.endpoints.organization_autofix_automation_settings.bulk_get_project_preferences"
    )
    def test_get_returns_settings_for_projects(self, mock_bulk_get_preferences):
        project1 = self.create_project(
            organization=self.organization, name="Project One", platform="javascript"
        )
        project2 = self.create_project(
            organization=self.organization, name="Project Two", platform="python"
        )

        project1.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.MEDIUM.value
        )
        project2.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.OFF.value
        )

        mock_bulk_get_preferences.return_value = {
            str(project1.id): {
                "automated_run_stopping_point": AutofixStoppingPoint.OPEN_PR.value,
                "repositories": [{"name": "repo1"}, {"name": "repo2"}],
            },
            str(project2.id): {
                "automated_run_stopping_point": AutofixStoppingPoint.CODE_CHANGES.value,
                "repositories": [],
            },
        }

        response = self.client.get(
            self.url, {"projectIds": [project1.id, project2.id]}, format="json"
        )

        assert response.status_code == 200
        assert len(response.data) == 2

        result1 = next(r for r in response.data if r["projectId"] == project1.id)
        result2 = next(r for r in response.data if r["projectId"] == project2.id)

        assert result1["fixes"] is True
        assert result1["prCreation"] is True
        assert result1["tuning"] == AutofixAutomationTuningSettings.MEDIUM.value
        assert result1["projectSlug"] == project1.slug
        assert result1["projectName"] == "Project One"
        assert result1["projectPlatform"] == "javascript"
        assert result1["reposCount"] == 2

        assert result2["fixes"] is False
        assert result2["prCreation"] is False
        assert result2["tuning"] == AutofixAutomationTuningSettings.OFF.value
        assert result2["projectName"] == "Project Two"
        assert result2["projectPlatform"] == "python"
        assert result2["reposCount"] == 0

    @patch(
        "sentry.seer.endpoints.organization_autofix_automation_settings.bulk_get_project_preferences"
    )
    def test_get_returns_defaults_for_projects_without_settings(self, mock_bulk_get_preferences):
        project = self.create_project(organization=self.organization)
        mock_bulk_get_preferences.return_value = {}

        response = self.client.get(self.url, {"projectIds": [project.id]}, format="json")

        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["projectId"] == project.id
        assert response.data[0]["fixes"] is False
        assert response.data[0]["prCreation"] is False
        assert response.data[0]["tuning"] == AutofixAutomationTuningSettings.OFF.value

    @patch(
        "sentry.seer.endpoints.organization_autofix_automation_settings.bulk_get_project_preferences"
    )
    def test_get_all_projects_when_no_project_ids(self, mock_bulk_get_preferences):
        project1 = self.create_project(organization=self.organization)
        project2 = self.create_project(organization=self.organization)
        mock_bulk_get_preferences.return_value = {}

        response = self.client.get(self.url, format="json")

        assert response.status_code == 200

        project_ids = [r["projectId"] for r in response.data]
        assert project1.id in project_ids
        assert project2.id in project_ids

    def test_get_invalid_project_ids(self):
        response = self.client.get(self.url, {"projectIds": ["not-an-int"]}, format="json")

        assert response.status_code == 400
        assert "projectIds" in response.data

    def test_get_unauthorized_project_ids_returns_403(self):
        project = self.create_project(organization=self.organization)
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)

        response = self.client.get(
            self.url, {"projectIds": [project.id, other_project.id]}, format="json"
        )

        assert response.status_code == 403

    @patch(
        "sentry.seer.endpoints.organization_autofix_automation_settings.bulk_get_project_preferences"
    )
    def test_get_multiple_project_ids_query_params(self, mock_bulk_get_preferences):
        project1 = self.create_project(organization=self.organization)
        project2 = self.create_project(organization=self.organization)
        mock_bulk_get_preferences.return_value = {}
        response = self.client.get(
            f"{self.url}?projectIds={project1.id}&projectIds={project2.id}", format="json"
        )

        assert response.status_code == 200
        assert len(response.data) == 2

    @patch(
        "sentry.seer.endpoints.organization_autofix_automation_settings.bulk_get_project_preferences"
    )
    def test_get_pagination(self, mock_bulk_get_preferences):
        for i in range(5):
            self.create_project(organization=self.organization, slug=f"project-{i}")
        mock_bulk_get_preferences.return_value = {}

        response = self.client.get(self.url, {"per_page": 2}, format="json")

        assert response.status_code == 200
        assert len(response.data) == 2
        assert "Link" in response

    def test_get_too_many_project_ids(self):
        project_ids = list(range(1, 1002))
        query_string = "&".join([f"projectIds={pid}" for pid in project_ids])
        response = self.client.get(f"{self.url}?{query_string}", format="json")

        # Django will reject this with 400 before our code runs due to DATA_UPLOAD_MAX_NUMBER_FIELDS
        assert response.status_code == 400

    def test_get_nonexistent_project_ids_returns_403(self):
        response = self.client.get(self.url, {"projectIds": [99999, 99998]}, format="json")
        assert response.status_code == 403

    @patch(
        "sentry.seer.endpoints.organization_autofix_automation_settings.bulk_get_project_preferences"
    )
    def test_get_pr_creation_false_when_stopping_point_is_code_changes(
        self, mock_bulk_get_preferences
    ):
        project = self.create_project(organization=self.organization)
        project.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.MEDIUM.value
        )
        mock_bulk_get_preferences.return_value = {
            str(project.id): {
                "automated_run_stopping_point": AutofixStoppingPoint.CODE_CHANGES.value,
            },
        }

        response = self.client.get(self.url, {"projectIds": [project.id]}, format="json")

        assert response.status_code == 200
        assert response.data[0]["fixes"] is True
        assert response.data[0]["prCreation"] is False

    @patch(
        "sentry.seer.endpoints.organization_autofix_automation_settings.bulk_get_project_preferences"
    )
    def test_get_pr_creation_false_when_no_seer_preference(self, mock_bulk_get_preferences):
        project = self.create_project(organization=self.organization)
        project.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.MEDIUM.value
        )
        mock_bulk_get_preferences.return_value = {}

        response = self.client.get(self.url, {"projectIds": [project.id]}, format="json")

        assert response.status_code == 200
        assert response.data[0]["fixes"] is True
        assert response.data[0]["prCreation"] is False

    @patch(
        "sentry.seer.endpoints.organization_autofix_automation_settings.bulk_get_project_preferences"
    )
    def test_get_search_by_name(self, mock_bulk_get_preferences):
        self.create_project(organization=self.organization, name="Frontend App", slug="frontend")
        self.create_project(organization=self.organization, name="Backend API", slug="backend")
        self.create_project(organization=self.organization, name="Mobile App", slug="mobile")
        mock_bulk_get_preferences.return_value = {}

        response = self.client.get(self.url, {"query": "Frontend"}, format="json")

        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["projectName"] == "Frontend App"

    @patch(
        "sentry.seer.endpoints.organization_autofix_automation_settings.bulk_get_project_preferences"
    )
    def test_get_search_by_slug(self, mock_bulk_get_preferences):
        self.create_project(organization=self.organization, name="Frontend App", slug="frontend")
        self.create_project(organization=self.organization, name="Backend API", slug="backend")
        mock_bulk_get_preferences.return_value = {}

        response = self.client.get(self.url, {"query": "backend"}, format="json")

        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["projectSlug"] == "backend"

    @patch(
        "sentry.seer.endpoints.organization_autofix_automation_settings.bulk_get_project_preferences"
    )
    def test_get_search_no_results(self, mock_bulk_get_preferences):
        self.create_project(organization=self.organization, name="Frontend App", slug="frontend")
        mock_bulk_get_preferences.return_value = {}

        response = self.client.get(self.url, {"query": "nonexistent"}, format="json")

        assert response.status_code == 200
        assert len(response.data) == 0

    @patch(
        "sentry.seer.endpoints.organization_autofix_automation_settings.bulk_get_project_preferences"
    )
    def test_get_handles_none_seer_preferences(self, mock_bulk_get_preferences):
        project = self.create_project(organization=self.organization)
        project.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.MEDIUM.value
        )
        mock_bulk_get_preferences.return_value = None

        response = self.client.get(self.url, {"projectIds": [project.id]}, format="json")

        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["projectId"] == project.id
        assert response.data[0]["fixes"] is True
        assert response.data[0]["prCreation"] is False
        assert response.data[0]["reposCount"] == 0

    @patch(
        "sentry.seer.endpoints.organization_autofix_automation_settings.bulk_get_project_preferences"
    )
    def test_get_handles_none_project_preference_value(self, mock_bulk_get_preferences):
        project = self.create_project(organization=self.organization)
        project.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.MEDIUM.value
        )
        mock_bulk_get_preferences.return_value = {str(project.id): None}

        response = self.client.get(self.url, {"projectIds": [project.id]}, format="json")

        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["projectId"] == project.id
        assert response.data[0]["fixes"] is True
        assert response.data[0]["prCreation"] is False
        assert response.data[0]["reposCount"] == 0

    @patch(
        "sentry.seer.endpoints.organization_autofix_automation_settings.bulk_get_project_preferences"
    )
    def test_get_handles_none_repositories_value(self, mock_bulk_get_preferences):
        project = self.create_project(organization=self.organization)
        project.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.MEDIUM.value
        )
        mock_bulk_get_preferences.return_value = {
            str(project.id): {
                "automated_run_stopping_point": AutofixStoppingPoint.OPEN_PR.value,
                "repositories": None,
            }
        }

        response = self.client.get(self.url, {"projectIds": [project.id]}, format="json")

        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["reposCount"] == 0
