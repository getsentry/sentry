from __future__ import annotations

import random
from abc import abstractmethod
from datetime import timedelta
from enum import Enum
from typing import TYPE_CHECKING, Any, ClassVar

from sentry import options
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.utils.performance_issues.base import PerformanceProblemsMap, Span
from sentry.workflow_engine.models import DataPacket
from sentry.workflow_engine.types import DetectorGroupKey

if TYPE_CHECKING:
    from sentry.workflow_engine.handlers.detector.base import (
        DetectorEvaluationResult,
        DetectorHandler,
    )


class DetectorType(Enum):
    SLOW_DB_QUERY = "slow_db_query"
    RENDER_BLOCKING_ASSET_SPAN = "render_blocking_assets"
    N_PLUS_ONE_DB_QUERIES = "n_plus_one_db"
    N_PLUS_ONE_DB_QUERIES_EXTENDED = "n_plus_one_db_ext"
    N_PLUS_ONE_API_CALLS = "n_plus_one_api_calls"
    CONSECUTIVE_DB_OP = "consecutive_db"
    CONSECUTIVE_HTTP_OP = "consecutive_http"
    LARGE_HTTP_PAYLOAD = "large_http_payload"
    FILE_IO_MAIN_THREAD = "file_io_main_thread"
    M_N_PLUS_ONE_DB = "m_n_plus_one_db"
    UNCOMPRESSED_ASSETS = "uncompressed_assets"
    DB_MAIN_THREAD = "db_main_thread"
    HTTP_OVERHEAD = "http_overhead"


# Detector and the corresponding system option must be added to this list to have issues created.
DETECTOR_TYPE_ISSUE_CREATION_TO_SYSTEM_OPTION = {
    DetectorType.N_PLUS_ONE_DB_QUERIES: "performance.issues.n_plus_one_db.problem-creation",
    DetectorType.N_PLUS_ONE_DB_QUERIES_EXTENDED: "performance.issues.n_plus_one_db_ext.problem-creation",
    DetectorType.CONSECUTIVE_DB_OP: "performance.issues.consecutive_db.problem-creation",
    DetectorType.CONSECUTIVE_HTTP_OP: "performance.issues.consecutive_http.flag_disabled",
    DetectorType.LARGE_HTTP_PAYLOAD: "performance.issues.large_http_payload.flag_disabled",
    DetectorType.N_PLUS_ONE_API_CALLS: "performance.issues.n_plus_one_api_calls.problem-creation",
    DetectorType.FILE_IO_MAIN_THREAD: "performance.issues.file_io_main_thread.problem-creation",
    DetectorType.UNCOMPRESSED_ASSETS: "performance.issues.compressed_assets.problem-creation",
    DetectorType.SLOW_DB_QUERY: "performance.issues.slow_db_query.problem-creation",
    DetectorType.RENDER_BLOCKING_ASSET_SPAN: "performance.issues.render_blocking_assets.problem-creation",
    DetectorType.M_N_PLUS_ONE_DB: "performance.issues.m_n_plus_one_db.problem-creation",
    DetectorType.DB_MAIN_THREAD: "performance.issues.db_main_thread.problem-creation",
    DetectorType.HTTP_OVERHEAD: "performance.issues.http_overhead.problem-creation",
}


class PerformanceDetectorHandler(DetectorHandler):
    # init with a Detector and event
    type: ClassVar[DetectorType]
    stored_problems: PerformanceProblemsMap

    def __init__(self, settings: dict[DetectorType, Any], event: dict[str, Any]) -> None:
        # self.settings = settings[self.settings_key]
        self.settings = self.detector.config
        self._event = event

    def evaluate(self, data_packet: DataPacket) -> dict[DetectorGroupKey, DetectorEvaluationResult]:
        pass

    def find_span_prefix(self, settings, span_op: str):
        allowed_span_ops = settings.get("allowed_span_ops", [])
        if len(allowed_span_ops) <= 0:
            return True
        return next((op for op in allowed_span_ops if span_op.startswith(op)), False)

    def settings_for_span(self, span: Span):
        op = span.get("op", None)
        span_id = span.get("span_id", None)
        if not op or not span_id:
            return None

        span_duration = get_span_duration(span)
        for setting in self.settings:
            op_prefix = self.find_span_prefix(setting, op)
            if op_prefix:
                return op, span_id, op_prefix, span_duration, setting
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

    def is_creation_allowed_for_system(self) -> bool:
        system_option = DETECTOR_TYPE_ISSUE_CREATION_TO_SYSTEM_OPTION.get(self.__class__.type, None)

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
        return False  # Creation is off by default. Ideally, it should auto-generate the feature flag name, and check its value

    def is_creation_allowed_for_project(self, project: Project) -> bool:
        return False  # Creation is off by default. Ideally, it should auto-generate the project option name, and check its value

    @classmethod
    def is_detector_enabled(cls) -> bool:
        return True

    @classmethod
    def is_event_eligible(cls, event, project: Project | None = None) -> bool:
        return True


def get_span_duration(span: Span) -> timedelta:
    return timedelta(seconds=span.get("timestamp", 0)) - timedelta(
        seconds=span.get("start_timestamp", 0)
    )
