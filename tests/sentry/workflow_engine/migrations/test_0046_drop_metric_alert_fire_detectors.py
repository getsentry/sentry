from sentry.models.organization import Organization
from sentry.testutils.cases import TestMigrations
from sentry.workflow_engine.models.detector import Detector


class DropMetricAlertFireDetectors(TestMigrations):
    app = "workflow_engine"
    migrate_from = "0045_add_unique_constraint_alert_rule_detector"
    migrate_to = "0046_drop_metric_alert_fire_detectors"

    def setup_before_migration(self, app):
        self.organization = Organization.objects.create(name="test", slug="test")
        self.project = self.create_project(organization=self.organization)

        detector_field_values = {
            "project_id": self.project.id,
            "name": "test",
            "description": "test",
            "workflow_condition_group": None,
            "owner_user_id": None,
            "owner_team": None,
            "config": {
                "threshold_period": 1,
                "comparison_delta": 300,
                "detection_type": "static",
            },
            "enabled": True,
            "created_by_id": None,
            "type": "metric_alert_fire",
        }

        Detector.objects.create(**detector_field_values)
        detector_field_values["type"] = "monitor_check_in_failure"
        Detector.objects.create(**detector_field_values)

        assert Detector.objects.filter(type="metric_alert_fire").count() == 1

    def test(self):
        assert Detector.objects.filter(type="metric_alert_fire").count() == 0
