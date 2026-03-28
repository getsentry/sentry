from __future__ import annotations

from typing import Any
from unittest.mock import patch

from django.core.cache import cache

from sentry.processing_errors.detection import (
    DETECTOR_CONFIGS,
    _cache_key_triggered,
    detect_processing_issues,
)
from sentry.processing_errors.grouptype import NativeConfigurationType, SourcemapConfigurationType
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models import DetectorState


class _FakeEvent:
    """Minimal event-like object for testing the detection function."""

    def __init__(self, project, errors=None, platform="javascript"):
        self.project = project
        self.event_id = "fake-event-id"
        self.data: dict[str, Any] = {
            "platform": platform,
            "sdk": {"name": "sentry.javascript.browser", "version": "7.0.0"},
        }
        if errors is not None:
            self.data["errors"] = errors


def _make_job(event, is_reprocessed=False):
    return {
        "event": event,
        "is_reprocessed": is_reprocessed,
    }


def _sourcemap_config():
    return DETECTOR_CONFIGS[0]


def _native_config():
    return DETECTOR_CONFIGS[1]


class TestDetectSourcemapIssues(TestCase):
    def setUp(self):
        super().setUp()
        config = _sourcemap_config()
        cache.delete(_cache_key_triggered(config.slug, self.project.id))

    def test_js_errors_trigger_detector(self) -> None:
        event = _FakeEvent(
            self.project,
            errors=[{"type": "js_no_source", "url": "https://example.com/app.js"}],
        )

        with self.feature("organizations:sourcemap-issue-detection"):
            detect_processing_issues(_make_job(event))

        state = DetectorState.objects.get(
            detector__type=SourcemapConfigurationType.slug,
            detector__project=self.project,
        )
        assert state.is_triggered is True

        config = _sourcemap_config()
        assert cache.get(_cache_key_triggered(config.slug, self.project.id)) is not None

    def test_no_errors_does_not_trigger(self) -> None:
        event = _FakeEvent(self.project, errors=[])

        with self.feature("organizations:sourcemap-issue-detection"):
            detect_processing_issues(_make_job(event))

        assert not DetectorState.objects.filter(
            detector__type=SourcemapConfigurationType.slug,
            detector__project=self.project,
        ).exists()

    def test_non_js_errors_does_not_trigger(self) -> None:
        event = _FakeEvent(
            self.project,
            errors=[{"type": "native_missing_dsym", "image": "libfoo.so"}],
        )

        with self.feature("organizations:sourcemap-issue-detection"):
            detect_processing_issues(_make_job(event))

        assert not DetectorState.objects.filter(
            detector__type=SourcemapConfigurationType.slug,
            detector__project=self.project,
        ).exists()

    def test_feature_flag_off_does_not_trigger(self) -> None:
        event = _FakeEvent(
            self.project,
            errors=[{"type": "js_no_source", "url": "https://example.com/app.js"}],
        )

        detect_processing_issues(_make_job(event))

        assert not DetectorState.objects.filter(
            detector__type=SourcemapConfigurationType.slug,
            detector__project=self.project,
        ).exists()

    def test_reprocessed_event_skipped(self) -> None:
        event = _FakeEvent(
            self.project,
            errors=[{"type": "js_no_source", "url": "https://example.com/app.js"}],
        )

        with self.feature("organizations:sourcemap-issue-detection"):
            detect_processing_issues(_make_job(event, is_reprocessed=True))

        assert not DetectorState.objects.filter(
            detector__type=SourcemapConfigurationType.slug,
            detector__project=self.project,
        ).exists()

    def test_already_triggered_skips_evaluation(self) -> None:
        event = _FakeEvent(
            self.project,
            errors=[{"type": "js_no_source", "url": "https://example.com/app.js"}],
        )

        # First call triggers
        with self.feature("organizations:sourcemap-issue-detection"):
            detect_processing_issues(_make_job(event))

        # Second call should skip evaluation (cache hit)
        with (
            self.feature("organizations:sourcemap-issue-detection"),
            patch("sentry.processing_errors.detection.process_detectors") as mock_process,
        ):
            detect_processing_issues(_make_job(event))
            mock_process.assert_not_called()

    def test_throttled_refresh_updates_date_when_stale(self) -> None:
        event = _FakeEvent(
            self.project,
            errors=[{"type": "js_no_source", "url": "https://example.com/app.js"}],
        )

        with self.feature("organizations:sourcemap-issue-detection"):
            detect_processing_issues(_make_job(event))

        state = DetectorState.objects.get(
            detector__type=SourcemapConfigurationType.slug,
            detector__project=self.project,
        )
        original_date_updated = state.date_updated

        # Allow the rate limiter to pass again by mocking it as not limited
        with (
            self.feature("organizations:sourcemap-issue-detection"),
            patch(
                "sentry.processing_errors.detection.ratelimits.backend.is_limited",
                return_value=False,
            ),
        ):
            detect_processing_issues(_make_job(event))

        state.refresh_from_db()
        assert state.date_updated > original_date_updated

    def test_throttled_refresh_skips_when_recent(self) -> None:
        event = _FakeEvent(
            self.project,
            errors=[{"type": "js_no_source", "url": "https://example.com/app.js"}],
        )

        with self.feature("organizations:sourcemap-issue-detection"):
            detect_processing_issues(_make_job(event))

        state = DetectorState.objects.get(
            detector__type=SourcemapConfigurationType.slug,
            detector__project=self.project,
        )
        original_date_updated = state.date_updated

        # Second call — rate limiter should block the refresh
        with self.feature("organizations:sourcemap-issue-detection"):
            detect_processing_issues(_make_job(event))

        state.refresh_from_db()
        assert state.date_updated == original_date_updated


