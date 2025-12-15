from __future__ import annotations

from sentry.constants import ObjectStatus
from sentry.models.repositorysettings import RepositorySettings
from sentry.seer.autofix.constants import AutofixAutomationTuningSettings
from sentry.seer.endpoints.organization_seer_onboarding_check import (
    has_supported_scm_integration,
    is_autofix_enabled,
    is_code_review_enabled,
)
from sentry.testutils.cases import APITestCase, TestCase


class TestHasSupportedScmIntegration(TestCase):
    """Unit tests for has_supported_scm_integration()"""

    def test_scm_integration(self) -> None:
        self.create_integration(
            organization=self.organization,
            provider="github",
            name="GitHub Test",
            external_id="123",
        )

        assert has_supported_scm_integration(self.organization.id)

    def test_scm_integration_github_enterprise(self) -> None:
        self.create_integration(
            organization=self.organization,
            provider="github_enterprise",
            name="GitHub Enterprise Test",
            external_id="456",
        )

        assert has_supported_scm_integration(self.organization.id)

    def test_no_integration(self) -> None:
        assert not has_supported_scm_integration(self.organization.id)

    def test_inactive_integration(self) -> None:
        self.create_integration(
            organization=self.organization,
            provider="github",
            name="GitHub Test",
            external_id="123",
            oi_params={"status": ObjectStatus.DISABLED},
        )

        assert not has_supported_scm_integration(self.organization.id)

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

        assert has_supported_scm_integration(org1.id)
        assert not has_supported_scm_integration(org2.id)


class TestIsCodeReviewEnabled(TestCase):
    """Unit tests for is_code_review_enabled()"""

    def test_code_review_enabled(self) -> None:
        repo = self.create_repo(project=self.project)

        RepositorySettings.objects.create(
            repository=repo,
            enabled_code_review=True,
        )

        assert is_code_review_enabled(self.organization.id)

    def test_code_review_disabled(self) -> None:
        repo = self.create_repo(project=self.project)

        RepositorySettings.objects.create(
            repository=repo,
            enabled_code_review=False,
        )

        assert not is_code_review_enabled(self.organization.id)

    def test_multiple_repositories(self) -> None:
        repo1 = self.create_repo(project=self.project)
        repo2 = self.create_repo(project=self.project)

        RepositorySettings.objects.create(
            repository=repo1,
            enabled_code_review=True,
        )

        RepositorySettings.objects.create(
            repository=repo2,
            enabled_code_review=False,
        )

        assert is_code_review_enabled(self.organization.id)

    def test_no_repositories(self) -> None:
        assert not is_code_review_enabled(self.organization.id)

    def test_inactive_repository(self) -> None:
        repo = self.create_repo(project=self.project)
        repo.status = ObjectStatus.DISABLED
        repo.save()

        RepositorySettings.objects.create(
            repository=repo,
            enabled_code_review=True,
        )

        assert not is_code_review_enabled(self.organization.id)

    def test_no_settings(self) -> None:
        self.create_repo(project=self.project)
        assert not is_code_review_enabled(self.organization.id)

    def test_multiple_organizations(self) -> None:
        org1 = self.organization
        org2 = self.create_organization()

        project1 = self.create_project(organization=org1)
        project2 = self.create_project(organization=org2)

        repo1 = self.create_repo(project=project1)
        repo2 = self.create_repo(project=project2)

        RepositorySettings.objects.create(
            repository=repo1,
            enabled_code_review=True,
        )

        RepositorySettings.objects.create(
            repository=repo2,
            enabled_code_review=False,
        )

        assert is_code_review_enabled(org1.id)
        assert not is_code_review_enabled(org2.id)


