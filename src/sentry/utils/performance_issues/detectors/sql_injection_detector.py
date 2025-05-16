from __future__ import annotations

import hashlib
from typing import Any

from sentry.issues.grouptype import SQLInjectionGroupType
from sentry.issues.issue_occurrence import IssueEvidence
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.utils.performance_issues.base import (
    DetectorType,
    PerformanceDetector,
    fingerprint_span,
    get_notification_attachment_body,
)
from sentry.utils.performance_issues.performance_problem import PerformanceProblem
from sentry.utils.performance_issues.types import Span

MAX_EVIDENCE_VALUE_LENGTH = 10_000

SQL_KEYWORDS = [
    "SELECT",
    "WHERE",
    "AND",
    "OR",
    "NOT",
    "IN",
    "LIKE",
    "LIMIT",
    "ORDER BY",
    "GROUP BY",
    "HAVING",
    "DISTINCT",
    "JOIN",
    "ON",
    "AS",
    "CASE",
    "WHEN",
    "THEN",
    "ELSE",
    "END",
    "UNION",
    "ALL",
    "ANY",
    "SOME",
    "EXISTS",
]


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

        self.user_inputs = [
            query_value[1] for query_value in query_string if self.keep_query_value(query_value)
        ]

    def visit_span(self, span: Span) -> None:
        if not SQLInjectionDetector.is_span_eligible(span):
            return

        description = span.get("description")
        fingerprint = fingerprint_span(span)
        op = span.get("op", None)
        spans_involved = [span["span_id"]]

        if any(user_input in description for user_input in self.user_inputs):
            for user_input in self.user_inputs:
                fingerprint_description = span.get("description")
                if user_input in fingerprint_description:
                    fingerprint_description = fingerprint_description.replace(user_input, "")

            self.stored_problems[fingerprint] = PerformanceProblem(
                type=SQLInjectionGroupType,
                fingerprint=self._fingerprint(fingerprint_description),
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

    def keep_query_value(self, query: tuple[str, str]) -> bool:
        query_value = query[1].upper()
        query_key = query[0].upper()

        if query_key == query_value:
            return False
        if query_value in SQL_KEYWORDS:
            return False
        return True

    @classmethod
    def is_span_eligible(cls, span: Span) -> bool:
        op = span.get("op", None)
        if not op or op != "db":
            return False

        description = span.get("description", None)
        if not description:
            return False

        return True

    def _fingerprint(self, description: str) -> str:
        signature = (str(description)).encode("utf-8")
        full_fingerprint = hashlib.sha1(signature).hexdigest()
        return f"1-{SQLInjectionGroupType.type_id}-{full_fingerprint}"
