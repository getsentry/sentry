from __future__ import annotations

import hashlib
from abc import ABC, abstractmethod
from collections import deque
from collections.abc import Sequence
from typing import Any

from sentry.issue_detection.base import DetectorType, PerformanceDetector
from sentry.issue_detection.detectors.utils import (
    get_notification_attachment_body,
    get_span_evidence_value,
    total_span_time,
)
from sentry.issue_detection.performance_problem import PerformanceProblem
from sentry.issue_detection.types import Span
from sentry.issues.grouptype import (
    PerformanceMNPlusOneDBQueriesGroupType,
    PerformanceNPlusOneGroupType,
)
from sentry.issues.issue_occurrence import IssueEvidence
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.utils import metrics


class MNPlusOneState(ABC):
    """Abstract base class for the MNPlusOneDBSpanDetector state machine."""

    @abstractmethod
    def next(self, span: Span) -> tuple[MNPlusOneState, PerformanceProblem | None]:
        raise NotImplementedError

    def finish(self) -> PerformanceProblem | None:
        return None

    def _equivalent(self, a: Span, b: Span) -> bool:
        """db spans are equivalent if their ops and hashes match. Other spans are
        equivalent if their ops match."""
        first_op = a.get("op") or None
        second_op = b.get("op") or None
        if not first_op or not second_op or first_op != second_op:
            return False

        if first_op == "default":
            return a.get("description") == b.get("description")

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

    __slots__ = ("settings", "event", "recent_spans", "parent_map")

    def __init__(
        self,
        *,
        settings: dict[str, Any],
        event: dict[str, Any],
        parent_map: dict[str, str] | None = None,
        initial_spans: Sequence[Span] | None = None,
    ) -> None:
        self.settings = settings
        self.event = event
        self.recent_spans = deque(initial_spans or [], self.settings["max_sequence_length"])
        self.parent_map = parent_map or {}
        """
        A mapping of all visited spans IDs to their parent span IDs (span_id -> parent_span_id).
        In practice, this parent_map is passed back and forth between states to maintain a stable
        reference for any visited span regardless of whether a pattern is found.
        """

    def next(self, span: Span) -> tuple[MNPlusOneState, PerformanceProblem | None]:
        span_id = span.get("span_id")
        parent_span_id = span.get("parent_span_id")
        if span_id and parent_span_id:
            self.parent_map[span_id] = parent_span_id

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
                    return (
                        ContinuingMNPlusOne(
                            settings=self.settings,
                            event=self.event,
                            pattern=pattern,
                            first_span=span,
                            parent_map=self.parent_map,
                        ),
                        None,
                    )

        # We haven't found a pattern yet, so remember this span and keep
        # looking.
        self.recent_spans.append(span)
        return (self, None)

    def _is_valid_pattern(self, pattern: Sequence[Span]) -> bool:
        """A valid pattern contains at least one db operation and is not all equivalent."""
        found_db_op = False
        found_different_span = False

        # Patterns shouldn't start with a serialize span, since that follows an operation or query.
        first_span_description = pattern[0].get("description", "")
        if (
            first_span_description == "prisma:client:serialize"
            or first_span_description == "prisma:engine:serialize"
        ):
            return False

        for span in pattern:
            op = span.get("op") or ""
            description = span.get("description") or ""
            found_db_op = found_db_op or bool(
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

    __slots__ = ("settings", "event", "pattern", "spans", "pattern_index", "parent_map")

    def __init__(
        self,
        *,
        settings: dict[str, Any],
        event: dict[str, Any],
        pattern: list[Span],
        first_span: Span,
        parent_map: dict[str, str],
    ) -> None:
        self.settings = settings
        self.event = event
        self.pattern = pattern
        self.parent_map = parent_map
        """
        A mapping of all visited spans IDs to their parent span IDs (span_id -> parent_span_id).
        In practice, this parent_map is passed back and forth between states to maintain a stable
        reference for any visited span regardless of whether a pattern is found.
        """
        # The full list of spans involved in the MN pattern.
        self.spans = pattern.copy()
        self.spans.append(first_span)
        self.pattern_index = 1

    def next(self, span: Span) -> tuple[MNPlusOneState, PerformanceProblem | None]:
        span_id = span.get("span_id")
        parent_span_id = span.get("parent_span_id")
        if span_id and parent_span_id:
            self.parent_map[span_id] = parent_span_id

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

        # Keep more context for pattern detection by including spans that could be
        # the beginning of a new pattern. Instead of just keeping the incomplete
        # remainder, keep the last pattern_length spans plus the current span.
        # Keep at least the last pattern_length spans (or all if we have fewer)
        pattern_length = len(self.pattern)
        context_start = max(0, len(self.spans) - pattern_length)
        remaining_spans = self.spans[context_start:] + [span]
        return (
            SearchingForMNPlusOne(
                settings=self.settings,
                event=self.event,
                parent_map=self.parent_map,
                initial_spans=remaining_spans,
            ),
            self._maybe_performance_problem(),
        )

    def finish(self) -> PerformanceProblem | None:
        return self._maybe_performance_problem()

    def _maybe_performance_problem(self) -> PerformanceProblem | None:
        times_occurred = int(len(self.spans) / len(self.pattern))
        minimum_occurrences_of_pattern = self.settings["minimum_occurrences_of_pattern"]
        if times_occurred < minimum_occurrences_of_pattern:
            return None

        offender_span_count = len(self.pattern) * times_occurred
        offender_spans = self.spans[:offender_span_count]

        # Consider all spans when evaluating the duration threshold, however at least 10 percent
        # of the total duration of offenders should be from db spans.
        total_spans_duration = total_span_time(offender_spans)
        if total_spans_duration < self.settings["total_duration_threshold"]:
            metrics.incr("mn_plus_one_db_span_detector.below_duration_threshold")
            return None

        offender_db_spans = [span for span in offender_spans if span["op"].startswith("db")]
        total_db_spans_duration = total_span_time(offender_db_spans)
        pct_db_spans = total_db_spans_duration / total_spans_duration if total_spans_duration else 0
        if pct_db_spans < self.settings["min_percentage_of_db_spans"]:
            metrics.incr("mn_plus_one_db_span_detector.below_db_span_percentage")
            return None

        common_parent_span = self._find_common_parent_span(offender_spans)
        if not common_parent_span:
            metrics.incr("mn_plus_one_db_span_detector.no_parent_span")
            return None

        db_span = self._first_relevant_db_span()
        if not db_span:
            metrics.incr("mn_plus_one_db_span_detector.no_db_span")
            return None

        db_span_ids = [span["span_id"] for span in offender_db_spans]
        offender_span_ids = [span["span_id"] for span in offender_spans]

        return PerformanceProblem(
            fingerprint=self._fingerprint(db_span["hash"], common_parent_span),
            op="db",
            desc=db_span["description"],
            type=PerformanceNPlusOneGroupType,
            parent_span_ids=[common_parent_span["span_id"]],
            cause_span_ids=db_span_ids,
            offender_span_ids=offender_span_ids,
            evidence_data={
                "op": "db",
                "parent_span_ids": [common_parent_span["span_id"]],
                "cause_span_ids": db_span_ids,
                "offender_span_ids": offender_span_ids,
                "transaction_name": self.event.get("transaction", ""),
                "parent_span": get_span_evidence_value(common_parent_span),
                "repeating_spans": [get_span_evidence_value(span) for span in self.pattern],
                "repeating_spans_compact": [
                    get_span_evidence_value(span, include_op=False) for span in self.pattern
                ],
                "number_repeating_spans": str(len(offender_spans)),
                "pattern_size": len(self.pattern),
                "num_pattern_repetitions": times_occurred,
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

    def _first_relevant_db_span(self) -> Span | None:
        for span in self.spans:
            if (
                span["op"].startswith("db")
                and get_span_evidence_value(span, include_op=False) != "prisma:engine:connection"
            ):
                return span
        return None

    def _find_common_parent_span(self, spans: Sequence[Span]) -> Span | None:
        """
        Using the self.parent_map, identify the common parent within the configured depth
        of the every span in the list. Returns None if no common parent is found, or the common
        parent is not within the event.
        """
        # Use a set to track the common parent across all spans.
        # It'll start empty, fill with the first span's parents, and then intersect every span's
        # parent list after that.
        common_parent_set: set[str] = set()
        # We also store the latest parent list for ordering later on.
        latest_parent_list: list[str] = []
        for span in spans:
            span_id = span.get("span_id")
            if not span_id:
                return None

            current_parent_list = []
            current_span_id = span_id

            # This will run at most `max_allowable_depth` times for n spans.
            # For that reason, `max_allowable_depth` cannot be user-configurable -- to avoid
            # O(n^2) complexity and load issues.
            for _ in range(self.settings["max_allowable_depth"]):
                parent_span_id = self.parent_map.get(current_span_id)
                if not parent_span_id:
                    break
                current_parent_list.append(parent_span_id)
                # If this parent_span_id is already in the global intersection, stop early, we don't
                # need to build the rest of the parent list.
                if parent_span_id in common_parent_set:
                    break
                current_span_id = parent_span_id

            # If common_parent_set is empty (first iteration), set it to the current parent list.
            # Otherwise, intersect it with the current_parent_list.
            common_parent_set = (
                common_parent_set.intersection(set(current_parent_list))
                if common_parent_set
                else set(current_parent_list)
            )

            # At this point, if common_parent_set is empty, we can bail out early since that means
            # at least two parent lists have no intersection, thus no common parent.
            if not common_parent_set:
                return None

            latest_parent_list = current_parent_list

        # The parent list is ordered, so the first match is the earliest common parent,
        # which is the best match for useful fingerprinting.
        common_parent_span_id = next(
            (span_id for span_id in latest_parent_list if span_id in common_parent_set), None
        )
        if not common_parent_span_id:
            return None

        all_spans = self.event.get("spans") or []
        for span in all_spans:
            if span.get("span_id") == common_parent_span_id:
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

    To create a problem from a set a spans, this detector looks for the following:
    - A pattern of at least one db span and one non-db span (set by `max_sequence_length`)
    - The pattern is repeated sequentially with no intervening spans (set by `min_occurrences_of_pattern`)
    - The total duration of the repeated pattern is above the threshold (set by `total_duration_threshold`)
    - The total duration of the db spans is above the percentage threshold for the whole sequence (set by `min_percentage_of_db_spans`)
    - The pattern has at least one common parent span within the event, and within the configured depth (set by `max_allowable_depth`)

    Uses a small state machine internally.
    """

    __slots__ = ("state",)

    type = DetectorType.M_N_PLUS_ONE_DB
    settings_key = DetectorType.M_N_PLUS_ONE_DB

    def __init__(self, settings: dict[DetectorType, Any], event: dict[str, Any]) -> None:
        super().__init__(settings, event)

        self.state: MNPlusOneState = SearchingForMNPlusOne(
            settings=self.settings,
            event=event,
            parent_map={},
        )

    def is_creation_allowed_for_organization(self, organization: Organization | None) -> bool:
        return True

    def is_creation_allowed_for_project(self, project: Project) -> bool:
        return self.settings["detection_enabled"]

    def visit_span(self, span: Span) -> None:
        self.state, performance_problem = self.state.next(span)
        if performance_problem:
            self.stored_problems[performance_problem.fingerprint] = performance_problem

    def on_complete(self) -> None:
        if performance_problem := self.state.finish():
            self.stored_problems[performance_problem.fingerprint] = performance_problem
