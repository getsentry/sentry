from unittest import mock

from sentry.integrations.github.integration import GitHubOAuthLoginResult
from sentry.integrations.models.integration import Integration
from sentry.models.project import Project
from sentry.testutils.asserts import assert_existing_projects_status
from sentry.testutils.cases import AcceptanceTestCase
from sentry.testutils.silo import no_silo_test
from sentry.testutils.thread_leaks.pytest import thread_leak_allowlist


@no_silo_test
@thread_leak_allowlist(reason="sentry sdk background worker", issue=97042)
class CreateProjectTest(AcceptanceTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(name="Rowdy Tiger", owner=self.user)
        self.login_as(self.user)
        self.path = f"/organizations/{self.org.slug}/projects/new/"

    def load_project_creation_page(self) -> None:
        self.browser.get(self.path)
        self.browser.wait_until('[aria-label="Create Project"]')

    def test_no_teams(self) -> None:
        self.load_project_creation_page()
        self.browser.click(None, "//*[text()='Select a Team']")
        self.browser.click('[data-test-id="create-team-option"]')
        self.browser.wait_until("[role='dialog']")
        input = self.browser.element('input[name="slug"]')
        input.send_keys("new-team")
        self.browser.element("[role='dialog'] form").submit()
        self.browser.wait_until(xpath='//div[text()="#new-team"]')

    def test_select_correct_platform(self) -> None:
        self.create_team(organization=self.org, name="team three")
        self.load_project_creation_page()
        self.browser.click("[data-test-id='platform-javascript-react']")
        self.browser.click('[data-test-id="create-project"]')
        self.browser.wait_until(xpath="//h2[text()='Configure React SDK']")

    def test_project_deletion_on_going_back(self) -> None:
        self.create_team(organization=self.org, name="team three", members=[self.user])
        self.load_project_creation_page()
        self.browser.click("[data-test-id='platform-php-laravel']")
        self.browser.click('[data-test-id="create-project"]')
        self.browser.wait_until(xpath="//h2[text()='Configure Laravel SDK']")
        project1 = Project.objects.get(organization=self.org, slug="php-laravel")
        self.browser.click('[aria-label="Back to Platform Selection"]')
        self.browser.wait_until("[data-test-id='platform-javascript-nextjs']")
        self.browser.driver.execute_script(
            "arguments[0].click()",
            self.browser.element("[data-test-id='platform-javascript-nextjs']"),
        )
        self.browser.click('[data-test-id="create-project"]')
        self.browser.wait_until(xpath="//h2[text()='Configure Next.js SDK']")
        project2 = Project.objects.get(organization=self.org, slug="javascript-nextjs")
        self.browser.back()
        self.browser.get("/organizations/%s/projects/" % self.org.slug)
        self.browser.wait_until(xpath='//h1[text()="Remain Calm"]')
        assert_existing_projects_status(
            self.org, active_project_ids=[], deleted_project_ids=[project1.id, project2.id]
        )


@no_silo_test
@thread_leak_allowlist(reason="sentry sdk background worker", issue=97042)
class ScmCreateProjectTest(AcceptanceTestCase):
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

    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user("scm-project-creator@example.com")
        self.org = self.create_organization(name="SCM Project Creation", owner=self.user)
        self.team = self.create_team(organization=self.org, name="SCM Admins", members=[self.user])
        self.login_as(self.user)
        self.path = f"/organizations/{self.org.slug}/projects/new/"

    def create_github_integration(self) -> Integration:
        integration = self.create_provider_integration(
            provider="github",
            name="getsentry",
            external_id="12345",
            metadata={"access_token": "ghu_xxxxx"},
        )
        integration.add_organization(self.org, self.user)
        return integration

    def load_project_creation_page(self) -> None:
        self.browser.get(self.path)
        self.browser.wait_until(xpath='//h4[text()="Repository"]')

    def select_repository(self) -> None:
        repository_input = self.browser.element('input[aria-autocomplete="list"]')
        repository_input.send_keys("sentry")
        self.browser.wait_until('[data-test-id="menu-list-item-label"]')
        self.browser.click('[data-test-id="menu-list-item-label"]')
        self.browser.wait_until(xpath='//*[contains(text(), "Auto-detected from your repository")]')
        self.browser.wait_until(
            xpath='//*[@role="radiogroup"]//*[@role="radio" and @aria-checked="true"]'
            '[contains(., "Django")]'
        )

    def create_scm_project(self, sdk_name: str, platform: str) -> Project:
        self.browser.wait_until_clickable(xpath='//button[contains(., "Create project")]')
        self.browser.click(xpath='//button[contains(., "Create project")]')
        self.browser.wait_until(xpath=f'//h2[text()="Configure {sdk_name} SDK"]')

        project = Project.objects.get(organization=self.org)
        assert project.platform == platform
        assert project.name == platform
        assert project.slug == platform
        assert_existing_projects_status(
            self.org, active_project_ids=[project.id], deleted_project_ids=[]
        )
        return project

    def test_connect_provider_select_repository_and_create(self) -> None:
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
                    "organizations:onboarding-scm-project-creation": True,
                    "organizations:integrations-github-platform-detection": True,
                }
            ),
            mock.patch(
                "sentry.integrations.github.integration.GitHubIntegration.get_repositories",
                return_value=self.mock_repos,
            ),
            mock.patch(
                "sentry.integrations.github.repository.GitHubRepositoryProvider._validate_repo",
                return_value={"id": "12345"},
            ),
            mock.patch(
                "sentry.integrations.api.endpoints.organization_repository_platforms.detect_platforms",
                return_value=self.mock_platforms,
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
            self.load_project_creation_page()
            self.browser.driver.execute_script(
                """
                window.__testOpenUrl = null;
                window.open = function(url) {
                    window.__testOpenUrl = url;
                    return window;
                };
                """
            )

            self.browser.wait_until(xpath='//button[contains(., "GitHub")]')
            self.browser.click(xpath='//button[contains(., "GitHub")]')
            self.browser.wait_until(xpath='//button[contains(., "Authorize GitHub")]')
            self.browser.click(xpath='//button[contains(., "Authorize GitHub")]')

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

            self.browser.wait_until(xpath='//button[contains(., "Install GitHub App")]')
            self.browser.driver.execute_script("window.__testOpenUrl = null;")
            self.browser.click(xpath='//button[contains(., "Install GitHub App")]')
            self.browser.driver.execute_script(
                "window.postMessage(arguments[0], window.location.origin);",
                {
                    "_pipeline_source": "sentry-pipeline",
                    "installation_id": "12345",
                },
            )

            self.browser.wait_until(xpath='//button[contains(., "getsentry")]')
            self.select_repository()
            self.create_scm_project("Django", "python-django")

    def test_create_without_repository(self) -> None:
        with self.feature(
            {
                "organizations:onboarding-scm-project-creation": True,
                "organizations:performance-view": True,
            }
        ):
            self.load_project_creation_page()

            platform_input = self.browser.element('input[aria-autocomplete="list"]')
            platform_input.send_keys("React")
            self.browser.wait_until(
                xpath='//p[@data-test-id="menu-list-item-label"][text()="React"]'
            )
            self.browser.click(xpath='//p[@data-test-id="menu-list-item-label"][text()="React"]')

            self.browser.wait_until(xpath='//*[@role="checkbox"][.//*[text()="Tracing"]]')
            self.browser.click(xpath='//*[@role="checkbox"][.//*[text()="Tracing"]]')
            self.browser.wait_until(
                xpath='//*[@role="checkbox" and @aria-checked="true"][.//*[text()="Tracing"]]'
            )
            self.create_scm_project("React", "javascript-react")

    def test_create_with_existing_integration(self) -> None:
        self.create_github_integration()

        with (
            self.feature(
                {
                    "organizations:onboarding-scm-project-creation": True,
                    "organizations:integrations-github-platform-detection": True,
                }
            ),
            mock.patch(
                "sentry.integrations.github.integration.GitHubIntegration.get_repositories",
                return_value=self.mock_repos,
            ),
            mock.patch(
                "sentry.integrations.github.repository.GitHubRepositoryProvider._validate_repo",
                return_value={"id": "12345"},
            ),
            mock.patch(
                "sentry.integrations.api.endpoints.organization_repository_platforms.detect_platforms",
                return_value=self.mock_platforms,
            ),
        ):
            self.load_project_creation_page()
            self.browser.wait_until(xpath='//button[contains(., "getsentry")]')
            assert not self.browser.element_exists(
                xpath='//button[contains(., "Authorize GitHub")]'
            )
            self.browser.wait_until('input[aria-autocomplete="list"]')

            self.select_repository()
            self.create_scm_project("Django", "python-django")
