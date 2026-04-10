from unittest import mock

import pytest

from sentry.api.serializers import serialize
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.models.project import Project
from sentry.shared_integrations.exceptions import ApiError
from sentry.testutils.asserts import assert_existing_projects_status
from sentry.testutils.cases import AcceptanceTestCase
from sentry.testutils.silo import no_silo_test
from sentry.utils import json

pytestmark = pytest.mark.sentry_metrics


@no_silo_test
class ScmOnboardingTest(AcceptanceTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(name="Rowdy Tiger", owner=None)
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.member = self.create_member(
            user=self.user, organization=self.org, role="owner", teams=[self.team]
        )
        self.login_as(self.user)

    def create_github_integration(self) -> Integration:
        integration = self.create_provider_integration(
            provider="github",
            name="getsentry",
            external_id="12345",
            metadata={"access_token": "ghu_xxxxx"},
        )
        integration.add_organization(self.org, self.user)
        return integration

    def start_onboarding(self) -> None:
        self.browser.get(f"/onboarding/{self.org.slug}/")
        self.browser.wait_until('[data-test-id="onboarding-step-welcome"]')
        self.browser.click('[data-test-id="onboarding-welcome-start"]')
        self.browser.wait_until('[data-test-id="onboarding-step-scm-connect"]')

    def test_scm_onboarding_happy_path(self) -> None:
        """Full flow: welcome → connect repo → detected platform → create project."""
        self.create_github_integration()

        mock_repos = [
            {
                "name": "sentry",
                "identifier": "getsentry/sentry",
                "default_branch": "master",
                "external_id": "12345",
            },
        ]

        mock_platforms = [
            {
                "platform": "python-django",
                "language": "Python",
                "bytes": 50000,
                "confidence": "high",
                "priority": 1,
            }
        ]

        with (
            self.feature(
                {
                    "organizations:onboarding-scm-experiment": True,
                    "organizations:integrations-github-platform-detection": True,
                }
            ),
            mock.patch(
                "sentry.integrations.github.integration.GitHubIntegration.get_repositories",
                return_value=mock_repos,
            ),
            mock.patch(
                "sentry.integrations.github.repository.GitHubRepositoryProvider._validate_repo",
                return_value={"id": "12345"},
            ),
            mock.patch(
                "sentry.integrations.api.endpoints.organization_repository_platforms.detect_platforms",
                return_value=mock_platforms,
            ),
        ):
            self.start_onboarding()

            # SCM Connect: wait for integration to be detected, then search
            self.browser.wait_until(xpath='//*[contains(text(), "Connected to")]')
            # react-select renders a separate placeholder element, not an HTML
            # placeholder attribute, so target the input by its ARIA role.
            input_el = self.browser.element('input[aria-autocomplete="list"]')
            input_el.send_keys("sentry")
            self.browser.wait_until('[data-test-id="menu-list-item-label"]')
            self.browser.click('[data-test-id="menu-list-item-label"]')
            self.browser.wait_until_clickable(xpath='//button[contains(., "Continue")]')
            self.browser.click(xpath='//button[contains(., "Continue")]')

            # Platform Features: select detected platform, then continue
            self.browser.wait_until('[data-test-id="onboarding-step-scm-platform-features"]')
            self.browser.wait_until('[role="radio"]')
            self.browser.click('[role="radio"]')
            self.browser.click(xpath='//button[contains(., "Continue")]')

            # Project Details: defaults auto-fill from platform + team
            self.browser.wait_until('[data-test-id="onboarding-step-scm-project-details"]')
            self.browser.wait_until_clickable(xpath='//button[contains(., "Create project")]')
            self.browser.click(xpath='//button[contains(., "Create project")]')

            # Setup Docs: verify SDK heading renders, not just the step container
            self.browser.wait_until(xpath='//h2[text()="Configure Django SDK"]')

            project = Project.objects.get(organization=self.org)
            assert project.platform == "python-django"
            assert project.name == "python-django"
            assert project.slug == "python-django"
            assert_existing_projects_status(
                self.org, active_project_ids=[project.id], deleted_project_ids=[]
            )

    def test_scm_onboarding_skip_integration(self) -> None:
        """Skip flow: welcome → skip connect → manual platform → create project."""
        with self.feature({"organizations:onboarding-scm-experiment": True}):
            self.start_onboarding()

            # SCM Connect: skip
            self.browser.click(xpath='//button[contains(., "Skip for now")]')

            # Platform Features: manual picker
            self.browser.wait_until('[data-test-id="onboarding-step-scm-platform-features"]')
            self.browser.wait_until(xpath='//h3[text()="Select a platform"]')
            input_el = self.browser.element('input[aria-autocomplete="list"]')
            input_el.send_keys("React")
            self.browser.wait_until(
                xpath='//p[@data-test-id="menu-list-item-label"][text()="React"]'
            )
            self.browser.click(xpath='//p[@data-test-id="menu-list-item-label"][text()="React"]')
            self.browser.click(xpath='//button[contains(., "Continue")]')

            # Project Details: defaults auto-fill
            self.browser.wait_until('[data-test-id="onboarding-step-scm-project-details"]')
            self.browser.wait_until_clickable(xpath='//button[contains(., "Create project")]')
            self.browser.click(xpath='//button[contains(., "Create project")]')

            # Setup Docs
            self.browser.wait_until(xpath='//h2[text()="Configure React SDK"]')

            project = Project.objects.get(organization=self.org)
            assert project.platform == "javascript-react"
            assert project.name == "javascript-react"
            assert project.slug == "javascript-react"
            assert_existing_projects_status(
                self.org, active_project_ids=[project.id], deleted_project_ids=[]
            )

    def test_scm_onboarding_with_integration_install(self) -> None:
        """Install flow: welcome → install GitHub → repo search → detected platform → create project."""
        mock_repos = [
            {
                "name": "sentry",
                "identifier": "getsentry/sentry",
                "default_branch": "master",
                "external_id": "12345",
            },
        ]

        mock_platforms = [
            {
                "platform": "python-django",
                "language": "Python",
                "bytes": 50000,
                "confidence": "high",
                "priority": 1,
            }
        ]

        with (
            self.feature(
                {
                    "organizations:onboarding-scm-experiment": True,
                    "organizations:integrations-github-platform-detection": True,
                }
            ),
            mock.patch(
                "sentry.integrations.github.integration.GitHubIntegration.get_repositories",
                return_value=mock_repos,
            ),
            mock.patch(
                "sentry.integrations.github.repository.GitHubRepositoryProvider._validate_repo",
                return_value={"id": "12345"},
            ),
            mock.patch(
                "sentry.integrations.api.endpoints.organization_repository_platforms.detect_platforms",
                return_value=mock_platforms,
            ),
        ):
            self.start_onboarding()

            # SCM Connect: no integration installed, provider pills are shown.
            # Override window.open so that AddIntegration stores `window` as the
            # dialog reference.  When we later inject a postMessage from the same
            # window, `message.source === this.dialog` passes.
            self.browser.driver.execute_script(
                """
                window.__testOpenCalled = false;
                window.open = function() {
                    window.__testOpenCalled = true;
                    return window;
                };
                """
            )

            # Wait for the providers to load, then click Install GitHub.
            self.browser.wait_until(xpath='//button[contains(., "GitHub")]')
            self.browser.click(xpath='//button[contains(., "GitHub")]')
            assert self.browser.driver.execute_script("return window.__testOpenCalled")

            # Simulate the OAuth pipeline: create the integration in the DB,
            # then serialize it with the same code path as IntegrationPipeline._dialog_response
            # to avoid mock-drift between the test data and the real serializer.
            integration = self.create_github_integration()
            org_integration = OrganizationIntegration.objects.get(
                integration=integration, organization_id=self.org.id
            )
            # Resolve Django lazy objects (translations, datetimes) so
            # Selenium can JSON-serialize the data for execute_script.
            serialized = json.loads(json.dumps(serialize(org_integration, self.user)))
            self.browser.driver.execute_script(
                "window.postMessage(arguments[0], window.location.origin);",
                {"success": True, "data": serialized},
            )

            # Wait for the component to process the message and show connected state.
            self.browser.wait_until(xpath='//*[contains(text(), "Connected to")]')

            # Repo search (same flow as happy path from here on).
            input_el = self.browser.element('input[aria-autocomplete="list"]')
            input_el.send_keys("sentry")
            self.browser.wait_until('[data-test-id="menu-list-item-label"]')
            self.browser.click('[data-test-id="menu-list-item-label"]')
            self.browser.wait_until_clickable(xpath='//button[contains(., "Continue")]')
            self.browser.click(xpath='//button[contains(., "Continue")]')

            # Platform Features
            self.browser.wait_until('[data-test-id="onboarding-step-scm-platform-features"]')
            self.browser.wait_until('[role="radio"]')
            self.browser.click('[role="radio"]')
            self.browser.click(xpath='//button[contains(., "Continue")]')

            # Project Details
            self.browser.wait_until('[data-test-id="onboarding-step-scm-project-details"]')
            self.browser.wait_until_clickable(xpath='//button[contains(., "Create project")]')
            self.browser.click(xpath='//button[contains(., "Create project")]')

            # Setup Docs
            self.browser.wait_until(xpath='//h2[text()="Configure Django SDK"]')

            project = Project.objects.get(organization=self.org)
            assert project.platform == "python-django"
            assert project.name == "python-django"
            assert project.slug == "python-django"
            assert_existing_projects_status(
                self.org, active_project_ids=[project.id], deleted_project_ids=[]
            )

    def test_scm_onboarding_detection_error_falls_back_to_manual_picker(self) -> None:
        """When platform detection fails, user can still select a platform manually."""
        self.create_github_integration()

        mock_repos = [
            {
                "name": "sentry",
                "identifier": "getsentry/sentry",
                "default_branch": "master",
                "external_id": "12345",
            },
        ]

        with (
            self.feature(
                {
                    "organizations:onboarding-scm-experiment": True,
                    "organizations:integrations-github-platform-detection": True,
                }
            ),
            mock.patch(
                "sentry.integrations.github.integration.GitHubIntegration.get_repositories",
                return_value=mock_repos,
            ),
            mock.patch(
                "sentry.integrations.github.repository.GitHubRepositoryProvider._validate_repo",
                return_value={"id": "12345"},
            ),
            mock.patch(
                "sentry.integrations.api.endpoints.organization_repository_platforms.detect_platforms",
                side_effect=ApiError("GitHub API error"),
            ),
        ):
            self.start_onboarding()

            # SCM Connect: select a repo
            self.browser.wait_until(xpath='//*[contains(text(), "Connected to")]')
            input_el = self.browser.element('input[aria-autocomplete="list"]')
            input_el.send_keys("sentry")
            self.browser.wait_until('[data-test-id="menu-list-item-label"]')
            self.browser.click('[data-test-id="menu-list-item-label"]')
            self.browser.wait_until_clickable(xpath='//button[contains(., "Continue")]')
            self.browser.click(xpath='//button[contains(., "Continue")]')

            # Platform Features: detection failed, should show manual picker
            self.browser.wait_until('[data-test-id="onboarding-step-scm-platform-features"]')
            self.browser.wait_until(xpath='//h3[text()="Select a platform"]')
            input_el = self.browser.element('input[aria-autocomplete="list"]')
            input_el.send_keys("React")
            self.browser.wait_until(
                xpath='//p[@data-test-id="menu-list-item-label"][text()="React"]'
            )
            self.browser.click(xpath='//p[@data-test-id="menu-list-item-label"][text()="React"]')
            self.browser.click(xpath='//button[contains(., "Continue")]')

            # Project Details
            self.browser.wait_until('[data-test-id="onboarding-step-scm-project-details"]')
            self.browser.wait_until_clickable(xpath='//button[contains(., "Create project")]')
            self.browser.click(xpath='//button[contains(., "Create project")]')

            # Setup Docs
            self.browser.wait_until(xpath='//h2[text()="Configure React SDK"]')

            project = Project.objects.get(organization=self.org)
            assert project.platform == "javascript-react"
            assert project.name == "javascript-react"
            assert project.slug == "javascript-react"
            assert_existing_projects_status(
                self.org, active_project_ids=[project.id], deleted_project_ids=[]
            )

    def test_scm_onboarding_repo_search_no_results(self) -> None:
        """Empty search results show a helpful message about permissions."""
        self.create_github_integration()

        with (
            self.feature({"organizations:onboarding-scm-experiment": True}),
            mock.patch(
                "sentry.integrations.github.integration.GitHubIntegration.get_repositories",
                return_value=[],
            ),
        ):
            self.start_onboarding()

            # SCM Connect: integration detected, search returns no results
            self.browser.wait_until(xpath='//*[contains(text(), "Connected to")]')
            input_el = self.browser.element('input[aria-autocomplete="list"]')
            input_el.send_keys("nonexistent-repo")
            self.browser.wait_until(xpath='//*[contains(text(), "No repositories found")]')
