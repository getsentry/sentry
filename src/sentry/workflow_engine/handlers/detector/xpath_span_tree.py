import abc
from typing import TYPE_CHECKING, Any

from lxml import etree

from sentry.performance_issues.performance_problem import PerformanceProblem
from sentry.performance_issues.types import Span
from sentry.workflow_engine.handlers.detector.span_tree import SpanTreeDetectorHandler

if TYPE_CHECKING:
    from sentry.performance_issues.base import DetectorType


class XPathSpanTreeDetectorHandler(SpanTreeDetectorHandler):
    """
    DetectorHandler that uses XPath expressions to declaratively select spans
    and evaluate them for performance problems.
    """

    def detect_problems(
        self, span_tree_xml: etree.Element, event: dict[str, Any]
    ) -> dict[str, PerformanceProblem]:
        """Use XPath for span selection on pre-built XML tree."""

        # Get XPath selector from subclass
        span_selector = self._get_span_selector(event)

        # Use XPath to select candidate spans/subtrees
        selected_elements = span_tree_xml.xpath(span_selector)

        problems = {}
        for selection in selected_elements:
            # Each selection could be a single span or a subtree
            problem = self._evaluate_span_selection_for_problem(selection, event)
            if problem:
                problems[problem.fingerprint] = problem

        return problems

    @staticmethod
    def spans_to_xml(spans: list[Span], event: dict[str, Any]) -> etree.Element:
        """Convert span tree to XML structure for XPath querying."""
        root = etree.Element("trace")
        root.set("transaction", event.get("description", ""))
        root.set("timestamp", str(event.get("timestamp", 0)))

        # Create span elements
        span_elements: dict[str, etree.Element] = {}
        for span in spans:
            span_elem = etree.Element("span")

            # Track which keys are nested (for reconstruction)
            nested_keys: list[str] = []

            # Add all span attributes
            for key, value in span.items():
                if isinstance(value, dict):
                    # Flatten dict values with prefixes
                    nested_keys.append(key)
                    for sub_key, sub_value in value.items():
                        span_elem.set(f"{key}__{sub_key}", str(sub_value))
                else:
                    span_elem.set(key, str(value))

            # Add calculated duration
            start = span.get("start_timestamp", 0)
            end = span.get("timestamp", 0)
            duration_ms = (end - start) * 1000
            span_elem.set("duration_ms", str(duration_ms))

            # Store nested keys info for reconstruction
            if nested_keys:
                span_elem.set("__nested_keys__", ",".join(nested_keys))

            span_elements[span.get("span_id", "")] = span_elem

        # Build tree structure based on parent-child relationships
        orphaned_spans: list[etree.Element] = []
        for span in spans:
            span_elem = span_elements[span.get("span_id", "")]
            parent_id = span.get("parent_span_id", "")

            if parent_id and parent_id in span_elements:
                span_elements[parent_id].append(span_elem)
            else:
                orphaned_spans.append(span_elem)

        # Add orphaned spans directly to root
        for span_elem in orphaned_spans:
            root.append(span_elem)

        return root

    def _xml_element_to_span(self, element: etree.Element) -> Span:
        """Convert XML element back to Span dict. Useful helper for subclasses."""
        span = {}
        nested_keys = set()

        # Get nested keys info
        nested_keys_attr = element.get("__nested_keys__")
        if nested_keys_attr:
            nested_keys = set(nested_keys_attr.split(","))

        # Reconstruct span attributes
        nested_data = {}

        for key, value in element.attrib.items():
            # Skip special attributes we added
            if key in ["duration_ms", "__nested_keys__"]:
                continue

            # Handle nested attributes (those with __ separator)
            if "__" in key:
                parent_key, sub_key = key.split("__", 1)
                if parent_key in nested_keys:
                    if parent_key not in nested_data:
                        nested_data[parent_key] = {}
                    # Try to convert back to appropriate type
                    try:
                        # Try int first
                        nested_data[parent_key][sub_key] = int(value)
                    except ValueError:
                        try:
                            # Try float
                            nested_data[parent_key][sub_key] = float(value)
                        except ValueError:
                            # Keep as string
                            nested_data[parent_key][sub_key] = value
                else:
                    # This shouldn't happen but handle gracefully
                    span[key] = value
            else:
                # Direct attribute - try to convert back to appropriate type
                if key in ["start_timestamp", "timestamp"]:
                    span[key] = float(value)
                else:
                    try:
                        # Try int first
                        span[key] = int(value)
                    except ValueError:
                        try:
                            # Try float
                            span[key] = float(value)
                        except ValueError:
                            # Keep as string
                            span[key] = value

        # Add nested data back to span
        span.update(nested_data)

        return span

    def _get_duration_ms(self, span: Span) -> float:
        """Calculate span duration in milliseconds."""
        start = span.get("start_timestamp", 0)
        end = span.get("timestamp", 0)
        return (end - start) * 1000

    @abc.abstractmethod
    def _get_span_selector(self, event: dict[str, Any]) -> str:
        """
        Return the XPath expression to select candidate spans/subtrees.
        This allows subclasses to dynamically generate selectors based on event data
        or detector configuration.

        Args:
            event: Full event data

        Returns:
            XPath expression string
        """
        pass

    @abc.abstractmethod
    def _legacy_detector_type(self) -> "DetectorType | None":
        """
        Return the legacy DetectorType that this detector replaces.
        This is used to avoid running both the new and legacy implementations.

        Returns:
            DetectorType enum value or None if no legacy detector to replace
        """
        pass

    @abc.abstractmethod
    def _evaluate_span_selection_for_problem(
        self, selection: etree.Element, event: dict[str, Any]
    ) -> PerformanceProblem | None:
        """
        Evaluate a selected span or subtree to determine if it represents a performance problem.

        Args:
            selection: XML element representing the selected span(s) - could be a single
                      span or a subtree containing multiple spans for structural analysis
            event: Full event data

        Returns:
            PerformanceProblem if one is detected, None otherwise
        """
        pass
