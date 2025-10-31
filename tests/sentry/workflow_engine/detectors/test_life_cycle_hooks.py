from unittest.mock import Mock, PropertyMock, patch

from django.test.client import RequestFactory

from sentry.issues.grouptype import PerformanceSlowDBQueryGroupType
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.endpoints.validators.base.detector import BaseDetectorTypeValidator
from sentry.workflow_engine.models import Detector
from sentry.workflow_engine.types import DetectorLifeCycleHooks, DetectorSettings


class TestDetectorLifeCycleValidatorHooks(TestCase):
    def setUp(self) -> None:
        super().setUp()

        self.login_as(user=self.user)
        self.url = f"/api/0/organizations/{self.organization.slug}/monitors"
        self.request = RequestFactory().post(self.url)
        self.request.user = self.user

        self.context = {
            "organization": self.organization,
            "project": self.project,
            "request": self.request,
        }

        self.valid_data = {
            "name": "LifeCycle Test Detector",
            # Just using a random type, this will have mocked info
            "type": PerformanceSlowDBQueryGroupType,
        }

        self.detector_settings = DetectorSettings(
            hooks=DetectorLifeCycleHooks(
                after_create=Mock(),
                after_update=Mock(),
            )
        )

    def test_create(self) -> None:
        validator = BaseDetectorTypeValidator(self.valid_data, context=self.context)

        with patch.object(Detector, "settings", new_callable=PropertyMock) as mock_settings:
            mock_settings.return_value = self.detector_settings
            detector = validator.create(self.valid_data)
            detector.settings.hooks.after_create.assert_called_with(detector)

    def test_create__no_hooks(self) -> None:
        validator = BaseDetectorTypeValidator(self.valid_data, context=self.context)
        self.detector_settings = DetectorSettings()

        with patch.object(Detector, "settings", new_callable=PropertyMock) as mock_settings:
            mock_settings.return_value = self.detector_settings
            detector = validator.create(self.valid_data)
            assert detector

    def test_update(self) -> None:
        validator = BaseDetectorTypeValidator(self.valid_data, context=self.context)
        detector = self.create_detector(name="Example")

        with patch.object(Detector, "settings", new_callable=PropertyMock) as mock_settings:
            mock_settings.return_value = self.detector_settings
            detector = validator.update(detector, self.valid_data)

            # Ensure update happened, and hook was invoked
            assert detector.name == self.valid_data["name"]
            detector.settings.hooks.after_update.assert_called_with(detector)

    def test_update__no_hooks(self) -> None:
        validator = BaseDetectorTypeValidator(self.valid_data, context=self.context)
        self.detector = self.create_detector(name="Example")
        self.detector_settings = DetectorSettings()

        with patch.object(Detector, "settings", new_callable=PropertyMock) as mock_settings:
            mock_settings.return_value = self.detector_settings
            detector = validator.update(self.detector, self.valid_data)
            assert detector.name == self.valid_data["name"]
