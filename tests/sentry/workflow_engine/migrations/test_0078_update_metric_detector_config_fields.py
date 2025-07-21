from sentry.testutils.cases import TestMigrations


class UpdateMetricDetectorConfigFieldsTest(TestMigrations):
    migrate_from = "0079_add_unique_constraint_to_detector_group"
    migrate_to = "0080_update_metric_detector_config_fields"
    app = "workflow_engine"

    def setup_initial_state(self):
        self.detector = self.create_detector(
            type="metric_issue",
            config={
                "threshold_period": 15,
                "sensitivity": None,
                "seasonality": None,
                "detection_type": "percent",
                "comparison_delta": 3600,
            },
        )
        self.other_detector = self.create_detector(
            type="uptime_domain_failure", config={"mode": 1, "environment": "development"}
        )
        return super().setup_initial_state()

    def test_simple(self):
        self.detector.refresh_from_db()
        assert self.detector.config == {
            "detection_type": "percent",
            "comparison_delta": 3600,
        }

    def test_unaffected(self):
        self.other_detector.refresh_from_db()
        assert self.other_detector.config == {"mode": 1, "environment": "development"}
