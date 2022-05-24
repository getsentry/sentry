from functools import partial
from typing import Any, Sequence

from sentry.models import Organization, Project
from sentry.utils.compat import map

from .base import ReportBackend


class DummyReportBackend(ReportBackend):
    def prepare(self, timestamp: float, duration: float, organization: Organization) -> None:
        pass

    def fetch(
        self,
        timestamp: float,
        duration: float,
        organization: Organization,
        projects: Sequence[Project],
    ) -> Sequence[Any]:
        assert all(project.organization_id == organization.id for project in projects)
        return map(partial(self.build, timestamp, duration), projects)
