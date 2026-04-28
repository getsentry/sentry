from collections.abc import Generator
from contextlib import contextmanager
from unittest import mock

import pytest
from django.utils import timezone

from sentry.integrations.github.integration import GitHubOAuthLoginResult
from sentry.integrations.models.integration import Integration
from sentry.models.project import Project
from sentry.models.rule import Rule
from sentry.shared_integrations.exceptions import ApiError
from sentry.testutils.asserts import assert_existing_projects_status
from sentry.testutils.cases import AcceptanceTestCase
from sentry.testutils.silo import no_silo_test

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

    @contextmanager
    def projects_born_active(self) -> Generator[None]:
        """Mark newly-created Projects as active so useRecentCreatedProject sees
        isProjectActive=true on the first render of setup-docs.

        Without this, tests must write first_event after setup-docs mounts, then
        wait for the hook's 1s poll to observe it — racing the test's click on
        Back. Mutating the returned instance lets ProjectSummarySerializer
        surface firstEvent in the create response, so the frontend never sees
        the inactive state.
        """
        original_create = Project.objects.create

        def create_active(*args: object, **kwargs: object) -> Project:
            project = original_create(*args, **kwargs)
            now = timezone.now()
            Project.objects.filter(id=project.id).update(first_event=now)
            project.first_event = now
            return project

        with mock.patch.object(Project.objects, "create", side_effect=create_active):
            yield

    def skip_to_setup_docs(self, platform_search: str, platform_label: str) -> None:
        """Drive through the skip flow to setup-docs: skip connect → pick platform → create project."""
        self.browser.click(xpath='//button[contains(., "Skip for now")]')

        self.browser.wait_until('[data-test-id="onboarding-step-scm-platform-features"]')
        self.browser.wait_until(xpath='//h3[text()="Select a platform"]')
        input_el = self.browser.element('input[aria-autocomplete="list"]')
        input_el.send_keys(platform_search)
        self.browser.wait_until(
            xpath=f'//p[@data-test-id="menu-list-item-label"][text()="{platform_label}"]'
        )
        self.browser.click(
            xpath=f'//p[@data-test-id="menu-list-item-label"][text()="{platform_label}"]'
        )
        self.browser.click(xpath='//button[contains(., "Continue")]')

        self.browser.wait_until('[data-test-id="onboarding-step-scm-project-details"]')
        self.browser.wait_until_clickable(xpath='//button[contains(., "Create project")]')
        self.browser.click(xpath='//button[contains(., "Create project")]')

    def skip_to_setup_docs_control(self, platform_search: str, platform_label: str) -> None:
        """Control-path variant: Continue on platform features auto-creates the project."""
        self.browser.click(xpath='//button[contains(., "Skip for now")]')

        self.browser.wait_until('[data-test-id="onboarding-step-scm-platform-features"]')
        self.browser.wait_until(xpath='//h3[text()="Select a platform"]')
        input_el = self.browser.element('input[aria-autocomplete="list"]')
        input_el.send_keys(platform_search)
        self.browser.wait_until(
            xpath=f'//p[@data-test-id="menu-list-item-label"][text()="{platform_label}"]'
        )
        self.browser.click(
            xpath=f'//p[@data-test-id="menu-list-item-label"][text()="{platform_label}"]'
        )
        self.browser.wait_until_clickable(xpath='//button[contains(., "Continue")]')
        self.browser.click(xpath='//button[contains(., "Continue")]')

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
                    "organizations:onboarding-scm-project-details-experiment": True,
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
        with self.feature(
            {
                "organizations:onboarding-scm-experiment": True,
                "organizations:onboarding-scm-project-details-experiment": True,
            }
        ):
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

    def test_scm_onboarding_header_skip_onboarding(self) -> None:
        """Header skip on scm-platform-features navigates to issues with step-specific referrer."""
        with self.feature({"organizations:onboarding-scm-experiment": True}):
            self.start_onboarding()

            # SCM Connect: skip for now to advance to platform features
            self.browser.click(xpath='//button[contains(., "Skip for now")]')
            self.browser.wait_until('[data-test-id="onboarding-step-scm-platform-features"]')

            # Click the header "Skip setup" button
            self.browser.click(xpath='//a[contains(., "Skip setup")]')

            # Navigation leaves the onboarding step and carries the step-specific referrer
            self.browser.wait_until_not('[data-test-id="onboarding-step-scm-platform-features"]')
            assert "onboarding-scm-platform-features-skip" in self.browser.current_url

    def test_scm_onboarding_with_integration_install(self) -> None:
        """Install flow: welcome → install GitHub via API pipeline → repo search → detected platform → create project."""
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

        mock_installation_response = {
            "id": "12345",
            "app_id": "1",
            "account": {
                "login": "getsentry",
                "avatar_url": "https://example.com/avatar.png",
                "html_url": "https://github.com/getsentry",
                "type": "Organization",
                "id": 67890,
            },
        }

        with (
            self.feature(
                {
                    "organizations:onboarding-scm-experiment": True,
                    "organizations:onboarding-scm-project-details-experiment": True,
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
            mock.patch(
                "sentry.integrations.github.integration.exchange_github_oauth",
                return_value=GitHubOAuthLoginResult(
                    authenticated_user="testuser",
                    installation_info=[],
                ),
            ),
            mock.patch(
                "sentry.integrations.github.integration.GitHubIntegrationProvider.get_installation_info",
                return_value=mock_installation_response,
            ),
        ):
            self.start_onboarding()

            # SCM Connect: no integration installed, provider pills are shown.
            # Override window.open so the pipeline popup steps (OAuth and app
            # install) return `window` as the popup reference. This lets us
            # inject postMessage from the same window and pass the
            # `event.source === popupRef.current` check.
            self.browser.driver.execute_script(
                """
                window.__testOpenUrl = null;
                window.open = function(url) {
                    window.__testOpenUrl = url;
                    return window;
                };
                """
            )

            # Wait for the providers to load, then click Install GitHub.
            # This opens the API-driven pipeline modal (not a popup).
            self.browser.wait_until(xpath='//button[contains(., "GitHub")]')
            self.browser.click(xpath='//button[contains(., "GitHub")]')

            # Step 1: OAuth Login — the modal shows "Authorize GitHub".
            self.browser.wait_until(xpath='//button[contains(., "Authorize GitHub")]')
            self.browser.click(xpath='//button[contains(., "Authorize GitHub")]')

            # The OAuth popup was intercepted. Extract the state parameter from
            # the captured URL and send a postMessage callback.
            oauth_url = self.browser.driver.execute_script("return window.__testOpenUrl")
            assert oauth_url is not None
            state = dict(pair.split("=") for pair in oauth_url.split("?")[1].split("&")).get(
                "state", ""
            )
            self.browser.driver.execute_script(
                "window.postMessage(arguments[0], window.location.origin);",
                {
                    "_pipeline_source": "sentry-pipeline",
                    "code": "fake_oauth_code",
                    "state": state,
                },
            )

            # Step 2: Org Selection — fresh install, shows "Install GitHub App".
            self.browser.wait_until(xpath='//button[contains(., "Install GitHub App")]')
            self.browser.driver.execute_script("window.__testOpenUrl = null;")
            self.browser.click(xpath='//button[contains(., "Install GitHub App")]')

            # The install popup was intercepted. Send a postMessage callback
            # with the installation_id. The backend validates and completes
            # the pipeline, creating the integration.
            self.browser.driver.execute_script(
                "window.postMessage(arguments[0], window.location.origin);",
                {
                    "_pipeline_source": "sentry-pipeline",
                    "installation_id": "12345",
                },
            )

            # Wait for the pipeline modal to close and the connected state.
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
                    "organizations:onboarding-scm-project-details-experiment": True,
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

    def test_scm_back_from_setup_docs_non_active_project(self) -> None:
        """Non-active project is deleted on back-nav; re-creating produces a fresh project."""
        with self.feature(
            {
                "organizations:onboarding-scm-experiment": True,
                "organizations:onboarding-scm-project-details-experiment": True,
            }
        ):
            self.start_onboarding()
            self.skip_to_setup_docs("React", "React")

            self.browser.wait_until(xpath='//h2[text()="Configure React SDK"]')
            project1 = Project.objects.get(organization=self.org)
            assert project1.platform == "javascript-react"

            # Navigate back — project has no events, so useBackActions deletes it.
            self.browser.click('[aria-label="Back"]')
            self.browser.wait_until('[data-test-id="onboarding-step-scm-project-details"]')
            self.browser.wait_until_clickable(xpath='//button[contains(., "Create project")]')
            self.browser.click(xpath='//button[contains(., "Create project")]')

            self.browser.wait_until(xpath='//h2[text()="Configure React SDK"]')
            project2 = Project.objects.get(organization=self.org, slug="javascript-react", status=0)
            assert project2.id != project1.id
            assert_existing_projects_status(
                self.org,
                active_project_ids=[project2.id],
                deleted_project_ids=[project1.id],
            )

    def test_scm_back_from_setup_docs_active_project_no_changes(self) -> None:
        """Active project survives back-nav; clicking Create again reuses it (no duplicate)."""
        with (
            self.feature(
                {
                    "organizations:onboarding-scm-experiment": True,
                    "organizations:onboarding-scm-project-details-experiment": True,
                }
            ),
            self.projects_born_active(),
        ):
            self.start_onboarding()
            self.skip_to_setup_docs("React", "React")

            self.browser.wait_until(xpath='//h2[text()="Configure React SDK"]')
            project = Project.objects.get(organization=self.org)
            assert Rule.objects.filter(project=project).count() == 1

            # Project is active, so useBackActions does NOT delete it on back-nav.
            self.browser.click('[aria-label="Back"]')
            self.browser.wait_until('[data-test-id="onboarding-step-scm-project-details"]')
            self.browser.wait_until_clickable(xpath='//button[contains(., "Create project")]')
            self.browser.click(xpath='//button[contains(., "Create project")]')

            # Reuse fast-path: same project, same rule.
            self.browser.wait_until(xpath='//h2[text()="Configure React SDK"]')
            assert Project.objects.filter(organization=self.org, status=0).count() == 1
            assert_existing_projects_status(
                self.org, active_project_ids=[project.id], deleted_project_ids=[]
            )
            assert Rule.objects.filter(project=project).count() == 1

    def test_scm_back_from_setup_docs_active_project_alert_changed(self) -> None:
        """Changing the alert setting abandons the active project and creates a new one."""
        with (
            self.feature(
                {
                    "organizations:onboarding-scm-experiment": True,
                    "organizations:onboarding-scm-project-details-experiment": True,
                }
            ),
            self.projects_born_active(),
        ):
            self.start_onboarding()
            self.skip_to_setup_docs("React", "React")

            self.browser.wait_until(xpath='//h2[text()="Configure React SDK"]')
            project1 = Project.objects.get(organization=self.org)
            assert Rule.objects.filter(project=project1).count() == 1

            self.browser.click('[aria-label="Back"]')
            self.browser.wait_until('[data-test-id="onboarding-step-scm-project-details"]')

            # Switch alerts from "High priority issues" to "create later".
            self.browser.click(
                xpath='//button[@role="radio"][contains(., "create my own alerts later")]'
            )
            self.browser.wait_until(
                xpath='//button[@role="radio"][@aria-checked="true"][contains(., "create my own alerts later")]'
            )
            self.browser.wait_until_clickable(xpath='//button[contains(., "Create project")]')
            self.browser.click(xpath='//button[contains(., "Create project")]')

            # New project is created with a suffixed slug; the old project is kept.
            self.browser.wait_until(xpath='//h2[text()="Configure React SDK"]')
            active = Project.objects.filter(organization=self.org, status=0).order_by("id")
            assert active.count() == 2
            project2 = active.last()
            assert project2 is not None
            assert project2.id != project1.id
            assert project2.platform == "javascript-react"
            # "create later" → no alert rule on the new project; old rule survives.
            assert Rule.objects.filter(project=project2).count() == 0
            assert Rule.objects.filter(project=project1).count() == 1

    def test_scm_back_from_setup_docs_active_project_platform_changed(self) -> None:
        """Active project survives back-nav; changing platform creates a new project."""
        with (
            self.feature(
                {
                    "organizations:onboarding-scm-experiment": True,
                    "organizations:onboarding-scm-project-details-experiment": True,
                }
            ),
            self.projects_born_active(),
        ):
            self.start_onboarding()
            self.skip_to_setup_docs("React", "React")

            self.browser.wait_until(xpath='//h2[text()="Configure React SDK"]')
            project1 = Project.objects.get(organization=self.org)

            # Navigate all the way back to platform selection and pick a different one.
            self.browser.click('[aria-label="Back"]')
            self.browser.wait_until('[data-test-id="onboarding-step-scm-project-details"]')
            self.browser.click('[aria-label="Back"]')
            self.browser.wait_until('[data-test-id="onboarding-step-scm-platform-features"]')
            self.browser.wait_until(xpath='//h3[text()="Select a platform"]')
            input_el = self.browser.element('input[aria-autocomplete="list"]')
            input_el.send_keys("Vue")
            self.browser.wait_until(xpath='//p[@data-test-id="menu-list-item-label"][text()="Vue"]')
            self.browser.click(xpath='//p[@data-test-id="menu-list-item-label"][text()="Vue"]')
            self.browser.click(xpath='//button[contains(., "Continue")]')

            self.browser.wait_until('[data-test-id="onboarding-step-scm-project-details"]')
            self.browser.wait_until_clickable(xpath='//button[contains(., "Create project")]')
            self.browser.click(xpath='//button[contains(., "Create project")]')

            self.browser.wait_until(xpath='//h2[text()="Configure Vue SDK"]')
            project2 = Project.objects.get(organization=self.org, platform="javascript-vue")
            assert project2.id != project1.id
            assert_existing_projects_status(
                self.org,
                active_project_ids=[project1.id, project2.id],
                deleted_project_ids=[],
            )
            assert Rule.objects.filter(project=project2).count() == 1

    def test_scm_onboarding_control_skip_integration(self) -> None:
        """Control path skip flow: skip connect → manual platform → Continue auto-creates project."""
        with self.feature(
            {
                "organizations:onboarding-scm-experiment": True,
                "organizations:onboarding-scm-project-details-experiment": False,
            }
        ):
            self.start_onboarding()
            self.skip_to_setup_docs_control("React", "React")

            # Skips scm-project-details entirely and lands on setup-docs.
            self.browser.wait_until(xpath='//h2[text()="Configure React SDK"]')
            assert not self.browser.element_exists(
                '[data-test-id="onboarding-step-scm-project-details"]'
            )

            project = Project.objects.get(organization=self.org)
            assert project.platform == "javascript-react"
            assert project.slug == "javascript-react"
            assert Rule.objects.filter(project=project).count() == 1
            assert_existing_projects_status(
                self.org, active_project_ids=[project.id], deleted_project_ids=[]
            )

    def test_scm_onboarding_control_happy_path(self) -> None:
        """Control path full flow: connect repo → detected platform → Continue auto-creates project."""
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
                    "organizations:onboarding-scm-project-details-experiment": False,
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

            self.browser.wait_until(xpath='//*[contains(text(), "Connected to")]')
            input_el = self.browser.element('input[aria-autocomplete="list"]')
            input_el.send_keys("sentry")
            self.browser.wait_until('[data-test-id="menu-list-item-label"]')
            self.browser.click('[data-test-id="menu-list-item-label"]')
            self.browser.wait_until_clickable(xpath='//button[contains(., "Continue")]')
            self.browser.click(xpath='//button[contains(., "Continue")]')

            self.browser.wait_until('[data-test-id="onboarding-step-scm-platform-features"]')
            self.browser.wait_until('[role="radio"]')
            self.browser.click('[role="radio"]')
            self.browser.wait_until_clickable(xpath='//button[contains(., "Continue")]')
            self.browser.click(xpath='//button[contains(., "Continue")]')

            self.browser.wait_until(xpath='//h2[text()="Configure Django SDK"]')
            assert not self.browser.element_exists(
                '[data-test-id="onboarding-step-scm-project-details"]'
            )

            project = Project.objects.get(organization=self.org)
            assert project.platform == "python-django"
            assert project.name == "python-django"
            assert project.slug == "python-django"
            assert_existing_projects_status(
                self.org, active_project_ids=[project.id], deleted_project_ids=[]
            )

    def test_scm_back_from_setup_docs_control_non_active_project(self) -> None:
        """Control path: non-active project is deleted on back-nav; Continue creates a fresh one."""
        with self.feature(
            {
                "organizations:onboarding-scm-experiment": True,
                "organizations:onboarding-scm-project-details-experiment": False,
            }
        ):
            self.start_onboarding()
            self.skip_to_setup_docs_control("React", "React")

            self.browser.wait_until(xpath='//h2[text()="Configure React SDK"]')
            project1 = Project.objects.get(organization=self.org)
            assert project1.platform == "javascript-react"

            # Back from setup-docs lands on scm-platform-features; project has no
            # events, so useBackActions deletes it.
            self.browser.click('[aria-label="Back"]')
            self.browser.wait_until('[data-test-id="onboarding-step-scm-platform-features"]')
            self.browser.wait_until_clickable(xpath='//button[contains(., "Continue")]')
            self.browser.click(xpath='//button[contains(., "Continue")]')

            self.browser.wait_until(xpath='//h2[text()="Configure React SDK"]')
            project2 = Project.objects.get(organization=self.org, slug="javascript-react", status=0)
            assert project2.id != project1.id
            assert_existing_projects_status(
                self.org,
                active_project_ids=[project2.id],
                deleted_project_ids=[project1.id],
            )

    def test_scm_back_from_setup_docs_control_active_project_no_changes(self) -> None:
        """Control path: active project survives back-nav; Continue reuses it (no duplicate)."""
        with (
            self.feature(
                {
                    "organizations:onboarding-scm-experiment": True,
                    "organizations:onboarding-scm-project-details-experiment": False,
                }
            ),
            self.projects_born_active(),
        ):
            self.start_onboarding()
            self.skip_to_setup_docs_control("React", "React")

            self.browser.wait_until(xpath='//h2[text()="Configure React SDK"]')
            project = Project.objects.get(organization=self.org)

            self.browser.click('[aria-label="Back"]')
            self.browser.wait_until('[data-test-id="onboarding-step-scm-platform-features"]')
            self.browser.wait_until_clickable(xpath='//button[contains(., "Continue")]')
            self.browser.click(xpath='//button[contains(., "Continue")]')

            self.browser.wait_until(xpath='//h2[text()="Configure React SDK"]')
            assert Project.objects.filter(organization=self.org, status=0).count() == 1
            assert_existing_projects_status(
                self.org, active_project_ids=[project.id], deleted_project_ids=[]
            )

    def test_scm_back_from_setup_docs_control_active_project_platform_changed(self) -> None:
        """Control path: active project survives back-nav; changing platform creates a new project."""
        with (
            self.feature(
                {
                    "organizations:onboarding-scm-experiment": True,
                    "organizations:onboarding-scm-project-details-experiment": False,
                }
            ),
            self.projects_born_active(),
        ):
            self.start_onboarding()
            self.skip_to_setup_docs_control("React", "React")

            self.browser.wait_until(xpath='//h2[text()="Configure React SDK"]')
            project1 = Project.objects.get(organization=self.org)

            self.browser.click('[aria-label="Back"]')
            self.browser.wait_until('[data-test-id="onboarding-step-scm-platform-features"]')
            self.browser.wait_until(xpath='//h3[text()="Select a platform"]')
            input_el = self.browser.element('input[aria-autocomplete="list"]')
            input_el.send_keys("Vue")
            self.browser.wait_until(xpath='//p[@data-test-id="menu-list-item-label"][text()="Vue"]')
            self.browser.click(xpath='//p[@data-test-id="menu-list-item-label"][text()="Vue"]')
            self.browser.wait_until_clickable(xpath='//button[contains(., "Continue")]')
            self.browser.click(xpath='//button[contains(., "Continue")]')

            self.browser.wait_until(xpath='//h2[text()="Configure Vue SDK"]')
            project2 = Project.objects.get(organization=self.org, platform="javascript-vue")
            assert project2.id != project1.id
            assert_existing_projects_status(
                self.org,
                active_project_ids=[project1.id, project2.id],
                deleted_project_ids=[],
            )
