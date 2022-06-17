from selenium.webdriver.common.action_chains import ActionChains

from sentry.testutils import AcceptanceTestCase

FEATURE_NAME = "organizations:filters-and-sampling"


class ProjectSettingsSamplingTest(AcceptanceTestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(name="Rowdy Tiger", owner=None)
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.project.update_option(
            "sentry:dynamic_sampling",
            {
                "next_id": 3,
                "rules": [
                    {
                        "sampleRate": 0.7,
                        "type": "trace",
                        "condition": {
                            "op": "and",
                            "inner": [],
                        },
                        "id": 0,
                    },
                    {
                        "sampleRate": 0.8,
                        "type": "trace",
                        "condition": {
                            "op": "and",
                            "inner": [
                                {
                                    "op": "eq",
                                    "name": "trace.environment",
                                    "value": ["production"],
                                    "options": {"ignoreCase": "true"},
                                }
                            ],
                        },
                        "id": 1,
                    },
                    {
                        "sampleRate": 0.1,
                        "type": "trace",
                        "condition": {
                            "op": "and",
                            "inner": [
                                {
                                    "op": "glob",
                                    "name": "trace.release",
                                    "value": ["[13].[19]"],
                                }
                            ],
                        },
                        "id": 2,
                    },
                ],
            },
        )

        self.create_member(user=self.user, organization=self.org, role="owner", teams=[self.team])
        self.login_as(self.user)
        self.path = f"/settings/{self.org.slug}/projects/{self.project.slug}/sampling/trace/"

    def wait_until_loaded(self):
        self.browser.get(self.path)
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')

    def test_drag_and_drop_rule_error(self):
        with self.feature(FEATURE_NAME):
            self.wait_until_loaded()

            # Tries to drag rules with conditions below a rule without a condition (flat rule)
            dragHandleSource = self.browser.elements(
                '[data-test-id="sampling-rule"] [aria-roledescription="sortable"]'
            )[1]
            dragHandleTarget = self.browser.elements(
                '[data-test-id="sampling-rule"] [aria-roledescription="sortable"]'
            )[2]

            action = ActionChains(self.browser.driver)
            action.drag_and_drop(dragHandleSource, dragHandleTarget)
            action.perform()

            self.browser.wait_until_test_id("toast-error")

    def test_drag_and_drop_rule_success(self):
        with self.feature(FEATURE_NAME):
            self.wait_until_loaded()

            # Before
            rulesBefore = self.browser.elements('[data-test-id="sampling-rule"]')
            assert "Environment" in rulesBefore[0].text
            assert "Release" in rulesBefore[1].text

            dragHandleSource = self.browser.elements('[aria-roledescription="sortable"]')[1]
            dragHandleTarget = self.browser.elements('[aria-roledescription="sortable"]')[0]

            action = ActionChains(self.browser.driver)
            action.drag_and_drop(dragHandleSource, dragHandleTarget)
            action.perform()

            # After
            rulesAfter = self.browser.elements('[data-test-id="sampling-rule"]')
            assert "Release" in rulesAfter[0].text
            assert "Environment" in rulesAfter[1].text

    def test_tab_switch(self):
        with self.feature(FEATURE_NAME):
            self.wait_until_loaded()

            # Go to individual transactions tab
            self.browser.elements('[role="tab"]')[1].click()

            assert (
                f"/settings/{self.org.slug}/projects/{self.project.slug}/sampling/transaction/"
                in self.browser.driver.current_url
            )

            # There are no transaction rules
            assert (
                len(self.browser.find_elements_by_css_selector('[data-test-id="sampling-rule"]'))
                == 0
            )

            assert self.browser.element_exists('[data-test-id="empty-state"]')

            # Go back to the distributed traces tab
            self.browser.elements('[role="tab"]')[0].click()

            assert (
                f"/settings/{self.org.slug}/projects/{self.project.slug}/sampling/trace/"
                in self.browser.driver.current_url
            )

            # There are transaction rules
            assert self.browser.element_exists('[data-test-id="sampling-rule"]')

            assert (
                len(self.browser.find_elements_by_css_selector('[data-test-id="empty-state"]')) == 0
            )

    def test_add_trace_rule(self):
        with self.feature(FEATURE_NAME):
            self.wait_until_loaded()

            # Open the modal
            self.browser.element('[aria-label="Add Rule"]').click()

            # Fill out the form
            self.browser.element('[aria-label="Add Condition"]').click()
            self.browser.element('[data-test-id="trace.user.id"]').click()
            self.browser.element('[placeholder="ex. 4711 (Multiline)"]').click()
            self.browser.element('[placeholder="ex. 4711 (Multiline)"]').send_keys("1234")
            self.browser.element('[placeholder="%"]').send_keys("20")

            # Save rule
            self.browser.element('[aria-label="Save Rule"]').click()

            # Wait the success message to show up
            self.browser.wait_until('[data-test-id="toast-success"]')
