from typing import int
from unittest.mock import MagicMock, patch

from rest_framework.exceptions import ErrorDetail

from sentry import audit_log
from sentry.models.environment import Environment
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.endpoints.validators.error_detector import ErrorDetectorValidator
from sentry.workflow_engine.models.detector import Detector


# TODO - This should probably live in the same module the detector does
class TestErrorDetectorValidator(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.project = self.create_project()
        self.environment = Environment.objects.create(
            organization_id=self.project.organization_id, name="production"
        )
        self.context = {
            "organization": self.project.organization,
            "project": self.project,
            "request": self.make_request(),
        }
        self.valid_data = {
            "name": "Test Detector",
            "type": "error",
            "fingerprinting_rules": """message:"hello world 1" -> hw1 title="HW1""",
            "resolve_age": 30,
        }
        self.existing_error_detector = Detector.objects.create(
            name="Existing Detector", type="error", project_id=self.project.id, config={}
        )

    @patch("sentry.workflow_engine.endpoints.validators.error_detector.create_audit_entry")
    def test_create_with_valid_data(self, mock_audit: MagicMock) -> None:
        validator = ErrorDetectorValidator(
            data=self.valid_data,
            context=self.context,
        )
        assert validator.is_valid(), validator.errors

        with self.tasks():
            detector = validator.save()

        # Verify detector in DB
        detector = Detector.objects.get(id=detector.id)
        assert detector.name == "Test Detector"
        assert detector.type == "error"
        assert detector.project_id == self.project.id
        assert detector.workflow_condition_group is None

        # Verify audit log
        mock_audit.assert_called_once_with(
            request=self.context["request"],
            organization=self.project.organization,
            target_object=detector.id,
            event=audit_log.get_event_id("DETECTOR_ADD"),
            data=detector.get_audit_log_data(),
        )

    def test_invalid_detector_type(self) -> None:
        data = {**self.valid_data, "type": "metric_issue"}
        validator = ErrorDetectorValidator(data=data, context=self.context)
        assert not validator.is_valid()
        assert validator.errors.get("type") == [
            ErrorDetail(string="Detector type must be error", code="invalid")
        ]

    def test_invalid_fingerprinting_rules(self) -> None:
        data = {**self.valid_data, "fingerprinting_rules": "hello"}
        validator = ErrorDetectorValidator(data=data, context=self.context)
        assert not validator.is_valid()
        assert validator.errors.get("fingerprintingRules") == [
            ErrorDetail(string="""Invalid syntax near "hello" (line 1, column 1)""", code="invalid")
        ]

    def test_invalid_resolve_duration(self) -> None:
        data = {**self.valid_data, "resolve_age": "-1"}
        validator = ErrorDetectorValidator(data=data, context=self.context)
        assert not validator.is_valid()
        assert validator.errors.get("resolveAge") == [
            ErrorDetail(string="Resolve age must be a non-negative number", code="invalid")
        ]

    def test_invalid_condition_group(self) -> None:
        data = {
            **self.valid_data,
            "condition_group": {
                "logic_type": "any",
                "conditions": [
                    {
                        "type": "eq",
                        "comparison": 100,
                        "condition_result": "high",
                    }
                ],
            },
        }
        validator = ErrorDetectorValidator(data=data, context=self.context)
        assert not validator.is_valid()
        assert validator.errors.get("conditionGroup") == [
            ErrorDetail(
                string="Condition group is not supported for error detectors", code="invalid"
            )
        ]

    def test_update_existing_with_valid_data(self) -> None:
        data = {**self.valid_data, "name": "Updated Detector"}
        validator = ErrorDetectorValidator(
            data=data, context=self.context, instance=self.existing_error_detector
        )
        assert validator.is_valid()
        with self.tasks():
            detector = validator.save()
        assert detector.name == "Updated Detector"
        assert detector.type == "error"
        assert detector.project_id == self.project.id
        assert detector.workflow_condition_group is None
