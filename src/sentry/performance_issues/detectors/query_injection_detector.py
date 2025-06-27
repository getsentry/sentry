from __future__ import annotations

import hashlib
from typing import Any

from sentry.issues.grouptype import QueryInjectionVulnerabilityGroupType
from sentry.issues.issue_occurrence import IssueEvidence
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.performance_issues.base import (
    DetectorType,
    PerformanceDetector,
    get_notification_attachment_body,
)
from sentry.performance_issues.performance_problem import PerformanceProblem
from sentry.performance_issues.types import Span
from sentry.utils import json

MAX_EVIDENCE_VALUE_LENGTH = 10_000


class QueryInjectionDetector(PerformanceDetector):
    __slots__ = "stored_problems"

    type = DetectorType.QUERY_INJECTION
    settings_key = DetectorType.QUERY_INJECTION

    def __init__(self, settings: dict[DetectorType, Any], event: dict[str, Any]) -> None:
        super().__init__(settings, event)

        self.stored_problems = {}
        self.potential_unsafe_inputs: list[tuple[str, dict[str, Any]]] = []
        self.extract_request_data(event)

    def extract_request_data(self, event: dict[str, Any]) -> None:
        self.request_data = event.get("request", {}).get("data", {})
        self.request_url = event.get("request", {}).get("url", "")
        if not isinstance(self.request_data, dict):
            return

        for query_pair in self.request_data.items():
            query_value = query_pair[1]
            # Any JSON-like values being passed as query parameters are potential unsafe inputs
            if not isinstance(query_value, (str, int, float, bool)) and query_value is not None:
                self.potential_unsafe_inputs.append(query_pair)

    def visit_span(self, span: Span) -> None:
        if not QueryInjectionDetector.is_span_eligible(span):
            return

        if len(self.potential_unsafe_inputs) == 0:
            return

        description = span.get("description", None) or ""
        op = span.get("op", None) or ""
        spans_involved = [span["span_id"]]

        unsafe_inputs = []
        for input_key, input_value in self.potential_unsafe_inputs:
            original_input_value = input_value.copy()
            # Replace all operands in filter with "?" since the query description is sanitized
            if input_value and isinstance(input_value, dict):
                for dict_key, dict_value in input_value.items():
                    if dict_key and not isinstance(dict_value, dict):
                        input_value[dict_key] = "?"

            input_dict = {input_key: input_value}
            if json.dumps(input_dict) in description:
                description = description.replace(json.dumps(input_value), "?")
                unsafe_inputs.append((input_key, original_input_value))

        if len(unsafe_inputs) == 0:
            return

        fingerprint = self._fingerprint(description)

        self.stored_problems[fingerprint] = PerformanceProblem(
            type=QueryInjectionVulnerabilityGroupType,
            fingerprint=fingerprint,
            op=op,
            desc=description[:MAX_EVIDENCE_VALUE_LENGTH],
            cause_span_ids=[],
            parent_span_ids=[],
            offender_span_ids=spans_involved,
            evidence_data={
                "op": op,
                "cause_span_ids": [],
                "parent_span_ids": [],
                "offender_span_ids": spans_involved,
                "transaction_name": self._event.get("transaction", ""),
                "vulnerable_parameters": unsafe_inputs,
                "request_url": self.request_url,
            },
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

    def is_creation_allowed_for_organization(self, organization: Organization) -> bool:
        return True

    def is_creation_allowed_for_project(self, project: Project | None) -> bool:
        return self.settings["detection_enabled"]

    @classmethod
    def is_span_eligible(cls, span: Span) -> bool:
        if not span.get("span_id"):
            return False

        op = span.get("op", None)

        if not op or not op.startswith("db") or op.startswith("db.redis"):
            return False

        description = span.get("description", None)
        if not description:
            return False
        return True

    def _fingerprint(self, description: str) -> str:
        signature = description.encode("utf-8")
        full_fingerprint = hashlib.sha1(signature).hexdigest()
        return f"1-{QueryInjectionVulnerabilityGroupType.type_id}-{full_fingerprint}"
