from __future__ import annotations

import hashlib
from datetime import timedelta

from sentry.issues.grouptype import PerformanceSlowDBQueryGroupType
from sentry.issues.issue_occurrence import IssueEvidence
from sentry.models.organization import Organization
from sentry.models.project import Project

from ..base import (
    DetectorType,
    PerformanceDetector,
    fingerprint_span,
    get_notification_attachment_body,
    get_span_evidence_value,
)
from ..performance_problem import PerformanceProblem
from ..types import Span

# Truncating the evidence to prevent hitting Kafka's broken message size limit.
#  A better solution would be to audit the usage of `description`,
#  `evidence_data` and `evidence_display` and deduplicate those keys. Right now
#  they are nearly identical
MAX_EVIDENCE_VALUE_LENGTH = 10_000


class SlowDBQueryDetector(PerformanceDetector):
    """
    Check for slow spans in a certain type of span.op (eg. slow db spans)
    """

    type = DetectorType.SLOW_DB_QUERY
    settings_key = DetectorType.SLOW_DB_QUERY

    def visit_span(self, span: Span) -> None:
        settings_for_span = self.settings_for_span(span)
        if not settings_for_span:
            return
        op, span_id, op_prefix, span_duration, settings = settings_for_span
        duration_threshold = settings.get("duration_threshold")

        fingerprint = fingerprint_span(span)

        if not fingerprint:
            return

        if not self._is_span_eligible(span):
            return

        description = span["description"].strip()

        if span_duration >= timedelta(
            milliseconds=duration_threshold
        ) and not self.stored_problems.get(fingerprint, False):
            spans_involved = [span_id]

            hash = span.get("hash", "")
            type = PerformanceSlowDBQueryGroupType

            self.stored_problems[fingerprint] = PerformanceProblem(
                type=type,
                fingerprint=self._fingerprint(hash),
                op=op,
                desc=description[:MAX_EVIDENCE_VALUE_LENGTH],
                cause_span_ids=[],
                parent_span_ids=[],
                offender_span_ids=spans_involved,
                evidence_data={
                    "op": op,
                    "cause_span_ids": [],
                    "parent_span_ids": [],
                    "offender_span_ids": spans_involved,
                    "transaction_name": self._event.get("description", ""),
                    "repeating_spans": get_span_evidence_value(span)[:MAX_EVIDENCE_VALUE_LENGTH],
                    "repeating_spans_compact": get_span_evidence_value(span, include_op=False)[
                        :MAX_EVIDENCE_VALUE_LENGTH
                    ],
                    "num_repeating_spans": str(len(spans_involved)),
                },
                evidence_display=[
                    IssueEvidence(
                        name="Offending Spans",
                        value=get_notification_attachment_body(
                            op,
                            description,
                        )[:MAX_EVIDENCE_VALUE_LENGTH],
                        # Has to be marked important to be displayed in the notifications
                        important=True,
                    )
                ],
            )

    def is_creation_allowed_for_organization(self, organization: Organization | None) -> bool:
        return True

    def is_creation_allowed_for_project(self, project: Project | None) -> bool:
        return self.settings["detection_enabled"]

    def _is_span_eligible(self, span: Span) -> bool:
        description = span.get("description", None)
        if not description:
            return False

        description = description.strip()
        if description[:6].upper() != "SELECT":
            return False

        if description.endswith("..."):
            return False

        return True

    def _fingerprint(self, hash: str) -> str:
        signature = (str(hash)).encode("utf-8")
        full_fingerprint = hashlib.sha1(signature).hexdigest()
        return f"1-{PerformanceSlowDBQueryGroupType.type_id}-{full_fingerprint}"


# New workflow engine-based detector handler
from typing import Any

from lxml.etree import _Element

from sentry.workflow_engine.handlers.detector.base import DetectorOccurrence, EventData
from sentry.workflow_engine.handlers.detector.span_tree import SpanTreeDataPacket
from sentry.workflow_engine.handlers.detector.xpath_span_tree import XPathSpanTreeDetectorHandler
from sentry.workflow_engine.models import DataPacket
from sentry.workflow_engine.processors.data_condition_group import ProcessedDataConditionGroup
from sentry.workflow_engine.types import DetectorPriorityLevel


