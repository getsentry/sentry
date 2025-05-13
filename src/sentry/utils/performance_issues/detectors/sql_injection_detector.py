from __future__ import annotations

import hashlib
from typing import Any

from sentry import features
from sentry.issues.grouptype import SQLInjectionGroupType
from sentry.issues.issue_occurrence import IssueEvidence
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.utils.performance_issues.base import (
    DetectorType,
    PerformanceDetector,
    fingerprint_span,
    get_notification_attachment_body,
    get_span_evidence_value,
)
from sentry.utils.performance_issues.performance_problem import PerformanceProblem
from sentry.utils.performance_issues.types import Span

MAX_EVIDENCE_VALUE_LENGTH = 10_000


class SQLInjectionDetector(PerformanceDetector):
    __slots__ = "stored_problems"

    type = DetectorType.SQL_INJECTION
    settings_key = DetectorType.SQL_INJECTION

    def __init__(self, settings: dict[DetectorType, Any], event: dict[str, Any]) -> None:
        super().__init__(settings, event)

        self.stored_problems = {}

        query_string = event.get("request", {}).get("query_string", None)
        if not query_string:
            return

        self.user_inputs = [query_value[1] for query_value in query_string]

    def visit_span(self, span: Span) -> None:
        if not SQLInjectionDetector.is_span_eligible(span):
            return

        description = span.get("description")
        fingerprint = fingerprint_span(span)
        hash = span.get("hash", "")
        op = span.get("op", None)
        spans_involved = [span["span_id"]]

        for user_input in self.user_inputs:
            if user_input in description and self.is_sql_injection(user_input):
                self.stored_problems[fingerprint] = PerformanceProblem(
                    type=SQLInjectionGroupType,
                    fingerprint=self._fingerprint(hash),
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
                        "transaction_name": self._event.get("description", ""),
                        "repeating_spans": get_span_evidence_value(span)[
                            :MAX_EVIDENCE_VALUE_LENGTH
                        ],
                        "repeating_spans_compact": get_span_evidence_value(span, include_op=False)[
                            :MAX_EVIDENCE_VALUE_LENGTH
                        ],
                        "num_repeating_spans": str(len(spans_involved)),
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
        return features.has("organizations:sql-injection-detector", organization, actor=None)

    def is_creation_allowed_for_project(self, project: Project | None) -> bool:
        return self.settings["detection_enabled"]

    def is_sql_injection(self, user_input: str) -> bool:
        if (
            "DROP" in user_input
            or "DELETE" in user_input
            or "UPDATE" in user_input
            or "INSERT" in user_input
        ):
            return True
        if ";" in user_input:
            return True
        if "--" in user_input:
            return True
        if "1=1" in user_input:
            return True
        return False

    @classmethod
    def is_span_eligible(cls, span: Span) -> bool:
        op = span.get("op", None)
        if not op or op != "db":
            return False

        description = span.get("description", None)
        if not description:
            return False

        return True

    def _fingerprint(self, hash: str) -> str:
        signature = (str(hash)).encode("utf-8")
        full_fingerprint = hashlib.sha1(signature).hexdigest()
        return f"1-{SQLInjectionGroupType.type_id}-{full_fingerprint}"
