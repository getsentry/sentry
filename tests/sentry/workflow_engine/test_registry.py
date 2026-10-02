from unittest.mock import patch

from sentry.workflow_engine.registry import detector_settings_registry
from sentry.workflow_engine.types import DetectorSettings


def test_detector_settings_registry_registers_multiple_slugs_to_one_class() -> None:
    with patch.dict(detector_settings_registry.registrations):

        @detector_settings_registry.register("fake_issue_type_1")
        @detector_settings_registry.register("fake_issue_type_2")
        class FakeDetectorSettings(DetectorSettings):
            pass

        assert detector_settings_registry.get("fake_issue_type_1") is FakeDetectorSettings

        assert detector_settings_registry.get("fake_issue_type_2") is FakeDetectorSettings
