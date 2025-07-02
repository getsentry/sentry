from __future__ import annotations

import hashlib
import re
from collections.abc import Sequence
from typing import Any

from sentry.issues.grouptype import DBQueryInjectionVulnerabilityGroupType
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

MAX_EVIDENCE_VALUE_LENGTH = 10_000

# Keywords that are excluded from the detection
EXCLUDED_KEYWORDS = [
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
    "DESC",
    "ASC",
    "NULL",
    "ORDER",
    "SORT",
    "EXPAND",
    "PAGE",
]

EXCLUDED_PACKAGES = ["github.com/go-sql-driver/mysql", "sequelize"]


class SQLInjectionDetector(PerformanceDetector):
    type = DetectorType.SQL_INJECTION
    settings_key = DetectorType.SQL_INJECTION

    def __init__(self, settings: dict[DetectorType, Any], event: dict[str, Any]) -> None:
        super().__init__(settings, event)

        self.stored_problems = {}
        self.request_parameters: list[Sequence[Any]] = []
        self.extract_request_data(event)

    def extract_request_data(self, event: dict[str, Any]) -> None:
        """
        Extracts valid request data from the query string and body of the event. There are a couple conditions we filter for:
        First, any pairs where the key and value are the same are ignored. This is so that when we look for user inputs in the description, we don't match on the key.
        Second, if the value is a SQL keyword, it is ignored. For example, we don't want to match on the value "SELECT".
        """
        self.query_string = event.get("request", {}).get("query_string", None)
        self.request_body = event.get("request", {}).get("data", None)
        self.request_url = event.get("request", {}).get("url", None)

        if not self.query_string and not self.request_body:
            return

        valid_parameters = []
        request_data = []

        if self.query_string and isinstance(self.query_string, list):
            request_data.extend(self.query_string)
        if self.request_body and isinstance(self.request_body, dict):
            request_data.extend(self.request_body.items())

        for query_pair in request_data:
            query_value = query_pair[1]
            query_key = query_pair[0]

            # Filters out empty strings or single character strings
            if (
                not isinstance(query_value, str)
                or not isinstance(query_key, str)
                or not query_value
                or len(query_value) < self.settings["query_value_length_threshold"]
            ):
                continue
            if query_key == query_value:
                continue
            if query_value.upper() in EXCLUDED_KEYWORDS or query_key.upper() in EXCLUDED_KEYWORDS:
                continue
            valid_parameters.append(query_pair)

        self.request_parameters = valid_parameters

    def visit_span(self, span: Span) -> None:
        if not SQLInjectionDetector.is_span_eligible(span) or not self.request_parameters:
            return

        description = span.get("description") or ""
        op = span.get("op") or ""
        spans_involved = [span["span_id"]]
        vulnerable_parameters = []

        if "WHERE" not in description.upper():
            return

        for key, value in self.request_parameters:
            regex_key = rf'(?<![\w.$])"?{re.escape(key)}"?(?![\w.$"])'
            regex_value = rf"(?<![\w.$])(['\"]?){re.escape(value)}\1(?![\w.$'\"])"
            where_index = description.upper().find("WHERE")
            if re.search(regex_key, description[where_index:]) and re.search(
                regex_value, description[where_index:]
            ):
                description = description[:where_index] + re.sub(
                    regex_value, "[UNTRUSTED_INPUT]", description[where_index:]
                )
                vulnerable_parameters.append((key, value))

        if len(vulnerable_parameters) == 0:
            return

        parameterized_description = span.get("sentry_tags", {}).get("description")
        # If the query description is not parameterized, use the original description with replacements
        if not parameterized_description:
            parameterized_description = description
        vulnerable_keys = [key for key, _ in vulnerable_parameters]
        fingerprint_description = f"{'-'.join(vulnerable_keys)}-{parameterized_description}"
        fingerprint = self._fingerprint(fingerprint_description)

        issue_description = (
            f"Untrusted Inputs [{', '.join(vulnerable_keys)}] in `{parameterized_description}`"
        )

        self.stored_problems[fingerprint] = PerformanceProblem(
            type=DBQueryInjectionVulnerabilityGroupType,
            fingerprint=fingerprint,
            op=op,
            desc=issue_description[:MAX_EVIDENCE_VALUE_LENGTH],
            cause_span_ids=[],
            parent_span_ids=[],
            offender_span_ids=spans_involved,
            evidence_data={
                "op": op,
                "cause_span_ids": [],
                "parent_span_ids": [],
                "offender_span_ids": spans_involved,
                "transaction_name": self._event.get("transaction", ""),
                "vulnerable_parameters": vulnerable_parameters,
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

        description = description.strip()
        if description[:6].upper() != "SELECT":
            return False

        return True

    @classmethod
    def is_event_eligible(cls, event: dict[str, Any], project: Project | None = None) -> bool:
        packages = event.get("modules", {})
        if not packages or not isinstance(packages, dict):
            return True
        # Filter out events with packages known to internally escape inputs
        for package_name in packages.keys():
            if package_name in EXCLUDED_PACKAGES:
                return False
        return True

    def _fingerprint(self, description: str) -> str:
        signature = description.encode("utf-8")
        full_fingerprint = hashlib.sha1(signature).hexdigest()
        return f"1-{DBQueryInjectionVulnerabilityGroupType.type_id}-{full_fingerprint}"
