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
