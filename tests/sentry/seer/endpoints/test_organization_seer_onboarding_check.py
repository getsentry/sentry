from __future__ import annotations

from sentry.constants import ObjectStatus
from sentry.seer.endpoints.organization_seer_onboarding_check import (
    has_supported_scm_integration,
    is_autofix_enabled,
    is_code_review_enabled,
)
from sentry.seer.models.project_repository import SeerProjectRepository
from sentry.testutils.cases import APITestCase, TestCase
from sentry.testutils.helpers.features import with_feature


class TestHasSupportedScmIntegration(TestCase):
    """Unit tests for has_supported_scm_integration()"""

    def test_scm_integration(self) -> None:
        self.create_integration(
            organization=self.organization,
            provider="github",
            name="GitHub Test",
            external_id="123",
        )

        assert has_supported_scm_integration(self.organization)

    def test_scm_integration_github_enterprise(self) -> None:
        self.create_integration(
            organization=self.organization,
            provider="github_enterprise",
            name="GitHub Enterprise Test",
            external_id="456",
        )

        assert has_supported_scm_integration(self.organization)

    def test_no_integration(self) -> None:
        assert not has_supported_scm_integration(self.organization)

    def test_inactive_integration(self) -> None:
        self.create_integration(
            organization=self.organization,
            provider="github",
            name="GitHub Test",
            external_id="123",
            oi_params={"status": ObjectStatus.DISABLED},
        )

        assert not has_supported_scm_integration(self.organization)

    def test_multiple_organizations(self) -> None:
        org1 = self.organization
        org2 = self.create_organization()

        # Create GitHub integration for org1 only
        self.create_integration(
            organization=org1,
            provider="github",
            name="GitHub Test",
            external_id="123",
        )

        assert has_supported_scm_integration(org1)
        assert not has_supported_scm_integration(org2)

    @with_feature("organizations:seer-gitlab-support")
    def test_gitlab_integration_with_feature_flag(self) -> None:
        self.create_integration(
            organization=self.organization,
            provider="gitlab",
            name="GitLab Test",
            external_id="789",
        )

        assert has_supported_scm_integration(self.organization)

    @with_feature("organizations:seer-gitlab-support")
    def test_no_integration_with_gitlab_feature_flag(self) -> None:
        assert not has_supported_scm_integration(self.organization)

    def test_gitlab_integration_without_feature_flag(self) -> None:
        # GitLab should not count as a supported SCM without the feature flag
        self.create_integration(
            organization=self.organization,
            provider="gitlab",
            name="GitLab Test",
            external_id="789",
        )

        assert not has_supported_scm_integration(self.organization)


class TestIsCodeReviewEnabled(TestCase):
    """Unit tests for is_code_review_enabled()"""

    def test_code_review_enabled(self) -> None:
        repo = self.create_repo(project=self.project)

        self.create_repository_settings(
            repository=repo,
            enabled_code_review=True,
        )

        assert is_code_review_enabled(self.organization)

    def test_code_review_disabled(self) -> None:
        repo = self.create_repo(project=self.project)

        self.create_repository_settings(
            repository=repo,
            enabled_code_review=False,
        )

        assert not is_code_review_enabled(self.organization)

    def test_multiple_repositories(self) -> None:
        repo1 = self.create_repo(project=self.project)
        repo2 = self.create_repo(project=self.project)

        self.create_repository_settings(
            repository=repo1,
            enabled_code_review=True,
        )

        self.create_repository_settings(
            repository=repo2,
            enabled_code_review=False,
        )

        assert is_code_review_enabled(self.organization)

    def test_no_repositories(self) -> None:
        assert not is_code_review_enabled(self.organization)

    def test_inactive_repository(self) -> None:
        repo = self.create_repo(project=self.project)
        repo.status = ObjectStatus.DISABLED
        repo.save()

        self.create_repository_settings(
            repository=repo,
            enabled_code_review=True,
        )

        assert not is_code_review_enabled(self.organization)

    def test_no_settings(self) -> None:
        self.create_repo(project=self.project)
        assert not is_code_review_enabled(self.organization)

    def test_multiple_organizations(self) -> None:
        org1 = self.organization
        org2 = self.create_organization()

        project1 = self.create_project(organization=org1)
        project2 = self.create_project(organization=org2)

        repo1 = self.create_repo(project=project1)
        repo2 = self.create_repo(project=project2)

        self.create_repository_settings(
            repository=repo1,
            enabled_code_review=True,
        )

        self.create_repository_settings(
            repository=repo2,
            enabled_code_review=False,
        )

        assert is_code_review_enabled(org1)
        assert not is_code_review_enabled(org2)


