from __future__ import annotations

import hashlib
import os
from collections import defaultdict
from collections.abc import Mapping, Sequence
from datetime import timedelta
from typing import Any
from urllib.parse import parse_qs, urlparse

from django.utils.encoding import force_bytes

from sentry.issues.grouptype import PerformanceNPlusOneAPICallsGroupType
from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.types.group import PriorityLevel
from sentry.utils.performance_issues.base import (
    fingerprint_http_spans,
    get_notification_attachment_body,
    get_span_evidence_value,
    get_url_from_span,
    parameterize_url,
)
from sentry.utils.performance_issues.detector_handlers.performance_issue_detector_handler import (
    PerformanceIssueDetectorHandler,
)
from sentry.utils.performance_issues.detectors.utils import get_total_span_duration
from sentry.utils.performance_issues.performance_problem import PerformanceProblem
from sentry.workflow_engine.models import Detector
from sentry.workflow_engine.types import DetectorGroupKey

from .types import PerformanceProblemsMap, Span


class NPlusOneAPICallsDetectorHandler(PerformanceIssueDetectorHandler):
    def __init__(self, detector: Detector):
        super().__init__(detector)
        # TODO: Only store the span IDs and timestamps instead of entire span objects
        self.stored_problems: PerformanceProblemsMap = {}
        self.spans: list[Span] = []
        self.span_hashes: dict[str, str | None] = {}

    def is_creation_allowed_for_organization(self, organization: Organization) -> bool:
        return True

    def is_creation_allowed_for_project(self, project: Project) -> bool:
        return self.detector.config["detection_enabled"]

    @classmethod
    def is_event_eligible(cls, event: dict[str, Any], project: Project | None = None) -> bool:
        trace_op = event.get("contexts", {}).get("trace", {}).get("op")
        if trace_op and trace_op not in ["navigation", "pageload", "ui.load", "ui.action"]:
            return False

        return True

    def _spans_are_concurrent(self, span_a: Span, span_b: Span) -> bool:
        span_a_start: int = span_a.get("start_timestamp", 0) or 0
        span_b_start: int = span_b.get("start_timestamp", 0) or 0

        return timedelta(seconds=abs(span_a_start - span_b_start)) < timedelta(
            milliseconds=self.settings["concurrency_threshold"]
        )

    def _spans_are_similar(self, span_a: Span, span_b: Span) -> bool:
        return (
            self.span_hashes[span_a["span_id"]] == self.span_hashes[span_b["span_id"]]
            and span_a["parent_span_id"] == span_b["parent_span_id"]
        )

    def visit_span(self, span: Span) -> None:
        if not self.is_span_eligible(span):
            return

        op = span.get("op", None)
        # self.settings needs to be Detector.config
        if op not in self.settings.get("allowed_span_ops", []):
            return

        self.span_hashes[span["span_id"]] = get_span_hash(span)

        previous_span = self.spans[-1] if len(self.spans) > 0 else None

        if previous_span is None:
            self.spans.append(span)
        elif self._spans_are_concurrent(previous_span, span) and self._spans_are_similar(
            previous_span, span
        ):
            self.spans.append(span)
        else:
            # self._maybe_store_problem() # build_occurrence_and_event_data
            self.spans = [span]

    def evaluate(self, data_packet):
        # TODO need to set this up the way DetectorHandler expects
        pass

    def on_complete(self) -> None:
        self.build_occurrence_and_event_data(group_key, value, new_status)
        # self._maybe_store_problem()
        self.spans = []

    def _fingerprint(self) -> str | None:
        first_url = get_url_from_span(self.spans[0])
        parameterized_first_url = parameterize_url(first_url)

        # Check if we parameterized the URL at all. If not, do not attempt
        # fingerprinting. Unparameterized URLs run too high a risk of
        # fingerprinting explosions. Query parameters are parameterized by
        # definition, so exclude them from comparison
        if without_query_params(parameterized_first_url) == without_query_params(first_url):
            return None

        fingerprint = fingerprint_http_spans([self.spans[0]])

        return f"1-{PerformanceNPlusOneAPICallsGroupType.type_id}-{fingerprint}"

    def _get_path_prefix(self, repeating_span: Span) -> str:
        if not repeating_span:
            return ""

        url = get_url_from_span(repeating_span)
        parsed_url = urlparse(url)
        return parsed_url.path or ""

    def _get_parameters(self) -> list[str]:
        if not self.spans or len(self.spans) == 0:
            return []

        urls = [get_url_from_span(span) for span in self.spans]

        all_parameters: Mapping[str, list[str]] = defaultdict(list)

        for url in urls:
            parsed_url = urlparse(url)
            parameters = parse_qs(parsed_url.query)

            for key, value in parameters.items():
                all_parameters[key] += value

        return [
            "{{{}: {}}}".format(key, ",".join(values)) for key, values in all_parameters.items()
        ]

    def build_occurrence_and_event_data(
        self, group_key: DetectorGroupKey, value: int, new_status: PriorityLevel
    ) -> tuple[IssueOccurrence, dict[str, Any]]:
        # TODO need to set this up the way DetectorHandler expects

        if len(self.spans) < 1:
            return

        if len(self.spans) < self.settings["count"]:
            return

        total_duration = get_total_span_duration(self.spans)
        if total_duration < self.settings["total_duration"]:
            return

        last_span = self.spans[-1]

        fingerprint = self._fingerprint()
        if not fingerprint:
            return

        offender_span_ids = [span["span_id"] for span in self.spans]

        self.stored_problems[fingerprint] = PerformanceProblem(
            fingerprint=fingerprint,
            op=last_span["op"],
            desc=os.path.commonprefix([span.get("description", "") or "" for span in self.spans]),
            type=PerformanceNPlusOneAPICallsGroupType,
            cause_span_ids=[],
            parent_span_ids=[last_span.get("parent_span_id", None)],
            offender_span_ids=offender_span_ids,
            evidence_data={
                "op": last_span["op"],
                "cause_span_ids": [],
                "parent_span_ids": [last_span.get("parent_span_id", None)],
                "offender_span_ids": offender_span_ids,
                "transaction_name": self._event.get(
                    "transaction", ""
                ),  # how to pass this? we have it in evaluate as that gets passed the data packet
                "num_repeating_spans": str(len(offender_span_ids)) if offender_span_ids else "",
                "repeating_spans": self._get_path_prefix(self.spans[0]),
                "repeating_spans_compact": get_span_evidence_value(self.spans[0], include_op=False),
                "parameters": self._get_parameters(),
            },
            evidence_display=[
                IssueEvidence(
                    name="Offending Spans",
                    value=get_notification_attachment_body(
                        last_span["op"],
                        os.path.commonprefix(
                            [span.get("description", "") or "" for span in self.spans]
                        ),
                    ),
                    # Has to be marked important to be displayed in the notifications
                    important=True,
                )
            ],
        )


