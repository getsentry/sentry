from __future__ import annotations

import re
from datetime import timedelta
from typing import Any

from sentry.issues.grouptype import PerformanceLargeHTTPPayloadGroupType
from sentry.issues.issue_occurrence import IssueEvidence
from sentry.models.organization import Organization
from sentry.models.project import Project

from ..base import DetectorType, PerformanceDetector
from ..detectors.utils import (
    fingerprint_http_spans,
    get_notification_attachment_body,
    get_span_duration,
    get_span_evidence_value,
)
from ..performance_problem import PerformanceProblem
from ..types import Span

# Matches a file extension, ignoring query parameters at the end
EXTENSION_REGEX = re.compile(r"\.([a-zA-Z0-9]+)/?(?!/)(\?.*)?$")
EXTENSION_ALLOW_LIST = ("JSON",)

# Content-Type values that typically indicate file downloads
FILE_DOWNLOAD_CONTENT_TYPES = {
    "application/octet-stream",
    "application/pdf",
    "application/zip",
    "application/x-zip-compressed",
    "application/x-rar-compressed",
    "application/x-7z-compressed",
    "application/x-tar",
    "application/x-gzip",
    "application/x-bzip2",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.oasis.opendocument.text",
    "application/vnd.oasis.opendocument.spreadsheet",
    "application/vnd.oasis.opendocument.presentation",
    "image/",
    "video/",
    "audio/",
    "text/csv",
    "text/plain",
}


class LargeHTTPPayloadDetector(PerformanceDetector):
    """
    Detects large HTTP payloads that may indicate performance issues.

    This detector excludes file downloads based on:
    1. File extensions in URLs (existing behavior)
    2. HTTP response headers indicating file downloads (new behavior):
       - Content-Disposition: attachment
       - Content-Type values indicating file downloads (e.g., application/pdf, image/*, video/*, etc.)

    This addresses the issue where file download endpoints using internal unique identifiers
    (without file extensions in URLs) were incorrectly flagged as performance issues.
    """

    type = DetectorType.LARGE_HTTP_PAYLOAD
    settings_key = DetectorType.LARGE_HTTP_PAYLOAD

    def __init__(self, settings: dict[DetectorType, Any], event: dict[str, Any]) -> None:
        super().__init__(settings, event)

        self.consecutive_http_spans: list[Span] = []

    def visit_span(self, span: Span) -> None:
        if not self._is_span_eligible(span):
            return

        data = span.get("data", None)
        if not data:
            return

        encoded_body_size = data.get("http.response_content_length", None)
        if not encoded_body_size:
            return

        payload_size_threshold = self.settings.get("payload_size_threshold")

        if isinstance(encoded_body_size, str):
            encoded_body_size = int(encoded_body_size)

        if encoded_body_size > payload_size_threshold:
            self._store_performance_problem(span)

    def _store_performance_problem(self, span: Span) -> None:
        fingerprint = self._fingerprint(span)
        offender_span_id: str = span["span_id"]
        desc: str = span.get("description", "")

        self.stored_problems[fingerprint] = PerformanceProblem(
            fingerprint=fingerprint,
            op="http",
            desc=desc,
            type=PerformanceLargeHTTPPayloadGroupType,
            cause_span_ids=[],
            parent_span_ids=None,
            offender_span_ids=[offender_span_id],
            evidence_display=[
                IssueEvidence(
                    name="Offending Spans",
                    value=get_notification_attachment_body(
                        "http",
                        desc,
                    ),
                    # Has to be marked important to be displayed in the notifications
                    important=True,
                )
            ],
            evidence_data={
                "parent_span_ids": [],
                "cause_span_ids": [],
                "offender_span_ids": [offender_span_id],
                "op": "http",
                "transaction_name": self._event.get("description", ""),
                "repeating_spans": get_span_evidence_value(span),
                "repeating_spans_compact": get_span_evidence_value(span, include_op=False),
                "num_repeating_spans": 1,
            },
        )

    def _is_span_eligible(self, span: Span) -> bool:
        span_id = span.get("span_id", None)
        op: str = span.get("op", "") or ""
        hash = span.get("hash", None)
        description: str = span.get("description", "") or ""

        if not span_id or not op or not hash or not description:
            return False

        # This detector is only available for HTTP spans
        if not op.startswith("http"):
            return False

        if get_span_duration(span) < timedelta(
            milliseconds=self.settings.get("minimum_span_duration")
        ):
            return False

        # Check if this is a file download based on HTTP headers
        # This addresses the issue where file download endpoints using internal unique identifiers
        # (without file extensions in URLs) were incorrectly flagged as performance issues.
        if self._is_file_download(span):
            return False

        normalized_description = description.strip().upper()
        extension = EXTENSION_REGEX.search(normalized_description)
        if extension and extension.group(1) not in EXTENSION_ALLOW_LIST:
            return False

        if any([x in description for x in ["_next/static/", "_next/data/"]]):
            return False

        span_data = span.get("data", {})
        if span_data and span_data.get("http.request.prefetch"):
            return False

        return True

    def _is_file_download(self, span: Span) -> bool:
        """
        Check if this span represents a file download based on HTTP headers.
        Returns True if the response indicates a file download, False otherwise.
        """
        span_data = span.get("data", {})
        if not span_data:
            return False

        # Check response headers
        response_headers = span_data.get("response", {}).get("headers", {})
        if not response_headers:
            return False

        # Check Content-Disposition header for attachment
        content_disposition = response_headers.get("content-disposition", "").lower()
        if content_disposition and "attachment" in content_disposition:
            return True

        # Check Content-Type header for file download indicators
        content_type = response_headers.get("content-type", "").lower()
        if not content_type:
            return False

        # Check for exact matches
        if content_type in FILE_DOWNLOAD_CONTENT_TYPES:
            return True

        # Check for prefix matches (e.g., image/, video/, audio/)
        for download_type in FILE_DOWNLOAD_CONTENT_TYPES:
            if download_type.endswith("/") and content_type.startswith(download_type):
                return True

        return False

    def _fingerprint(self, span: Span) -> str:
        hashed_url_paths = fingerprint_http_spans([span])
        return f"1-{PerformanceLargeHTTPPayloadGroupType.type_id}-{hashed_url_paths}"

    def is_creation_allowed_for_organization(self, organization: Organization) -> bool:
        return True

    def is_creation_allowed_for_project(self, project: Project) -> bool:
        return self.settings["detection_enabled"]
