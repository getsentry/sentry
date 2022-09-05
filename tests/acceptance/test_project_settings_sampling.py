from datetime import datetime, timedelta

import pytz

from sentry.constants import DataCategory
from sentry.testutils import AcceptanceTestCase
from sentry.testutils.cases import OutcomesSnubaTest
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


class ProjectSettingsSamplingTest(OutcomesSnubaTest, AcceptanceTestCase):
    def setUp(self):
        # super(OutcomesSnubaTest, self).setUp()
        # super(AcceptanceTestCase, self).setUp()
        super().setUp()
        self.now = datetime(2021, 3, 14, 12, 27, 28, tzinfo=pytz.utc)
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

            # # Click on the recommended sampling values option
            # self.browser.click_when_visible('[id="sampling-recommended"]')

            # # Click on done button
            # self.browser.click_when_visible('[aria-label="Done"]')

            # # Wait the success message to show up
            # self.browser.wait_until('[data-test-id="toast-success"]')

            # # Validate the payload
            # project_option = ProjectOption.objects.get(
            #     key="sentry:dynamic_sampling", project=self.project
            # )
            # saved_sampling_setting = project_option.value
            # serializer = DynamicSamplingSerializer(data=saved_sampling_setting)
            # assert serializer.is_valid()
            # assert len(serializer.validated_data["rules"]) == 1
            # assert saved_sampling_setting == serializer.validated_data
            # assert (
            #     uniform_rule_with_recommended_sampling_values
            #     == serializer.validated_data["rules"][0]
            # )
