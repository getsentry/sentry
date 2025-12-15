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

    @patch(
        "sentry.seer.endpoints.organization_autofix_automation_settings.bulk_get_project_preferences"
    )
    def test_post_rejects_projects_not_in_organization(self, mock_bulk_get_preferences):
        project1 = self.create_project(organization=self.organization, name="Project One")
        project2 = self.create_project(organization=self.organization, name="Project Two")
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)

        response = self.client.post(
            self.url,
            {
                "projectIds": [project1.id, project2.id, other_project.id],
                "automatedRunStoppingPoint": AutofixStoppingPoint.OPEN_PR.value,
            },
        )
        assert response.status_code == 403
