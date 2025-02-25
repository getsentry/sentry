from abc import abstractmethod
from typing import TYPE_CHECKING

from sentry.workflow_engine.handlers.detector import StatefulDetectorHandler

if TYPE_CHECKING:
    from sentry.models.project import Project
    from sentry.utils.performance_issues.types import Span


class PerformanceIssueDetectorHandler(StatefulDetectorHandler):
    def on_complete(self) -> None:
        pass

    @classmethod
    def is_event_eligible(cls, event, project: Project | None = None) -> bool:
        return True

    @abstractmethod
    def visit_span(self, span: Span) -> None:
        raise NotImplementedError

    # other base stuff from PerformanceDetector
