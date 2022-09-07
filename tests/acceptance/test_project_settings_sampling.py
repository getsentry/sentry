from datetime import datetime, timedelta

import pytest
import pytz
import requests
from django.conf import settings
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.keys import Keys

from sentry.api.endpoints.project_details import DynamicSamplingSerializer
from sentry.constants import DataCategory
from sentry.models import ProjectOption
from sentry.testutils import AcceptanceTestCase
from sentry.testutils.skips import requires_snuba
from sentry.utils import json
from sentry.utils.outcomes import Outcome

FEATURE_NAME = ["organizations:server-side-sampling", "organizations:server-side-sampling-ui"]

uniform_rule_with_recommended_sampling_values = {
    "id": 1,
    "active": False,
    "type": "trace",
    "condition": {
        "op": "and",
        "inner": [],
    },
    "sampleRate": 0.1,
}

uniform_rule_with_custom_sampling_values = {
    "id": 1,
    "active": False,
    "type": "trace",
    "condition": {
        "op": "and",
        "inner": [],
    },
    "sampleRate": 0.5,
}

specific_rule_with_all_current_trace_conditions = {
    "id": 2,
    "type": "trace",
    "active": False,
    "condition": {
        "op": "and",
        "inner": [
            {
                "op": "eq",
                "name": "trace.environment",
                "value": ["prod", "production"],
                "options": {"ignoreCase": True},
            },
            {"op": "glob", "name": "trace.release", "value": ["frontend@22*"]},
        ],
    },
    "sampleRate": 0.3,
}


