from __future__ import annotations

import urllib.parse
from collections import defaultdict
from dataclasses import dataclass
from typing import Optional

from sentry import features
from sentry.issues.grouptype import PerformanceHTTPOverheadGroupType
from sentry.issues.issue_occurrence import IssueEvidence
from sentry.models import Organization, Project

from ..base import (
    DetectorType,
    PerformanceDetector,
    does_overlap_previous_span,
    get_notification_attachment_body,
    get_span_evidence_value,
)
from ..performance_problem import PerformanceProblem
from ..types import Span


@dataclass
class ProblemIndicator:
    """
    Keep span data that will be used to store the problem together.
    Has a monotonic queue depth to know if spans hit the parallel limit without walking all spans again.
    """

    span: Span
    delay: float
    queue_depth: int = 0


class HTTPOverheadDetector(PerformanceDetector):
    """
    Detect HTTP/1.1 overhead in http spans outside of response time for that endpoint using
    Browser reporting of PerformanceNavigationTiming. Parent-child span hierarchy
    is ignored as there is an external limit (browser http/1.1 request limit) solely based on time.

      [-------- transaction -----------]
        [0] https://service.io/api/book/1      - request delay ~0ms
        ----[1] https://service.io/api/book/2  - request delay ~0ms
        ----[2] https://service.io/api/book/3  - request delay ~0ms
        ...
        ----[5] https://service.io/api/book/6  - request delay 400ms - Hit ~6 connection limit.
        ----[6] https://service.io/api/book/7  - request delay 600ms - Over threshold, triggers detection.
        ...
    """

    __slots__ = "stored_problems"

    type = DetectorType.HTTP_OVERHEAD
    settings_key = DetectorType.HTTP_OVERHEAD

    def init(self):
        self.stored_problems: dict[str, PerformanceProblem] = {}
        self.location_to_indicators = defaultdict(list)

    def visit_span(self, span: Span) -> None:
        span_data = span.get("data", {})
        if not self._is_span_eligible(span) or not span_data:
            return

        url = span_data.get("url", "")
        span_start = span.get("start_timestamp", 0) * 1000
        request_start = span_data.get("http.request.request_start", 0) * 1000

        if not url or not span_start or not request_start:
            return

        if url.startswith("/"):
            location = "/"
        else:
            parsed_url = urllib.parse.urlparse(url)
            location = parsed_url.netloc

        if not location:
            return

        request_delay = request_start - span_start

        if request_delay < 0:
            # shouldn't be possible, but these values are browser reported
            return

        indicators = self.location_to_indicators[location]
        recent_beginning_of_chain = next(
            filter(lambda i: i.queue_depth == 0, reversed(indicators)), None
        )
        recent_end_of_chain = indicators[-1] if indicators else None

        if not recent_beginning_of_chain:
            self.location_to_indicators[location] += [ProblemIndicator(span, request_delay, 0)]
            return

        previous_delay = recent_beginning_of_chain.delay
        previous_span = recent_beginning_of_chain.span
        previous_monotonic = recent_end_of_chain.queue_depth if recent_end_of_chain else 0

        is_overlapping = does_overlap_previous_span(previous_span, span)
        new_monotonic = (
            previous_monotonic + 1 if request_delay >= previous_delay and is_overlapping else 0
        )

        self.location_to_indicators[location] += [
            ProblemIndicator(span, request_delay, new_monotonic)
        ]

    def _is_span_eligible(self, span: Span) -> bool:
        span_op = span.get("op", None)
        span_data = span.get("data", {})
        if not span_data:
            return False
        protocol_version = span_data.get("network.protocol.version", None)

        if not span_op or not span_op == "http.client" or not protocol_version == "1.1":
            return False
        return True

    def _store_performance_problem(self, location: str) -> None:
        delay_threshold = self.settings.get("http_request_delay_threshold")

        # This isn't a threshold, it reduces noise in offending spans.
        indicators = [
            indicator
            for indicator in self.location_to_indicators[location]
            if indicator.delay > 100
        ]

        location_spans = [indicator.span for indicator in indicators]
        meets_min_queued = any(
            indicator.queue_depth >= 5 for indicator in indicators
        )  # Browsers queue past 4-6 connections.
        exceeds_delay_threshold = any(indicator.delay > delay_threshold for indicator in indicators)

        if not exceeds_delay_threshold or not meets_min_queued or not location_spans:
            return

        fingerprint = f"1-{PerformanceHTTPOverheadGroupType.type_id}-{location}"
        example_span = location_spans[0]
        desc: str = example_span.get("description", None)

        location_span_ids = [span.get("span_id", None) for span in location_spans]

        self.stored_problems[fingerprint] = PerformanceProblem(
            fingerprint,
            "http",
            desc=desc,
            type=PerformanceHTTPOverheadGroupType,
            cause_span_ids=[],
            parent_span_ids=None,
            offender_span_ids=location_span_ids,
            evidence_data={
                "parent_span_ids": [],
                "cause_span_ids": [],
                "offender_span_ids": location_span_ids,
                "op": "http",
                "transaction_name": self._event.get("transaction", ""),
                "repeating_spans": get_span_evidence_value(example_span),
                "repeating_spans_compact": get_span_evidence_value(example_span, include_op=False),
                "num_repeating_spans": str(len(location_spans)),
            },
            evidence_display=[
                IssueEvidence(
                    name="Offending Spans",
                    value=get_notification_attachment_body(
                        "http",
                        desc,
                    ),
                    important=True,
                )
            ],
        )

    def on_complete(self) -> None:
        for location in self.location_to_indicators:
            self._store_performance_problem(location)

    def is_creation_allowed_for_organization(self, organization: Optional[Organization]) -> bool:
        return features.has(
            "organizations:performance-issues-http-overhead-detector",
            organization,
            actor=None,
        )

    def is_creation_allowed_for_project(self, project: Project) -> bool:
        return self.settings["detection_enabled"]
