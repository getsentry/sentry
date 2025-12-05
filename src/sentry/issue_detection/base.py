from __future__ import annotations

import random
from abc import ABC, abstractmethod
from datetime import timedelta
from enum import Enum
from typing import Any, ClassVar

from sentry import options
from sentry.issue_detection.detectors.utils import get_span_duration
from sentry.issue_detection.performance_problem import PerformanceProblem
from sentry.models.organization import Organization
from sentry.models.project import Project

from .types import Span


class DetectorType(Enum):
    SLOW_DB_QUERY = "slow_db_query"
    RENDER_BLOCKING_ASSET_SPAN = "render_blocking_assets"
    N_PLUS_ONE_DB_QUERIES = "n_plus_one_db"
    N_PLUS_ONE_API_CALLS = "n_plus_one_api_calls"
    CONSECUTIVE_DB_OP = "consecutive_db"
    CONSECUTIVE_HTTP_OP = "consecutive_http"
    LARGE_HTTP_PAYLOAD = "large_http_payload"
    FILE_IO_MAIN_THREAD = "file_io_main_thread"
    M_N_PLUS_ONE_DB = "m_n_plus_one_db"
    UNCOMPRESSED_ASSETS = "uncompressed_assets"
    DB_MAIN_THREAD = "db_main_thread"
    HTTP_OVERHEAD = "http_overhead"
    SQL_INJECTION = "sql_injection"
    QUERY_INJECTION = "query_injection"


# Detector and the corresponding system option must be added to this list to have issues created.
DETECTOR_TYPE_ISSUE_CREATION_TO_SYSTEM_OPTION = {
    DetectorType.N_PLUS_ONE_DB_QUERIES: "performance.issues.n_plus_one_db.problem-creation",
    DetectorType.CONSECUTIVE_DB_OP: "performance.issues.consecutive_db.problem-creation",
    DetectorType.CONSECUTIVE_HTTP_OP: "performance.issues.consecutive_http.problem-creation",
    DetectorType.LARGE_HTTP_PAYLOAD: "performance.issues.large_http_payload.problem-creation",
    DetectorType.N_PLUS_ONE_API_CALLS: "performance.issues.n_plus_one_api_calls.problem-creation",
    DetectorType.FILE_IO_MAIN_THREAD: "performance.issues.file_io_main_thread.problem-creation",
    DetectorType.UNCOMPRESSED_ASSETS: "performance.issues.compressed_assets.problem-creation",
    DetectorType.SLOW_DB_QUERY: "performance.issues.slow_db_query.problem-creation",
    DetectorType.RENDER_BLOCKING_ASSET_SPAN: "performance.issues.render_blocking_assets.problem-creation",
    DetectorType.M_N_PLUS_ONE_DB: "performance.issues.m_n_plus_one_db.problem-creation",
    DetectorType.DB_MAIN_THREAD: "performance.issues.db_main_thread.problem-creation",
    DetectorType.HTTP_OVERHEAD: "performance.issues.http_overhead.problem-creation",
    DetectorType.SQL_INJECTION: "performance.issues.sql_injection.problem-creation",
    DetectorType.QUERY_INJECTION: "performance.issues.query_injection.problem-creation",
}


class PerformanceDetector(ABC):
    """
    Classes of this type have their visit functions called as the event is walked once and will store a performance issue if one is detected.
    """

    type: ClassVar[DetectorType]

    def __init__(self, settings: dict[DetectorType, Any], event: dict[str, Any]) -> None:
        self.settings = settings[self.settings_key]
        self._event = event
        self.stored_problems: dict[str, PerformanceProblem] = {}

    def find_span_prefix(self, settings: dict[str, Any], span_op: str) -> str | bool:
        allowed_span_ops = settings.get("allowed_span_ops", [])
        if len(allowed_span_ops) <= 0:
            return True
        return next((op for op in allowed_span_ops if span_op.startswith(op)), False)

    def settings_for_span(
        self, span: Span
    ) -> tuple[str, str, str | bool, timedelta, dict[str, Any]] | None:
        op = span.get("op", None)
        span_id = span.get("span_id", None)
        if not op or not span_id:
            return None

        span_duration = get_span_duration(span)
        op_prefix = self.find_span_prefix(self.settings, op)
        if op_prefix:
            return op, span_id, op_prefix, span_duration, self.settings
        return None

    def event(self) -> dict[str, Any]:
        return self._event

    @property
    @abstractmethod
    def settings_key(self) -> DetectorType:
        raise NotImplementedError

    @abstractmethod
    def visit_span(self, span: Span) -> None:
        raise NotImplementedError

    def on_complete(self) -> None:
        pass

    @classmethod
    def is_detection_allowed_for_system(cls) -> bool:
        """
        This method determines whether the detector should be run at all for this Sentry instance.

        See `_detect_performance_problems` in `performance_detection.py` for more context.
        """
        system_option = DETECTOR_TYPE_ISSUE_CREATION_TO_SYSTEM_OPTION.get(cls.type, None)

        if not system_option:
            return False

        try:
            creation_option_value: bool | float | None = options.get(system_option)
            if isinstance(creation_option_value, bool):
                return not creation_option_value
            elif isinstance(
                creation_option_value, float
            ):  # If the option is a float, we are controlling it with a rate. TODO - make all detectors use boolean
                return creation_option_value > random.random()
            return False

        except options.UnknownOption:
            return False

    def is_creation_allowed_for_organization(self, organization: Organization) -> bool:
        """
        After running the detector, this method determines whether the found problems should be
        passed to the issue platform for a given organization.

        See `_detect_performance_problems` in `performance_detection.py` for more context.
        """
        return False

    def is_creation_allowed_for_project(self, project: Project) -> bool:
        """
        After running the detector, this method determines whether the found problems should be
        passed to the issue platform for a given project.

        See `_detect_performance_problems` in `performance_detection.py` for more context.
        """
        return False

    @classmethod
    def is_event_eligible(cls, event: dict[str, Any], project: Project | None = None) -> bool:
        return True
