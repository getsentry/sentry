# from datetime import datetime
# from unittest.mock import patch

from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.wait import WebDriverWait

from fixtures.page_objects.issue_list import IssueListPage
from sentry.models.savedsearch import SavedSearch, SortOptions, Visibility
from sentry.testutils.cases import AcceptanceTestCase, SnubaTestCase
from sentry.testutils.silo import no_silo_test


@no_silo_test
class OrganizationGroupIndexTest(AcceptanceTestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(owner=self.user, name="Rowdy Tiger")
        self.team = self.create_team(
            organization=self.org, name="Mariachi Band", members=[self.user]
        )
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.other_project = self.create_project(
            organization=self.org, teams=[self.team], name="Sumatra"
        )
        self.login_as(self.user)
        self.page = IssueListPage(self.browser, self.client)
        self.dismiss_assistant()

        # Create recommended saved searches
        self.create_saved_search(
            name="Assigned to Me",
            query="is:unresolved assigned:me",
            visibility=Visibility.ORGANIZATION,
            is_global=True,
        )
        self.create_saved_search(
            name="Errors Only",
            query="is:unresolved evel:error",
            visibility=Visibility.ORGANIZATION,
            is_global=True,
        )

    def test_click_saved_search(self):
        self.page.visit_issue_list(self.org.slug)
        self.browser.click_when_visible('button[aria-label="Custom Search"]')

        # Navigate to a recommended saved search
        self.browser.click('button[aria-label="Errors Only"]')
        self.page.wait_until_loaded()

    def test_create_saved_search(self):
        self.page.visit_issue_list(self.org.slug)
        self.browser.click_when_visible('button[aria-label="Custom Search"]')

        self.browser.click('[aria-label="Add saved search"]')

        self.browser.wait_until('[role="dialog"]')

        self.browser.find_element(by=By.NAME, value="name").send_keys("My Saved Search")
        query_input = self.browser.find_element(
            by=By.CSS_SELECTOR, value='[role="dialog"] textarea'
        )
        self.browser.click('[role="dialog"] button[aria-label="Clear search"]')
        query_input.send_keys("browser.name:Firefox", Keys.ENTER)
        self.browser.click('[role="dialog"] button[aria-label="Save"]')
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')

        # The saved search should have been created with the correct options
        created_search = SavedSearch.objects.get(name="My Saved Search")
        assert created_search
        assert created_search.query == "browser.name:Firefox"
        assert created_search.sort == SortOptions.DATE
        assert created_search.visibility == Visibility.OWNER
        assert not created_search.is_global
        assert created_search.owner_id == self.user.id

        # And the sidebar should have been updated with the new search item
        assert self.browser.find_element(
            by=By.CSS_SELECTOR, value='button[aria-label="My Saved Search"]'
        )

    def test_edit_saved_search(self):
        # Start with a user saved search
        self.create_saved_search(
            organization=self.org,
            name="My Saved Search",
            query="browser.name:Firefox",
            visibility=Visibility.OWNER,
            owner=self.user,
        )

        self.page.visit_issue_list(self.org.slug)
        self.browser.click_when_visible('button[aria-label="Custom Search"]')

        self.browser.move_to('button[aria-label="My Saved Search"]')
        self.browser.wait_until_clickable('button[aria-label="Saved search options"]')
        self.browser.click('button[aria-label="Saved search options"]')
        self.browser.click('[data-test-id="edit"]')

        self.browser.wait_until('[role="dialog"]')

        self.browser.find_element(by=By.NAME, value="name").clear()
        self.browser.find_element(by=By.NAME, value="name").send_keys("New Saved Search Name")
        self.browser.click('[role="dialog"] button[aria-label="Save"]')
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')

        # The saved search should have been updated with the correct options
        created_search = SavedSearch.objects.get(name="New Saved Search Name")
        assert created_search
        assert created_search.query == "browser.name:Firefox"
        assert created_search.sort == SortOptions.DATE
        assert created_search.visibility == Visibility.OWNER
        assert not created_search.is_global
        assert created_search.owner_id == self.user.id

        # And the sidebar should have been updated
        assert self.browser.find_element(
            by=By.CSS_SELECTOR, value='button[aria-label="New Saved Search Name"]'
        )

    def test_delete_saved_search(self):
        # Start with a user saved search
        self.create_saved_search(
            organization=self.org,
            name="My Saved Search",
            query="browser.name:Firefox",
            visibility=Visibility.OWNER,
            owner=self.user,
        )

        self.page.visit_issue_list(self.org.slug)
        self.browser.click_when_visible('button[aria-label="Custom Search"]')

        self.browser.move_to('button[aria-label="My Saved Search"]')
        self.browser.wait_until_clickable('button[aria-label="Saved search options"]')
        self.browser.click('button[aria-label="Saved search options"]')
        self.browser.click('[data-test-id="delete"]')

        self.browser.wait_until('[role="dialog"]')
        self.browser.click('[role="dialog"] button[aria-label="Confirm"]')

        # Search is immediately removed from the UI
        assert not self.browser.element_exists('button[aria-label="My Saved Search"]')

        # The saved search should be removed from the db
        # Since this is an optimistic update there is nothing to wait for in the UI
        wait = WebDriverWait(self.browser.driver, 10)
        wait.until(lambda _: not SavedSearch.objects.filter(name="My Saved Search").exists())
