from __future__ import annotations

import hashlib
from typing import Any

from sentry.issues.grouptype import DBInjectionVulnerabilityGroupType
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
        self.extract_user_inputs(event)

    def extract_user_inputs(self, event: dict[str, Any]) -> None:
        """
        Extracts valid user inputs from the query string of the event. There are a couple conditions we filter for:
        First, any queries where the key and value are the same are ignored. This is so that when we look for user inputs in the description, we don't match on the key.
        Second, if the query value is a SQL keyword, it is ignored. For example, we don't want to match on the value "SELECT" in the query string.
        """
        self.query_string = event.get("request", {}).get("query_string", None)
        self.request_url = event.get("request", {}).get("url", None)

        if not self.query_string:
            return

        valid_queries = []

        for query_pair in self.query_string:
            query_value = query_pair[1].upper()
            query_key = query_pair[0].upper()

            if query_key == query_value:
                continue
            if query_value in SQL_KEYWORDS:
                continue
            valid_queries.append(query_pair)

        self.user_inputs = valid_queries

    def visit_span(self, span: Span) -> None:
        if not SQLInjectionDetector.is_span_eligible(span):
            return

        description = span.get("description")
        op = span.get("op", None)
        spans_involved = [span["span_id"]]
        vulnerable_query_keys = []

        for user_input in self.user_inputs:
            query_value = user_input[1]
            query_key = user_input[0]
            if query_value in description:
                description = description.replace(query_value, "?")
                vulnerable_query_keys.append(query_key)

        if len(vulnerable_query_keys) == 0:
            return

        fingerprint = self._fingerprint(description)

        self.stored_problems[fingerprint] = PerformanceProblem(
            type=DBInjectionVulnerabilityGroupType,
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
                "vulnerable_query_keys": vulnerable_query_keys,
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
        return f"1-{DBInjectionVulnerabilityGroupType.type_id}-{full_fingerprint}"
