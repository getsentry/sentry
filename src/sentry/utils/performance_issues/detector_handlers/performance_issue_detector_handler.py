from abc import abstractmethod
from enum import Enum
from typing import ClassVar

from sentry.models.project import Project
from sentry.utils.performance_issues.types import PerformanceProblemsMap, Span
from sentry.workflow_engine.handlers.detector import StatefulDetectorHandler


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


class PerformanceIssueDetectorHandler(StatefulDetectorHandler):
    type: ClassVar[DetectorType]
    stored_problems: PerformanceProblemsMap

    def on_complete(self) -> None:
        pass

    @classmethod
    def is_event_eligible(cls, event, project: Project | None = None) -> bool:
        return True

    @abstractmethod
    def visit_span(self, span: Span) -> None:
        raise NotImplementedError

    # other base stuff from PerformanceDetector
