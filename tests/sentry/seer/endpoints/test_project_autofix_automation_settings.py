from unittest.mock import patch

from django.urls import reverse

from sentry.seer.autofix.constants import AutofixAutomationTuningSettings
from sentry.seer.autofix.utils import AutofixStoppingPoint
from sentry.seer.models import SeerProjectPreference, SeerRawPreferenceResponse, SeerRepoDefinition
from sentry.testutils.cases import APITestCase


class OrganizationAutofixAutomationProjectSettingsEndpointTest(APITestCase):
    endpoint = "sentry-api-0-project-autofix-automation-settings"
    method = "get"

    seer_repo = SeerRepoDefinition(
        name="test-repo",
        owner="test-owner",
        external_id="test-external-id",
        provider="github",
    )

    def setUp(self):
        super().setUp()
        # The test likely fails because `self.organization` and `self.project` are not set up before this.
        # In most Sentry tests, you need to create the organization and the project first, e.g.:
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)
        self.url = reverse(
            self.endpoint,
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "project_id_or_slug": self.project.slug,
            },
        )
        self.login_as(user=self.user)

    @patch("sentry.seer.endpoints.project_autofix_automation_settings.get_project_seer_preferences")
    def test_get_returns_default_settings(self, mock_get_preferences):
        mock_get_preferences.return_value = SeerRawPreferenceResponse(preference=None)

        response = self.client.get(self.url)

        assert response.status_code == 200
        assert response.data == {
            "projectId": self.project.id,
            "autofixAutomationTuning": AutofixAutomationTuningSettings.OFF.value,
            "automatedRunStoppingPoint": AutofixStoppingPoint.CODE_CHANGES.value,
            "reposCount": 0,
        }

    @patch("sentry.seer.endpoints.project_autofix_automation_settings.get_project_seer_preferences")
    def test_get_returns_saved_settings(self, mock_get_preferences):
        self.project.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.MEDIUM.value
        )
        mock_get_preferences.return_value = SeerRawPreferenceResponse(
            preference=SeerProjectPreference(
                organization_id=self.organization.id,
                project_id=self.project.id,
                repositories=[self.seer_repo],
                automated_run_stopping_point=AutofixStoppingPoint.OPEN_PR.value,
            )
        )

        response = self.client.get(self.url)

        assert response.status_code == 200
        assert response.data == {
            "projectId": self.project.id,
            "autofixAutomationTuning": AutofixAutomationTuningSettings.MEDIUM.value,
            "automatedRunStoppingPoint": AutofixStoppingPoint.OPEN_PR.value,
            "reposCount": 1,
        }

    def test_post_rejects_invalid_tuning(self):
        response = self.client.put(self.url, {"autofixAutomationTuning": "invalid"})
        assert response.status_code == 400

    def test_put_rejects_invalid_stopping_point(self):
        response = self.client.put(self.url, {"automatedRunStoppingPoint": "invalid"})
        assert response.status_code == 400

    @patch("sentry.seer.endpoints.project_autofix_automation_settings.bulk_set_project_preferences")
    @patch("sentry.seer.endpoints.project_autofix_automation_settings.get_project_seer_preferences")
    def test_put_updates_all_fields(self, mock_get_preferences, mock_bulk_set_preferences):
        self.project.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.OFF.value
        )
        mock_get_preferences.return_value = SeerRawPreferenceResponse(
            preference=SeerProjectPreference(
                organization_id=self.organization.id,
                project_id=self.project.id,
                repositories=[self.seer_repo],
                automated_run_stopping_point=AutofixStoppingPoint.OPEN_PR.value,
            )
        )

        response = self.client.put(
            self.url,
            {
                "autofixAutomationTuning": AutofixAutomationTuningSettings.MEDIUM.value,
                "automatedRunStoppingPoint": AutofixStoppingPoint.OPEN_PR.value,
            },
        )

        assert response.status_code == 204

        self.project.refresh_from_db()
        assert (
            self.project.get_option("sentry:autofix_automation_tuning")
            == AutofixAutomationTuningSettings.MEDIUM.value
        )

        mock_bulk_set_preferences.assert_called_once()
        call_args = mock_bulk_set_preferences.call_args
        preferences = call_args[0][1]
        assert preferences == [
            {
                "organization_id": self.organization.id,
                "project_id": self.project.id,
                "repositories": [self.seer_repo.dict()],
                "automated_run_stopping_point": AutofixStoppingPoint.OPEN_PR.value,
                "automation_handoff": None,
            }
        ]

    @patch("sentry.seer.endpoints.project_autofix_automation_settings.bulk_set_project_preferences")
    @patch("sentry.seer.endpoints.project_autofix_automation_settings.get_project_seer_preferences")
    def test_put_updates_passed_fields(self, mock_get_preferences, mock_bulk_set_preferences):
        self.project.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.OFF.value
        )
        mock_get_preferences.return_value = SeerRawPreferenceResponse(
            preference=SeerProjectPreference(
                organization_id=self.organization.id,
                project_id=self.project.id,
                repositories=[self.seer_repo],
                automated_run_stopping_point=AutofixStoppingPoint.CODE_CHANGES.value,
                automation_handoff=None,
            )
        )

        response = self.client.put(
            self.url,
            {"autofixAutomationTuning": AutofixAutomationTuningSettings.MEDIUM.value},
        )

        assert response.status_code == 204

        self.project.refresh_from_db()
        assert (
            self.project.get_option("sentry:autofix_automation_tuning")
            == AutofixAutomationTuningSettings.MEDIUM.value
        )

        mock_bulk_set_preferences.assert_not_called()

        response = self.client.put(
            self.url,
            {"automatedRunStoppingPoint": AutofixStoppingPoint.OPEN_PR.value},
        )

        mock_bulk_set_preferences.assert_called_once()
        call_args = mock_bulk_set_preferences.call_args
        preferences = call_args[0][1]
        assert preferences == [
            {
                "organization_id": self.organization.id,
                "project_id": self.project.id,
                "repositories": [self.seer_repo.dict()],
                "automated_run_stopping_point": AutofixStoppingPoint.OPEN_PR.value,
                "automation_handoff": None,
            }
        ]
