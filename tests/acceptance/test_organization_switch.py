from __future__ import absolute_import

from selenium.common.exceptions import TimeoutException
from sentry.testutils import AcceptanceTestCase, SnubaTestCase
from sentry.utils.retries import TimedRetryPolicy


class OrganizationSwitchTest(AcceptanceTestCase, SnubaTestCase):
    def setUp(self):
        super(OrganizationSwitchTest, self).setUp()

        self.primary_projects = [
            self.create_project(organization=self.organization, teams=[self.team], name=name)
            for name in ["Bengal", "Sumatra", "Siberian"]
        ]

        self.secondary_organization = self.create_organization(owner=self.user, name="Banana Duck")

        self.secondary_team = self.create_team(
            organization=self.secondary_organization, name="Second", members=[self.user]
        )

        self.secondary_projects = [
            self.create_project(
                organization=self.secondary_organization, teams=[self.secondary_team], name=name
            )
            for name in ["Gone Goose", "Peaceful Platypus"]
        ]

        self.login_as(self.user)

    def test_organization_switches(self):
        def navigate_to_issues_page(org_slug):
            issues_url = OrganizationSwitchTest.url_creator("issues", org_slug)
            self.browser.get(issues_url)
            self.browser.wait_until_not(".loading-indicator")

        @TimedRetryPolicy.wrap(timeout=20, exceptions=(TimeoutException,))
        def open_project_selector():
            self.browser.click_when_visible(
                selector='[data-test-id="global-header-project-selector"]'
            )
            # Check if the automplete-list has shown up, if that fails we
            # want to retry this step.
            self.browser.wait_until('[data-test-id="autocomplete-list"]')

        def get_project_elements_from_project_selector_dropdown():
            selector = '[data-test-id="autocomplete-list"] [data-test-id="badge-display-name"]'
            self.browser.wait_until(selector)

            return self.browser.find_elements_by_css_selector(selector)

        transition_urls = [
            OrganizationSwitchTest.url_creator(page, self.organization.slug)
            for page in ["issues", "releases" "discover", "user-feedback"]
        ]

        with self.settings(SENTRY_SINGLE_ORGANIZATION=False), self.feature(
            "organizations:discover"
        ):
            for transition_url in transition_urls:
                navigate_to_issues_page(self.organization.slug)
                open_project_selector()
                primary_projects_elements = get_project_elements_from_project_selector_dropdown()
                OrganizationSwitchTest.expect_projects_element_text_to_match_projects_slug(
                    primary_projects_elements, self.primary_projects
                )

                self.browser.get(transition_url)
                self.browser.wait_until_not(".loading-indicator")

                navigate_to_issues_page(self.secondary_organization.slug)
                open_project_selector()
                secondary_projects_elements = get_project_elements_from_project_selector_dropdown()

                OrganizationSwitchTest.expect_projects_element_text_to_match_projects_slug(
                    secondary_projects_elements, self.secondary_projects
                )

    @staticmethod
    def expect_projects_element_text_to_match_projects_slug(elements, projects):
        assert len(elements) == len(projects)
        assert {e.text for e in elements} == {p.slug for p in projects}

    @staticmethod
    def url_creator(page_path, org_slug):
        return u"organizations/{org_id}/{page_path}/".format(org_id=org_slug, page_path=page_path)
