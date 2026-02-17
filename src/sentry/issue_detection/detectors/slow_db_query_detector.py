from __future__ import annotations

import hashlib
import logging
from datetime import timedelta

from sentry.issues.grouptype import PerformanceSlowDBQueryGroupType
from sentry.issues.issue_occurrence import IssueEvidence
from sentry.models.organization import Organization
from sentry.models.project import Project

from ..base import DetectorType, PerformanceDetector
from ..detectors.utils import (
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

        if self.stored_problems.get(fingerprint):
            logging.info(
                "Multiple occurrences detected for fingerprint",
                extra={"detector": self.settings_key},
            )
            return

        description = span["description"].strip()

        if duration_threshold is not None and span_duration >= timedelta(
            milliseconds=duration_threshold
        ):
            spans_involved = [span_id]

            hash = span.get("hash", "")
            type = PerformanceSlowDBQueryGroupType

            evidence_data = {
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
            }
            if self.detector_id is not None:
                evidence_data["detector_id"] = self.detector_id

            self.stored_problems[fingerprint] = PerformanceProblem(
                type=type,
                fingerprint=self._fingerprint(hash),
                op=op,
                desc=description[:MAX_EVIDENCE_VALUE_LENGTH],
                cause_span_ids=[],
                parent_span_ids=[],
                offender_span_ids=spans_involved,
                evidence_data=evidence_data,
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
