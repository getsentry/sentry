from typing import Any

from django.db.migrations.state import StateApps

from sentry.silo.safety import unguarded_write
from sentry.testutils.cases import TestMigrations


class CleanUpMetricDetectorConfigTest(TestMigrations):
    app = "workflow_engine"
    migrate_from = "0124_add_workflow_type_org_index"
    migrate_to = "0125_clean_up_metric_detector_config"

    def setup_before_migration(self, apps: StateApps) -> None:
        Organization = apps.get_model("sentry", "Organization")
        Project = apps.get_model("sentry", "Project")
        Detector = apps.get_model("workflow_engine", "Detector")

        with unguarded_write(using="default"):
            org = Organization.objects.create(slug="detection-type", name="Detection Type")
        project = Project.objects.create(
            organization_id=org.id, slug="detection-type", name="Detection Type"
        )

        # (name, config before, expected config after)
        cases: list[tuple[str, dict[str, Any], dict[str, Any]]] = [
            (
                "static without delta",
                {"detection_type": "static"},
                {"detection_type": "static"},
            ),
            (
                "static with null delta",
                {"detection_type": "static", "comparison_delta": None},
                {"detection_type": "static"},
            ),
            (
                "static with delta",
                {"detection_type": "static", "comparison_delta": 3600},
                {"detection_type": "percent", "comparison_delta": 3600},
            ),
            (
                "percent without delta",
                {"detection_type": "percent"},
                {"detection_type": "static"},
            ),
            (
                "percent with null delta",
                {"detection_type": "percent", "comparison_delta": None},
                {"detection_type": "static"},
            ),
            (
                "percent with delta",
                {"detection_type": "percent", "comparison_delta": 3600},
                {"detection_type": "percent", "comparison_delta": 3600},
            ),
            (
                "dynamic without delta",
                {"detection_type": "dynamic"},
                {"detection_type": "dynamic"},
            ),
            (
                "dynamic with null delta",
                {"detection_type": "dynamic", "comparison_delta": None},
                {"detection_type": "dynamic"},
            ),
            # There's no "dynamic with delta" case here because we don't have any broken anomaly
            # detectors
        ]

        # Keys which aren't in the config schema, all of which have been found on real detectors
        extra_keys = {
            "threshold_period": 1,
            "sensitivity": "medium",
            "seasonality": "auto",
            "threshold_type": 0,
            "environment": "production",
        }

        self.cases = []
        for name, config, expected_config in cases:
            detector_no_extra_keys = Detector.objects.create(
                project_id=project.id, name=name, type="metric_issue", config=config
            )
            detector_with_extra_keys = Detector.objects.create(
                project_id=project.id,
                name=name,
                type="metric_issue",
                config={**config, **extra_keys},
            )
            self.cases.append((name, detector_no_extra_keys.id, expected_config))
            self.cases.append(
                (f"{name} - with extra keys", detector_with_extra_keys.id, expected_config)
            )

    def test(self) -> None:
        Detector = self.apps.get_model("workflow_engine", "Detector")
        for name, detector_id, expected_config in self.cases:
            with self.subTest(name):
                assert Detector.objects.get(id=detector_id).config == expected_config