@pytest.mark.snuba
@requires_snuba
class ProjectSettingsSamplingTest(AcceptanceTestCase):
    def setUp(self):
        super().setUp()
        self.now = datetime(2013, 5, 18, 15, 13, 58, 132928, tzinfo=pytz.utc)
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(name="Rowdy Tiger", owner=None)
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.project.update_option(
            "sentry:dynamic_sampling",
            {
                "next_id": 1,
                "rules": [],
            },
        )
        self.create_member(user=self.user, organization=self.org, role="owner", teams=[self.team])
        self.login_as(self.user)
        self.path = f"/settings/{self.org.slug}/projects/{self.project.slug}/server-side-sampling/"
        assert requests.post(settings.SENTRY_SNUBA + "/tests/outcomes/drop").status_code == 200

    def store_outcomes(self, outcome, num_times=1):
        outcomes = []
        for _ in range(num_times):
            outcome_copy = outcome.copy()
            outcome_copy["timestamp"] = outcome_copy["timestamp"].strftime("%Y-%m-%dT%H:%M:%S.%fZ")
            outcomes.append(outcome_copy)

        assert (
            requests.post(
                settings.SENTRY_SNUBA + "/tests/outcomes/insert", data=json.dumps(outcomes)
            ).status_code
            == 200
        )

    def wait_until_page_loaded(self):
        self.browser.get(self.path)
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')

    def test_add_uniform_rule_with_recommended_sampling_values(self):
        self.store_outcomes(
            {
                "org_id": self.org.id,
                "timestamp": self.now - timedelta(hours=1),
                "project_id": self.project.id,
                "outcome": Outcome.ACCEPTED,
                "reason": "none",
                "category": DataCategory.TRANSACTION,
                "quantity": 1,
            }
        )

        with self.feature(FEATURE_NAME):
            self.wait_until_page_loaded()

            # Open uniform rate modal
            self.browser.click_when_visible('[aria-label="Start Setup"]')

            self.browser.wait_until('[id="recommended-client-sampling"]')

            # Click on the recommended sampling values option
            self.browser.click_when_visible('[id="sampling-recommended"]')

            # Click on done button
            self.browser.click_when_visible('[aria-label="Done"]')

            # Wait the success message to show up
            self.browser.wait_until('[data-test-id="toast-success"]')

            # Validate the payload
            project_option = ProjectOption.objects.get(
                key="sentry:dynamic_sampling", project=self.project
            )
            saved_sampling_setting = project_option.value
            serializer = DynamicSamplingSerializer(data=saved_sampling_setting)
            assert serializer.is_valid()
            assert len(serializer.validated_data["rules"]) == 1
            assert saved_sampling_setting == serializer.validated_data
            assert (
                uniform_rule_with_recommended_sampling_values
                == serializer.validated_data["rules"][0]
            )

    def test_add_uniform_rule_with_custom_sampling_values(self):
        self.store_outcomes(
            {
                "org_id": self.org.id,
                "timestamp": self.now - timedelta(hours=1),
                "project_id": self.project.id,
                "outcome": Outcome.ACCEPTED,
                "reason": "none",
                "category": DataCategory.TRANSACTION,
                "quantity": 1,
            }
        )

        with self.feature(FEATURE_NAME):
            self.wait_until_page_loaded()

            # Open uniform rate modal
            self.browser.click_when_visible('[aria-label="Start Setup"]')

            self.browser.wait_until('[id="recommended-client-sampling"]')

            # Enter a custom value for client side sampling
            self.browser.element('[id="recommended-client-sampling"]').clear()
            self.browser.element('[id="recommended-client-sampling"]').send_keys(80, Keys.ENTER)

            # Enter a custom value for server side sampling
            self.browser.element('[id="recommended-server-sampling"]').clear()
            self.browser.element('[id="recommended-server-sampling"]').send_keys(50, Keys.ENTER)

            # Click on next button
            self.browser.click_when_visible('[aria-label="Next"]')

            # Click on done button
            self.browser.click_when_visible('[aria-label="Done"]')

            # Wait the success message to show up
            self.browser.wait_until('[data-test-id="toast-success"]')

            # Validate the payload
            project_option = ProjectOption.objects.get(
                key="sentry:dynamic_sampling", project=self.project
            )
            saved_sampling_setting = project_option.value
            serializer = DynamicSamplingSerializer(data=saved_sampling_setting)
            assert serializer.is_valid()
            assert len(serializer.validated_data["rules"]) == 1
            assert saved_sampling_setting == serializer.validated_data
            assert uniform_rule_with_custom_sampling_values == serializer.validated_data["rules"][0]

    def test_activate_uniform_rule(self):
        with self.feature(FEATURE_NAME):
            self.project.update_option(
                "sentry:dynamic_sampling",
                {
                    "next_id": 2,
                    "rules": [uniform_rule_with_recommended_sampling_values],
                },
            )

            self.wait_until_page_loaded()

            # Click on activate rule button
            self.browser.element('[aria-label="Activate Rule"]').click()

            # Wait the success message to show up
            self.browser.wait_until('[data-test-id="toast-success"]')

            # Validate the payload
            project_option = ProjectOption.objects.get(
                key="sentry:dynamic_sampling", project=self.project
            )
            saved_sampling_setting = project_option.value
            serializer = DynamicSamplingSerializer(data=saved_sampling_setting)
            assert serializer.is_valid()
            assert len(serializer.validated_data["rules"]) == 1
            assert saved_sampling_setting == serializer.validated_data

            assert {
                **uniform_rule_with_recommended_sampling_values,
                "active": True,
                "id": 2,
            } == serializer.validated_data["rules"][0]

    def test_deactivate_uniform_rule(self):
        with self.feature(FEATURE_NAME):
            self.project.update_option(
                "sentry:dynamic_sampling",
                {
                    "next_id": 2,
                    "rules": [{**uniform_rule_with_recommended_sampling_values, "active": True}],
                },
            )

            self.wait_until_page_loaded()

            # Click on deactivate rule button
            self.browser.element('[aria-label="Deactivate Rule"]').click()

            # Wait the success message to show up
            self.browser.wait_until('[data-test-id="toast-success"]')

            # Validate the payload
            project_option = ProjectOption.objects.get(
                key="sentry:dynamic_sampling", project=self.project
            )
            saved_sampling_setting = project_option.value
            serializer = DynamicSamplingSerializer(data=saved_sampling_setting)
            assert serializer.is_valid()
            assert len(serializer.validated_data["rules"]) == 1
            assert saved_sampling_setting == serializer.validated_data

            assert {
                **uniform_rule_with_recommended_sampling_values,
                "active": False,
                "id": 2,
            } == serializer.validated_data["rules"][0]

    def test_add_specific_rule(self):
        with self.feature(FEATURE_NAME):
            self.project.update_option(
                "sentry:dynamic_sampling",
                {
                    "next_id": 2,
                    "rules": [uniform_rule_with_recommended_sampling_values],
                },
            )

            self.wait_until_page_loaded()

            # Open specific rule modal
            self.browser.element('[aria-label="Add Rule"]').click()

            # Open conditions dropdown
            self.browser.element('[aria-label="Add Condition"]').click()

            # Add Environment
            self.browser.element('[data-test-id="trace.environment"]').click()

            # Add Release
            self.browser.element('[data-test-id="trace.release"]').click()

            # Fill in Environment
            self.browser.element('[aria-label="Search or add an environment"]').send_keys("prod")
            self.browser.wait_until_not('[data-test-id="loading-indicator"]')
            self.browser.element('[aria-label="Search or add an environment"]').send_keys(
                Keys.ENTER
            )
            self.browser.element('[aria-label="Search or add an environment"]').send_keys(
                "production"
            )
            self.browser.wait_until_not('[data-test-id="loading-indicator"]')
            self.browser.element('[aria-label="Search or add an environment"]').send_keys(
                Keys.ENTER
            )

            # Fill in Release
            self.browser.element('[aria-label="Search or add a release"]').send_keys("frontend@22*")
            self.browser.wait_until_not('[data-test-id="loading-indicator"]')
            self.browser.element('[aria-label="Search or add a release"]').send_keys(Keys.ENTER)

            # Fill in sample rate
            self.browser.element('[placeholder="%"]').send_keys("30")

            # Save rule
            self.browser.element('[aria-label="Save Rule"]').click()

            # Wait the success message to show up
            self.browser.wait_until('[data-test-id="toast-success"]')

            # Take a screenshot
            self.browser.snapshot("sampling settings rule with current trace conditions")

            # Validate the payload
            project_option = ProjectOption.objects.get(
                key="sentry:dynamic_sampling", project=self.project
            )
            saved_sampling_setting = project_option.value
            serializer = DynamicSamplingSerializer(data=saved_sampling_setting)
            assert serializer.is_valid()
            assert len(serializer.validated_data["rules"]) == 2
            assert saved_sampling_setting == serializer.validated_data
            assert (
                specific_rule_with_all_current_trace_conditions
                == serializer.validated_data["rules"][0]
            )

    def test_drag_and_drop_rule_error(self):
        with self.feature(FEATURE_NAME):
            self.project.update_option(
                "sentry:dynamic_sampling",
                {
                    "next_id": 3,
                    "rules": [
                        {**specific_rule_with_all_current_trace_conditions, "id": 1},
                        {**uniform_rule_with_recommended_sampling_values, "id": 2},
                    ],
                },
            )

            self.wait_until_page_loaded()

            # Tries to drag specific rules below an uniform rule
            dragHandleSource = self.browser.elements(
                '[data-test-id="sampling-rule"] [aria-roledescription="sortable"]'
            )[0]
            dragHandleTarget = self.browser.elements(
                '[data-test-id="sampling-rule"] [aria-roledescription="sortable"]'
            )[1]

            action = ActionChains(self.browser.driver)
            action.drag_and_drop(dragHandleSource, dragHandleTarget)
            action.perform()

            self.browser.wait_until_test_id("toast-error")

    def test_drag_and_drop_rule_success(self):
        with self.feature(FEATURE_NAME):
            self.project.update_option(
                "sentry:dynamic_sampling",
                {
                    "next_id": 4,
                    "rules": [
                        {
                            **specific_rule_with_all_current_trace_conditions,
                            "id": 1,
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
                        },
                        {
                            **specific_rule_with_all_current_trace_conditions,
                            "sampleRate": 0.8,
                            "id": 2,
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
                        },
                        {
                            **uniform_rule_with_recommended_sampling_values,
                            "id": 3,
                        },
                    ],
                },
            )

            self.wait_until_page_loaded()

            # Before
            rules_before = self.browser.elements('[data-test-id="sampling-rule"]')
            assert "Release" in rules_before[0].text
            assert "Environment" in rules_before[1].text

            drag_handle_source = self.browser.elements('[aria-roledescription="sortable"]')[1]
            dragHandleTarget = self.browser.elements('[aria-roledescription="sortable"]')[0]

            action = ActionChains(self.browser.driver)
            action.drag_and_drop(drag_handle_source, dragHandleTarget)
            action.perform()

            # Wait the success message to show up
            self.browser.wait_until('[data-test-id="toast-success"]')

            # After
            rulesAfter = self.browser.elements('[data-test-id="sampling-rule"]')
            assert "Environment" in rulesAfter[0].text
            assert "Release" in rulesAfter[1].text
