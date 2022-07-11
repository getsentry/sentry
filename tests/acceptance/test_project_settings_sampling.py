from selenium.webdriver.common.action_chains import ActionChains

from sentry.testutils import AcceptanceTestCase

FEATURE_NAME = "organizations:server-side-sampling"


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
                "next_id": 4,
                "rules": [
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
                                    "options": {"ignoreCase": True},
                                }
                            ],
                        },
                        "id": 2,
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
                        "id": 3,
                    },
                    {
                        "sampleRate": 0.7,
                        "type": "trace",
                        "condition": {
                            "op": "and",
                            "inner": [],
                        },
                        "id": 1,
                    },
                ],
            },
        )
        self.create_member(user=self.user, organization=self.org, role="owner", teams=[self.team])
        self.login_as(self.user)
        self.path = f"/settings/{self.org.slug}/projects/{self.project.slug}/server-side-sampling/"

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
            rules_before = self.browser.elements('[data-test-id="sampling-rule"]')
            assert "Environment" in rules_before[0].text
            assert "Release" in rules_before[1].text

            drag_handle_source = self.browser.elements('[aria-roledescription="sortable"]')[1]
            dragHandleTarget = self.browser.elements('[aria-roledescription="sortable"]')[0]

            action = ActionChains(self.browser.driver)
            action.drag_and_drop(drag_handle_source, dragHandleTarget)
            action.perform()

            # After
            rulesAfter = self.browser.elements('[data-test-id="sampling-rule"]')
            assert "Release" in rulesAfter[0].text
            assert "Environment" in rulesAfter[1].text
