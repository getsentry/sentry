from __future__ import annotations

import hashlib
import logging
from typing import Any

from sentry.issue_detection.base import DetectorType
from sentry.issue_detection.detectors.span_first.base import SpanFirstDetector
from sentry.issue_detection.detectors.span_first.span_first_utils import (
    get_description,
    get_duration,
    get_evidence_value,
    get_grouping_hash,
    get_op,
    get_segment_transaction,
    truncate,
)
from sentry.issue_detection.performance_problem import PerformanceProblem
from sentry.issue_detection.types import StandaloneSpan
from sentry.issues.grouptype import PerformanceSlowDBQueryGroupType
from sentry.issues.issue_occurrence import IssueEvidence

logger = logging.getLogger(__name__)


class SpanFirstSlowDBQueryDetector(SpanFirstDetector):
    """
    Span-first version of SlowDBQueryDetector.

    Check for slow database spans.
    """

    type = DetectorType.SLOW_DB_QUERY
    grouptype = PerformanceSlowDBQueryGroupType

    def visit_span(self, span: StandaloneSpan) -> None:
        op = get_op(span)
        description = get_description(span)
        span_id = span.get("span_id")
        duration_threshold = self._settings.get("duration_threshold")

        # Ensure we have the data we need
        if not op or not description or not span_id or duration_threshold is None:
            return

        # Check op and description to ensure this is the right kind of span to be checking
        if not self._is_span_eligible(op, description):
            return

        # This is the real check - if the span isn't slower than the threshold, nothing to report
        if get_duration(span) < duration_threshold:
            return

        # At this point we know there's a problem to report

        fingerprint = self._get_fingerprint(span)
        transaction_name = get_segment_transaction(self._segment_span)

        if fingerprint in self.stored_problems:
            logger.info(
                "slow_db_query_span_first.duplicate_fingerprint",
                extra={"fingerprint": fingerprint},
            )
            return

        evidence_value = truncate(get_evidence_value(op, description))
        trimmed_description = truncate(description)
        evidence_data: dict[str, Any] = {
            "op": op,
            "cause_span_ids": [],
            "parent_span_ids": [],
            "offender_span_ids": [span_id],
            "transaction_name": transaction_name,
            "repeating_spans": evidence_value,
            "repeating_spans_compact": trimmed_description,
            "num_repeating_spans": "1",
        }
        if self._detector_id is not None:
            evidence_data["detector_id"] = self._detector_id

        self.stored_problems[fingerprint] = PerformanceProblem(
            type=self.grouptype,
            fingerprint=fingerprint,
            op=op,
            desc=trimmed_description,
            cause_span_ids=[],
            parent_span_ids=[],
            offender_span_ids=[span_id],
            evidence_data=evidence_data,
            evidence_display=[
                IssueEvidence(
                    name="Offending Spans",
                    value=evidence_value,
                    # Has to be marked important to be displayed in the notifications
                    important=True,
                )
            ],
        )

    def _is_span_eligible(self, op: str, description: str) -> bool:
        allowed_span_ops = self._settings.get("allowed_span_ops") or []
        if allowed_span_ops and not any(op.startswith(prefix) for prefix in allowed_span_ops):
            return False

        if description[:6].upper() != "SELECT":
            return False
        if description.endswith("..."):
            return False

        return True

    def _get_fingerprint(self, span: StandaloneSpan) -> str:
        hashed_grouping_hash = hashlib.sha1(get_grouping_hash(span).encode("utf-8")).hexdigest()
        return f"1-{self.grouptype.type_id}-{hashed_grouping_hash}"
