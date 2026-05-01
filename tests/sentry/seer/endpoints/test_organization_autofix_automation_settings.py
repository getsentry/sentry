from django.urls import reverse

from sentry.models.auditlogentry import AuditLogEntry
from sentry.models.options.project_option import ProjectOption
from sentry.models.repository import Repository
from sentry.seer.autofix.constants import AutofixAutomationTuningSettings
from sentry.seer.autofix.utils import AutofixStoppingPoint
from sentry.seer.models.project_repository import SeerProjectRepository
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode


class OrganizationAutofixAutomationSettingsEndpointTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.url = reverse(
            "sentry-api-0-organization-autofix-automation-settings",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )

    def test_get_returns_default_settings_for_all_projects(self) -> None:
        project1 = self.create_project(organization=self.organization, name="Project One")
        project2 = self.create_project(organization=self.organization, name="Project Two")

        response = self.client.get(self.url, {})

        assert response.status_code == 200
        assert response.data == [
            {
                "projectId": project1.id,
                "projectSlug": project1.slug,
                "autofixAutomationTuning": AutofixAutomationTuningSettings.OFF.value,
                "automatedRunStoppingPoint": AutofixStoppingPoint.CODE_CHANGES.value,
                "automationHandoff": None,
                "reposCount": 0,
            },
            {
                "projectId": project2.id,
                "projectSlug": project2.slug,
                "autofixAutomationTuning": AutofixAutomationTuningSettings.OFF.value,
                "automatedRunStoppingPoint": AutofixStoppingPoint.CODE_CHANGES.value,
                "automationHandoff": None,
                "reposCount": 0,
            },
        ]

    def test_get_returns_projects_matching_query(self) -> None:
        project1 = self.create_project(organization=self.organization, name="Project One")
        project2 = self.create_project(organization=self.organization, name="Project Two")

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

    def test_get_paginates_results(self) -> None:
        for i in range(5):
            self.create_project(organization=self.organization, slug=f"project-{i}")

        response1 = self.client.get(self.url, {"per_page": "3"})
        assert response1.status_code == 200
        assert 'rel="previous"; results="false"' in response1.headers["Link"]
        assert 'rel="next"; results="true"' in response1.headers["Link"]

        response2 = self.client.get(self.url, {"per_page": "3", "cursor": "3:1:0"})
        assert response2.status_code == 200
        assert 'rel="previous"; results="true"' in response2.headers["Link"]
        assert 'rel="next"; results="false"' in response2.headers["Link"]

    def test_get_reads_project_preferences(self) -> None:
        project1 = self.create_project(organization=self.organization, name="Project One")
        project2 = self.create_project(organization=self.organization, name="Project Two")

        project1.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.MEDIUM.value
        )
        project1.update_option(
            "sentry:seer_automated_run_stopping_point", AutofixStoppingPoint.OPEN_PR.value
        )
        project2.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.HIGH.value
        )
        project2.update_option(
            "sentry:seer_automated_run_stopping_point", AutofixStoppingPoint.OPEN_PR.value
        )

        repo = self.create_repo(
            project=project1,
            name="test-owner/test-repo",
            provider="github",
            external_id="12345",
        )
        SeerProjectRepository.objects.create(project=project1, repository=repo)

        response = self.client.get(self.url)
        assert response.status_code == 200
        assert response.data == [
            {
                "projectId": project1.id,
                "projectSlug": project1.slug,
                "autofixAutomationTuning": AutofixAutomationTuningSettings.MEDIUM.value,
                "automatedRunStoppingPoint": AutofixStoppingPoint.OPEN_PR.value,
                "automationHandoff": None,
                "reposCount": 1,
            },
            {
                "projectId": project2.id,
                "projectSlug": project2.slug,
                "autofixAutomationTuning": AutofixAutomationTuningSettings.HIGH.value,
                "automatedRunStoppingPoint": AutofixStoppingPoint.OPEN_PR.value,
                "automationHandoff": None,
                "reposCount": 0,
            },
        ]

    def test_post_creates_project_preferences(self):
        project = self.create_project(organization=self.organization)

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
        assert (
            project.get_option("sentry:seer_automated_run_stopping_point")
            == AutofixStoppingPoint.OPEN_PR.value
        )
        assert SeerProjectRepository.objects.filter(project=project).count() == 0

    def test_post_updates_each_preference_field_independently(self):
        project = self.create_project(organization=self.organization)
        assert (
            project.get_option("sentry:autofix_automation_tuning")
            == AutofixAutomationTuningSettings.OFF.value
        )

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
        # Unset stopping point is preserved.
        assert not ProjectOption.objects.filter(
            project=project, key="sentry:seer_automated_run_stopping_point"
        ).exists()

        response = self.client.post(
            self.url,
            {
                "projectIds": [project.id],
                "automatedRunStoppingPoint": AutofixStoppingPoint.OPEN_PR.value,
            },
        )

        project.refresh_from_db()
        assert (
            project.get_option("sentry:seer_automated_run_stopping_point")
            == AutofixStoppingPoint.OPEN_PR.value
        )
        # Tuning set in the previous request is preserved.
        assert (
            project.get_option("sentry:autofix_automation_tuning")
            == AutofixAutomationTuningSettings.MEDIUM.value
        )

    def test_post_requires_one_or_more_project_ids(self) -> None:
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

    def test_post_rejects_invalid_project_ids(self) -> None:
        response = self.client.post(
            self.url,
            {
                "projectIds": [99999],
                "automatedRunStoppingPoint": AutofixStoppingPoint.OPEN_PR.value,
            },
        )
        assert response.status_code == 403

    def test_post_rejects_invalid_tuning(self) -> None:
        response = self.client.post(
            self.url,
            {
                "projectIds": [99999],
                "autofixAutomationTuning": "invalid",
            },
        )
        assert response.status_code == 400

    def test_post_rejects_invalid_stopping_point(self) -> None:
        response = self.client.post(
            self.url,
            {
                "projectIds": [99999],
                "automatedRunStoppingPoint": "invalid",
            },
        )
        assert response.status_code == 400

    def test_post_accepts_root_cause_stopping_point_with_flag(self) -> None:
        project = self.create_project(organization=self.organization)

        with self.feature("organizations:root-cause-stopping-point"):
            response = self.client.post(
                self.url,
                {
                    "projectIds": [project.id],
                    "automatedRunStoppingPoint": "root_cause",
                },
            )
        assert response.status_code == 204
        assert project.get_option("sentry:seer_automated_run_stopping_point") == "root_cause"

    def test_post_rejects_projects_not_in_organization(self) -> None:
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

    def test_post_ignores_repo_mappings_not_in_project_ids(self):
        project1 = self.create_project(organization=self.organization)
        project2 = self.create_project(organization=self.organization)
        Repository.objects.create(
            organization_id=self.organization.id,
            name="test-org/test-repo",
            provider="github",
            external_id="12345",
        )

        repo_data = {
            "provider": "github",
            "owner": "test-org",
            "name": "test-repo",
            "externalId": "12345",
            "organizationId": self.organization.id,
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

        assert SeerProjectRepository.objects.filter(project=project1).count() == 1
        assert SeerProjectRepository.objects.filter(project=project2).count() == 0

    def test_post_updates_project_repo_mappings(self):
        project = self.create_project(organization=self.organization)
        repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="test-org/test-repo",
            provider="github",
            external_id="12345",
        )

        repo_data = {
            "provider": "github",
            "owner": "test-org",
            "name": "test-repo",
            "externalId": "12345",
            "organizationId": self.organization.id,
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
        assert (
            project.get_option("sentry:seer_automated_run_stopping_point")
            == AutofixStoppingPoint.OPEN_PR.value
        )

        seer_repos = list(SeerProjectRepository.objects.filter(project=project))
        assert len(seer_repos) == 1
        assert seer_repos[0].repository_id == repo.id

    def test_post_clears_repos_with_empty_list(self):
        project = self.create_project(organization=self.organization)
        existing_repo = self.create_repo(
            project=project,
            name="old-owner/old-repo",
            provider="github",
            external_id="old-111",
        )
        SeerProjectRepository.objects.create(project=project, repository=existing_repo)

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

        assert SeerProjectRepository.objects.filter(project=project).count() == 0

    def test_post_overwrites_existing_repos(self):
        project = self.create_project(organization=self.organization)
        existing_repo = self.create_repo(
            project=project,
            name="old-owner/old-repo",
            provider="github",
            external_id="111",
        )
        SeerProjectRepository.objects.create(project=project, repository=existing_repo)

        new_repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="new-owner/new-repo",
            provider="github",
            external_id="222",
        )

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
            },
        )
        assert response.status_code == 204

        seer_repos = list(SeerProjectRepository.objects.filter(project=project))
        assert len(seer_repos) == 1
        assert seer_repos[0].repository_id == new_repo.id

    def test_post_only_updates_projects_with_changes(self):
        project1 = self.create_project(organization=self.organization)
        project2 = self.create_project(organization=self.organization)
        existing_repo = self.create_repo(
            project=project2,
            name="test-org/existing-repo",
            provider="github",
            external_id="existing-id",
        )
        SeerProjectRepository.objects.create(project=project2, repository=existing_repo)

        Repository.objects.create(
            organization_id=self.organization.id,
            name="test-org/test-repo",
            provider="github",
            external_id="12345",
        )

        repo_data = {
            "provider": "github",
            "owner": "test-org",
            "name": "test-repo",
            "externalId": "12345",
            "organizationId": self.organization.id,
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

        # project1 got the new mapping; project2's existing repo is untouched.
        assert SeerProjectRepository.objects.filter(project=project1).count() == 1
        project2_repos = list(SeerProjectRepository.objects.filter(project=project2))
        assert len(project2_repos) == 1
        assert project2_repos[0].repository_id == existing_repo.id

    def test_post_appends_repos_when_append_flag_true(self):
        project = self.create_project(organization=self.organization)
        existing_repo = self.create_repo(
            project=project,
            name="existing-owner/existing-repo",
            provider="github",
            external_id="111",
        )
        SeerProjectRepository.objects.create(project=project, repository=existing_repo)
        new_repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="new-owner/new-repo",
            provider="github",
            external_id="222",
        )

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

        seer_repos = SeerProjectRepository.objects.filter(project=project).order_by("repository_id")
        assert [r.repository_id for r in seer_repos] == sorted([existing_repo.id, new_repo.id])

    def test_post_append_skips_duplicates(self):
        project = self.create_project(organization=self.organization)
        existing_repo = self.create_repo(
            project=project,
            name="existing-owner/existing-repo",
            provider="github",
            external_id="111",
        )
        SeerProjectRepository.objects.create(project=project, repository=existing_repo)
        new_repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="new-owner/new-repo",
            provider="github",
            external_id="222",
        )

        # Include a duplicate (same organization_id, provider, external_id) and a new repo
        duplicate_repo_data = {
            "provider": "github",
            "owner": "existing-owner",
            "name": "existing-repo",
            "externalId": "111",
            "organizationId": self.organization.id,
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
                    str(project.id): [duplicate_repo_data, new_repo_data],
                },
                "appendRepositories": True,
            },
        )
        assert response.status_code == 204

        # Should only have 2 repos: the existing one and the new one (duplicate skipped)
        seer_repos = SeerProjectRepository.objects.filter(project=project).order_by("repository_id")
        assert [r.repository_id for r in seer_repos] == sorted([existing_repo.id, new_repo.id])

    def test_post_creates_audit_log(self):
        project1 = self.create_project(organization=self.organization)
        project2 = self.create_project(organization=self.organization)

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

    def test_post_validates_repository_exists_in_organization(self):
        """Test that POST validates repositories exist in the organization"""
        project = self.create_project(organization=self.organization)
        repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="test-org/test-repo",
            provider="github",
            external_id="12345",
        )

        repo_data = {
            "provider": "github",
            "owner": "test-org",
            "name": "test-repo",
            "externalId": "12345",
            "organizationId": self.organization.id,
        }

        response = self.client.post(
            self.url,
            {
                "projectIds": [project.id],
                "projectRepoMappings": {
                    str(project.id): [repo_data],
                },
            },
        )
        assert response.status_code == 204
        seer_repos = list(SeerProjectRepository.objects.filter(project=project))
        assert len(seer_repos) == 1
        assert seer_repos[0].repository_id == repo.id

    def test_post_rejects_repository_not_in_organization(self):
        """Test that POST fails when repository doesn't exist in the organization"""
        project = self.create_project(organization=self.organization)

        repo_data = {
            "provider": "github",
            "owner": "test-org",
            "name": "test-repo",
            "externalId": "nonexistent-repo-id",
        }

        response = self.client.post(
            self.url,
            {
                "projectIds": [project.id],
                "projectRepoMappings": {
                    str(project.id): [repo_data],
                },
            },
        )
        assert response.status_code == 400
        assert response.data["detail"] == "Invalid repository"
        assert SeerProjectRepository.objects.filter(project=project).count() == 0

    def test_post_rejects_repository_from_different_organization(self):
        """Test that POST fails when repository exists but belongs to a different organization"""
        project = self.create_project(organization=self.organization)
        other_org = self.create_organization(owner=self.user)
        Repository.objects.create(
            organization_id=other_org.id,
            name="other-org/repo",
            provider="github",
            external_id="other-org-repo-id",
        )

        repo_data = {
            "provider": "github",
            "owner": "other-org",
            "name": "repo",
            "externalId": "other-org-repo-id",
        }

        response = self.client.post(
            self.url,
            {
                "projectIds": [project.id],
                "projectRepoMappings": {
                    str(project.id): [repo_data],
                },
            },
        )
        assert response.status_code == 400
        assert response.data["detail"] == "Invalid repository"
        assert SeerProjectRepository.objects.filter(project=project).count() == 0

    def test_post_rejects_mismatched_organization_id_in_repository_data(self):
        """Test that POST fails when repository organization_id doesn't match the organization."""
        project = self.create_project(organization=self.organization)
        other_org = self.create_organization(owner=self.user)
        Repository.objects.create(
            organization_id=self.organization.id,
            name="test-org/test-repo",
            provider="github",
            external_id="12345",
        )

        repo_data = {
            "provider": "github",
            "owner": "test-org",
            "name": "test-repo",
            "externalId": "12345",
            "organizationId": other_org.id,
        }

        response = self.client.post(
            self.url,
            {
                "projectIds": [project.id],
                "projectRepoMappings": {
                    str(project.id): [repo_data],
                },
            },
        )
        assert response.status_code == 400
        assert response.data["detail"] == "Invalid repository"
        assert SeerProjectRepository.objects.filter(project=project).count() == 0

    def test_post_rejects_mismatched_repo_name_or_owner(self):
        """Test that POST fails when repository name/owner don't match the database record."""
        project = self.create_project(organization=self.organization)
        Repository.objects.create(
            organization_id=self.organization.id,
            name="real-owner/real-repo",
            provider="github",
            external_id="12345",
        )

        repo_data = {
            "provider": "github",
            "owner": "injected-owner",
            "name": "injected-name",
            "externalId": "12345",
            "organizationId": self.organization.id,
        }

        response = self.client.post(
            self.url,
            {
                "projectIds": [project.id],
                "projectRepoMappings": {
                    str(project.id): [repo_data],
                },
            },
        )
        assert response.status_code == 400
        assert response.data["detail"] == "Invalid repository"
        assert SeerProjectRepository.objects.filter(project=project).count() == 0

    def test_post_rejects_unsupported_repo_provider(self):
        project = self.create_project(organization=self.organization)

        repo_data = {
            "provider": "gitlab",
            "owner": "test-org",
            "name": "test-repo",
            "externalId": "12345",
        }

        response = self.client.post(
            self.url,
            {
                "projectIds": [project.id],
                "projectRepoMappings": {
                    str(project.id): [repo_data],
                },
            },
        )
        assert response.status_code == 400
        assert SeerProjectRepository.objects.filter(project=project).count() == 0
