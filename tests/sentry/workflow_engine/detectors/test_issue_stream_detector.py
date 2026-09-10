import pytest
from jsonschema import ValidationError
from rest_framework.exceptions import PermissionDenied

from sentry.testutils.cases import TestCase
from sentry.workflow_engine.endpoints.validators.issue_stream_detector import (
    IssueStreamDetectorValidator,
)
from sentry.workflow_engine.models.detector import Detector
from sentry.workflow_engine.typings.grouptype import IssueStreamGroupType


class TestIssueStreamDetectorValidator(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.project = self.create_project()
        self.context = {
            "organization": self.project.organization,
            "project": self.project,
            "request": self.make_request(),
        }
        self.valid_data = {"name": "Issue Stream", "type": IssueStreamGroupType.slug}

    def test_create_is_not_supported(self) -> None:
        validator = IssueStreamDetectorValidator(data=self.valid_data, context=self.context)
        assert validator.is_valid(), validator.errors

        with pytest.raises(PermissionDenied):
            validator.save()

    def test_update_is_not_supported(self) -> None:
        detector = self.create_detector(type=IssueStreamGroupType.slug, project=self.project)
        validator = IssueStreamDetectorValidator(
            instance=detector, data={"name": "Renamed"}, partial=True, context=self.context
        )
        assert validator.is_valid(), validator.errors

        with pytest.raises(PermissionDenied):
            validator.save()

    def test_config_schema_is_enforced_on_save(self) -> None:
        with pytest.raises(ValidationError):
            Detector.objects.create(
                name="Issue Stream",
                type=IssueStreamGroupType.slug,
                project=self.project,
                config={"organization_id": "not-an-integer"},
            )