class TestIsAutofixEnabled(TestCase):
    """Unit tests for is_autofix_enabled()"""

    def setUp(self) -> None:
        super().setUp()
        self.project = self.create_project(organization=self.organization)

    def test_no_repositories(self) -> None:
        assert not is_autofix_enabled(self.organization)

    def test_with_repository(self) -> None:
        repo = self.create_repo(project=self.project)
        SeerProjectRepository.objects.create(project=self.project, repository=repo)

        assert is_autofix_enabled(self.organization)

    def test_inactive_repository(self) -> None:
        repo = self.create_repo(project=self.project)
        SeerProjectRepository.objects.create(project=self.project, repository=repo)
        repo.status = ObjectStatus.DISABLED
        repo.save()

        assert not is_autofix_enabled(self.organization)

    def test_no_projects(self) -> None:
        repo = self.create_repo(project=self.project)
        SeerProjectRepository.objects.create(project=self.project, repository=repo)

        org_without_projects = self.create_organization()

        assert not is_autofix_enabled(org_without_projects)

    def test_inactive_project(self) -> None:
        inactive_project = self.create_project(
            organization=self.organization, status=ObjectStatus.DISABLED
        )
        repo = self.create_repo(project=inactive_project)
        SeerProjectRepository.objects.create(project=inactive_project, repository=repo)

        assert not is_autofix_enabled(self.organization)

    def test_multiple_projects(self) -> None:
        project1 = self.create_project(organization=self.organization)
        self.create_project(organization=self.organization)

        repo = self.create_repo(project=project1)
        SeerProjectRepository.objects.create(project=project1, repository=repo)

        assert is_autofix_enabled(self.organization)

    def test_multiple_organizations(self) -> None:
        org2 = self.create_organization()

        project1 = self.create_project(organization=self.organization)
        self.create_project(organization=org2)

        repo = self.create_repo(project=project1)
        SeerProjectRepository.objects.create(project=project1, repository=repo)

        assert is_autofix_enabled(self.organization)
        assert not is_autofix_enabled(org2)


