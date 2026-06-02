from sentry.issues.grouptype import registry as grouptype_registry
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.registry import detector_settings_registry
from sentry.workflow_engine.types import DetectorType


class TestDetectorSettingsRegistryCompleteness(TestCase):
    def test_all_detector_types_have_registered_settings(self) -> None:
        missing = [dt for dt in DetectorType if detector_settings_registry.get(dt) is None]
        assert missing == [], f"DetectorTypes with no registered DetectorSettings: {missing}"


class TestDetectorTypeSlugConvention(TestCase):
    def test_detector_type_value_matches_group_type_slug(self) -> None:
        mismatches = [
            (gt.__name__, gt.slug, gt.detector_type.value)
            for gt in grouptype_registry.all()
            if gt.detector_type is not None and gt.detector_type.value != gt.slug
        ]
        assert mismatches == [], (
            "GroupType.detector_type.value must equal GroupType.slug. Mismatches: "
            + ", ".join(
                f"{name} (slug={slug!r}, detector_type.value={dt_val!r})"
                for name, slug, dt_val in mismatches
            )
        )
