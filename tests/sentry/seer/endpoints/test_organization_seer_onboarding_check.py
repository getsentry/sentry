from __future__ import annotations

from typing import Any

from rest_framework.response import Response

from sentry.constants import ObjectStatus
from sentry.models.project import Project
from sentry.models.repository import Repository
from sentry.seer.endpoints.organization_seer_onboarding_check import (
    has_code_review_access,
    has_supported_scm_integration,
    is_autofix_enabled,
    is_code_review_enabled,
)
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

    def test_gitlab_integration(self) -> None:
        self.create_integration(
            organization=self.organization,
            provider="gitlab",
            name="GitLab Test",
            external_id="789",
        )

        assert has_supported_scm_integration(self.organization)

    def test_cursor_origin_integration_needs_the_feature_flag(self) -> None:
        self.create_integration(
            organization=self.organization,
            provider="cursor_origin",
            name="acme",
            external_id="inst_01example",
        )

        assert not has_supported_scm_integration(self.organization)
        with self.feature("organizations:seer-cursor-origin-support"):
            assert has_supported_scm_integration(self.organization)


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


class TestHasCodeReviewAccess(TestCase):
    """Unit tests for has_code_review_access()"""

    def test_no_access(self) -> None:
        assert not has_code_review_access(self.organization)

    @with_feature("organizations:seat-based-seer-enabled")
    def test_seat_based_seer(self) -> None:
        assert has_code_review_access(self.organization)

    @with_feature("organizations:code-review-beta")
    def test_code_review_beta(self) -> None:
        assert has_code_review_access(self.organization)


class TestIsAutofixEnabled(TestCase):
    """Unit tests for is_autofix_enabled()"""

    def setUp(self) -> None:
        super().setUp()
        self.project = self.create_project(organization=self.organization)

    def test_no_repositories(self) -> None:
        assert not is_autofix_enabled(self.organization)

    def test_with_repository(self) -> None:
        repo = self.create_repo(project=self.project)
        self.create_seer_project_repository(project=self.project, repository=repo)

        assert is_autofix_enabled(self.organization)

    def test_inactive_repository(self) -> None:
        repo = self.create_repo(project=self.project)
        self.create_seer_project_repository(project=self.project, repository=repo)
        repo.status = ObjectStatus.DISABLED
        repo.save()

        assert not is_autofix_enabled(self.organization)

    def test_no_projects(self) -> None:
        repo = self.create_repo(project=self.project)
        self.create_seer_project_repository(project=self.project, repository=repo)

        org_without_projects = self.create_organization()

        assert not is_autofix_enabled(org_without_projects)

    def test_inactive_project(self) -> None:
        inactive_project = self.create_project(
            organization=self.organization, status=ObjectStatus.DISABLED
        )
        repo = self.create_repo(project=inactive_project)
        self.create_seer_project_repository(project=inactive_project, repository=repo)

        assert not is_autofix_enabled(self.organization)

    def test_linked_repo_without_seer_config(self) -> None:
        repo = self.create_repo(project=self.project)
        self.create_project_repository(project=self.project, repository=repo)

        assert not is_autofix_enabled(self.organization)

    def test_multiple_projects(self) -> None:
        project1 = self.create_project(organization=self.organization)
        self.create_project(organization=self.organization)

        repo = self.create_repo(project=project1)
        self.create_seer_project_repository(project=project1, repository=repo)

        assert is_autofix_enabled(self.organization)

    def test_multiple_organizations(self) -> None:
        org2 = self.create_organization()

        project1 = self.create_project(organization=self.organization)
        self.create_project(organization=org2)

        repo = self.create_repo(project=project1)
        self.create_seer_project_repository(project=project1, repository=repo)

        assert is_autofix_enabled(self.organization)
        assert not is_autofix_enabled(org2)


