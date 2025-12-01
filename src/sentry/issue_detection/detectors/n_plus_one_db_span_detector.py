from __future__ import annotations

import hashlib
from typing import Any

from sentry.issue_detection.base import DetectorType, PerformanceDetector
from sentry.issue_detection.detectors.utils import (
    get_notification_attachment_body,
    get_span_evidence_value,
    total_span_time,
)
from sentry.issue_detection.performance_problem import PerformanceProblem
from sentry.issue_detection.types import Span
from sentry.issues.grouptype import PerformanceNPlusOneGroupType
from sentry.issues.issue_occurrence import IssueEvidence
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.utils import metrics
from sentry.utils.safe import get_path


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
        "potential_parents",
        "source_span",
        "n_hash",
        "n_spans",
        "transaction",
    )

    type = DetectorType.N_PLUS_ONE_DB_QUERIES
    settings_key = DetectorType.N_PLUS_ONE_DB_QUERIES

    def __init__(self, settings: dict[DetectorType, Any], event: dict[str, Any]) -> None:
        super().__init__(settings, event)

        self.potential_parents = {}
        self.previous_span: Span | None = None
        self.n_spans: list[Span] = []
        self.source_span: Span | None = None
        root_span = get_path(self._event, "contexts", "trace")
        if root_span:
            self.potential_parents[root_span.get("span_id")] = root_span

    def is_creation_allowed_for_organization(self, organization: Organization | None) -> bool:
        return True

    def is_creation_allowed_for_project(self, project: Project | None) -> bool:
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
        return (
            op.startswith("db")
            and not op.startswith("db.redis")
            and not op.startswith("db.connection")
        )

    def _maybe_use_as_source(self, span: Span) -> None:
        parent_span_id = span.get("parent_span_id", None)
        if not parent_span_id or parent_span_id not in self.potential_parents:
            return

        self.source_span = span

    def _continues_n_plus_1(self, span: Span) -> bool:
        if self.source_span is None:
            return False

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

        if not self.previous_span:
            self.previous_span = span
            return True

        return are_spans_equivalent(a=span, b=self.previous_span)

    def _maybe_store_problem(self) -> None:
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

        fingerprint = self._fingerprint(
            parent_op=parent_span.get("op", ""),
            parent_hash=parent_span.get("hash", ""),
            source_hash=self.source_span.get("hash", ""),
            n_hash=self.n_spans[0].get("hash", ""),
        )
        if fingerprint not in self.stored_problems:
            self._metrics_for_extra_matching_spans()

            offender_span_ids = [span["span_id"] for span in self.n_spans]
            first_span_description = get_valid_db_span_description(self.n_spans[0])
            if not first_span_description:
                metrics.incr("performance.performance_issue.invalid_description")
                return

            self.stored_problems[fingerprint] = PerformanceProblem(
                fingerprint=fingerprint,
                op="db",
                desc=first_span_description,
                type=PerformanceNPlusOneGroupType,
                parent_span_ids=[parent_span_id],
                cause_span_ids=[self.source_span["span_id"]],
                offender_span_ids=offender_span_ids,
                evidence_display=[
                    IssueEvidence(
                        name="Offending Spans",
                        value=get_notification_attachment_body("db", first_span_description),
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
                    "repeating_spans": f"{self.n_spans[0].get('op', 'db')} - {first_span_description}",
                    "repeating_spans_compact": first_span_description,
                    "num_repeating_spans": str(len(offender_span_ids)),
                },
            )

    def _is_slower_than_threshold(self) -> bool:
        duration_threshold = self.settings.get("duration_threshold")
        return total_span_time(self.n_spans) >= duration_threshold

    def _metrics_for_extra_matching_spans(self) -> None:
        # Checks for any extra spans that match the detected problem but are not part of affected spans.
        # Temporary check since we eventually want to capture extra perf problems on the initial pass while walking spans.
        n_count = len(self.n_spans)
        all_matching_spans = [
            span
            for span in self._event.get("spans", [])
            if self.previous_span
            and span.get("span_id", None) == self.previous_span.get("span_id", None)
        ]
        all_count = len(all_matching_spans)
        if n_count > 0 and n_count != all_count:
            metrics.incr("performance.performance_issue.np1_db.extra_spans")

    def _reset_detection(self) -> None:
        self.source_span = None
        self.previous_span = None
        self.n_spans = []

    def _fingerprint(self, parent_op: str, parent_hash: str, source_hash: str, n_hash: str) -> str:
        problem_class = "GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES"
        full_fingerprint = hashlib.sha1(
            (str(parent_op) + str(parent_hash) + str(source_hash) + str(n_hash)).encode("utf8"),
        ).hexdigest()
        return f"1-{problem_class}-{full_fingerprint}"


def contains_complete_query(span: Span, is_source: bool | None = False) -> bool:
    # Remove the truncation check from the n_plus_one db detector.
    query = span.get("description")
    if is_source and query:
        return True
    else:
        return bool(query and not query.endswith("..."))


def get_valid_db_span_description(span: Span) -> str | None:
    """
    For MongoDB spans, we use the `description` provided by Relay since it re-includes the collection name.
    See https://github.com/getsentry/relay/blob/25.3.0/relay-event-normalization/src/normalize/span/description/mod.rs#L68-L82
    Explicitly require a '{' in MongoDB spans to only trigger on queries rather than client calls.
    """
    default_description = span.get("description", "")
    db_system = span.get("sentry_tags", {}).get("system", "")

    # Connection spans can have `op` as `db` but we don't want to trigger on them.
    if "pg-pool.connect" in default_description:
        return None

    # Trigger pathway on `mongodb`, `mongoose`, etc...
    if "mongo" in db_system:
        description = span.get("sentry_tags", {}).get("description")
        if not description or "{" not in description:
            return None
        return description
    return default_description


def are_spans_equivalent(a: Span, b: Span) -> bool:
    """
    Returns True if two DB spans are sufficiently similar for grouping N+1 DB Spans
    """
    hash_match = a.get("hash") == b.get("hash")
    has_description = bool(a.get("description"))
    description_match = a.get("description") == b.get("description")
    base_checks = all([hash_match, has_description, description_match])

    a_db_system = a.get("sentry_tags", {}).get("system")
    # We perform more checks for MongoDB spans
    if a_db_system == "mongodb":
        # Relay augments MongoDB span descriptions with more collection data.
        # We can use this for more accurate grouping.
        a_relay_description = a.get("sentry_tags", {}).get("description")
        b_relay_description = b.get("sentry_tags", {}).get("description")
        return a_relay_description == b_relay_description and base_checks

    return base_checks
