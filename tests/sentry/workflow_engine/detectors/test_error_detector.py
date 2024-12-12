from rest_framework.exceptions import ErrorDetail

from sentry.models.environment import Environment
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.endpoints.validators.error_detector import ErrorDetectorValidator


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

    # create doesn't work because the validator is not registered yet
    # TODO: test_create_with_valid_data

    def test_invalid_group_type(self):
        validator = ErrorDetectorValidator(data=self.valid_data, context=self.context)
        assert not validator.is_valid()
        assert validator.errors.get("groupType") == [
            ErrorDetail(string="Group type not compatible with detectors", code="invalid")
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
