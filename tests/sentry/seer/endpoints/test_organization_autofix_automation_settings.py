from django.urls import reverse

from sentry.seer.autofix.constants import AutofixAutomationTuningSettings
from sentry.testutils.cases import APITestCase


class OrganizationAutofixAutomationSettingsEndpointTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.url = reverse(
            "sentry-api-0-organization-autofix-automation-settings",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )

    def test_put_bulk_update_settings(self):
        project1 = self.create_project(organization=self.organization)
        project2 = self.create_project(organization=self.organization)

        response = self.client.put(
            self.url,
            data={
                "projectIds": [project1.id, project2.id],
                "autofixAutomationTuning": "high",
            },
            format="json",
        )

        assert response.status_code == 204

        project1.refresh_from_db()
        project2.refresh_from_db()
        assert (
            project1.get_option("sentry:autofix_automation_tuning")
            == AutofixAutomationTuningSettings.HIGH
        )
        assert (
            project2.get_option("sentry:autofix_automation_tuning")
            == AutofixAutomationTuningSettings.HIGH
        )

    def test_put_invalid_setting(self):
        project = self.create_project(organization=self.organization)

        response = self.client.put(
            self.url,
            data={
                "projectIds": [project.id],
                "autofixAutomationTuning": "invalid_setting",
            },
            format="json",
        )

        assert response.status_code == 400

    def test_put_empty_project_ids(self):
        response = self.client.put(
            self.url,
            data={
                "projectIds": [],
                "autofixAutomationTuning": "high",
            },
            format="json",
        )

        assert response.status_code == 400

    def test_put_project_not_in_organization(self):
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)

        response = self.client.put(
            self.url,
            data={
                "projectIds": [other_project.id],
                "autofixAutomationTuning": "high",
            },
            format="json",
        )

        assert response.status_code == 403

    def test_put_all_valid_settings(self):
        for setting in AutofixAutomationTuningSettings:
            project = self.create_project(organization=self.organization)

            response = self.client.put(
                self.url,
                data={
                    "projectIds": [project.id],
                    "autofixAutomationTuning": setting.value,
                },
                format="json",
            )

            assert response.status_code == 204

            project.refresh_from_db()
            assert project.get_option("sentry:autofix_automation_tuning") == setting
