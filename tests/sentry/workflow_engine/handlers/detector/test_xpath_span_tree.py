from __future__ import annotations

import hashlib
from typing import Any, cast

from lxml.etree import _Element

from sentry.issues.grouptype import PerformanceSlowDBQueryGroupType
from sentry.performance_issues.base import DetectorType
from sentry.performance_issues.performance_problem import PerformanceProblem
from sentry.performance_issues.types import Span
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.handlers.detector.xpath_span_tree import XPathSpanTreeDetectorHandler
from sentry.workflow_engine.models import Detector


class MockDetector:
    """Mock detector for testing."""

    def __init__(self, config=None):
        self.config = config or {"duration_threshold": 1000}
        self.name = "Test Slow DB Query Detector"
        self.workflow_condition_group_id = None


class MockSlowDBQueryDetectorHandler(XPathSpanTreeDetectorHandler):
    """Mock implementation of XPath-based slow DB query detector for testing."""

    def __init__(self, detector: MockDetector | Detector):
        # Store the mock detector in the same way the parent class would
        self.detector: Any = detector  # Use Any to avoid type conflicts in test

    def _get_span_selector(self, event: dict[str, Any]) -> str:
        threshold = self.detector.config.get("duration_threshold", 1000)
        return (
            f"//span["
            f"starts-with(@op, 'db') and "
            f"@duration_ms > {threshold} and "
            f"starts-with(@description, 'SELECT') and "
            f"not(substring(@description, string-length(@description) - 2) = '...')"
            f"]"
        )

    def _legacy_detector_type(self) -> DetectorType | None:
        return DetectorType.SLOW_DB_QUERY

    def _evaluate_span_selection_for_problem(
        self, selection: _Element, event: dict[str, Any]
    ) -> PerformanceProblem | None:
        # Convert back to span dict
        span = self._xml_element_to_span(selection)

        span_id = span.get("span_id", "")
        op = span.get("op", "")
        description = span.get("description", "").strip()
        hash_value = span.get("hash", "")

        # Create a simple fingerprint for testing
        signature = str(hash_value).encode("utf-8")
        full_fingerprint = hashlib.sha1(signature).hexdigest()
        fingerprint = f"1-{PerformanceSlowDBQueryGroupType.type_id}-{full_fingerprint}"

        return PerformanceProblem(
            type=PerformanceSlowDBQueryGroupType,
            fingerprint=fingerprint,
            op=op,
            desc=description,
            cause_span_ids=[],
            parent_span_ids=[],
            offender_span_ids=[span_id],
            evidence_data={
                "op": op,
                "cause_span_ids": [],
                "parent_span_ids": [],
                "offender_span_ids": [span_id],
                "transaction_name": event.get("description", ""),
            },
            evidence_display=[],
        )

    # Implement required abstract methods (not needed for these tests but required by base class)
    def evaluate(self, data_packet):
        return {}

    def create_occurrence(self, evaluation_result, data_packet, priority):
        from sentry.workflow_engine.handlers.detector.base import DetectorOccurrence

        return (
            DetectorOccurrence(
                issue_title="Test",
                subtitle="Test",
                type=PerformanceSlowDBQueryGroupType,
                level="error",
                culprit="test",
            ),
            {},
        )

    def extract_value(self, data_packet):
        return 0

    def extract_dedupe_value(self, data_packet):
        return 0


