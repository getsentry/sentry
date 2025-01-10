from unittest.mock import patch

from rest_framework.exceptions import ErrorDetail

from sentry import audit_log
from sentry.models.environment import Environment
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.endpoints.validators.error_detector import ErrorDetectorValidator
from sentry.workflow_engine.models.detector import Detector


class TestErrorDetectorValidator(TestCase):
    def setUp(self):
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
            "group_type": "error",
            "fingerprinting_rules": """message:"hello world 1" -> hw1 title="HW1""",
            "resolve_age": 30,
        }

    @patch("sentry.workflow_engine.endpoints.validators.error_detector.create_audit_entry")
    def test_create_with_valid_data(self, mock_audit):
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
        assert detector.organization_id == self.project.organization_id
        assert detector.workflow_condition_group is None

        # Verify audit log
        mock_audit.assert_called_once_with(
            request=self.context["request"],
            organization=self.project.organization,
            target_object=detector.id,
            event=audit_log.get_event_id("WORKFLOW_ENGINE_DETECTOR_ADD"),
            data=detector.get_audit_log_data(),
        )

    def test_invalid_group_type(self):
        data = {**self.valid_data, "group_type": "metric_alert_fire"}
        validator = ErrorDetectorValidator(data=data, context=self.context)
        assert not validator.is_valid()
        assert validator.errors.get("groupType") == [
            ErrorDetail(string="Group type must be error", code="invalid")
        ]

    def test_invalid_fingerprinting_rules(self):
        data = {**self.valid_data, "fingerprinting_rules": "hello"}
        validator = ErrorDetectorValidator(data=data, context=self.context)
        assert not validator.is_valid()
        assert validator.errors.get("fingerprintingRules") == [
            ErrorDetail(string="""Invalid syntax near "hello" (line 1, column 1)""", code="invalid")
        ]

    def test_invalid_resolve_duration(self):
        data = {**self.valid_data, "resolve_age": "-1"}
        validator = ErrorDetectorValidator(data=data, context=self.context)
        assert not validator.is_valid()
        assert validator.errors.get("resolveAge") == [
            ErrorDetail(string="Resolve age must be a non-negative number", code="invalid")
        ]
