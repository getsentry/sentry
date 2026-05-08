from django.urls import reverse

from sentry.constants import ObjectStatus
from sentry.seer.autofix.constants import AutofixAutomationTuningSettings
from sentry.seer.models import AutofixHandoffPoint
from sentry.seer.models.project_repository import SeerProjectRepository
from sentry.testutils.cases import APITestCase


class ProjectSeerSettingsEndpointTest(APITestCase):
    endpoint = "sentry-api-0-project-seer-settings"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.project = self.create_project(organization=self.organization)
        self.url = reverse(
            self.endpoint,
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "project_id_or_slug": self.project.slug,
            },
        )

    def test_get_returns_defaults(self) -> None:
        """A project with no options set should return defaults."""
        response = self.client.get(self.url)

        assert response.status_code == 200
        assert response.data == {
            "projectId": self.project.id,
            "projectSlug": self.project.slug,
            "agent": "seer",
            "integrationId": None,
            "stoppingPoint": "off",
            "scannerAutomation": True,
            "reposCount": 0,
        }

    def test_get_returns_configured_project_options(self) -> None:
        """A project with explicit options should reflect them in the response."""
        self.project.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.MEDIUM
        )
        self.project.update_option("sentry:seer_automated_run_stopping_point", "open_pr")
        self.project.update_option("sentry:seer_scanner_automation", False)

        response = self.client.get(self.url)

        assert response.status_code == 200
        assert response.data["stoppingPoint"] == "open_pr"
        assert response.data["scannerAutomation"] is False

    def test_get_returns_external_agent_with_integration_id(self) -> None:
        """A project with an external handoff should return the agent alias and integration ID."""
        self.project.update_option(
            "sentry:seer_automation_handoff_target", "cursor_background_agent"
        )
        self.project.update_option(
            "sentry:seer_automation_handoff_point", AutofixHandoffPoint.ROOT_CAUSE
        )
        self.project.update_option("sentry:seer_automation_handoff_integration_id", 42)

        response = self.client.get(self.url)

        assert response.status_code == 200
        assert response.data["agent"] == "cursor_background_agent"
        assert response.data["integrationId"] == "42"

    def test_get_stopping_point_off_when_tuning_off(self) -> None:
        """stoppingPoint should be 'off' when tuning is OFF."""
        self.project.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.OFF
        )
        self.project.update_option("sentry:seer_automated_run_stopping_point", "open_pr")

        response = self.client.get(self.url)

        assert response.status_code == 200
        assert response.data["stoppingPoint"] == "off"

    def test_get_stopping_point_when_tuning_on(self) -> None:
        """When tuning is not OFF, stoppingPoint should reflect the stored value."""
        self.project.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.MEDIUM
        )
        self.project.update_option("sentry:seer_automated_run_stopping_point", "root_cause")

        response = self.client.get(self.url)

        assert response.status_code == 200
        assert response.data["stoppingPoint"] == "root_cause"

    def test_get_repos_count(self) -> None:
        """reposCount should reflect active SeerProjectRepository rows."""
        repo1 = self.create_repo(project=self.project, name="owner/repo-1")
        repo2 = self.create_repo(project=self.project, name="owner/repo-2")
        SeerProjectRepository.objects.create(project=self.project, repository=repo1)
        SeerProjectRepository.objects.create(project=self.project, repository=repo2)

        response = self.client.get(self.url)

        assert response.status_code == 200
        assert response.data["reposCount"] == 2

    def test_get_repos_count_excludes_inactive_repos(self) -> None:
        """Repos with non-active status should not be counted."""
        active_repo = self.create_repo(project=self.project, name="owner/active")
        disabled_repo = self.create_repo(project=self.project, name="owner/deleted")
        disabled_repo.status = ObjectStatus.DISABLED
        disabled_repo.save()
        SeerProjectRepository.objects.create(project=self.project, repository=active_repo)
        SeerProjectRepository.objects.create(project=self.project, repository=disabled_repo)

        response = self.client.get(self.url)

        assert response.status_code == 200
        assert response.data["reposCount"] == 1

    def test_put_returns_updated_settings(self) -> None:
        """PUT response should contain the full updated settings object."""
        response = self.client.put(
            self.url, data={"agent": "seer", "stoppingPoint": "code_changes"}, format="json"
        )

        assert response.status_code == 200
        assert response.data["projectId"] == self.project.id
        assert response.data["projectSlug"] == self.project.slug
        assert response.data["agent"] == "seer"
        assert response.data["stoppingPoint"] == "code_changes"
        assert "scannerAutomation" in response.data
        assert "reposCount" in response.data

    def test_put_requires_at_least_one_update_field(self) -> None:
        """Sending no update fields should return 400."""
        response = self.client.put(self.url, data={}, format="json")
        assert response.status_code == 400

    def test_put_requires_integration_id_for_external_agent(self) -> None:
        """External agent without integrationId should return 400."""
        response = self.client.put(
            self.url, data={"agent": "cursor_background_agent"}, format="json"
        )
        assert response.status_code == 400

    def test_put_seer_agent_does_not_require_integration_id(self) -> None:
        """agent=seer should not require integrationId."""
        response = self.client.put(self.url, data={"agent": "seer"}, format="json")
        assert response.status_code == 200

    def test_put_rejects_invalid_agent(self) -> None:
        """An unrecognized agent value should return 400."""
        response = self.client.put(self.url, data={"agent": "invalid"}, format="json")
        assert response.status_code == 400

    def test_put_rejects_invalid_stopping_point(self) -> None:
        """An unrecognized stoppingPoint value should return 400."""
        response = self.client.put(self.url, data={"stoppingPoint": "invalid"}, format="json")
        assert response.status_code == 400

    def test_put_creates_audit_log_entry(self) -> None:
        """PUT should create an audit log entry with the project ID."""
        from sentry.models.auditlogentry import AuditLogEntry
        from sentry.silo.base import SiloMode
        from sentry.testutils.outbox import outbox_runner
        from sentry.testutils.silo import assume_test_silo_mode

        with outbox_runner():
            self.client.put(
                self.url,
                data={"scannerAutomation": False},
                format="json",
            )

        with assume_test_silo_mode(SiloMode.CONTROL):
            entry = AuditLogEntry.objects.filter(
                organization_id=self.organization.id,
            ).first()

            assert entry is not None
            assert entry.data["project_id"] == self.project.id
