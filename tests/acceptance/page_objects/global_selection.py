from __future__ import absolute_import

from .base import BasePage


class GlobalSelectionPage(BasePage):
    def get_selected_project_slug(self):
        return self.browser.element('[data-test-id="global-header-project-selector"]').text

    def get_selected_environment(self):
        return self.browser.element('[data-test-id="global-header-environment-selector"]').text

    def get_selected_date(self):
        return self.browser.element('[data-test-id="global-header-timerange-selector"]').text

    def go_back_to_issues(self):
        self.browser.click('[data-test-id="back-to-issues"]')

    def open_project_selector(self):
        self.browser.click('[data-test-id="global-header-project-selector"]')

    def select_project_by_slug(self, slug):
        project_item_selector = u'//*[@data-test-id="badge-display-name" and text()="{}"]'.format(
            slug
        )

        self.open_project_selector()
        self.browser.wait_until(xpath=project_item_selector)
        self.browser.click(xpath=project_item_selector)

    def open_environment_selector(self):
        self.browser.click('[data-test-id="global-header-environment-selector"]')

    def select_environment(self, environment):
        environment_path = u'//*[text()="{}"]'.format(environment)

        self.open_project_selector()
        self.browser.wait_until(xpath=environment_path)
        self.browser.click(xpath=environment_path)

    def open_date_selector(self):
        self.browser.click('[data-test-id="global-header-timerange-selector"]')

    def select_date(self, date):
        date_path = u'//*[text()="{}"]'.format(date)

        self.open_date_selector()
        self.browser.wait_until(xpath=date_path)
        self.browser.click(xpath=date_path)
