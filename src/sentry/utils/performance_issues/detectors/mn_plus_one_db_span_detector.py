from __future__ import annotations

import hashlib
from abc import ABC, abstractmethod
from collections import deque
from typing import Any, Dict, Optional, Sequence, Tuple

from sentry import features
from sentry.eventstore.models import Event
from sentry.issues.grouptype import (
    PerformanceMNPlusOneDBQueriesGroupType,
    PerformanceNPlusOneGroupType,
)
from sentry.issues.issue_occurrence import IssueEvidence
from sentry.models.organization import Organization
from sentry.models.project import Project

from ..base import (
    DetectorType,
    PerformanceDetector,
    get_notification_attachment_body,
    get_span_evidence_value,
    total_span_time,
)
from ..performance_problem import PerformanceProblem
from ..types import Span


class MNPlusOneState(ABC):
    """Abstract base class for the MNPlusOneDBSpanDetector state machine."""

    @abstractmethod
    def next(self, span: Span) -> Tuple[MNPlusOneState, Optional[PerformanceProblem]]:
        raise NotImplementedError

    def finish(self) -> Optional[PerformanceProblem]:
        return None

    def _equivalent(self, a: Span, b: Span) -> bool:
        """db spans are equivalent if their ops and hashes match. Other spans are
        equivalent if their ops match."""
        first_op = a.get("op") or None
        second_op = b.get("op") or None
        if not first_op or not second_op or first_op != second_op:
            return False

        if first_op.startswith("db"):
            return a.get("hash") == b.get("hash")

        return True


class SearchingForMNPlusOne(MNPlusOneState):
    """
    The initial state for the MN+1 DB Query detector, and the state we return to
    whenever there is no active repeating pattern being checked.

    Keeps a list of recently seen spans until a repeat is found, at which point
    it transitions to the ContinuingMNPlusOne state.
    """

    __slots__ = ("settings", "event", "recent_spans")

    def __init__(
        self, settings: Dict[str, Any], event: Event, initial_spans: Optional[Sequence[Span]] = None
    ) -> None:
        self.settings = settings
        self.event = event
        self.recent_spans = deque(initial_spans or [], self.settings["max_sequence_length"])

    def next(self, span: Span) -> Tuple[MNPlusOneState, Optional[PerformanceProblem]]:
        # Can't be a potential MN+1 without at least 2 previous spans.
        if len(self.recent_spans) <= 1:
            self.recent_spans.append(span)
            return (self, None)

        # Has an MN pattern begun to repeat itself? If so, transition to the
        # ContinuingMNPlusOne state.
        # Convert the recent_spans deque into a list for slicing. Skip the last
        # item in the list because that would find an N+1 instead.
        recent_span_list = list(self.recent_spans)
        for i, recent_span in enumerate(recent_span_list[:-1]):
            if self._equivalent(span, recent_span):
                pattern = recent_span_list[i:]
                if self._is_valid_pattern(pattern):
                    return (ContinuingMNPlusOne(self.settings, self.event, pattern, span), None)

        # We haven't found a pattern yet, so remember this span and keep
        # looking.
        self.recent_spans.append(span)
        return (self, None)

    def _is_valid_pattern(self, pattern: Sequence[Span]) -> bool:
        """A valid pattern contains at least one db operation and is not all equivalent."""
        found_db_op = False
        found_different_span = False

        for span in pattern:
            op = span.get("op") or ""
            description = span.get("description") or ""
            found_db_op = found_db_op or (
                op.startswith("db")
                and not op.startswith("db.redis")
                and description
                and not description.endswith("...")
            )
            found_different_span = found_different_span or not self._equivalent(pattern[0], span)
            if found_db_op and found_different_span:
                return True

        return False