class OrganizationSeerOnboardingCheckTest(APITestCase):
    """Integration tests for the GET endpoint"""

    endpoint = "sentry-api-0-organization-seer-onboarding-check"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.project = self.create_project(organization=self.organization)

    def get_response(self, organization_slug, **kwargs):
        url = f"/api/0/organizations/{organization_slug}/seer/onboarding-check/"
        return self.client.get(url, format="json", **kwargs)

    def test_nothing_configured(self) -> None:
        response = self.get_response(self.organization.slug)

        assert response.status_code == 200
        assert response.data == {
            "hasSupportedScmIntegration": False,
            "isCodeReviewEnabled": False,
            "isAutofixEnabled": False,
            "needsConfigReminder": False,
            "isSeerConfigured": False,
        }

    def test_all_configured(self) -> None:
        autofix_repo = self.create_repo(project=self.project)
        SeerProjectRepository.objects.create(project=self.project, repository=autofix_repo)

        self.create_integration(
            organization=self.organization,
            provider="github",
            name="GitHub Test",
            external_id="123",
        )

        code_review_repo = self.create_repo(project=self.project)
        self.create_repository_settings(
            repository=code_review_repo,
            enabled_code_review=True,
        )

        response = self.get_response(self.organization.slug)

        assert response.status_code == 200
        assert response.data == {
            "hasSupportedScmIntegration": True,
            "isCodeReviewEnabled": True,
            "isAutofixEnabled": True,
            "needsConfigReminder": False,
            "isSeerConfigured": True,
        }

    def test_github_integration_only(self) -> None:
        self.create_integration(
            organization=self.organization,
            provider="github",
            name="GitHub Test",
            external_id="123",
        )

        response = self.get_response(self.organization.slug)

        assert response.status_code == 200
        assert response.data == {
            "hasSupportedScmIntegration": True,
            "isCodeReviewEnabled": False,
            "isAutofixEnabled": False,
            "needsConfigReminder": False,
            "isSeerConfigured": False,
        }

    def test_code_review_enabled_only(self) -> None:
        repo = self.create_repo(project=self.project)
        self.create_repository_settings(
            repository=repo,
            enabled_code_review=True,
        )

        response = self.get_response(self.organization.slug)

        assert response.status_code == 200
        assert response.data == {
            "hasSupportedScmIntegration": False,
            "isCodeReviewEnabled": True,
            "isAutofixEnabled": False,
            "needsConfigReminder": False,
            "isSeerConfigured": False,
        }

    def test_autofix_enabled_only(self) -> None:
        repo = self.create_repo(project=self.project)
        SeerProjectRepository.objects.create(project=self.project, repository=repo)

        response = self.get_response(self.organization.slug)

        assert response.status_code == 200
        assert response.data == {
            "hasSupportedScmIntegration": False,
            "isCodeReviewEnabled": False,
            "isAutofixEnabled": True,
            "needsConfigReminder": False,
            "isSeerConfigured": False,
        }

    def test_github_and_code_review_enabled(self) -> None:
        self.create_integration(
            organization=self.organization,
            provider="github",
            name="GitHub Test",
            external_id="123",
        )

        repo = self.create_repo(project=self.project)
        self.create_repository_settings(
            repository=repo,
            enabled_code_review=True,
        )

        response = self.get_response(self.organization.slug)

        assert response.status_code == 200
        assert response.data == {
            "hasSupportedScmIntegration": True,
            "isCodeReviewEnabled": True,
            "isAutofixEnabled": False,
            "needsConfigReminder": False,
            "isSeerConfigured": True,
        }

    def test_github_and_autofix_enabled(self) -> None:
        repo = self.create_repo(project=self.project)
        SeerProjectRepository.objects.create(project=self.project, repository=repo)

        self.create_integration(
            organization=self.organization,
            provider="github",
            name="GitHub Test",
            external_id="123",
        )

        response = self.get_response(self.organization.slug)

        assert response.status_code == 200
        assert response.data == {
            "hasSupportedScmIntegration": True,
            "isCodeReviewEnabled": False,
            "isAutofixEnabled": True,
            "needsConfigReminder": False,
            "isSeerConfigured": True,
        }

    def test_code_review_and_autofix_enabled(self) -> None:
        autofix_repo = self.create_repo(project=self.project)
        SeerProjectRepository.objects.create(project=self.project, repository=autofix_repo)

        code_review_repo = self.create_repo(project=self.project)
        self.create_repository_settings(
            repository=code_review_repo,
            enabled_code_review=True,
        )

        response = self.get_response(self.organization.slug)

        assert response.status_code == 200
        assert response.data == {
            "hasSupportedScmIntegration": False,
            "isCodeReviewEnabled": True,
            "isAutofixEnabled": True,
            "needsConfigReminder": False,
            "isSeerConfigured": False,
        }

    def test_needs_config_reminder_forces_configured(self) -> None:
        """When org is in force-config-reminder list, needsConfigReminder is True but isSeerConfigured follows normal logic."""
        with self.options({"seer.organizations.force-config-reminder": [self.organization.slug]}):
            response = self.get_response(self.organization.slug)

            assert response.status_code == 200
            assert response.data == {
                "hasSupportedScmIntegration": False,
                "isCodeReviewEnabled": False,
                "isAutofixEnabled": False,
                "needsConfigReminder": True,
                "isSeerConfigured": False,
            }

    def test_needs_config_reminder_with_scm_integration(self) -> None:
        """When org is in config reminder list with SCM integration but no code review/autofix, isSeerConfigured is False."""
        self.create_integration(
            organization=self.organization,
            provider="github",
            name="GitHub Test",
            external_id="123",
        )

        with self.options({"seer.organizations.force-config-reminder": [self.organization.slug]}):
            response = self.get_response(self.organization.slug)

            assert response.status_code == 200
            assert response.data == {
                "hasSupportedScmIntegration": True,
                "isCodeReviewEnabled": False,
                "isAutofixEnabled": False,
                "needsConfigReminder": True,
                "isSeerConfigured": False,
            }

    def test_not_in_config_reminder_list(self) -> None:
        """When org is not in config reminder list, isSeerConfigured follows normal logic."""
        with self.options({"seer.organizations.force-config-reminder": ["other-org"]}):
            response = self.get_response(self.organization.slug)

            assert response.status_code == 200
            assert response.data == {
                "hasSupportedScmIntegration": False,
                "isCodeReviewEnabled": False,
                "isAutofixEnabled": False,
                "needsConfigReminder": False,
                "isSeerConfigured": False,
            }

    def test_config_reminder_with_complete_setup(self) -> None:
        """Config reminder flag is independent of isSeerConfigured logic."""
        self.create_integration(
            organization=self.organization,
            provider="github",
            name="GitHub Test",
            external_id="123",
        )

        repo = self.create_repo(project=self.project)
        self.create_repository_settings(
            repository=repo,
            enabled_code_review=True,
        )

        with self.options({"seer.organizations.force-config-reminder": [self.organization.slug]}):
            response = self.get_response(self.organization.slug)

            assert response.status_code == 200
            # needsConfigReminder is independent - it can be True even when configured
            assert response.data["needsConfigReminder"] is True
            assert response.data["isSeerConfigured"] is True