HTTP_METHODS = {
    "GET",
    "HEAD",
    "POST",
    "PUT",
    "DELETE",
    "CONNECT",
    "OPTIONS",
    "TRACE",
    "PATCH",
}


def get_span_hash(span: Span) -> str | None:
    if span.get("op") != "http.client":
        return span.get("hash")

    parts = remove_http_client_query_string_strategy(span)
    if not parts:
        return None

    hash = hashlib.md5()
    for part in parts:
        hash.update(force_bytes(part, errors="replace"))

    return hash.hexdigest()[:16]


def remove_http_client_query_string_strategy(span: Span) -> Sequence[str] | None:
    """
    This is an inline version of the `http.client` parameterization code in
    `"default:2022-10-27"`, the default span grouping strategy at time of
    writing. It's inlined here to insulate this detector from changes in the
    strategy, which are coming soon.
    """

    # Check the description is of the form `<HTTP METHOD> <URL>`
    description = span.get("description") or ""
    parts = description.split(" ", 1)
    if len(parts) != 2:
        return None

    # Ensure that this is a valid http method
    method, url_str = parts
    method = method.upper()
    if method not in HTTP_METHODS:
        return None

    url = urlparse(url_str)
    return [method, url.scheme, url.netloc, url.path]


def without_query_params(url: str) -> str:
    return urlparse(url)._replace(query="").geturl()