class SlowDBQueryDetectorHandler(XPathSpanTreeDetectorHandler):
    """
    DetectorHandler for slow database query detection using XPath.
    Selects DB spans that exceed the duration threshold.
    """

    def _get_span_selector(self, event: dict[str, Any]) -> str:
        """
        Generate XPath selector for slow DB spans.
        Selects spans that:
        - Have op starting with 'db'
        - Exceed duration threshold
        - Have description starting with 'SELECT'
        - Don't end with '...' (truncated queries)
        """
        # Get threshold from detector config
        settings = self.detector.config or {}
        threshold = settings.get("duration_threshold", 1000)  # Default 1000ms

        return (
            f"//span["
            f"starts-with(@op, 'db') and "
            f"@duration_ms > {threshold} and "
            f"starts-with(@description, 'SELECT') and "
            f"not(substring(@description, string-length(@description) - 2) = '...')"
            f"]"
        )

    def _legacy_detector_type(self) -> DetectorType | None:
        """Return the legacy DetectorType that this detector replaces."""
        return DetectorType.SLOW_DB_QUERY

    def _evaluate_span_selection_for_problem(
        self, selection: _Element, event: dict[str, Any]
    ) -> PerformanceProblem | None:
        """
        Evaluate a selected slow DB span to create a performance problem.
        """
        # Convert back to span dict for processing
        span = XPathSpanTreeDetectorHandler.xml_element_to_span(selection)

        span_id = span.get("span_id", "")
        op = span.get("op", "")
        description = span.get("description", "").strip()
        hash_value = span.get("hash", "")

        spans_involved = [span_id]
        duration_ms = self._get_duration_ms(span)

        problem = PerformanceProblem(
            type=PerformanceSlowDBQueryGroupType,
            fingerprint=self._fingerprint(hash_value),
            op=op,
            desc=description[:MAX_EVIDENCE_VALUE_LENGTH],
            cause_span_ids=[],
            parent_span_ids=[],
            offender_span_ids=spans_involved,
            evidence_data={
                "op": op,
                "cause_span_ids": [],
                "parent_span_ids": [],
                "offender_span_ids": spans_involved,
                "transaction_name": event.get("description", ""),
                "repeating_spans": get_span_evidence_value(span)[:MAX_EVIDENCE_VALUE_LENGTH],
                "repeating_spans_compact": get_span_evidence_value(span, include_op=False)[
                    :MAX_EVIDENCE_VALUE_LENGTH
                ],
                "num_repeating_spans": str(len(spans_involved)),
                "duration_ms": f"{duration_ms:.0f}",
            },
            evidence_display=[
                IssueEvidence(
                    name="Offending Spans",
                    value=get_notification_attachment_body(op, description)[
                        :MAX_EVIDENCE_VALUE_LENGTH
                    ],
                    important=True,
                )
            ],
        )

        return problem

    # Note that this is not used, since occurrences are created here:
    # https://github.com/getsentry/sentry/blob/05db3d1a792d61a770bcf4ebd3136a7b8596e82e/src/sentry/event_manager.py#L2768
    def create_occurrence(
        self,
        evaluation_result: ProcessedDataConditionGroup,
        data_packet: DataPacket[SpanTreeDataPacket],
        priority: DetectorPriorityLevel,
    ) -> tuple[DetectorOccurrence, EventData]:
        """
        Create a DetectorOccurrence from the performance problem.
        """
        if not data_packet.packet:
            raise ValueError("DataPacket packet is None")

        problem = evaluation_result.condition_results[0].result

        if not problem:
            raise ValueError("No performance problems found")

        # Type check: ensure we have a PerformanceProblem
        if not isinstance(problem, PerformanceProblem):
            raise ValueError(f"Expected PerformanceProblem, got {type(problem)}")

        # Get duration from evidence_data if available, otherwise calculate it from XML
        evidence_data = problem.evidence_data or {}
        duration_ms = f"{evidence_data.get('duration_ms')}ms"

        occurrence = DetectorOccurrence(
            issue_title=f"Slow DB Query: {problem.desc[:100]}",
            subtitle=f"Query took {duration_ms}",
            evidence_data=problem.evidence_data or {},
            evidence_display=problem.evidence_display,
            type=problem.type,
            level="error",
            culprit=problem.desc,
            priority=priority,
        )

        # Create event data
        event_data = {
            "fingerprint": problem.fingerprint,
            "op": problem.op,
            "description": problem.desc,
            "span_ids": problem.offender_span_ids,
        }

        return occurrence, event_data

    def _fingerprint(self, hash_value: str) -> str:
        """Generate fingerprint for the problem."""
        signature = str(hash_value).encode("utf-8")
        full_fingerprint = hashlib.sha1(signature).hexdigest()
        return f"1-{PerformanceSlowDBQueryGroupType.type_id}-{full_fingerprint}"
