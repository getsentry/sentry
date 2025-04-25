from __future__ import annotations

import os
from collections import defaultdict
from datetime import timedelta
from typing import Any
from urllib.parse import urlparse

from sentry.issues.grouptype import PerformanceNPlusOneAPICallsExperimentalGroupType
from sentry.issues.issue_occurrence import IssueEvidence
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.utils.performance_issues.base import (
    DetectorType,
    PerformanceDetector,
    fingerprint_http_spans,
    get_notification_attachment_body,
    get_span_evidence_value,
    get_url_from_span,
    parameterize_url,
    parameterize_url_with_result,
)
from sentry.utils.performance_issues.detectors.utils import get_total_span_duration
from sentry.utils.performance_issues.performance_problem import PerformanceProblem
from sentry.utils.performance_issues.types import PerformanceProblemsMap, Span


class NPlusOneAPICallsExperimentalDetector(PerformanceDetector):
    """
    Detect parallel network calls to the same parameterized endpoint.

      [-------- transaction -----------]
         [-------- parent span -----------]
          [n0] https://service.io/resources/1/?id=12443
          [n1] https://service.io/resources/2/?id=13342
          [n2] https://service.io/resources/3/?id=13441
          ...
    """

    __slots__ = ["stored_problems"]
    type = DetectorType.EXPERIMENTAL_N_PLUS_ONE_API_CALLS
    settings_key = DetectorType.EXPERIMENTAL_N_PLUS_ONE_API_CALLS

    def __init__(self, settings: dict[DetectorType, Any], event: dict[str, Any]) -> None:
        super().__init__(settings, event)

        # TODO: Only store the span IDs and timestamps instead of entire span objects
        self.stored_problems: PerformanceProblemsMap = {}
        self.spans: list[Span] = []

    def is_creation_allowed_for_system(self) -> bool:
        # Defer to the issue platform for whether to create issues
        # See https://develop.sentry.dev/backend/issue-platform/#releasing-your-issue-type
        return True

    def visit_span(self, span: Span) -> None:
        if not NPlusOneAPICallsExperimentalDetector.is_span_eligible(span):
            return

        op = span.get("op", None)
        if op not in self.settings.get("allowed_span_ops", []):
            return

        previous_span = self.spans[-1] if len(self.spans) > 0 else None

        if previous_span is None:
            self.spans.append(span)
        elif self._spans_are_concurrent(previous_span, span) and self._spans_are_similar(
            previous_span, span
        ):
            self.spans.append(span)
        else:
            self._maybe_store_problem()
            self.spans = [span]

    def is_creation_allowed_for_organization(self, organization: Organization) -> bool:
        return True

    def is_creation_allowed_for_project(self, project: Project) -> bool:
        return self.settings["detection_enabled"]

    @classmethod
    def is_event_eligible(cls, event: dict[str, Any], project: Project | None = None) -> bool:
        trace_op = event.get("contexts", {}).get("trace", {}).get("op")
        if trace_op and trace_op not in ["navigation", "pageload", "ui.load", "ui.action"]:
            return False

        return True

    @classmethod
    def is_span_eligible(cls, span: Span) -> bool:
        span_id = span.get("span_id", None)
        op = span.get("op", None)
        hash = span.get("hash", None)

        if not span_id or not op or not hash:
            return False

        description = span.get("description")
        if not description:
            return False

        if description.strip()[:3].upper() != "GET":
            return False

        url = get_url_from_span(span)

        # GraphQL URLs have complicated queries in them. Until we parse those
        # queries to check for what's duplicated, we can't tell what is being
        # duplicated. Ignore them for now
        if "graphql" in url:
            return False

        # Next.js infixes its data URLs with a build ID. (e.g.,
        # /_next/data/<uuid>/some-endpoint) This causes a fingerprinting
        # explosion, since every deploy would change this ID and create new
        # fingerprints. Since we're not parameterizing URLs yet, we need to
        # exclude them
        if "_next/data" in url:
            return False

        # Next.js error pages cause an N+1 API Call that isn't useful to anyone
        if "__nextjs_original-stack-frame" in url:
            return False

        if not url:
            return False

        # Once most users update their SDKs to use the latest standard, we
        # won't have to do this, since the URLs will be sent in as `span.data`
        # in a parsed format
        parsed_url = urlparse(str(url))

        # Ignore anything that looks like an asset. Some frameworks (and apps)
        # fetch assets via XHR, which is not our concern
        _pathname, extension = os.path.splitext(parsed_url.path)
        if extension and extension in [".js", ".css", ".svg", ".png", ".mp3", ".jpg", ".jpeg"]:
            return False

        return True

    def on_complete(self) -> None:
        self._maybe_store_problem()
        self.spans = []

    def _maybe_store_problem(self) -> None:
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
        problem_description = self._get_parameterized_url(self.spans[0])
        if problem_description == "":
            problem_description = os.path.commonprefix(
                [span.get("description", "") or "" for span in self.spans]
            )

        self.stored_problems[fingerprint] = PerformanceProblem(
            fingerprint=fingerprint,
            op=last_span["op"],
            desc=problem_description,
            type=PerformanceNPlusOneAPICallsExperimentalGroupType,
            cause_span_ids=[],
            parent_span_ids=[last_span.get("parent_span_id", None)],
            offender_span_ids=offender_span_ids,
            evidence_data={
                "op": last_span["op"],
                "cause_span_ids": [],
                "parent_span_ids": [last_span.get("parent_span_id", None)],
                "offender_span_ids": offender_span_ids,
                "transaction_name": self._event.get("transaction", ""),
                "num_repeating_spans": str(len(offender_span_ids)) if offender_span_ids else "",
                "repeating_spans": self._get_path_prefix(self.spans[0]),
                "repeating_spans_compact": get_span_evidence_value(self.spans[0], include_op=False),
                "parameters": self._get_parameters()["query_params"],
                "path_parameters": self._get_parameters()["path_params"],
            },
            evidence_display=[
                IssueEvidence(
                    name="Offending Spans",
                    value=get_notification_attachment_body(
                        op=last_span["op"], desc=problem_description
                    ),
                    # Has to be marked important to be displayed in the notifications
                    important=True,
                )
            ],
        )

    def _get_parameters(self) -> dict[str, list[str]]:
        if not self.spans or len(self.spans) == 0:
            return {"query_params": [], "path_params": []}

        parameterized_urls = [
            parameterize_url_with_result(get_url_from_span(span)) for span in self.spans
        ]
        path_params = [param["path_params"] for param in parameterized_urls]
        query_dict: dict[str, list[str]] = defaultdict(list)

        for parameterized_url in parameterized_urls:
            query_params = parameterized_url["query_params"]

            for key, value in query_params.items():
                query_dict[key] += value
        return {
            "path_params": [f"{', '.join(param_group)}" for param_group in path_params],
            "query_params": [f"{key}: {', '.join(values)}" for key, values in query_dict.items()],
        }

    def _get_parameterized_url(self, span: Span) -> str:
        return parameterize_url(get_url_from_span(span))

    def _get_path_prefix(self, repeating_span: Span) -> str:
        if not repeating_span:
            return ""

        url = get_url_from_span(repeating_span)
        parsed_url = urlparse(url)
        return parsed_url.path or ""

    def _fingerprint(self) -> str | None:
        first_url = get_url_from_span(self.spans[0])
        parameterized_first_url = parameterize_url(first_url)

        # Check if we parameterized the URL at all. If not, do not attempt
        # fingerprinting. Unparameterized URLs run too high a risk of
        # fingerprinting explosions.
        if parameterized_first_url == first_url:
            return None

        fingerprint = fingerprint_http_spans([self.spans[0]])

        return f"1-{PerformanceNPlusOneAPICallsExperimentalGroupType.type_id}-{fingerprint}"

    def _spans_are_concurrent(self, span_a: Span, span_b: Span) -> bool:
        span_a_start: int = span_a.get("start_timestamp", 0) or 0
        span_b_start: int = span_b.get("start_timestamp", 0) or 0

        return timedelta(seconds=abs(span_a_start - span_b_start)) < timedelta(
            milliseconds=self.settings["concurrency_threshold"]
        )

    def _spans_are_similar(self, span_a: Span, span_b: Span) -> bool:
        return (
            self._get_parameterized_url(span_a) == self._get_parameterized_url(span_b)
            and span_a["parent_span_id"] == span_b["parent_span_id"]
        )