@with_feature(
    {
        "organizations:seer-token-based-billing-onboarding": True,
        "organizations:token-billed-seer-enabled": True,
    }
)
class TestIsAutofixEnabledTokenBasedBilling(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization, provider="github", external_id="ext123"
        )

    def create_linked_repo(self, project: Project) -> Repository:
        repo = self.create_repo(
            project=project,
            name="getsentry/sentry",
            provider="integrations:github",
            external_id="111",
            integration_id=self.integration.id,
        )
        self.create_project_repository(project=project, repository=repo)
        return repo

    def test_no_repositories(self) -> None:
        assert not is_autofix_enabled(self.organization)

    def test_linked_repo_without_seer_config(self) -> None:
        self.create_linked_repo(self.project)

        assert is_autofix_enabled(self.organization)

    def test_inactive_repository(self) -> None:
        repo = self.create_linked_repo(self.project)
        repo.status = ObjectStatus.DISABLED
        repo.save()

        assert not is_autofix_enabled(self.organization)

    def test_repository_without_integration(self) -> None:
        repo = self.create_linked_repo(self.project)
        repo.integration_id = None
        repo.save()

        assert not is_autofix_enabled(self.organization)

    def test_inactive_project(self) -> None:
        inactive_project = self.create_project(
            organization=self.organization, status=ObjectStatus.DISABLED
        )
        self.create_linked_repo(inactive_project)

        assert not is_autofix_enabled(self.organization)

    def test_multiple_organizations(self) -> None:
        org2 = self.create_organization()
        self.create_project(organization=org2)
        self.create_linked_repo(self.project)

        assert is_autofix_enabled(self.organization)
        assert not is_autofix_enabled(org2)


class OrganizationSeerOnboardingCheckTest(APITestCase):
    """Integration tests for the GET endpoint"""

    endpoint = "sentry-api-0-organization-seer-onboarding-check"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.project = self.create_project(organization=self.organization)

    def get_response(self, organization_slug: str, **kwargs: Any) -> Response:
        url = f"/api/0/organizations/{organization_slug}/seer/onboarding-check/"
        response: Response[Any] = self.client.get(url, format="json", **kwargs)
        return response

    def create_github_integration(self) -> None:
        self.create_integration(
            organization=self.organization,
            provider="github",
            name="GitHub Test",
            external_id="123",
        )

    def test_nothing_configured(self) -> None:
        response = self.get_response(self.organization.slug)

        assert response.status_code == 200
        assert response.data == {
            "hasSupportedScmIntegration": False,
            "isAutofixEnabled": False,
            "isSeerConfigured": False,
        }

    def test_github_integration_only(self) -> None:
        self.create_github_integration()

        response = self.get_response(self.organization.slug)

        assert response.status_code == 200
        assert response.data == {
            "hasSupportedScmIntegration": True,
            "isAutofixEnabled": False,
            "isSeerConfigured": False,
        }

    def test_autofix_enabled_only(self) -> None:
        repo = self.create_repo(project=self.project)
        self.create_seer_project_repository(project=self.project, repository=repo)

        response = self.get_response(self.organization.slug)

        assert response.status_code == 200
        assert response.data == {
            "hasSupportedScmIntegration": False,
            "isAutofixEnabled": True,
            "isSeerConfigured": False,
        }

    def test_github_and_autofix_enabled(self) -> None:
        repo = self.create_repo(project=self.project)
        self.create_seer_project_repository(project=self.project, repository=repo)
        self.create_github_integration()

        response = self.get_response(self.organization.slug)

        assert response.status_code == 200
        assert response.data == {
            "hasSupportedScmIntegration": True,
            "isAutofixEnabled": True,
            "isSeerConfigured": True,
        }

    def create_code_review_repo(self) -> None:
        repo = self.create_repo(project=self.project)
        self.create_repository_settings(repository=repo, enabled_code_review=True)

    def test_code_review_without_access_does_not_configure_seer(self) -> None:
        self.create_github_integration()
        self.create_code_review_repo()

        response = self.get_response(self.organization.slug)

        assert response.status_code == 200
        assert response.data == {
            "hasSupportedScmIntegration": True,
            "isAutofixEnabled": False,
            "isSeerConfigured": False,
        }

    @with_feature("organizations:seat-based-seer-enabled")
    def test_code_review_configures_seer_for_seat_based_org(self) -> None:
        self.create_github_integration()
        self.create_code_review_repo()

        response = self.get_response(self.organization.slug)

        assert response.status_code == 200
        assert response.data == {
            "hasSupportedScmIntegration": True,
            "isAutofixEnabled": False,
            "isSeerConfigured": True,
        }

    @with_feature("organizations:code-review-beta")
    def test_code_review_configures_seer_for_code_review_beta_org(self) -> None:
        self.create_github_integration()
        self.create_code_review_repo()

        response = self.get_response(self.organization.slug)

        assert response.status_code == 200
        assert response.data == {
            "hasSupportedScmIntegration": True,
            "isAutofixEnabled": False,
            "isSeerConfigured": True,
        }
