from unittest.mock import patch

from django.urls import reverse

from sentry.constants import ObjectStatus
from sentry.seer.autofix.constants import AutofixAutomationTuningSettings
from sentry.seer.models import AutofixHandoffPoint
from sentry.testutils.cases import APITestCase


@patch(
    "sentry.seer.endpoints.project_seer_settings.is_seer_seat_based_tier_enabled",
    return_value=True,
)
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

    def test_get_returns_defaults(self, mock_is_seat_based) -> None:
        """A project with no options set should return defaults."""
        response = self.client.get(self.url)

        assert response.status_code == 200
        assert response.data == {
            "projectId": str(self.project.id),
            "projectSlug": self.project.slug,
            "agent": "seer",
            "integrationId": None,
            "stoppingPoint": "off",
            "autoCreatePr": None,
            "automationTuning": "off",
            "scannerAutomation": True,
            "reposCount": 0,
        }

    def test_get_returns_configured_project_options(self, mock_is_seat_based) -> None:
        """A project with explicit options should reflect them in the response."""
        self.project.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.MEDIUM
        )
        self.project.update_option("sentry:seer_automated_run_stopping_point", "open_pr")
        self.project.update_option("sentry:seer_scanner_automation", False)

        response = self.client.get(self.url)

        assert response.status_code == 200
        assert response.data["stoppingPoint"] == "open_pr"
        assert response.data["autoCreatePr"] is None
        assert response.data["automationTuning"] == "medium"
        assert response.data["scannerAutomation"] is False

    def test_get_external_agent_with_integration_id(self, mock_is_seat_based) -> None:
        """A project with an external handoff should return the agent, integration ID,
        and autoCreatePr from the handoff config."""
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
        assert response.data["autoCreatePr"] is False

    def test_get_external_agent_with_auto_create_pr(self, mock_is_seat_based) -> None:
        """autoCreatePr should reflect the handoff config value."""
        self.project.update_option(
            "sentry:seer_automation_handoff_target", "cursor_background_agent"
        )
        self.project.update_option(
            "sentry:seer_automation_handoff_point", AutofixHandoffPoint.ROOT_CAUSE
        )
        self.project.update_option("sentry:seer_automation_handoff_integration_id", 42)
        self.project.update_option("sentry:seer_automation_handoff_auto_create_pr", True)

        response = self.client.get(self.url)

        assert response.status_code == 200
        assert response.data["autoCreatePr"] is True

    def test_get_stopping_point_off_when_tuning_off(self, mock_is_seat_based) -> None:
        """stoppingPoint should be 'off' when tuning is OFF."""
        self.project.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.OFF
        )
        self.project.update_option("sentry:seer_automated_run_stopping_point", "open_pr")

        response = self.client.get(self.url)

        assert response.status_code == 200
        assert response.data["stoppingPoint"] == "off"
        assert response.data["automationTuning"] == "off"

    def test_get_stopping_point_when_tuning_on(self, mock_is_seat_based) -> None:
        """When tuning is not OFF, stoppingPoint should reflect the stored value."""
        self.project.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.MEDIUM
        )
        self.project.update_option("sentry:seer_automated_run_stopping_point", "root_cause")

        response = self.client.get(self.url)

        assert response.status_code == 200
        assert response.data["stoppingPoint"] == "root_cause"
        assert response.data["automationTuning"] == "medium"

    def test_get_repos_count(self, mock_is_seat_based) -> None:
        """reposCount should reflect active SeerProjectRepository rows."""
        repo1 = self.create_repo(project=self.project, name="owner/repo-1")
        repo2 = self.create_repo(project=self.project, name="owner/repo-2")
        self.create_seer_project_repository(project=self.project, repository=repo1)
        self.create_seer_project_repository(project=self.project, repository=repo2)

        response = self.client.get(self.url)

        assert response.status_code == 200
        assert response.data["reposCount"] == 2

    def test_get_repos_count_excludes_inactive_repos(self, mock_is_seat_based) -> None:
        """Repos with non-active status should not be counted."""
        active_repo = self.create_repo(project=self.project, name="owner/active")
        disabled_repo = self.create_repo(project=self.project, name="owner/deleted")
        disabled_repo.status = ObjectStatus.DISABLED
        disabled_repo.save()
        self.create_seer_project_repository(project=self.project, repository=active_repo)
        self.create_seer_project_repository(project=self.project, repository=disabled_repo)

        response = self.client.get(self.url)

        assert response.status_code == 200
        assert response.data["reposCount"] == 1

    def test_put_returns_updated_settings(self, mock_is_seat_based) -> None:
        """PUT response should contain the full updated settings object."""
        response = self.client.put(
            self.url,
            data={"agent": "seer", "stoppingPoint": "code_changes", "automationTuning": "medium"},
            format="json",
        )

        assert response.status_code == 200
        assert response.data["projectId"] == str(self.project.id)
        assert response.data["projectSlug"] == self.project.slug
        assert response.data["agent"] == "seer"
        assert response.data["stoppingPoint"] == "code_changes"
        assert "scannerAutomation" in response.data
        assert "reposCount" in response.data

    def test_put_external_agent_with_valid_integration(self, mock_is_seat_based) -> None:
        """Valid external agent + integrationId should succeed and reflect in response."""
        integration = self.create_integration(
            organization=self.organization, external_id="ext", provider="github"
        )
        response = self.client.put(
            self.url,
            data={"agent": "cursor_background_agent", "integrationId": integration.id},
            format="json",
        )

        assert response.status_code == 200
        assert response.data["agent"] == "cursor_background_agent"
        assert response.data["integrationId"] == str(integration.id)

    def test_put_scanner_automation(self, mock_is_seat_based) -> None:
        """PUT scannerAutomation should update and return the new value."""
        response = self.client.put(self.url, data={"scannerAutomation": False}, format="json")

        assert response.status_code == 200
        assert response.data["scannerAutomation"] is False

    def test_put_stopping_point(self, mock_is_seat_based) -> None:
        response = self.client.put(self.url, data={"stoppingPoint": "open_pr"}, format="json")

        assert response.status_code == 200
        assert self.project.get_option("sentry:seer_automated_run_stopping_point") == "open_pr"

    def test_put_stopping_point_open_pr_syncs_auto_create_pr(self, mock_is_seat_based) -> None:
        """Setting stoppingPoint to open_pr should also set auto_create_pr to True."""
        response = self.client.put(self.url, data={"stoppingPoint": "open_pr"}, format="json")

        assert response.status_code == 200
        assert self.project.get_option("sentry:seer_automated_run_stopping_point") == "open_pr"
        assert self.project.get_option("sentry:seer_automation_handoff_auto_create_pr") is True

    def test_put_stopping_point_non_open_pr_clears_auto_create_pr(self, mock_is_seat_based) -> None:
        """Setting stoppingPoint to non-open_pr should clear auto_create_pr."""
        self.project.update_option("sentry:seer_automation_handoff_auto_create_pr", True)

        response = self.client.put(self.url, data={"stoppingPoint": "code_changes"}, format="json")

        assert response.status_code == 200
        assert self.project.get_option("sentry:seer_automated_run_stopping_point") == "code_changes"
        assert self.project.get_option("sentry:seer_automation_handoff_auto_create_pr") is False

    def test_put_legacy_stopping_point_does_not_sync_auto_create_pr(
        self, mock_is_seat_based
    ) -> None:
        """Legacy: changing stoppingPoint should not touch auto_create_pr."""
        mock_is_seat_based.return_value = False

        response = self.client.put(self.url, data={"stoppingPoint": "open_pr"}, format="json")

        assert response.status_code == 200
        assert self.project.get_option("sentry:seer_automated_run_stopping_point") == "open_pr"
        assert self.project.get_option("sentry:seer_automation_handoff_auto_create_pr") is False

    def test_put_legacy_auto_create_pr(self, mock_is_seat_based) -> None:
        """autoCreatePr should update the handoff option directly."""
        mock_is_seat_based.return_value = False

        response = self.client.put(self.url, data={"autoCreatePr": True}, format="json")

        assert response.status_code == 200
        assert self.project.get_option("sentry:seer_automation_handoff_auto_create_pr") is True

    def test_put_legacy_auto_create_pr_preserves_stopping_point(self, mock_is_seat_based) -> None:
        """autoCreatePr should not change the stored stopping_point."""
        mock_is_seat_based.return_value = False

        self.project.update_option("sentry:seer_automated_run_stopping_point", "root_cause")

        response = self.client.put(self.url, data={"autoCreatePr": True}, format="json")

        assert response.status_code == 200
        assert self.project.get_option("sentry:seer_automated_run_stopping_point") == "root_cause"

    def test_put_automation_tuning(self, mock_is_seat_based) -> None:
        """Seat-based: automationTuning accepts off and medium."""
        response = self.client.put(self.url, data={"automationTuning": "off"}, format="json")
        assert response.status_code == 200
        assert (
            self.project.get_option("sentry:autofix_automation_tuning")
            == AutofixAutomationTuningSettings.OFF
        )

        response = self.client.put(self.url, data={"automationTuning": "medium"}, format="json")
        assert response.status_code == 200
        assert (
            self.project.get_option("sentry:autofix_automation_tuning")
            == AutofixAutomationTuningSettings.MEDIUM
        )

    def test_put_automation_tuning_rejects_granular(self, mock_is_seat_based) -> None:
        """Seat-based: granular tuning values like 'high' should be rejected."""
        response = self.client.put(self.url, data={"automationTuning": "high"}, format="json")
        assert response.status_code == 400

    def test_put_legacy_automation_tuning_allows_granular(self, mock_is_seat_based) -> None:
        """Legacy: automationTuning should set tuning directly."""
        mock_is_seat_based.return_value = False
        response = self.client.put(self.url, data={"automationTuning": "high"}, format="json")

        assert response.status_code == 200
        assert (
            self.project.get_option("sentry:autofix_automation_tuning")
            == AutofixAutomationTuningSettings.HIGH
        )

    def test_put_requires_at_least_one_update_field(self, mock_is_seat_based) -> None:
        """Sending no update fields should return 400."""
        response = self.client.put(self.url, data={}, format="json")
        assert response.status_code == 400

    def test_put_requires_integration_id_for_external_agent(self, mock_is_seat_based) -> None:
        """External agent without integrationId should return 400."""
        response = self.client.put(
            self.url, data={"agent": "cursor_background_agent"}, format="json"
        )
        assert response.status_code == 400

    def test_put_rejects_integration_id_without_agent(self, mock_is_seat_based) -> None:
        """integrationId without agent should return 400."""
        integration = self.create_integration(
            organization=self.organization, external_id="valid", provider="github"
        )
        response = self.client.put(self.url, data={"integrationId": integration.id}, format="json")
        assert response.status_code == 400

    def test_put_rejects_integration_id_with_seer_agent(self, mock_is_seat_based) -> None:
        """integrationId with agent=seer should return 400."""
        integration = self.create_integration(
            organization=self.organization, external_id="valid", provider="github"
        )
        response = self.client.put(
            self.url, data={"agent": "seer", "integrationId": integration.id}, format="json"
        )
        assert response.status_code == 400

    def test_put_rejects_integration_id_from_other_org(self, mock_is_seat_based) -> None:
        """An integration ID that doesn't belong to this org should return 400."""
        other_org = self.create_organization()
        integration = self.create_integration(
            organization=other_org, external_id="other", provider="github"
        )

        response = self.client.put(
            self.url,
            data={"agent": "cursor_background_agent", "integrationId": integration.id},
            format="json",
        )
        assert response.status_code == 400

    def test_put_seer_agent_does_not_require_integration_id(self, mock_is_seat_based) -> None:
        """agent=seer should not require integrationId."""
        response = self.client.put(self.url, data={"agent": "seer"}, format="json")
        assert response.status_code == 200

    def test_put_rejects_invalid_agent(self, mock_is_seat_based) -> None:
        """An unrecognized agent value should return 400."""
        response = self.client.put(self.url, data={"agent": "invalid"}, format="json")
        assert response.status_code == 400

    def test_put_rejects_invalid_stopping_point(self, mock_is_seat_based) -> None:
        """An unrecognized stoppingPoint value should return 400."""
        response = self.client.put(self.url, data={"stoppingPoint": "invalid"}, format="json")
        assert response.status_code == 400

    def test_put_creates_audit_log_entry(self, mock_is_seat_based) -> None:
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


