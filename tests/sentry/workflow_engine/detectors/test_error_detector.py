from unittest import mock

from rest_framework.exceptions import ErrorDetail

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
        }

    @mock.patch("sentry.workflow_engine.endpoints.validators.base.create_audit_entry")
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

    def test_invalid_group_type(self):
        data = {**self.valid_data, "group_type": "invalid_type"}
        validator = ErrorDetectorValidator(data=data, context=self.context)
        assert not validator.is_valid()
        assert validator.errors.get("groupType") == [
            ErrorDetail(string="Unknown group type", code="invalid")
        ]
