import pytest
from jsonschema import ValidationError
from rest_framework.exceptions import PermissionDenied

from sentry.processing_errors.grouptype import (
    SourcemapConfigurationType,
    SourcemapDetectorValidator,
)
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models.detector import Detector


class TestSourcemapDetectorValidator(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.project = self.create_project()
        self.context = {
            "organization": self.project.organization,
            "project": self.project,
            "request": self.make_request(),
        }
        self.valid_data = {"name": "Sourcemaps", "type": SourcemapConfigurationType.slug}

    def test_create_is_not_supported(self) -> None:
        validator = SourcemapDetectorValidator(data=self.valid_data, context=self.context)
        assert validator.is_valid(), validator.errors

        with pytest.raises(PermissionDenied):
            validator.save()

    def test_update_is_not_supported(self) -> None:
        detector = self.create_detector(type=SourcemapConfigurationType.slug, project=self.project)
        validator = SourcemapDetectorValidator(
            instance=detector, data={"name": "Renamed"}, partial=True, context=self.context
        )
        assert validator.is_valid(), validator.errors

        with pytest.raises(PermissionDenied):
            validator.save()

    def test_config_must_be_a_dictionary(self) -> None:
        with pytest.raises(ValidationError):
            Detector.objects.create(
                name="Sourcemaps",
                type=SourcemapConfigurationType.slug,
                project=self.project,
                config=[],
            )