class ContinuingMNPlusOne(MNPlusOneState):
    """
    The state for when we think we might have found a pattern: a sequence of
    spans that has begun to repeat.

    When the sequence is broken (either by a mismatched span or span iteration
    finishing), returns to the SearchingMNPlusOne state, possibly returning a
    PerformanceProblem if the detected sequence met our thresholds.
    """

    __slots__ = ("settings", "event", "pattern", "spans", "pattern_index")

    def __init__(
        self, settings: Dict[str, Any], event: Event, pattern: Sequence[Span], first_span: Span
    ) -> None:
        self.settings = settings
        self.event = event
        self.pattern = pattern

        # The full list of spans involved in the MN pattern.
        self.spans: Sequence[Span] = pattern.copy()
        self.spans.append(first_span)
        self.pattern_index = 1

    def next(self, span: Span) -> MNPlusOneState:
        # If the MN pattern is continuing, carry on in this state.
        pattern_span = self.pattern[self.pattern_index]
        if self._equivalent(pattern_span, span):
            self.spans.append(span)
            self.pattern_index += 1
            if self.pattern_index >= len(self.pattern):
                self.pattern_index = 0
            return (self, None)

        # We've broken the MN pattern, so return to the Searching state. If it
        # is a significant problem, also return a PerformanceProblem.
        times_occurred = int(len(self.spans) / len(self.pattern))
        start_index = len(self.pattern) * times_occurred
        remaining_spans = self.spans[start_index:] + [span]
        return (
            SearchingForMNPlusOne(self.settings, self.event, remaining_spans),
            self._maybe_performance_problem(),
        )

    def finish(self) -> Optional[PerformanceProblem]:
        return self._maybe_performance_problem()

    def _maybe_performance_problem(self) -> Optional[PerformanceProblem]:
        times_occurred = int(len(self.spans) / len(self.pattern))
        minimum_occurrences_of_pattern = self.settings["minimum_occurrences_of_pattern"]
        if times_occurred < minimum_occurrences_of_pattern:
            return None

        offender_span_count = len(self.pattern) * times_occurred
        offender_spans = self.spans[:offender_span_count]

        # Only consider `db` spans when evaluating the duration threshold.
        total_duration_threshold = self.settings["total_duration_threshold"]
        offender_db_spans = [span for span in offender_spans if span["op"].startswith("db")]
        total_duration = total_span_time(offender_db_spans)
        if total_duration < total_duration_threshold:
            return None

        parent_span = self._find_common_parent_span(offender_spans)
        if not parent_span:
            return None

        db_span = self._first_db_span()
        return PerformanceProblem(
            fingerprint=self._fingerprint(db_span["hash"], parent_span),
            op="db",
            desc=db_span["description"],
            type=PerformanceNPlusOneGroupType,
            parent_span_ids=[parent_span["span_id"]],
            cause_span_ids=[],
            offender_span_ids=[span["span_id"] for span in offender_spans],
            evidence_data={
                "op": "db",
                "parent_span_ids": [parent_span["span_id"]],
                "cause_span_ids": [],
                "offender_span_ids": [span["span_id"] for span in offender_spans],
                "transaction_name": self.event.get("transaction", ""),
                "parent_span": get_span_evidence_value(parent_span),
                "repeating_spans": get_span_evidence_value(offender_spans[0]),
                "repeating_spans_compact": get_span_evidence_value(
                    offender_spans[0], include_op=False
                ),
                "number_repeating_spans": str(len(offender_spans)),
            },
            evidence_display=[
                IssueEvidence(
                    name="Offending Spans",
                    value=get_notification_attachment_body(
                        "db",
                        db_span["description"],
                    ),
                    # Has to be marked important to be displayed in the notifications
                    important=True,
                )
            ],
        )

    def _first_db_span(self) -> Optional[Span]:
        for span in self.spans:
            if span["op"].startswith("db"):
                return span
        return None

    def _find_common_parent_span(self, spans: Sequence[Span]):
        parent_span_id = spans[0].get("parent_span_id")
        if not parent_span_id:
            return None
        for id in [span.get("parent_span_id") for span in spans[1:]]:
            if not id or id != parent_span_id:
                return None

        all_spans = self.event.get("spans") or []
        for span in all_spans:
            if span.get("span_id") == parent_span_id:
                return span
        return None

    def _fingerprint(self, db_hash: str, parent_span: Span) -> str:
        parent_op = parent_span.get("op") or ""
        parent_hash = parent_span.get("hash") or ""
        full_fingerprint = hashlib.sha1(
            (parent_op + parent_hash + db_hash).encode("utf8")
        ).hexdigest()
        return f"1-{PerformanceMNPlusOneDBQueriesGroupType.type_id}-{full_fingerprint}"


class MNPlusOneDBSpanDetector(PerformanceDetector):
    """
    Detects N+1 DB query issues where the repeated query is interspersed with
    other spans (which may or may not be other queries) that all repeat together
    (hence, MN+1).

    Currently does not consider parent or source spans, and only looks for a
    repeating pattern of spans (A B C A B C etc).

    Uses a small state machine internally.
    """

    __slots__ = ("stored_problems", "state")

    type = DetectorType.M_N_PLUS_ONE_DB
    settings_key = DetectorType.M_N_PLUS_ONE_DB

    def init(self):
        self.stored_problems = {}
        self.state = SearchingForMNPlusOne(self.settings, self.event())

    def is_creation_allowed_for_organization(self, organization: Optional[Organization]) -> bool:
        return features.has(
            "organizations:performance-issues-m-n-plus-one-db-detector",
            organization,
            actor=None,
        )

    def is_creation_allowed_for_project(self, project: Project) -> bool:
        return self.settings["detection_enabled"]

    def visit_span(self, span):
        self.state, performance_problem = self.state.next(span)
        if performance_problem:
            self.stored_problems[performance_problem.fingerprint] = performance_problem

    def on_complete(self) -> None:
        if performance_problem := self.state.finish():
            self.stored_problems[performance_problem.fingerprint] = performance_problem
