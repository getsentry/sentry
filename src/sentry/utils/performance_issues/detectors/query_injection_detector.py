from __future__ import annotations

import hashlib
from typing import Any

from sentry.issues.grouptype import DBQueryInjectionVulnerabilityGroupType
from sentry.issues.issue_occurrence import IssueEvidence
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.utils.performance_issues.base import (
    DetectorType,
    PerformanceDetector,
    get_notification_attachment_body,
)
from sentry.utils.performance_issues.performance_problem import PerformanceProblem
from sentry.utils.performance_issues.types import Span

MAX_EVIDENCE_VALUE_LENGTH = 10_000


class QueryInjectionDetector(PerformanceDetector):
    __slots__ = "stored_problems"

    type = DetectorType.QUERY_INJECTION
    settings_key = DetectorType.QUERY_INJECTION

    def __init__(self, settings: dict[DetectorType, Any], event: dict[str, Any]) -> None:
        super().__init__(settings, event)

        self.stored_problems = {}
        self.potential_unsafe_inputs = []
        self.extract_request_data(event)

    def extract_request_data(self, event: dict[str, Any]) -> None:
        self.request_data = event.get("request", {}).get("data", {})
        self.request_url = event.get("request", {}).get("url", "")
        for key, value in self.request_data.items():
            if not isinstance(value, (str, int, float, bool)) and value is not None:
                self.potential_unsafe_inputs.append(key)

    def visit_span(self, span: Span) -> None:
        if not QueryInjectionDetector.is_span_eligible(span):
            return

        if len(self.potential_unsafe_inputs) == 0:
            return

        description = span.get("description", None) or ""
        op = span.get("op", None) or ""
        spans_involved = [span["span_id"]]

        unsafe_inputs = []
        for input in self.potential_unsafe_inputs:
            if input in description:
                description = description.replace(input, "?")
                unsafe_inputs.append(input)

        if len(unsafe_inputs) == 0:
            return

        fingerprint = self._fingerprint(description)

        self.stored_problems[fingerprint] = PerformanceProblem(
            type=DBQueryInjectionVulnerabilityGroupType,
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
                "unsafe_inputs": unsafe_inputs,
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
        return f"1-{DBQueryInjectionVulnerabilityGroupType.type_id}-{full_fingerprint}"