class TestDetectNativeIssues(TestCase):
    def setUp(self):
        super().setUp()
        config = _native_config()
        cache.delete(_cache_key_triggered(config.slug, self.project.id))

    def test_native_errors_trigger_detector(self) -> None:
        event = _FakeEvent(
            self.project,
            errors=[{"type": "native_missing_dsym", "image": "libfoo.so"}],
            platform="cocoa",
        )

        with self.feature("organizations:native-issue-detection"):
            detect_processing_issues(_make_job(event))

        state = DetectorState.objects.get(
            detector__type=NativeConfigurationType.slug,
            detector__project=self.project,
        )
        assert state.is_triggered is True

        config = _native_config()
        assert cache.get(_cache_key_triggered(config.slug, self.project.id)) is not None

    def test_proguard_errors_trigger_detector(self) -> None:
        event = _FakeEvent(
            self.project,
            errors=[{"type": "proguard_missing_mapping"}],
            platform="java",
        )

        with self.feature("organizations:native-issue-detection"):
            detect_processing_issues(_make_job(event))

        state = DetectorState.objects.get(
            detector__type=NativeConfigurationType.slug,
            detector__project=self.project,
        )
        assert state.is_triggered is True

    def test_js_errors_do_not_trigger_native(self) -> None:
        event = _FakeEvent(
            self.project,
            errors=[{"type": "js_no_source", "url": "https://example.com/app.js"}],
        )

        with self.feature("organizations:native-issue-detection"):
            detect_processing_issues(_make_job(event))

        assert not DetectorState.objects.filter(
            detector__type=NativeConfigurationType.slug,
            detector__project=self.project,
        ).exists()

    def test_feature_flag_off_does_not_trigger(self) -> None:
        event = _FakeEvent(
            self.project,
            errors=[{"type": "native_missing_dsym", "image": "libfoo.so"}],
            platform="cocoa",
        )

        detect_processing_issues(_make_job(event))

        assert not DetectorState.objects.filter(
            detector__type=NativeConfigurationType.slug,
            detector__project=self.project,
        ).exists()

    def test_sourcemap_and_native_trigger_independently(self) -> None:
        event = _FakeEvent(
            self.project,
            errors=[
                {"type": "js_no_source", "url": "https://example.com/app.js"},
                {"type": "native_missing_dsym", "image": "libfoo.so"},
            ],
        )

        with self.feature(
            {
                "organizations:sourcemap-issue-detection": True,
                "organizations:native-issue-detection": True,
            }
        ):
            detect_processing_issues(_make_job(event))

        sourcemap_state = DetectorState.objects.get(
            detector__type=SourcemapConfigurationType.slug,
            detector__project=self.project,
        )
        assert sourcemap_state.is_triggered is True

        native_state = DetectorState.objects.get(
            detector__type=NativeConfigurationType.slug,
            detector__project=self.project,
        )
        assert native_state.is_triggered is True
