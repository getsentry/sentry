import pytest
from jsonschema import ValidationError

from sentry.testutils.cases import TestCase
from sentry.uptime.grouptype import UptimeDomainCheckFailure
from sentry.uptime.models import ProjectUptimeSubscriptionMode


class TestUptimeDomainCheckFailureDetectorConfig(TestCase):
    def setUp(self):
        super().setUp()
        self.uptime_monitor = self.create_project_uptime_subscription()

    def test_detector_correct_schema(self):
        self.create_detector(
            name=self.uptime_monitor.name,
            project_id=self.project.id,
            type=UptimeDomainCheckFailure.slug,
            config={
                "mode": ProjectUptimeSubscriptionMode.MANUAL,
                "environment": "hi",
            },
        )

    def test_incorrect_config(self):
        with pytest.raises(ValidationError):
            self.create_detector(
                name=self.uptime_monitor.name,
                project_id=self.project.id,
                type=UptimeDomainCheckFailure.slug,
                config=["some", "stuff"],
            )

    def test_mismatched_schema(self):
        with pytest.raises(ValidationError):
            self.create_detector(
                name=self.uptime_monitor.name,
                project_id=self.project.id,
                type=UptimeDomainCheckFailure.slug,
                config={
                    "mode": "hi",
                    "environment": "hi",
                },
            )
        with pytest.raises(ValidationError):
            self.create_detector(
                name=self.uptime_monitor.name,
                project_id=self.project.id,
                type=UptimeDomainCheckFailure.slug,
                config={
                    "mode": ProjectUptimeSubscriptionMode.MANUAL,
                    "environment": 1,
                },
            )
        with pytest.raises(ValidationError):
            self.create_detector(
                name=self.uptime_monitor.name,
                project_id=self.project.id,
                type=UptimeDomainCheckFailure.slug,
                config={
                    "bad_mode": ProjectUptimeSubscriptionMode.MANUAL,
                    "environment": "hi",
                },
            )
        with pytest.raises(ValidationError):
            self.create_detector(
                name=self.uptime_monitor.name,
                project_id=self.project.id,
                type=UptimeDomainCheckFailure.slug,
                config={
                    "mode": ProjectUptimeSubscriptionMode.MANUAL,
                    "environment": "hi",
                    "junk": "hi",
                },
            )

    def test_missing_required(self):
        with pytest.raises(ValidationError):
            self.create_detector(
                name=self.uptime_monitor.name,
                project_id=self.project.id,
                type=UptimeDomainCheckFailure.slug,
                config={},
            )

        with pytest.raises(ValidationError):
            self.create_detector(
                name=self.uptime_monitor.name,
                project_id=self.project.id,
                type=UptimeDomainCheckFailure.slug,
            )

        with pytest.raises(ValidationError):
            self.create_detector(
                name=self.uptime_monitor.name,
                project_id=self.project.id,
                type=UptimeDomainCheckFailure.slug,
                config={
                    "mode": ProjectUptimeSubscriptionMode.MANUAL,
                },
            )

        with pytest.raises(ValidationError):
            self.create_detector(
                name=self.uptime_monitor.name,
                project_id=self.project.id,
                type=UptimeDomainCheckFailure.slug,
                config={"environment": "hi"},
            )
