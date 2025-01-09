from __future__ import annotations

import re
from collections.abc import Mapping, Sequence
from datetime import timedelta
from typing import Any

from django.utils.translation import gettext_lazy as _

from sentry.issues.grouptype import PerformanceConsecutiveDBQueriesGroupType
from sentry.issues.issue_occurrence import IssueEvidence
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.utils.event_frames import get_sdk_name
from sentry.utils.performance_issues.detectors.utils import (
    get_max_span_duration,
    get_total_span_duration,
)

from ..base import (
    DetectorType,
    PerformanceDetector,
    fingerprint_spans,
    get_notification_attachment_body,
    get_span_duration,
    get_span_evidence_value,
)
from ..performance_problem import PerformanceProblem
from ..types import Span


def join_regexes(regexes: Sequence[str]) -> str:
    return r"(?:" + r")|(?:".join(regexes) + r")"


CONTAINS_PARAMETER_REGEX = re.compile(
    join_regexes(
        [
            r"'(?:[^']|'')*?(?:\\'.*|'(?!'))",  # single-quoted strings
            r"\b(?:true|false)\b",  # booleans
            r"-?\b(?:[0-9]+\.)?[0-9]+(?:[eE][+-]?[0-9]+)?\b",  # numbers
            r"\?|\$1|%s",  # existing parameters
        ]
    )
)