@patch(
    "sentry.seer.endpoints.project_seer_settings.is_seer_seat_based_tier_enabled",
    return_value=True,
)
class OrganizationSeerProjectSettingsEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-seer-project-settings"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.project = self.create_project(organization=self.organization)
        self.url = reverse(
            self.endpoint,
            kwargs={"organization_id_or_slug": self.organization.slug},
        )

    def test_get_returns_defaults(self, mock_is_seat_based) -> None:
        """Projects with no options set should return default values."""
        response = self.client.get(self.url)

        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0] == {
            "projectId": str(self.project.id),
            "projectSlug": self.project.slug,
            "agent": "seer",
            "integrationId": None,
            "stoppingPoint": "off",
            "autoCreatePr": None,
            "automationTuning": "off",
            "scannerAutomation": True,
            "reposCount": 0,
        }

    def test_get_returns_configured_project_options(self, mock_is_seat_based) -> None:
        """Projects with explicit option values should reflect those in the response."""
        self.project.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.MEDIUM
        )
        self.project.update_option("sentry:seer_automated_run_stopping_point", "open_pr")
        self.project.update_option("sentry:seer_scanner_automation", False)

        response = self.client.get(self.url)

        assert response.status_code == 200
        assert response.data[0]["stoppingPoint"] == "open_pr"
        assert response.data[0]["autoCreatePr"] is None
        assert response.data[0]["automationTuning"] == "medium"
        assert response.data[0]["scannerAutomation"] is False

    def test_get_external_agent_with_integration_id(self, mock_is_seat_based) -> None:
        """A project configured with an external handoff should return the agent,
        integration ID, and autoCreatePr from the handoff config."""
        self.project.update_option(
            "sentry:seer_automation_handoff_target", "cursor_background_agent"
        )
        self.project.update_option(
            "sentry:seer_automation_handoff_point", AutofixHandoffPoint.ROOT_CAUSE
        )
        self.project.update_option("sentry:seer_automation_handoff_integration_id", 42)

        response = self.client.get(self.url)

        assert response.status_code == 200
        assert response.data[0]["agent"] == "cursor_background_agent"
        assert response.data[0]["integrationId"] == "42"
        assert response.data[0]["autoCreatePr"] is False

    def test_get_external_agent_with_auto_create_pr(self, mock_is_seat_based) -> None:
        """autoCreatePr should reflect the handoff config value."""
        self.project.update_option(
            "sentry:seer_automation_handoff_target", "cursor_background_agent"
        )
        self.project.update_option(
            "sentry:seer_automation_handoff_point", AutofixHandoffPoint.ROOT_CAUSE
        )
        self.project.update_option("sentry:seer_automation_handoff_integration_id", 42)
        self.project.update_option("sentry:seer_automation_handoff_auto_create_pr", True)

        response = self.client.get(self.url)

        assert response.status_code == 200
        assert response.data[0]["autoCreatePr"] is True

    def test_get_stopping_point_off_when_tuning_off(self, mock_is_seat_based) -> None:
        """When tuning is OFF, stoppingPoint should be 'off' regardless of the
        stored seer_automated_run_stopping_point value."""
        self.project.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.OFF
        )
        self.project.update_option("sentry:seer_automated_run_stopping_point", "open_pr")

        response = self.client.get(self.url)

        assert response.status_code == 200
        assert response.data[0]["stoppingPoint"] == "off"
        assert response.data[0]["automationTuning"] == "off"

    def test_get_stopping_point_when_tuning_on(self, mock_is_seat_based) -> None:
        """When tuning is not OFF, stoppingPoint should reflect the stored value."""
        self.project.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.MEDIUM
        )
        self.project.update_option("sentry:seer_automated_run_stopping_point", "root_cause")

        response = self.client.get(self.url)

        assert response.status_code == 200
        assert response.data[0]["stoppingPoint"] == "root_cause"
        assert response.data[0]["automationTuning"] == "medium"

    def test_get_repos_count(self, mock_is_seat_based) -> None:
        """reposCount should reflect the number of active SeerProjectRepository rows."""
        repo1 = self.create_repo(project=self.project, name="owner/repo-1")
        repo2 = self.create_repo(project=self.project, name="owner/repo-2")
        self.create_seer_project_repository(project=self.project, repository=repo1)
        self.create_seer_project_repository(project=self.project, repository=repo2)

        response = self.client.get(self.url)

        assert response.status_code == 200
        assert response.data[0]["reposCount"] == 2

    def test_get_repos_count_excludes_inactive_repos(self, mock_is_seat_based) -> None:
        """Repos with non-active status should not be counted."""
        active_repo = self.create_repo(project=self.project, name="owner/active")
        disabled_repo = self.create_repo(project=self.project, name="owner/deleted")
        disabled_repo.status = ObjectStatus.DISABLED
        disabled_repo.save()
        self.create_seer_project_repository(project=self.project, repository=active_repo)
        self.create_seer_project_repository(project=self.project, repository=disabled_repo)

        response = self.client.get(self.url)

        assert response.status_code == 200
        assert response.data[0]["reposCount"] == 1

    def test_get_only_returns_accessible_projects(self, mock_is_seat_based) -> None:
        """Response should only include projects the user has access to."""
        self.organization.flags.allow_joinleave = False
        self.organization.save()

        team = self.create_team(organization=self.organization)
        self.create_project(organization=self.organization, teams=[team])
        inaccessible_project = self.create_project(organization=self.organization)

        member = self.create_user()
        self.create_member(user=member, organization=self.organization, role="member", teams=[team])
        self.login_as(user=member)

        response = self.client.get(self.url)

        assert response.status_code == 200
        project_ids = [r["projectId"] for r in response.data]
        assert len(project_ids) == 1
        assert str(inaccessible_project.id) not in project_ids

    def test_get_paginates_results(self, mock_is_seat_based) -> None:
        """Results should be paginated with Link headers indicating next/previous."""
        for i in range(5):
            self.create_project(organization=self.organization, slug=f"paginate-{i}")

        response1 = self.client.get(self.url, {"per_page": "3"})
        assert response1.status_code == 200
        assert len(response1.data) == 3
        assert 'rel="next"; results="true"' in response1.headers["Link"]

        response2 = self.client.get(self.url, {"per_page": "3", "cursor": "3:1:0"})
        assert response2.status_code == 200
        assert 'rel="previous"; results="true"' in response2.headers["Link"]
        assert 'rel="next"; results="false"' in response2.headers["Link"]

    def test_get_sort_by_name(self, mock_is_seat_based) -> None:
        """sortBy=name should order by project slug."""
        project_b = self.create_project(organization=self.organization, slug="banana")
        project_a = self.create_project(organization=self.organization, slug="apple")

        response = self.client.get(self.url, {"sortBy": "name"})

        assert response.status_code == 200
        slugs = [r["projectSlug"] for r in response.data]
        assert slugs.index(project_a.slug) < slugs.index(project_b.slug)

    def test_get_sort_by_repos_count(self, mock_is_seat_based) -> None:
        """sortBy=reposCount should order by SeerProjectRepository count."""
        project1 = self.create_project(organization=self.organization)
        for i in range(2):
            repo = self.create_repo(project=project1, name=f"owner/repo-{i}")
            self.create_seer_project_repository(project=project1, repository=repo)
        project2 = self.create_project(organization=self.organization)

        response = self.client.get(self.url, {"sortBy": "reposCount"})

        assert response.status_code == 200
        ids = [r["projectId"] for r in response.data]
        assert ids.index(str(project2.id)) < ids.index(str(project1.id))

    def test_get_sort_by_agent(self, mock_is_seat_based) -> None:
        """sortBy=agent should order alphabetically by agent alias."""
        project_seer = self.create_project(organization=self.organization)

        project_cursor = self.create_project(organization=self.organization)
        project_cursor.update_option(
            "sentry:seer_automation_handoff_target", "cursor_background_agent"
        )

        project_claude = self.create_project(organization=self.organization)
        project_claude.update_option("sentry:seer_automation_handoff_target", "claude_code_agent")

        response = self.client.get(self.url, {"sortBy": "agent"})

        assert response.status_code == 200
        ids = [r["projectId"] for r in response.data]
        assert ids.index(str(project_claude.id)) < ids.index(str(project_cursor.id))
        assert ids.index(str(project_cursor.id)) < ids.index(str(project_seer.id))

    def test_get_sort_by_stopping_point(self, mock_is_seat_based) -> None:
        """sortBy=stoppingPoint should order by hierarchy rank (off < root_cause < code_changes < open_pr)."""
        project_open_pr = self.create_project(organization=self.organization)
        project_open_pr.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.MEDIUM
        )
        project_open_pr.update_option("sentry:seer_automated_run_stopping_point", "open_pr")

        project_root_cause = self.create_project(organization=self.organization)
        project_root_cause.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.MEDIUM
        )
        project_root_cause.update_option("sentry:seer_automated_run_stopping_point", "root_cause")

        # self.project has default tuning=OFF → stoppingPoint="off" (rank 0)

        response = self.client.get(self.url, {"sortBy": "stoppingPoint"})

        assert response.status_code == 200
        ids = [r["projectId"] for r in response.data]
        assert ids.index(str(self.project.id)) < ids.index(str(project_root_cause.id))
        assert ids.index(str(project_root_cause.id)) < ids.index(str(project_open_pr.id))

    def test_get_sort_by_invalid_field_returns_400(self, mock_is_seat_based) -> None:
        """An unrecognized sortBy value should return 400."""
        response = self.client.get(self.url, {"sortBy": "invalid"})
        assert response.status_code == 400

    def test_get_filter_empty_results(self, mock_is_seat_based) -> None:
        """A filter that matches nothing should return an empty list."""
        response = self.client.get(self.url, {"query": "id:999999999"})

        assert response.status_code == 200
        assert response.data == []

    def test_get_filter_by_free_text_name(self, mock_is_seat_based) -> None:
        """Free text query should match against both name and slug."""
        project1 = self.create_project(
            organization=self.organization, name="", slug="matching-slug"
        )
        project2 = self.create_project(
            organization=self.organization, name="Matching Name", slug=""
        )
        project3 = self.create_project(organization=self.organization)

        response = self.client.get(self.url, {"query": "matching"})

        assert response.status_code == 200
        ids = [r["projectId"] for r in response.data]
        assert len(ids) == 2
        assert str(project1.id) in ids
        assert str(project2.id) in ids
        assert str(project3.id) not in ids

    def test_get_filter_by_id(self, mock_is_seat_based) -> None:
        """id:N should return only the project with that ID."""
        self.create_project(organization=self.organization)
        project = self.create_project(organization=self.organization)

        response = self.client.get(self.url, {"query": f"id:{project.id}"})

        assert response.status_code == 200
        ids = [r["projectId"] for r in response.data]
        assert ids == [str(project.id)]

    def test_get_filter_by_id_list(self, mock_is_seat_based) -> None:
        """id:[N,M] should return only the projects with those IDs."""
        project1 = self.create_project(organization=self.organization)
        project2 = self.create_project(organization=self.organization)
        self.create_project(organization=self.organization)

        response = self.client.get(self.url, {"query": f"id:[{project1.id},{project2.id}]"})

        assert response.status_code == 200
        ids = [r["projectId"] for r in response.data]
        assert sorted(ids) == sorted([str(project1.id), str(project2.id)])

    def test_get_filter_by_repos_count(self, mock_is_seat_based) -> None:
        """reposCount with numeric operators."""
        project1 = self.create_project(organization=self.organization)
        for i in range(2):
            repo = self.create_repo(project=project1, name=f"owner/filter-repo-{i}")
            self.create_seer_project_repository(project=project1, repository=repo)
        project2 = self.create_project(organization=self.organization)

        response = self.client.get(self.url, {"query": "reposCount:>0"})
        assert response.status_code == 200
        ids = [r["projectId"] for r in response.data]
        assert str(project1.id) in ids
        assert str(project2.id) not in ids

        response = self.client.get(self.url, {"query": "reposCount:0"})
        ids = [r["projectId"] for r in response.data]
        assert str(project2.id) in ids
        assert str(project1.id) not in ids

    def test_get_filter_by_stopping_point(self, mock_is_seat_based) -> None:
        """stoppingPoint filter should account for tuning state."""
        project1 = self.create_project(organization=self.organization)
        project1.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.MEDIUM
        )
        project1.update_option("sentry:seer_automated_run_stopping_point", "code_changes")

        response = self.client.get(self.url, {"query": "stoppingPoint:off"})
        assert response.status_code == 200
        ids = [r["projectId"] for r in response.data]
        assert str(self.project.id) in ids
        assert str(project1.id) not in ids

        response = self.client.get(self.url, {"query": "stoppingPoint:code_changes"})
        ids = [r["projectId"] for r in response.data]
        assert str(project1.id) in ids
        assert str(self.project.id) not in ids

    def test_get_filter_by_agent_seer(self, mock_is_seat_based) -> None:
        """agent:seer should return projects with no handoff target (NULL)."""
        project1 = self.create_project(organization=self.organization)
        project1.update_option("sentry:seer_automation_handoff_target", "cursor_background_agent")

        response = self.client.get(self.url, {"query": "agent:seer"})

        assert response.status_code == 200
        ids = [r["projectId"] for r in response.data]
        assert str(self.project.id) in ids
        assert str(project1.id) not in ids

    def test_get_filter_by_agent_external(self, mock_is_seat_based) -> None:
        """agent:cursor_background_agent should return projects with cursor handoff target."""
        project1 = self.create_project(organization=self.organization)
        project1.update_option("sentry:seer_automation_handoff_target", "cursor_background_agent")

        response = self.client.get(self.url, {"query": "agent:cursor_background_agent"})

        assert response.status_code == 200
        ids = [r["projectId"] for r in response.data]
        assert str(project1.id) in ids
        assert str(self.project.id) not in ids

    def test_get_filter_negation(self, mock_is_seat_based) -> None:
        """!agent:seer should exclude projects with no handoff target."""
        project1 = self.create_project(organization=self.organization)
        project1.update_option("sentry:seer_automation_handoff_target", "cursor_background_agent")

        response = self.client.get(self.url, {"query": "!agent:seer"})

        assert response.status_code == 200
        ids = [r["projectId"] for r in response.data]
        assert str(project1.id) in ids
        assert str(self.project.id) not in ids

    def test_get_multiple_filters(self, mock_is_seat_based) -> None:
        """Combining multiple filters should intersect the results."""
        project1 = self.create_project(organization=self.organization)
        project1.update_option("sentry:seer_automation_handoff_target", "cursor_background_agent")
        repo = self.create_repo(project=project1, name="owner/repo-1")
        self.create_seer_project_repository(project=project1, repository=repo)

        project2 = self.create_project(organization=self.organization)
        project2.update_option("sentry:seer_automation_handoff_target", "cursor_background_agent")

        response = self.client.get(
            self.url, {"query": "agent:cursor_background_agent reposCount:>0"}
        )

        assert response.status_code == 200
        ids = [r["projectId"] for r in response.data]
        assert ids == [str(project1.id)]

    def test_get_invalid_search_query_returns_400(self, mock_is_seat_based) -> None:
        """A malformed search query should return 400 with detail."""
        response = self.client.get(self.url, {"query": "bogusKey:value"})
        assert response.status_code == 400
        assert "detail" in response.data

    def test_put_updates_all_projects(self, mock_is_seat_based) -> None:
        """Empty query should update all accessible projects."""
        project2 = self.create_project(organization=self.organization)

        response = self.client.put(self.url, data={"scannerAutomation": False}, format="json")

        assert response.status_code == 204
        assert self.project.get_option("sentry:seer_scanner_automation") is False
        assert project2.get_option("sentry:seer_scanner_automation") is False

    def test_put_applies_to_filtered_projects_only(self, mock_is_seat_based) -> None:
        """The query parameter should scope which projects get updated."""
        project2 = self.create_project(organization=self.organization)
        project2.update_option("sentry:seer_automation_handoff_target", "cursor_background_agent")

        response = self.client.put(
            self.url,
            data={"query": "agent:cursor_background_agent", "scannerAutomation": False},
            format="json",
        )

        assert response.status_code == 204
        assert project2.get_option("sentry:seer_scanner_automation") is False
        assert self.project.get_option("sentry:seer_scanner_automation") is True

    def test_put_updates_settings(self, mock_is_seat_based) -> None:
        """Bulk update with multiple seer agent fields should apply all of them."""
        project2 = self.create_project(organization=self.organization)

        response = self.client.put(
            self.url,
            data={
                "agent": "seer",
                "stoppingPoint": "code_changes",
                "automationTuning": "medium",
                "scannerAutomation": False,
            },
            format="json",
        )

        assert response.status_code == 204
        for p in (self.project, project2):
            assert p.get_option("sentry:seer_automated_run_stopping_point") == "code_changes"
            assert (
                p.get_option("sentry:autofix_automation_tuning")
                == AutofixAutomationTuningSettings.MEDIUM
            )
            assert p.get_option("sentry:seer_scanner_automation") is False

    def test_put_updates_settings_with_external_agent(self, mock_is_seat_based) -> None:
        """Bulk update with external agent fields should set agent, integration, and stopping point."""
        project2 = self.create_project(organization=self.organization)
        integration = self.create_integration(
            organization=self.organization, external_id="ext", provider="github"
        )

        response = self.client.put(
            self.url,
            data={
                "agent": "cursor_background_agent",
                "integrationId": integration.id,
                "stoppingPoint": "open_pr",
                "scannerAutomation": True,
            },
            format="json",
        )

        assert response.status_code == 204
        for p in (self.project, project2):
            assert (
                p.get_option("sentry:seer_automation_handoff_target") == "cursor_background_agent"
            )
            assert p.get_option("sentry:seer_automation_handoff_integration_id") == integration.id
            assert p.get_option("sentry:seer_automated_run_stopping_point") == "open_pr"
            assert p.get_option("sentry:seer_scanner_automation") is True

    def test_put_legacy_updates_settings(self, mock_is_seat_based) -> None:
        """Legacy: bulk update with granular tuning, auto_create_pr, and external agent."""
        mock_is_seat_based.return_value = False
        project2 = self.create_project(organization=self.organization)
        integration = self.create_integration(
            organization=self.organization, external_id="ext", provider="github"
        )

        response = self.client.put(
            self.url,
            data={
                "automationTuning": "high",
                "autoCreatePr": True,
                "agent": "cursor_background_agent",
                "integrationId": integration.id,
            },
            format="json",
        )

        assert response.status_code == 204
        for p in (self.project, project2):
            assert (
                p.get_option("sentry:autofix_automation_tuning")
                == AutofixAutomationTuningSettings.HIGH
            )
            assert p.get_option("sentry:seer_automation_handoff_auto_create_pr") is True
            assert (
                p.get_option("sentry:seer_automation_handoff_target") == "cursor_background_agent"
            )
            assert p.get_option("sentry:seer_automation_handoff_integration_id") == integration.id

    def test_put_invalid_search_query_returns_400(self, mock_is_seat_based) -> None:
        """A malformed query value should return 400."""
        response = self.client.put(
            self.url, data={"query": "invalidKey:value", "scannerAutomation": False}, format="json"
        )
        assert response.status_code == 400

    def test_put_creates_audit_log_entry(self, mock_is_seat_based) -> None:
        """Bulk update should create an audit log entry with project count and IDs."""
        from sentry.models.auditlogentry import AuditLogEntry
        from sentry.silo.base import SiloMode
        from sentry.testutils.outbox import outbox_runner
        from sentry.testutils.silo import assume_test_silo_mode

        project2 = self.create_project(organization=self.organization)

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
            assert entry.data["project_count"] == 2
            assert set(entry.data["project_ids"]) == {self.project.id, project2.id}
