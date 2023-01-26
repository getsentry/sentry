from __future__ import annotations

import random
from abc import ABC, abstractmethod
from datetime import timedelta
from enum import Enum
from typing import Any, Dict

from sentry import options
from sentry.eventstore.models import Event
from sentry.models import Organization, Project

from .types import PerformanceProblemsMap, Span


class DetectorType(Enum):
    SLOW_DB_QUERY = "slow_db_query"
    RENDER_BLOCKING_ASSET_SPAN = "render_blocking_assets"
    N_PLUS_ONE_DB_QUERIES = "n_plus_one_db"
    N_PLUS_ONE_DB_QUERIES_EXTENDED = "n_plus_one_db_ext"
    N_PLUS_ONE_API_CALLS = "n_plus_one_api_calls"
    CONSECUTIVE_DB_OP = "consecutive_db"
    FILE_IO_MAIN_THREAD = "file_io_main_thread"
    M_N_PLUS_ONE_DB = "m_n_plus_one_db"
    UNCOMPRESSED_ASSETS = "uncompressed_assets"


# Detector and the corresponding system option must be added to this list to have issues created.
DETECTOR_TYPE_ISSUE_CREATION_TO_SYSTEM_OPTION = {
    DetectorType.N_PLUS_ONE_DB_QUERIES: "performance.issues.n_plus_one_db.problem-creation",
    DetectorType.N_PLUS_ONE_DB_QUERIES_EXTENDED: "performance.issues.n_plus_one_db_ext.problem-creation",
    DetectorType.CONSECUTIVE_DB_OP: "performance.issues.consecutive_db.problem-creation",
    DetectorType.N_PLUS_ONE_API_CALLS: "performance.issues.n_plus_one_api_calls.problem-creation",
    DetectorType.FILE_IO_MAIN_THREAD: "performance.issues.file_io_main_thread.problem-creation",
    DetectorType.UNCOMPRESSED_ASSETS: "performance.issues.compressed_assets.problem-creation",
    DetectorType.SLOW_DB_QUERY: "performance.issues.slow_db_query.problem-creation",
    DetectorType.RENDER_BLOCKING_ASSET_SPAN: "performance.issues.render_blocking_assets.problem-creation",
}


class PerformanceDetector(ABC):
    """
    Classes of this type have their visit functions called as the event is walked once and will store a performance issue if one is detected.
    """

    type: DetectorType

    def __init__(self, settings: Dict[DetectorType, Any], event: Event):
        self.settings = settings[self.settings_key]
        self._event = event
        self.init()

    @abstractmethod
    def init(self):
        raise NotImplementedError

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

    def event(self) -> Event:
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

    @property
    @abstractmethod
    def stored_problems(self) -> PerformanceProblemsMap:
        raise NotImplementedError

    def is_creation_allowed_for_system(self) -> bool:
        system_option = DETECTOR_TYPE_ISSUE_CREATION_TO_SYSTEM_OPTION.get(self.__class__.type, None)

        if not system_option:
            return False

        try:
            rate = options.get(system_option)
        except options.UnknownOption:
            rate = 0

        return rate > random.random()

    def is_creation_allowed_for_organization(self, organization: Organization) -> bool:
        return False  # Creation is off by default. Ideally, it should auto-generate the feature flag name, and check its value

    def is_creation_allowed_for_project(self, project: Project) -> bool:
        return False  # Creation is off by default. Ideally, it should auto-generate the project option name, and check its value

    @classmethod
    def is_event_eligible(cls, event):
        return True


def get_span_duration(span: Span) -> timedelta:
    return timedelta(seconds=span.get("timestamp", 0)) - timedelta(
        seconds=span.get("start_timestamp", 0)
    )
