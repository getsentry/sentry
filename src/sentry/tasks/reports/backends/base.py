import abc


class ReportBackend(abc.ABC):
    def build(self, timestamp, duration, project):
        """Constructs the report for a project."""
        from sentry.tasks.reports import build_project_report
        from sentry.tasks.reports.utils.util import _to_interval

        return build_project_report(_to_interval(timestamp, duration), project)

    @abc.abstractmethod
    def prepare(self, timestamp, duration, organization):
        """Build and store reports for all projects in an organization."""
        pass

    @abc.abstractmethod
    def fetch(self, timestamp, duration, organization, projects):
        """
        Fetch reports for a set of projects in the organization, returning
        reports in the order that they were requested.
        """
        pass
