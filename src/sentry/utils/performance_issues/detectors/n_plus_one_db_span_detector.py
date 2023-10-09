from __future__ import annotations

import hashlib
from typing import Optional

from sentry.issues.grouptype import PerformanceNPlusOneGroupType
from sentry.issues.issue_occurrence import IssueEvidence
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.utils import metrics
from sentry.utils.safe import get_path

from ..base import (
    DetectorType,
    PerformanceDetector,
    get_notification_attachment_body,
    get_span_evidence_value,
    total_span_time,
)
from ..performance_problem import PerformanceProblem
from ..types import Span


class NPlusOneDBSpanDetector(PerformanceDetector):
    """
    Detector goals:
      - identify a database N+1 query with high accuracy
      - collect enough information to create a good fingerprint (see below)
      - only return issues with good fingerprints

    A good fingerprint is one that gives us confidence that, if two fingerprints
    match, then they correspond to the same issue location in code (and
    therefore, the same fix).

    To do this we look for a specific structure:

      [-------- transaction span -----------]
         [-------- parent span -----------]
            [source query]
                          [n0]
                              [n1]
                                  [n2]
                                      ...

    If we detect two different N+1 problems, and both have matching parents,
    source queries, and repeated (n) queries, then we can be fairly confident
    they are the same issue.
    """

    __slots__ = (
        "stored_problems",
        "potential_parents",
        "source_span",
        "n_hash",
        "n_spans",
        "transaction",
    )

    type = DetectorType.N_PLUS_ONE_DB_QUERIES
    settings_key = DetectorType.N_PLUS_ONE_DB_QUERIES

    def init(self):
        self.stored_problems = {}
        self.potential_parents = {}
        self.n_hash = None
        self.n_spans = []
        self.source_span = None
        root_span = get_path(self._event, "contexts", "trace")
        if root_span:
            self.potential_parents[root_span.get("span_id")] = root_span

    def is_creation_allowed_for_organization(self, organization: Optional[Organization]) -> bool:
        return True  # This detector is fully rolled out

    def is_creation_allowed_for_project(self, project: Optional[Project]) -> bool:
        return self.settings["detection_enabled"]

    def visit_span(self, span: Span) -> None:
        span_id = span.get("span_id", None)
        op = span.get("op", None)
        if not span_id or not op:
            return

        if not self._is_db_op(op):
            # This breaks up the N+1 we're currently tracking.
            self._maybe_store_problem()
            self._reset_detection()
            # Treat it as a potential parent as long as it isn't the root span.
            if span.get("parent_span_id", None):
                self.potential_parents[span_id] = span
            return

        if not self.source_span:
            # We aren't currently tracking an N+1. Maybe this span triggers one!
            self._maybe_use_as_source(span)
            return

        # If we got this far, we know we're a DB span and we're looking for a
        # sequence of N identical DB spans.
        if self._continues_n_plus_1(span):
            self.n_spans.append(span)
        else:
            previous_span = self.n_spans[-1] if self.n_spans else None
            self._maybe_store_problem()
            self._reset_detection()

            # Maybe this DB span starts a whole new N+1!
            if previous_span:
                self._maybe_use_as_source(previous_span)
            if self.source_span and self._continues_n_plus_1(span):
                self.n_spans.append(span)
            else:
                self.source_span = None
                self._maybe_use_as_source(span)

    def on_complete(self) -> None:
        self._maybe_store_problem()

    def _is_db_op(self, op: str) -> bool:
        return op.startswith("db") and not op.startswith("db.redis")

    def _maybe_use_as_source(self, span: Span):
        parent_span_id = span.get("parent_span_id", None)
        if not parent_span_id or parent_span_id not in self.potential_parents:
            return

        self.source_span = span

    def _continues_n_plus_1(self, span: Span):
        expected_parent_id = self.source_span.get("parent_span_id", None)
        parent_id = span.get("parent_span_id", None)
        if not parent_id or parent_id != expected_parent_id:
            return False

        span_hash = span.get("hash", None)
        if not span_hash:
            return False

        if span_hash == self.source_span.get("hash", None):
            # The source span and n repeating spans must have different queries.
            return False

        if not self.n_hash:
            self.n_hash = span_hash
            return True

        return span_hash == self.n_hash

    def _maybe_store_problem(self):
        if not self.source_span or not self.n_spans:
            return

        # Do we have enough spans?
        count = self.settings.get("count")
        if len(self.n_spans) < count:
            return

        # Do the spans take enough total time?
        if not self._is_slower_than_threshold():
            return

        # We require a parent span in order to improve our fingerprint accuracy.
        parent_span_id = self.source_span.get("parent_span_id", None)
        if not parent_span_id:
            return
        parent_span = self.potential_parents[parent_span_id]
        if not parent_span:
            return

        # Track how many N+1-looking problems we found but dropped because we
        # couldn't be sure (maybe the truncated part of the query differs).
        if not contains_complete_query(
            self.source_span, is_source=True
        ) or not contains_complete_query(self.n_spans[0]):
            metrics.incr("performance.performance_issue.truncated_np1_db")
            return

        if not self._contains_valid_repeating_query(self.n_spans[0]):
            metrics.incr("performance.performance_issue.unparametrized_first_span")
            return

        fingerprint = self._fingerprint(
            parent_span.get("op", None),
            parent_span.get("hash", None),
            self.source_span.get("hash", None),
            self.n_spans[0].get("hash", None),
        )
        if fingerprint not in self.stored_problems:
            self._metrics_for_extra_matching_spans()

            offender_span_ids = [span.get("span_id", None) for span in self.n_spans]

            self.stored_problems[fingerprint] = PerformanceProblem(
                fingerprint=fingerprint,
                op="db",
                desc=self.n_spans[0].get("description", ""),
                type=PerformanceNPlusOneGroupType,
                parent_span_ids=[parent_span_id],
                cause_span_ids=[self.source_span.get("span_id", None)],
                offender_span_ids=offender_span_ids,
                evidence_display=[
                    IssueEvidence(
                        name="Offending Spans",
                        value=get_notification_attachment_body(
                            "db",
                            self.n_spans[0].get("description", ""),
                        ),
                        # Has to be marked important to be displayed in the notifications
                        important=True,
                    )
                ],
                evidence_data={
                    "transaction_name": self._event.get("transaction", ""),
                    "op": "db",
                    "parent_span_ids": [parent_span_id],
                    "parent_span": get_span_evidence_value(parent_span),
                    "cause_span_ids": [self.source_span.get("span_id", None)],
                    "offender_span_ids": offender_span_ids,
                    "repeating_spans": get_span_evidence_value(self.n_spans[0]),
                    "repeating_spans_compact": get_span_evidence_value(
                        self.n_spans[0], include_op=False
                    ),
                    "num_repeating_spans": str(len(offender_span_ids)),
                },
            )

    def _is_slower_than_threshold(self) -> bool:
        duration_threshold = self.settings.get("duration_threshold")
        return total_span_time(self.n_spans) >= duration_threshold

    def _contains_valid_repeating_query(self, span: Span) -> bool:
        # Make sure we at least have a space, to exclude e.g. MongoDB and
        # Prisma's `rawQuery`.
        query = span.get("description", None)
        return bool(query) and " " in query

    def _metrics_for_extra_matching_spans(self):
        # Checks for any extra spans that match the detected problem but are not part of affected spans.
        # Temporary check since we eventually want to capture extra perf problems on the initial pass while walking spans.
        n_count = len(self.n_spans)
        all_matching_spans = [
            span
            for span in self._event.get("spans", [])
            if span.get("span_id", None) == self.n_hash
        ]
        all_count = len(all_matching_spans)
        if n_count > 0 and n_count != all_count:
            metrics.incr("performance.performance_issue.np1_db.extra_spans")

    def _reset_detection(self):
        self.source_span = None
        self.n_hash = None
        self.n_spans = []

    def _fingerprint(self, parent_op, parent_hash, source_hash, n_hash) -> str:
        # XXX: this has to be a hardcoded string otherwise grouping will break
        problem_class = "GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES"
        full_fingerprint = hashlib.sha1(
            (str(parent_op) + str(parent_hash) + str(source_hash) + str(n_hash)).encode("utf8"),
        ).hexdigest()
        return f"1-{problem_class}-{full_fingerprint}"


class NPlusOneDBSpanDetectorExtended(NPlusOneDBSpanDetector):
    """
    Detector goals:
    - Extend N+1 DB Detector to make it compatible with more frameworks.
    """

    type = DetectorType.N_PLUS_ONE_DB_QUERIES_EXTENDED

    __slots__ = (
        "stored_problems",
        "potential_parents",
        "source_span",
        "n_hash",
        "n_spans",
    )

    def is_creation_allowed_for_organization(self, organization: Optional[Organization]) -> bool:
        # Only collecting metrics.
        return False

    def is_creation_allowed_for_project(self, project: Optional[Project]) -> bool:
        # Only collecting metrics.
        return False


def contains_complete_query(span: Span, is_source: Optional[bool] = False) -> bool:
    # Remove the truncation check from the n_plus_one db detector.
    query = span.get("description", None)
    if is_source and query:
        return True
    else:
        return query and not query.endswith("...")
