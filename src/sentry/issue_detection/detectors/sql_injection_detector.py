from __future__ import annotations

import hashlib
import re
from collections.abc import Sequence
from typing import Any

from sentry.issue_detection.base import DetectorType, PerformanceDetector
from sentry.issue_detection.detectors.utils import get_notification_attachment_body
from sentry.issue_detection.performance_problem import PerformanceProblem
from sentry.issue_detection.types import Span
from sentry.issues.grouptype import QueryInjectionVulnerabilityGroupType
from sentry.issues.issue_occurrence import IssueEvidence
from sentry.models.organization import Organization
from sentry.models.project import Project

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

# Packages that are known to internally escape inputs:
# - github.com/go-sql-driver/mysql: MySQL driver for Go
# - sequelize: Sequelize ORM
# - gorm.io/gorm: GORM ORM for Go
# - @nestjs/typeorm: NestJS TypeORM
# - @mikro-orm/nestjs: MikroORM NestJS ORM
# - typeorm: TypeORM ORM
# - @mikro-orm/core: MikroORM
EXCLUDED_PACKAGES = [
    "github.com/go-sql-driver/mysql",
    "sequelize",
    "gorm.io/gorm",
    "@nestjs/typeorm",
    "@mikro-orm/nestjs",
    "typeorm",
    "@mikro-orm/core",
]
PARAMETERIZED_KEYWORDS = ["?", "$1", "%s"]


class SQLInjectionDetector(PerformanceDetector):
    type = DetectorType.SQL_INJECTION
    settings_key = DetectorType.SQL_INJECTION

    def __init__(
        self,
        settings: dict[DetectorType, Any],
        event: dict[str, Any],
        organization: Organization | None = None,
        detector_id: int | None = None,
    ) -> None:
        super().__init__(settings, event, organization, detector_id)

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
            # Skip None values or pairs that don't have at least 2 elements
            if not query_pair or not isinstance(query_pair, Sequence) or len(query_pair) < 2:
                continue
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
        if not self._is_span_eligible(span) or not self.request_parameters:
            return
        description = span.get("description") or ""
        op = span.get("op") or ""
        spans_involved = [span["span_id"]]
        vulnerable_parameters = []

        for key, value in self.request_parameters:
            regex_key = rf'(?<![\w.$])"?{re.escape(key)}"?(?![\w.$"])'
            regex_value = rf"(?<![\w.$])(['\"]?){re.escape(value)}\1(?![\w.$'\"])"
            where_index = description.upper().find("WHERE")
            # Search for comments only in the portion after WHERE clause
            description_after_where = description[where_index:]
            comment_index = description_after_where.find("--")
            if comment_index != -1:
                description_to_search = description_after_where[:comment_index]
                description_after_comment = description_after_where[comment_index:]
            else:
                description_to_search = description_after_where
                description_after_comment = ""
            if re.search(regex_key, description_to_search) and re.search(
                regex_value, description_to_search
            ):
                description = (
                    description[:where_index]
                    + re.sub(regex_value, "[UNTRUSTED_INPUT]", description_to_search)
                    + description_after_comment
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

        evidence_data = {
            "op": op,
            "cause_span_ids": [],
            "parent_span_ids": [],
            "offender_span_ids": spans_involved,
            "transaction_name": self._event.get("transaction", ""),
            "vulnerable_parameters": vulnerable_parameters,
            "request_url": self.request_url,
        }
        if self.detector_id is not None:
            evidence_data["detector_id"] = self.detector_id

        self.stored_problems[fingerprint] = PerformanceProblem(
            type=QueryInjectionVulnerabilityGroupType,
            fingerprint=fingerprint,
            op=op,
            desc=issue_description[:MAX_EVIDENCE_VALUE_LENGTH],
            cause_span_ids=[],
            parent_span_ids=[],
            offender_span_ids=spans_involved,
            evidence_data=evidence_data,
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

    def _is_span_eligible(self, span: Span) -> bool:
        if not span.get("span_id"):
            return False

        op = span.get("op", None)

        # If the span is not a database span, we can skip the detection. `db.sql.active_record` is known to cause false positives so it is excluded.
        if (
            not op
            or not op.startswith("db")
            or op.startswith("db.redis")
            or op == "db.sql.active_record"
        ):
            return False

        # Auto-generated rails queries can contain interpolated values
        origin = span.get("origin", "")
        if origin == "auto.db.rails" or (
            isinstance(origin, str) and origin.startswith("auto.db.otel.")
        ):
            return False

        # If bindings are present, we can assume the query is safe
        span_data = span.get("data", {})
        if span_data and span_data.get("db.sql.bindings"):
            return False

        description = span.get("description", None)
        if not description:
            return False

        # Only look at SELECT queries that have a WHERE clause and don't have any parameterized keywords
        description = description.strip()
        if (
            description[:6].upper() != "SELECT"
            or "WHERE" not in description.upper()
            or any(keyword in description for keyword in PARAMETERIZED_KEYWORDS)
            or re.search(r"&[A-Za-z_][A-Za-z0-9_]*", description)
        ):
            return False

        # If the description contains multiple occurrences of alias chaining, likely coming from an ORM
        if len(re.findall(r"\w+(->\w+)+", description)) > 3:
            return False

        # If the description contains multiple deleted_at IS NULL clauses, likely coming from an ORM
        if len(re.findall(r'"?deleted[_aA]+t"?\s+IS\s+NULL', description)) > 3:
            return False

        # Laravel queries with this pattern can contain interpolated values
        if span.get("sentry_tags", {}).get("sdk.name") == "sentry.php.laravel" and re.search(
            r"IN\s*\(\s*(\d+\s*,\s*)*\d+\s*\)", description.upper()
        ):
            return False

        # Zend1 can cause false positives
        if span.get("sentry_tags", {}).get("platform") == "php":
            span_data = span.get("data", {})
            event_traces = span_data.get("event.trace", []) if span_data else []
            if isinstance(event_traces, list) and any(
                [trace.get("function", "").startswith("Zend_") for trace in event_traces]
            ):
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
        return f"1-{QueryInjectionVulnerabilityGroupType.type_id}-{full_fingerprint}"
