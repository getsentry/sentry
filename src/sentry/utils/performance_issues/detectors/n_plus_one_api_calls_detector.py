from __future__ import annotations

import hashlib
import os
import random
import re
from datetime import timedelta
from typing import Optional
from urllib.parse import parse_qs, urlparse

from sentry import features
from sentry.issues.grouptype import PerformanceNPlusOneAPICallsGroupType
from sentry.models import Organization, Project

from ..base import (
    DETECTOR_TYPE_TO_GROUP_TYPE,
    DetectorType,
    PerformanceDetector,
    get_span_duration,
    get_url_from_span,
)
from ..performance_problem import PerformanceProblem
from ..types import PerformanceProblemsMap, Span

URL_PARAMETER_REGEX = re.compile(
    r"""(?x)
    (?P<uuid>
        \b
            [0-9a-fA-F]{8}-
            [0-9a-fA-F]{4}-
            [0-9a-fA-F]{4}-
            [0-9a-fA-F]{4}-
            [0-9a-fA-F]{12}
        \b
    ) |
    (?P<hashlike>
        \b[0-9a-fA-F]{10}([0-9a-fA-F]{14})?([0-9a-fA-F]{8})?([0-9a-fA-F]{8})?\b
    ) |
    (?P<int>
        -\d+\b |
        \b\d+\b
    )
"""
)  # Adapted from message.py


class NPlusOneAPICallsDetector(PerformanceDetector):
    """
    Detect parallel network calls to the same endpoint.

      [-------- transaction -----------]
         [-------- parent span -----------]
          [n0] https://service.io/resources/?id=12443
          [n1] https://service.io/resources/?id=13342
          [n2] https://service.io/resources/?id=13441
          ...
    """

    __slots__ = ["stored_problems"]
    type: DetectorType = DetectorType.N_PLUS_ONE_API_CALLS
    settings_key: DetectorType = DetectorType.N_PLUS_ONE_API_CALLS

    HOST_DENYLIST = []

    def init(self):
        # TODO: Only store the span IDs and timestamps instead of entire span objects
        self.stored_problems: PerformanceProblemsMap = {}
        self.spans: list[Span] = []

    def visit_span(self, span: Span) -> None:
        if not NPlusOneAPICallsDetector.is_span_eligible(span):
            return

        op = span.get("op", None)
        if op not in self.settings.get("allowed_span_ops", []):
            return

        duration_threshold = timedelta(milliseconds=self.settings.get("duration_threshold"))
        span_duration = get_span_duration(span)

        if span_duration < duration_threshold:
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
        return features.has(
            "organizations:performance-n-plus-one-api-calls-detector", organization, actor=None
        )

    def is_creation_allowed_for_project(self, project: Project) -> bool:
        return self.settings["detection_rate"] > random.random()

    @staticmethod
    def parameterize_url(url: str) -> str:
        parsed_url = urlparse(str(url))

        protocol_fragments = []
        if parsed_url.scheme:
            protocol_fragments.append(parsed_url.scheme)
            protocol_fragments.append("://")

        host_fragments = []
        for fragment in parsed_url.netloc.split("."):
            host_fragments.append(str(fragment))

        path_fragments = []
        for fragment in parsed_url.path.split("/"):
            if URL_PARAMETER_REGEX.search(fragment):
                path_fragments.append("*")
            else:
                path_fragments.append(str(fragment))

        query = parse_qs(parsed_url.query)

        return "".join(
            [
                "".join(protocol_fragments),
                ".".join(host_fragments),
                "/".join(path_fragments),
                "?",
                "&".join(sorted([f"{key}=*" for key in query.keys()])),
            ]
        ).rstrip("?")

    @classmethod
    def is_event_eligible(cls, event, project=None):
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

        # GraphQL URLs have complicated queries in them. Until we parse those
        # queries to check for what's duplicated, we can't tell what is being
        # duplicated. Ignore them for now
        if "graphql" in description:
            return False

        # Next.js infixes its data URLs with a build ID. (e.g.,
        # /_next/data/<uuid>/some-endpoint) This causes a fingerprinting
        # explosion, since every deploy would change this ID and create new
        # fingerprints. Since we're not parameterizing URLs yet, we need to
        # exclude them
        if "_next/data" in description:
            return False

        url = get_url_from_span(span)

        # Next.js error pages cause an N+1 API Call that isn't useful to anyone
        if "__nextjs_original-stack-frame" in url:
            return False

        if not url:
            return False

        parsed_url = urlparse(str(url))

        if parsed_url.netloc in cls.HOST_DENYLIST:
            return False

        # Ignore anything that looks like an asset. Some frameworks (and apps)
        # fetch assets via XHR, which is not our concern
        _pathname, extension = os.path.splitext(parsed_url.path)
        if extension and extension in [".js", ".css", ".svg", ".png", ".mp3", ".jpg", ".jpeg"]:
            return False

        return True

    def on_complete(self):
        self._maybe_store_problem()
        self.spans = []

    def _maybe_store_problem(self):
        if len(self.spans) < 1:
            return

        if len(self.spans) < self.settings["count"]:
            return

        last_span = self.spans[-1]

        fingerprint = self._fingerprint()
        if not fingerprint:
            return

        self.stored_problems[fingerprint] = PerformanceProblem(
            fingerprint=fingerprint,
            op=last_span["op"],
            desc=os.path.commonprefix([span.get("description", "") or "" for span in self.spans]),
            type=DETECTOR_TYPE_TO_GROUP_TYPE[self.settings_key],
            cause_span_ids=[],
            parent_span_ids=[last_span.get("parent_span_id", None)],
            offender_span_ids=[span["span_id"] for span in self.spans],
        )

    def _fingerprint(self) -> Optional[str]:
        first_url = get_url_from_span(self.spans[0])
        parameterized_first_url = self.parameterize_url(first_url)

        # Check if we parameterized the URL at all. If not, do not attempt
        # fingerprinting. Unparameterized URLs run too high a risk of
        # fingerprinting explosions. Query parameters are parameterized by
        # definition, so exclude them from comparison
        if without_query_params(parameterized_first_url) == without_query_params(first_url):
            return None

        parsed_first_url = urlparse(parameterized_first_url)
        path = parsed_first_url.path

        fingerprint = hashlib.sha1(path.encode("utf8")).hexdigest()

        return f"1-{PerformanceNPlusOneAPICallsGroupType.type_id}-{fingerprint}"

    def _spans_are_concurrent(self, span_a: Span, span_b: Span) -> bool:
        span_a_start: int = span_a.get("start_timestamp", 0) or 0
        span_b_start: int = span_b.get("start_timestamp", 0) or 0

        return timedelta(seconds=abs(span_a_start - span_b_start)) < timedelta(
            milliseconds=self.settings["concurrency_threshold"]
        )

    def _spans_are_similar(self, span_a: Span, span_b: Span) -> bool:
        return (
            span_a["hash"] == span_b["hash"]
            and span_a["parent_span_id"] == span_b["parent_span_id"]
        )


def without_query_params(url: str) -> str:
    return urlparse(url)._replace(query="").geturl()