class ConsecutiveDBSpanDetector(PerformanceDetector):
    """
    Let X and Y be the consecutive db span count threshold and the span duration threshold respectively,
    each defined in the threshold settings.

    The detector first looks for X number of consecutive db query spans,
    Once these set of spans are found, the detector will compare each db span in the consecutive list
    to determine if they are dependant on one another.
    If the sum of the durations of the independent spans exceeds Y, then a performance issue is found.

    This detector assuming spans are ordered chronologically
    """

    __slots__ = "stored_problems"

    type = DetectorType.CONSECUTIVE_DB_OP
    settings_key = DetectorType.CONSECUTIVE_DB_OP

    def __init__(self, settings: dict[DetectorType, Any], event: dict[str, Any]) -> None:
        super().__init__(settings, event)

        self.stored_problems: dict[str, PerformanceProblem] = {}
        self.consecutive_db_spans: list[Span] = []
        self.independent_db_spans: list[Span] = []

    def visit_span(self, span: Span) -> None:
        span_id = span.get("span_id", None)

        if not span_id or not self._is_db_query(span) or self._overlaps_last_span(span):
            self._validate_and_store_performance_problem()
            self._reset_variables()
            return

        self._add_problem_span(span)

    def _add_problem_span(self, span: Span) -> None:
        self.consecutive_db_spans.append(span)

    def _validate_and_store_performance_problem(self) -> None:
        self._set_independent_spans(self.consecutive_db_spans)
        if not len(self.independent_db_spans):
            return

        exceeds_count_threshold = len(self.consecutive_db_spans) >= self.settings.get(
            "consecutive_count_threshold"
        )
        exceeds_span_duration_threshold = all(
            get_span_duration(span).total_seconds() * 1000
            > self.settings.get("span_duration_threshold")
            for span in self.independent_db_spans
        )

        time_saved = self._calculate_time_saved(self.independent_db_spans)
        total_time = get_total_span_duration(self.consecutive_db_spans)

        exceeds_time_saved_threshold = time_saved >= self.settings.get("min_time_saved")

        exceeds_time_saved_threshold_ratio = False
        if total_time > 0:
            exceeds_time_saved_threshold_ratio = time_saved / total_time >= self.settings.get(
                "min_time_saved_ratio"
            )

        if (
            exceeds_count_threshold
            and exceeds_span_duration_threshold
            and exceeds_time_saved_threshold
            and exceeds_time_saved_threshold_ratio
        ):
            self._store_performance_problem()

    def _store_performance_problem(self) -> None:
        fingerprint = self._fingerprint()
        offender_span_ids = [span.get("span_id", None) for span in self.independent_db_spans]
        cause_span_ids = [span.get("span_id", None) for span in self.consecutive_db_spans]
        query: str = self.independent_db_spans[0].get("description", None)

        self.stored_problems[fingerprint] = PerformanceProblem(
            fingerprint,
            "db",
            desc=query,  # TODO: figure out which query to use for description
            type=PerformanceConsecutiveDBQueriesGroupType,
            cause_span_ids=cause_span_ids,
            parent_span_ids=None,
            offender_span_ids=offender_span_ids,
            evidence_data={
                "op": "db",
                "cause_span_ids": cause_span_ids,
                "parent_span_ids": None,
                "offender_span_ids": offender_span_ids,
                "transaction_name": self._event.get("transaction", ""),
                "span_evidence_key_value": [
                    {"key": str(_("Transaction")), "value": self._event.get("transaction", "")},
                    {"key": str(_("Starting Span")), "value": self._get_starting_span()},
                    {
                        "key": str(_("Parallelizable Spans")),
                        "value": self._get_parallelizable_spans(),
                        "is_multi_value": True,
                    },
                ],
                "transaction_duration": self._get_duration(self._event),
                "slow_span_duration": self._calculate_time_saved(self.independent_db_spans),
                "repeating_spans": get_span_evidence_value(self.independent_db_spans[0]),
                "repeating_spans_compact": get_span_evidence_value(
                    self.independent_db_spans[0], include_op=False
                ),
            },
            evidence_display=[
                IssueEvidence(
                    name="Offending Spans",
                    value=get_notification_attachment_body(
                        "db",
                        query,
                    ),
                    # Has to be marked important to be displayed in the notifications
                    important=True,
                )
            ],
        )

        self._reset_variables()

    def _get_duration(self, item: Mapping[str, Any] | None) -> float:
        if not item:
            return 0

        start = float(item.get("start_timestamp", 0))
        end = float(item.get("timestamp", 0))

        return (end - start) * 1000

    def _get_parallelizable_spans(self) -> list[str]:
        if not self.independent_db_spans or len(self.independent_db_spans) < 1:
            return [""]

        return [span.get("description", "") for span in self.independent_db_spans]

    def _get_starting_span(self) -> str:
        if not self.consecutive_db_spans or len(self.consecutive_db_spans) < 1:
            return ""

        return self.consecutive_db_spans[0].get("description", "")

    def _set_independent_spans(self, spans: list[Span]) -> None:
        """
        Given a list of spans, checks if there is at least a single span that is independent of the rest.
        To start, we are just checking for a span in a list of consecutive span without a WHERE clause
        """
        independent_spans = []
        for span in spans[1:]:
            query: str = span.get("description", None)
            if (
                query
                and contains_complete_query(span)
                and "WHERE" not in query.upper()
                and not CONTAINS_PARAMETER_REGEX.search(query)
            ):
                independent_spans.append(span)
        self.independent_db_spans = independent_spans

    def _calculate_time_saved(self, independent_spans: list[Span]) -> float:
        """
        Calculates the cost saved by running spans in parallel,
        this is the maximum time saved of running all independent queries in parallel
        note, maximum means it does not account for db connection times and overhead associated with parallelization,
        this is where thresholds come in
        """
        consecutive_spans = self.consecutive_db_spans
        total_duration = get_total_span_duration(consecutive_spans)
        max_independent_span_duration = get_max_span_duration(independent_spans)

        sum_of_dependent_span_durations = 0.0
        for span in consecutive_spans:
            if span not in independent_spans:
                sum_of_dependent_span_durations += get_span_duration(span).total_seconds() * 1000

        return total_duration - max(max_independent_span_duration, sum_of_dependent_span_durations)

    def _overlaps_last_span(self, span: Span) -> bool:
        if len(self.consecutive_db_spans) == 0:
            return False

        last_span = self.consecutive_db_spans[-1]

        last_span_ends = timedelta(seconds=last_span.get("timestamp", 0))
        current_span_begins = timedelta(seconds=span.get("start_timestamp", 0))
        return last_span_ends > current_span_begins

    def _reset_variables(self) -> None:
        self.consecutive_db_spans = []
        self.independent_db_spans = []

    def _is_db_query(self, span: Span) -> bool:
        op: str = span.get("op", "") or ""
        description: str = span.get("description", "") or ""
        is_db_op = op == "db" or op.startswith("db.sql")
        is_query = description.strip().upper().startswith("SELECT")
        return is_db_op and is_query

    def _fingerprint(self) -> str:
        prior_span_index = self.consecutive_db_spans.index(self.independent_db_spans[0]) - 1
        hashed_spans = fingerprint_spans(
            [self.consecutive_db_spans[prior_span_index]] + self.independent_db_spans
        )
        return f"1-{PerformanceConsecutiveDBQueriesGroupType.type_id}-{hashed_spans}"

    def on_complete(self) -> None:
        self._validate_and_store_performance_problem()

    def is_creation_allowed_for_organization(self, organization: Organization) -> bool:
        return True

    def is_creation_allowed_for_project(self, project: Project) -> bool:
        return self.settings["detection_enabled"]

    @classmethod
    def is_event_eligible(cls, event: dict[str, Any], project: Project | None = None) -> bool:
        request = event.get("request", None) or None
        sdk_name = get_sdk_name(event) or ""

        if request:
            url = request.get("url", "") or ""
            # TODO(nar): `method` can be removed once SDK adoption has increased and
            # we are receiving `http.method` consistently, likely beyond October 2023
            method = request.get("http.method", "") or request.get("method", "") or ""
            if url.endswith("/graphql") and method.lower() in ["post", "get"]:
                return False

        return "php" not in sdk_name.lower()


def contains_complete_query(span: Span, is_source: bool | None = False) -> bool:
    # Remove the truncation check from the n_plus_one db detector.
    query = span.get("description", None)
    if is_source and query:
        return True
    else:
        return query and not query.endswith("...")
