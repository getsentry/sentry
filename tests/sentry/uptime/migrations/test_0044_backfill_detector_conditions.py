import pytest
from sentry.testutils.cases import TestMigrations
from sentry.uptime.grouptype import UptimeDomainCheckFailure
from sentry.uptime.models import get_detector
from sentry.workflow_engine.models.detector import Detector


@pytest.mark.skip("Migration tests take too long right now")
class BackfillDetectorConditionsTest(TestMigrations):
    app = "uptime"
    migrate_from = "0039_uptime_drop_project_subscription_uptime_status_db"
    migrate_to = "0040_uptime_backfill_detector_conditions"

    def setup_initial_state(self):
        # Creates a monitor with a detector and condition
        monitor = self.create_project_uptime_subscription()
        self.detector_with_conditions = get_detector(monitor.uptime_subscription)
        assert self.detector_with_conditions
        self.existing_condition_group_id = self.detector_with_conditions.workflow_condition_group_id
        assert self.existing_condition_group_id

        # Creates a detector with missing condition_group and conditions
        self.detector_without_conditions = Detector.objects.create(
            type=UptimeDomainCheckFailure.slug,
            project=self.project,
            name="Example monitor",
            config={"environment": "production", "mode": 1},
        )

        assert self.detector_without_conditions.workflow_condition_group is None

    def test(self):
        # Existing detector with conditions does not change it's group
        assert self.detector_with_conditions
        self.detector_with_conditions.refresh_from_db()
        assert (
            self.detector_with_conditions.workflow_condition_group_id
            == self.existing_condition_group_id
        )

        # Detector missing conditions has a group
        self.detector_without_conditions.refresh_from_db()
        group = self.detector_without_conditions.workflow_condition_group
        assert group is not None

        conditions = group.conditions.all()
        assert len(conditions) == 2
        assert any(condition.comparison == "failure" for condition in conditions)
        assert any(condition.comparison == "success" for condition in conditions)
