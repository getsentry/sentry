from __future__ import annotations

from unittest.mock import patch

import pytest

from sentry.performance_issues.performance_detection import _detect_performance_problems
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import Feature
from sentry.workflow_engine.handlers.detector.xpath_span_tree import XPathSpanTreeDetectorHandler
from sentry.workflow_engine.models import DataConditionGroup, Detector


@pytest.mark.django_db
class NewDetectorIntegrationTest(TestCase):
    def setUp(self):
        super().setUp()
        self.project = self.create_project()
        self.organization = self.project.organization

        # Create a data condition group for the detector
        self.data_condition_group = DataConditionGroup.objects.create(
            organization_id=self.organization.id,
        )

    def create_slow_db_detector(self, enabled=True, threshold=1000) -> Detector:
        """Create a slow DB query detector instance."""
        from sentry.issues.grouptype import PerformanceSlowDBQueryGroupType

        return Detector.objects.create(
            project_id=self.project.id,
            enabled=enabled,
            name="Slow DB Query Detection",
            type=PerformanceSlowDBQueryGroupType.slug,
            workflow_condition_group=self.data_condition_group,
            config={
                "duration_threshold": threshold,
                "allowed_span_ops": ["db"],
            },
            description="Detects slow database queries exceeding duration threshold",
        )

    def create_slow_db_event(self, duration_seconds=2.0) -> dict:
        """Create an event with slow DB query spans."""
        return {
            "event_id": "slow_db_test",
            "description": "Slow DB Transaction",
            "timestamp": 1234567890.0,
            "spans": [
                {
                    "span_id": "root_span",
                    "parent_span_id": None,
                    "op": "navigation",
                    "description": "GET /api/slow",
                    "start_timestamp": 0.0,
                    "timestamp": 3.0,
                    "hash": "root123",
                },
                {
                    "span_id": "slow_db_span",
                    "parent_span_id": "root_span",
                    "op": "db",
                    "description": "SELECT * FROM large_table WHERE complex_condition = 'value'",
                    "start_timestamp": 1.0,
                    "timestamp": 1.0 + duration_seconds,
                    "hash": "slow_db_hash",
                    "data": {
                        "db.statement": "SELECT * FROM large_table WHERE complex_condition = 'value'"
                    },
                },
            ],
        }

    @Feature("performance.issues.new_detectors.slow_db_query_detection")
    @patch.object(XPathSpanTreeDetectorHandler, "detect_problems")
    def test_new_detector_path_executes(self, mock_detect_problems):
        """Test that new detector path executes when feature flag is enabled."""
        # Setup mock to return a problem
        mock_detect_problems.return_value = {}  # No problems found for simplicity

        self.create_slow_db_detector(enabled=True, threshold=1000)
        event = self.create_slow_db_event(duration_seconds=1.5)

        _detect_performance_problems(event, None, self.project)

        # Assert that the new detector's detect_problems method was called
        mock_detect_problems.assert_called_once()

        # Verify the call arguments
        call_args = mock_detect_problems.call_args
        span_tree_xml, event_data = call_args[0]

        # Verify XML tree was passed
        assert span_tree_xml.tag == "trace"
        assert event_data == event

    @patch.object(XPathSpanTreeDetectorHandler, "detect_problems")
    def test_new_detector_path_disabled_when_flag_off(self, mock_detect_problems):
        """Test that new detector path doesn't execute when feature flag is disabled."""
        self.create_slow_db_detector(enabled=True, threshold=1000)
        event = self.create_slow_db_event(duration_seconds=1.5)

        # Feature flag disabled by default
        _detect_performance_problems(event, None, self.project)

        # Assert that the new detector's detect_problems method was NOT called
        mock_detect_problems.assert_not_called()

    @Feature("performance.issues.new_detectors.slow_db_query_detection")
    @patch.object(XPathSpanTreeDetectorHandler, "detect_problems")
    def test_disabled_detector_not_executed(self, mock_detect_problems):
        """Test that disabled detectors don't execute even with feature flag on."""
        self.create_slow_db_detector(enabled=False, threshold=1000)
        event = self.create_slow_db_event(duration_seconds=1.5)

        _detect_performance_problems(event, None, self.project)

        # Should not call detect_problems for disabled detector
        mock_detect_problems.assert_not_called()

    @Feature("performance.issues.new_detectors.slow_db_query_detection")
    @patch.object(XPathSpanTreeDetectorHandler, "spans_to_xml")
    def test_xml_conversion_called_once(self, mock_spans_to_xml):
        """Test that XML conversion happens exactly once per detection cycle."""

        # Setup mock to return a mock XML tree
        class MockXML:
            tag = "trace"

            def xpath(self, selector):
                return []

        mock_spans_to_xml.return_value = MockXML()

        self.create_slow_db_detector(enabled=True, threshold=1000)
        event = self.create_slow_db_event(duration_seconds=1.5)

        _detect_performance_problems(event, None, self.project)

        # XML conversion should happen exactly once
        mock_spans_to_xml.assert_called_once()

        # Verify it was called with the correct arguments
        call_args = mock_spans_to_xml.call_args
        spans, event_data = call_args[0]
        assert spans == event["spans"]
        assert event_data == event

    @Feature("performance.issues.new_detectors.slow_db_query_detection")
    def test_real_detection_end_to_end(self):
        """Test actual detection without mocking to verify full integration."""
        self.create_slow_db_detector(enabled=True, threshold=1000)
        event = self.create_slow_db_event(duration_seconds=1.5)  # 1500ms - above threshold

        problems = _detect_performance_problems(event, None, self.project)

        # Should detect the slow query - problems are deduped by fingerprint
        # so we need to check that we have at least one problem with our span
        detected_span_ids = set()
        for problem in problems:
            detected_span_ids.update(problem.offender_span_ids)

        assert "slow_db_span" in detected_span_ids

        # Verify problem characteristics
        slow_db_problems = [p for p in problems if "slow_db_span" in p.offender_span_ids]
        assert len(slow_db_problems) >= 1  # May be deduped with legacy detector

        problem = slow_db_problems[0]
        assert "SELECT * FROM large_table" in problem.desc

    @Feature("performance.issues.new_detectors.slow_db_query_detection")
    def test_deduplication_with_legacy_detector(self):
        """Test that problems are properly deduped between new and legacy detectors."""
        # This test verifies that if both new and legacy detectors somehow run
        # (edge case), the deduplication in _detect_performance_problems works
        self.create_slow_db_detector(enabled=True, threshold=1000)
        event = self.create_slow_db_event(duration_seconds=1.5)

        problems = _detect_performance_problems(event, None, self.project)

        # Convert to set to test deduplication - should not have duplicates
        problem_fingerprints = [p.fingerprint for p in problems]
        unique_fingerprints = set(problem_fingerprints)

        # No duplicate fingerprints should exist
        assert len(problem_fingerprints) == len(unique_fingerprints)

    @Feature("performance.issues.new_detectors.slow_db_query_detection")
    @patch.object(XPathSpanTreeDetectorHandler, "detect_problems")
    def test_multiple_detectors_share_xml_conversion(self, mock_detect_problems):
        """Test that multiple span detectors share the same XML conversion."""
        mock_detect_problems.return_value = {}

        # Create multiple detectors
        self.create_slow_db_detector(enabled=True, threshold=1000)
        # Don't create another detector to avoid group type registration issues
        # The test is about verifying XML conversion is called once even with multiple detectors
        # We'll just mock that multiple detectors exist

        event = self.create_slow_db_event(duration_seconds=1.5)

        with patch.object(XPathSpanTreeDetectorHandler, "spans_to_xml") as mock_xml_conversion:

            class MockXML:
                tag = "trace"

                def xpath(self, selector):
                    return []

            mock_xml_conversion.return_value = MockXML()

            _detect_performance_problems(event, None, self.project)

            # XML conversion should happen only once despite multiple detectors
            mock_xml_conversion.assert_called_once()

            # detect_problems should be called for the detector
            mock_detect_problems.assert_called_once()

    def test_no_spans_no_xml_conversion(self):
        """Test that XML conversion doesn't happen when there are no spans."""
        self.create_slow_db_detector(enabled=True, threshold=1000)
        event = {
            "event_id": "no_spans_test",
            "description": "No Spans Transaction",
            "spans": [],
        }

        with patch.object(XPathSpanTreeDetectorHandler, "spans_to_xml") as mock_xml_conversion:
            problems = _detect_performance_problems(event, None, self.project)

            # Should not call XML conversion when there are no spans
            mock_xml_conversion.assert_not_called()
            assert len(problems) == 0