class XPathSpanTreeDetectorHandlerTest(TestCase):
    def setUp(self):
        super().setUp()
        self.project = self.create_project()

        # Create a mock detector with config
        self.detector = MockDetector({"duration_threshold": 1000})
        self.handler = MockSlowDBQueryDetectorHandler(self.detector)

    def _get_xpath_element(self, root: _Element, xpath_expr: str) -> _Element:
        """Helper to safely get a single element from XPath results."""
        results = root.xpath(xpath_expr)
        assert isinstance(results, list) and len(results) > 0, f"No results for xpath: {xpath_expr}"
        element = results[0]
        assert isinstance(element, _Element), f"Expected Element, got {type(element)}"
        return element

    def create_test_spans(self) -> list[dict[str, Any]]:
        """Create test spans with various characteristics for testing."""
        return [
            {
                "span_id": "root_span",
                "parent_span_id": None,
                "op": "navigation",
                "description": "GET /api/items",
                "start_timestamp": 0.0,
                "timestamp": 5.0,
                "hash": "abc123",
                "data": {"url": "/api/items", "method": "GET"},
            },
            {
                "span_id": "fast_db_span",
                "parent_span_id": "root_span",
                "op": "db",
                "description": "SELECT * FROM users WHERE id = 1",
                "start_timestamp": 1.0,
                "timestamp": 1.5,  # 500ms duration
                "hash": "def456",
                "data": {"db.statement": "SELECT * FROM users WHERE id = 1"},
            },
            {
                "span_id": "slow_db_span",
                "parent_span_id": "root_span",
                "op": "db.query",
                "description": "SELECT * FROM items WHERE status = 'active'",
                "start_timestamp": 2.0,
                "timestamp": 4.0,  # 2000ms duration
                "hash": "ghi789",
                "data": {"db.statement": "SELECT * FROM items WHERE status = 'active'"},
            },
            {
                "span_id": "truncated_query",
                "parent_span_id": "root_span",
                "op": "db",
                "description": "SELECT * FROM very_long_table_name...",
                "start_timestamp": 3.0,
                "timestamp": 5.0,  # 2000ms duration
                "hash": "jkl012",
                "data": {"db.statement": "SELECT * FROM very_long_table_name..."},
            },
            {
                "span_id": "non_db_span",
                "parent_span_id": "root_span",
                "op": "http.client",
                "description": "GET https://api.example.com/data",
                "start_timestamp": 1.5,
                "timestamp": 3.5,  # 2000ms duration
                "hash": "mno345",
                "data": {"url": "https://api.example.com/data"},
            },
        ]

    def create_test_event(self) -> dict[str, Any]:
        """Create test event data."""
        return {
            "event_id": "test_event_123",
            "description": "GET /api/items",
            "timestamp": 1234567890.0,
            "spans": self.create_test_spans(),
        }

    def test_spans_to_xml_conversion(self):
        """Test converting spans to XML structure."""
        spans = self.create_test_spans()
        event = self.create_test_event()

        xml_root = XPathSpanTreeDetectorHandler.spans_to_xml(cast(list[Span], spans), event)

        # Check root element
        assert xml_root.tag == "trace"
        assert xml_root.get("transaction") == "GET /api/items"
        assert xml_root.get("timestamp") == "1234567890.0"

        # Check spans are present
        span_elements = xml_root.xpath("//span")
        assert isinstance(span_elements, list)
        assert len(span_elements) == 5

        # Check specific span attributes
        slow_db_span = self._get_xpath_element(xml_root, "//span[@span_id='slow_db_span']")
        assert slow_db_span.get("op") == "db.query"
        assert slow_db_span.get("description") == "SELECT * FROM items WHERE status = 'active'"
        assert slow_db_span.get("duration_ms") == "2000.0"
        assert (
            slow_db_span.get("data__db.statement") == "SELECT * FROM items WHERE status = 'active'"
        )
        assert slow_db_span.get("__nested_keys__") == "data"

        # Check parent-child relationships
        root_span = self._get_xpath_element(xml_root, "//span[@span_id='root_span']")
        child_spans = root_span.xpath("./span")
        assert isinstance(child_spans, list)
        assert len(child_spans) == 4  # All other spans are children of root

    def test_xml_element_to_span_conversion(self):
        """Test converting XML element back to span dictionary."""
        spans = self.create_test_spans()
        event = self.create_test_event()

        xml_root = XPathSpanTreeDetectorHandler.spans_to_xml(cast(list[Span], spans), event)
        slow_db_element = self._get_xpath_element(xml_root, "//span[@span_id='slow_db_span']")

        # Convert back to span
        reconstructed_span = self.handler._xml_element_to_span(slow_db_element)

        # Find original span for comparison
        original_span = next(s for s in spans if s["span_id"] == "slow_db_span")

        # Check basic attributes
        assert reconstructed_span["span_id"] == original_span["span_id"]
        assert reconstructed_span["op"] == original_span["op"]
        assert reconstructed_span["description"] == original_span["description"]
        assert reconstructed_span["start_timestamp"] == original_span["start_timestamp"]
        assert reconstructed_span["timestamp"] == original_span["timestamp"]
        assert reconstructed_span["hash"] == original_span["hash"]

        # Check nested data is reconstructed correctly
        assert "data" in reconstructed_span
        assert reconstructed_span["data"] is not None
        assert original_span["data"] is not None
        assert reconstructed_span["data"]["db.statement"] == original_span["data"]["db.statement"]

    def test_xpath_span_selection(self):
        """Test XPath selector correctly identifies slow DB spans."""
        spans = self.create_test_spans()
        event = self.create_test_event()

        xml_root = XPathSpanTreeDetectorHandler.spans_to_xml(cast(list[Span], spans), event)

        # Get XPath selector from handler
        selector = self.handler._get_span_selector(event)

        # Apply selector
        selected_elements = xml_root.xpath(selector)

        # Should select only the slow DB span that meets criteria
        # (db operation, > 1000ms duration, starts with SELECT, not truncated)
        assert isinstance(selected_elements, list)
        assert len(selected_elements) == 1
        assert isinstance(selected_elements[0], _Element)
        assert selected_elements[0].get("span_id") == "slow_db_span"

        # fast_db_span should be excluded (duration too short)
        # truncated_query should be excluded (ends with '...')
        # non_db_span should be excluded (not db operation)

    def test_detect_problems_with_slow_query(self):
        """Test end-to-end problem detection with slow query."""
        spans = self.create_test_spans()
        event = self.create_test_event()

        xml_root = XPathSpanTreeDetectorHandler.spans_to_xml(cast(list[Span], spans), event)
        problems = self.handler._detect_problems_from_xml(xml_root, event)

        assert len(problems) == 1
        problem = next(iter(problems.values()))

        assert problem.type == PerformanceSlowDBQueryGroupType
        assert problem.op == "db.query"
        assert problem.desc == "SELECT * FROM items WHERE status = 'active'"
        assert problem.offender_span_ids == ["slow_db_span"]
        assert problem.evidence_data is not None
        assert problem.evidence_data["transaction_name"] == "GET /api/items"

    def test_detect_problems_with_no_slow_queries(self):
        """Test detection when no slow queries are present."""
        # Create spans with only fast queries
        fast_spans = [
            {
                "span_id": "fast_span_1",
                "parent_span_id": None,
                "op": "db",
                "description": "SELECT * FROM users LIMIT 1",
                "start_timestamp": 0.0,
                "timestamp": 0.3,  # 300ms duration
                "hash": "fast123",
            }
        ]

        event = {"description": "Fast Transaction", "timestamp": 1234567890.0}
        xml_root = XPathSpanTreeDetectorHandler.spans_to_xml(cast(list[Span], fast_spans), event)
        problems = self.handler._detect_problems_from_xml(xml_root, event)

        assert len(problems) == 0

    def test_custom_threshold_configuration(self):
        """Test that detector respects custom duration threshold."""
        # Create handler with lower threshold
        detector_with_low_threshold = MockDetector({"duration_threshold": 400})
        low_threshold_handler = MockSlowDBQueryDetectorHandler(detector_with_low_threshold)

        spans = self.create_test_spans()
        event = self.create_test_event()

        xml_root = XPathSpanTreeDetectorHandler.spans_to_xml(cast(list[Span], spans), event)
        problems = low_threshold_handler._detect_problems_from_xml(xml_root, event)

        # Now both fast_db_span (500ms) and slow_db_span (2000ms) should be detected
        # but truncated_query should still be excluded
        assert len(problems) == 2

        detected_span_ids: set[str] = set()
        for problem in problems.values():
            detected_span_ids.update(problem.offender_span_ids)

        # Should detect fast_db_span and slow_db_span
        assert "fast_db_span" in detected_span_ids
        assert "slow_db_span" in detected_span_ids

    def test_legacy_detector_type_mapping(self):
        """Test that handler correctly identifies its legacy detector type."""
        assert self.handler._legacy_detector_type() == DetectorType.SLOW_DB_QUERY

    def test_get_duration_ms_calculation(self):
        """Test duration calculation helper method."""
        span = {
            "start_timestamp": 1.0,
            "timestamp": 3.5,
        }

        duration = self.handler._get_duration_ms(cast(Span, span))
        assert duration == 2500.0  # (3.5 - 1.0) * 1000

    def test_xml_conversion_with_complex_nested_data(self):
        """Test XML conversion handles complex nested data structures."""
        complex_span = {
            "span_id": "complex_span",
            "op": "db",
            "description": "Complex query",
            "start_timestamp": 0.0,
            "timestamp": 2.0,
            "hash": "complex123",
            "data": {
                "db.statement": "SELECT * FROM table",
                "db.name": "postgres",
                "connection": {"host": "localhost", "port": 5432},
            },
            "tags": {"environment": "test", "service": "api"},
        }

        event = {"description": "Complex Transaction"}
        xml_root = XPathSpanTreeDetectorHandler.spans_to_xml(
            cast(list[Span], [complex_span]), event
        )

        span_element = self._get_xpath_element(xml_root, "//span[@span_id='complex_span']")

        # Check that nested data is flattened with prefixes
        assert span_element.get("data__db.statement") == "SELECT * FROM table"
        assert span_element.get("data__db.name") == "postgres"
        assert span_element.get("tags__environment") == "test"
        assert span_element.get("tags__service") == "api"

        # Check nested keys are tracked
        nested_keys_str = span_element.get("__nested_keys__")
        assert nested_keys_str is not None
        nested_keys = nested_keys_str.split(",")
        assert "data" in nested_keys
        assert "tags" in nested_keys

        # Test conversion back to span - use dict access since TypedDict doesn't have tags
        reconstructed = self.handler._xml_element_to_span(span_element)
        reconstructed_dict = cast(dict[str, Any], reconstructed)

        assert reconstructed_dict["data"] is not None
        assert reconstructed_dict["data"]["db.statement"] == "SELECT * FROM table"
        assert reconstructed_dict["data"]["db.name"] == "postgres"
        assert reconstructed_dict["tags"]["environment"] == "test"
        assert reconstructed_dict["tags"]["service"] == "api"
