from __future__ import annotations

from sentry import features
from sentry.issues.grouptype import PerformanceLargeHTTPPayloadGroupType
from sentry.models import Organization, Project

from ..base import DetectorType, PerformanceDetector, fingerprint_http_spans
from ..performance_problem import PerformanceProblem
from ..types import Span


class LargeHTTPPayloadDetector(PerformanceDetector):
    __slots__ = "stored_problems"

    type: DetectorType = DetectorType.LARGE_HTTP_PAYLOAD
    settings_key = DetectorType.LARGE_HTTP_PAYLOAD

    def init(self):
        self.stored_problems: dict[str, PerformanceProblem] = {}
        self.consecutive_http_spans: list[Span] = []

    def visit_span(self, span: Span) -> None:
        span_id = span.get("span_id", None)

        if not span_id or not self._is_eligible_http_span(span):
            return

        data = span.get("data", None)
        encoded_body_size = data and data.get("Encoded Body Size", None)
        if not (encoded_body_size):
            return

        payload_size_threshold = self.settings.get("payload_size_threshold")
        if encoded_body_size > payload_size_threshold:
            self._store_performance_problem(span)

    def _store_performance_problem(self, span) -> None:
        fingerprint = self._fingerprint(span)
        offender_span_ids = span.get("span_id", None)
        desc: str = span.get("description", None)

        self.stored_problems[fingerprint] = PerformanceProblem(
            fingerprint,
            "http",
            desc=desc,
            type=PerformanceLargeHTTPPayloadGroupType,
            cause_span_ids=[],
            parent_span_ids=None,
            offender_span_ids=offender_span_ids,
            evidence_display=[],
            evidence_data={
                "parent_span_ids": [],
                "cause_span_ids": [],
                "offender_span_ids": offender_span_ids,
                "op": "http",
            },
        )

    def _is_eligible_http_span(self, span: Span) -> bool:
        span_id = span.get("span_id", None)
        op: str = span.get("op", "") or ""
        hash = span.get("hash", None)
        description: str = span.get("description", "") or ""

        if not span_id or not op or not hash or not description:
            return False

        normalized_description = description.strip().upper()

        if not normalized_description.startswith(
            ("GET", "POST", "DELETE", "PUT", "PATCH")
        ):  # Just using all methods to see if anything interesting pops up
            return False

        if normalized_description.endswith(
            (".JS", ".CSS", ".SVG", ".PNG", ".MP3", ".JPG", ".JPEG")
        ):
            return False

        if any([x in description for x in ["_next/static/", "_next/data/"]]):
            return False

        return True

    def _fingerprint(self, span) -> str:
        hashed_url_paths = fingerprint_http_spans([span])
        return f"1-{PerformanceLargeHTTPPayloadGroupType.type_id}-{hashed_url_paths}"

    def is_creation_allowed_for_organization(self, organization: Organization) -> bool:
        return features.has(
            "organizations:performance-large-payload-detector", organization, actor=None
        )

    def is_creation_allowed_for_project(self, project: Project) -> bool:
        return True
