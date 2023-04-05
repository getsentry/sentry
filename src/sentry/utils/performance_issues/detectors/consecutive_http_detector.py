from __future__ import annotations

import hashlib
import re
from datetime import timedelta
from urllib.parse import parse_qs, urlparse

from sentry import features
from sentry.issues.grouptype import PerformanceConsecutiveHTTPQueriesGroupType
from sentry.models import Organization, Project

from ..base import (
    DetectorType,
    PerformanceDetector,
    get_duration_between_spans,
    get_span_duration,
    get_url_from_span,
)
from ..performance_problem import PerformanceProblem
from ..types import Span

URL_PARAMETER_REGEX = re.compile(
    r"""(?x)
    (?P<uuid>
        \b
            [0-9a-fA-F]{8}-
            [0-9a-fA-F]{4}-
            [0-9a-fA-F]{4}-
            [0-9a-fA-F]{4}-
            [0-9a-fA-F]{12}
        \b
    ) |
    (?P<hashlike>
        \b[0-9a-fA-F]{10}([0-9a-fA-F]{14})?([0-9a-fA-F]{8})?([0-9a-fA-F]{8})?\b
    ) |
    (?P<int>
        -\d+\b |
        \b\d+\b
    )
"""
)  # Adapted from message.py


class ConsecutiveHTTPSpanDetector(PerformanceDetector):
    __slots__ = "stored_problems"

    type: DetectorType = DetectorType.CONSECUTIVE_HTTP_OP
    settings_key = DetectorType.CONSECUTIVE_HTTP_OP

    def init(self):
        self.stored_problems: dict[str, PerformanceProblem] = {}
        self.consecutive_http_spans: list[Span] = []

    def visit_span(self, span: Span) -> None:
        span_id = span.get("span_id", None)

        if not span_id or not self._is_eligible_http_span(span):
            return

        if self._overlaps_last_span(span):
            self._validate_and_store_performance_problem()
            self._reset_variables()

        self._add_problem_span(span)

    def _add_problem_span(self, span: Span) -> None:
        self.consecutive_http_spans.append(span)

    def _validate_and_store_performance_problem(self):
        exceeds_count_threshold = len(self.consecutive_http_spans) >= self.settings.get(
            "consecutive_count_threshold"
        )
        exceeds_span_duration_threshold = all(
            get_span_duration(span).total_seconds() * 1000
            > self.settings.get("span_duration_threshold")
            for span in self.consecutive_http_spans
        )

        exceeds_duration_between_spans_threshold = all(
            get_duration_between_spans(
                self.consecutive_http_spans[idx - 1], self.consecutive_http_spans[idx]
            )
            < self.settings.get("max_duration_between_spans")
            for idx in range(1, len(self.consecutive_http_spans))
        )

        if (
            exceeds_count_threshold
            and exceeds_span_duration_threshold
            and exceeds_duration_between_spans_threshold
        ):
            self._store_performance_problem()

    def _store_performance_problem(self) -> None:
        fingerprint = self._fingerprint()
        offender_span_ids = [span.get("span_id", None) for span in self.consecutive_http_spans]
        desc: str = self.consecutive_http_spans[0].get("description", None)

        self.stored_problems[fingerprint] = PerformanceProblem(
            fingerprint,
            "http",
            desc=desc,
            type=PerformanceConsecutiveHTTPQueriesGroupType,
            cause_span_ids=[],
            parent_span_ids=None,
            offender_span_ids=offender_span_ids,
            evidence_display=[],
            evidence_data={
                "parent_span_ids": [],
                "cause_span_ids": [],
                "offender_span_ids": offender_span_ids,
                "op": "http",
            },
        )

        self._reset_variables()

    def _sum_span_duration(self, spans: list[Span]) -> int:
        "Given a list of spans, find the sum of the span durations in milliseconds"
        sum = 0
        for span in spans:
            sum += get_span_duration(span).total_seconds() * 1000
        return sum

    def _overlaps_last_span(self, span: Span) -> bool:
        if len(self.consecutive_http_spans) == 0:
            return False

        last_span = self.consecutive_http_spans[-1]

        last_span_ends = timedelta(seconds=last_span.get("timestamp", 0))
        current_span_begins = timedelta(seconds=span.get("start_timestamp", 0))
        return last_span_ends > current_span_begins

    def _reset_variables(self) -> None:
        self.consecutive_http_spans = []

    def _is_eligible_http_span(self, span: Span) -> bool:
        span_id = span.get("span_id", None)
        op: str = span.get("op", "") or ""
        hash = span.get("hash", None)
        description: str = span.get("description", "") or ""

        if not span_id or not op or not hash or not description:
            return False

        if (
            not description.strip().upper().startswith(("GET", "POST", "DELETE", "PUT", "PATCH"))
        ):  # Just using all methods to see if anything interesting pops up
            return False

        if any([x in description for x in ["_next/static/", "_next/data/"]]):
            return False

        return True

    def _fingerprint(self) -> str:
        url_paths = []
        for http_span in self.consecutive_http_spans:
            url = get_url_from_span(http_span)
            parametrized_url = self.parameterize_url(url)
            path = urlparse(parametrized_url).path
            if path not in url_paths:
                url_paths.append(path)
        url_paths.sort()

        hashed_url_paths = hashlib.sha1(("-".join(url_paths)).encode("utf8")).hexdigest()
        return f"1-{PerformanceConsecutiveHTTPQueriesGroupType.type_id}-{hashed_url_paths}"

    def on_complete(self) -> None:
        self._validate_and_store_performance_problem()

    def is_creation_allowed_for_organization(self, organization: Organization) -> bool:
        return features.has(
            "organizations:performance-consecutive-http-detector", organization, actor=None
        )

    @staticmethod
    def parameterize_url(url: str) -> str:
        parsed_url = urlparse(str(url))

        protocol_fragments = []
        if parsed_url.scheme:
            protocol_fragments.append(parsed_url.scheme)
            protocol_fragments.append("://")

        host_fragments = []
        for fragment in parsed_url.netloc.split("."):
            host_fragments.append(str(fragment))

        path_fragments = []
        for fragment in parsed_url.path.split("/"):
            if URL_PARAMETER_REGEX.search(fragment):
                path_fragments.append("*")
            else:
                path_fragments.append(str(fragment))

        query = parse_qs(parsed_url.query)

        return "".join(
            [
                "".join(protocol_fragments),
                ".".join(host_fragments),
                "/".join(path_fragments),
                "?",
                "&".join(sorted([f"{key}=*" for key in query.keys()])),
            ]
        ).rstrip("?")

    def is_creation_allowed_for_project(self, project: Project) -> bool:
        return True
