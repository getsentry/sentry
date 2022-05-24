import abc
from typing import Any, Sequence

from sentry.models import Organization, Project


class ReportBackend(abc.ABC):
    def build(
        self,
        timestamp: float,
        duration: float,
        project: Project,
    ) -> Any:
        """Constructs the report for a project."""
        from sentry.tasks.reports import build_project_report
        from sentry.tasks.reports.utils.util import _to_interval

        return build_project_report(_to_interval(timestamp, duration), project)

    @abc.abstractmethod
    def prepare(self, timestamp: float, duration: float, organization: Organization) -> None:
        """Build and store reports for all projects in an organization."""
        pass

    @abc.abstractmethod
    def fetch(
        self,
        timestamp: float,
        duration: float,
        organization: Organization,
        projects: Sequence[Project],
    ) -> Sequence[Any]:
        """
        Fetch reports for a set of projects in the organization, returning
        reports in the order that they were requested.
        """
        pass
