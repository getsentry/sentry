import pytest
from rest_framework.exceptions import ErrorDetail, PermissionDenied

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
            "name": "Existing Detector",
            "type": "error",
            "fingerprinting_rules": """message:"hello world 1" -> hw1 title="HW1""",
            "resolve_age": 30,
        }
        self.existing_error_detector = Detector.objects.create(
            name="Existing Detector", type="error", project_id=self.project.id, config={}
        )

    def test_create(self) -> None:
        validator = ErrorDetectorValidator(data=self.valid_data, context=self.context)
        assert validator.is_valid()
        with pytest.raises(PermissionDenied):
            validator.save()

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
        validator = ErrorDetectorValidator(
            data=self.valid_data, context=self.context, instance=self.existing_error_detector
        )
        assert validator.is_valid()
        with self.tasks():
            detector = validator.save()
        assert detector.name == "Existing Detector"
        assert detector.type == "error"
        assert detector.project_id == self.project.id
        assert detector.workflow_condition_group is None

    def test_update_with_name_change(self) -> None:
        data = {**self.valid_data, "name": "Updated Detector"}
        validator = ErrorDetectorValidator(
            data=data, context=self.context, instance=self.existing_error_detector
        )
        assert not validator.is_valid()
        assert validator.errors.get("name") == [
            ErrorDetail(string="Name changes are not supported for error detectors", code="invalid")
        ]