class TestIsAutofixEnabled(TestCase):
    """Unit tests for is_autofix_enabled()"""

    def test_no_option_set(self) -> None:
        assert not is_autofix_enabled(self.organization.id)

    def test_with_autofix_low(self) -> None:
        self.project.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.LOW.value
        )
        assert is_autofix_enabled(self.organization.id)

    def test_with_autofix_medium(self) -> None:
        self.project.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.MEDIUM.value
        )
        assert is_autofix_enabled(self.organization.id)

    def test_with_autofix_high(self) -> None:
        self.project.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.HIGH.value
        )
        assert is_autofix_enabled(self.organization.id)

    def test_with_autofix_off(self) -> None:
        self.project.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.OFF.value
        )
        assert not is_autofix_enabled(self.organization.id)

    def test_with_autofix_none(self) -> None:
        self.project.update_option("sentry:autofix_automation_tuning", None)
        assert not is_autofix_enabled(self.organization.id)

    def test_no_projects(self) -> None:
        org_without_projects = self.create_organization()
        assert not is_autofix_enabled(org_without_projects.id)

    def test_inactive_project(self) -> None:
        inactive_project = self.create_project(
            organization=self.organization, status=ObjectStatus.DISABLED
        )
        inactive_project.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.HIGH.value
        )

        assert not is_autofix_enabled(self.organization.id)

    def test_multiple_projects(self) -> None:
        project1 = self.create_project(organization=self.organization)
        project2 = self.create_project(organization=self.organization)
        project3 = self.create_project(organization=self.organization)

        project1.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.MEDIUM.value
        )
        project2.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.OFF.value
        )
        project3.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.OFF.value
        )

        assert is_autofix_enabled(self.organization.id)

    def test_multiple_organizations(self) -> None:
        org1 = self.organization
        org2 = self.create_organization()

        project1 = self.create_project(organization=org1)
        project2 = self.create_project(organization=org2)

        project1.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.HIGH.value
        )
        project2.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.OFF.value
        )

        assert is_autofix_enabled(org1.id)
        assert not is_autofix_enabled(org2.id)


class OrganizationSeerOnboardingCheckTest(APITestCase):
    """Integration tests for the GET endpoint"""

    endpoint = "sentry-api-0-organization-seer-onboarding-check"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

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
            "isSeerConfigured": False,
        }

    def test_all_configured(self) -> None:
        self.create_integration(
            organization=self.organization,
            provider="github",
            name="GitHub Test",
            external_id="123",
        )

        repo = self.create_repo(project=self.project)
        RepositorySettings.objects.create(
            repository=repo,
            enabled_code_review=True,
        )

        self.project.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.HIGH.value
        )

        response = self.get_response(self.organization.slug)

        assert response.status_code == 200
        assert response.data == {
            "hasSupportedScmIntegration": True,
            "isCodeReviewEnabled": True,
            "isAutofixEnabled": True,
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
            "isSeerConfigured": False,
        }

    def test_code_review_enabled_only(self) -> None:
        repo = self.create_repo(project=self.project)
        RepositorySettings.objects.create(
            repository=repo,
            enabled_code_review=True,
        )

        response = self.get_response(self.organization.slug)

        assert response.status_code == 200
        assert response.data == {
            "hasSupportedScmIntegration": False,
            "isCodeReviewEnabled": True,
            "isAutofixEnabled": False,
            "isSeerConfigured": False,
        }

    def test_autofix_enabled_only(self) -> None:
        self.project.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.HIGH.value
        )

        response = self.get_response(self.organization.slug)

        assert response.status_code == 200
        assert response.data == {
            "hasSupportedScmIntegration": False,
            "isCodeReviewEnabled": False,
            "isAutofixEnabled": True,
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
        RepositorySettings.objects.create(
            repository=repo,
            enabled_code_review=True,
        )

        response = self.get_response(self.organization.slug)

        assert response.status_code == 200
        assert response.data == {
            "hasSupportedScmIntegration": True,
            "isCodeReviewEnabled": True,
            "isAutofixEnabled": False,
            "isSeerConfigured": True,
        }

    def test_github_and_autofix_enabled(self) -> None:
        self.create_integration(
            organization=self.organization,
            provider="github",
            name="GitHub Test",
            external_id="123",
        )

        self.project.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.HIGH.value
        )

        response = self.get_response(self.organization.slug)

        assert response.status_code == 200
        assert response.data == {
            "hasSupportedScmIntegration": True,
            "isCodeReviewEnabled": False,
            "isAutofixEnabled": True,
            "isSeerConfigured": True,
        }

    def test_code_review_and_autofix_enabled(self) -> None:
        repo = self.create_repo(project=self.project)
        RepositorySettings.objects.create(
            repository=repo,
            enabled_code_review=True,
        )

        self.project.update_option(
            "sentry:autofix_automation_tuning", AutofixAutomationTuningSettings.HIGH.value
        )

        response = self.get_response(self.organization.slug)

        assert response.status_code == 200
        assert response.data == {
            "hasSupportedScmIntegration": False,
            "isCodeReviewEnabled": True,
            "isAutofixEnabled": True,
            "isSeerConfigured": False,
        }
