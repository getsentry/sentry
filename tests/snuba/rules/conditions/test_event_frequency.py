import time
from uuid import uuid4

from sentry.models.project import Project
from sentry.testutils.cases import BaseMetricsTestCase


class BaseEventFrequencyPercentTest(BaseMetricsTestCase):
    def _make_sessions(
        self,
        num: int,
        environment_name: str | None = None,
        project: Project | None = None,
        received: float | None = None,
    ) -> None:
        if received is None:
            received = time.time()

        def make_session(i: int) -> dict[str, object]:
            return {
                "distinct_id": uuid4().hex,
                "session_id": uuid4().hex,
                "org_id": project.organization_id if project else self.project.organization_id,
                "project_id": project.id if project else self.project.id,
                "status": "ok",
                "seq": 0,
                "release": "foo@1.0.0",
                "environment": environment_name if environment_name else "prod",
                "retention_days": 90,
                "duration": None,
                "errors": 0,
                # Spread sessions throughout the time period.
                "started": received - i - 1,
                "received": received,
            }

        self.bulk_store_sessions([make_session(i) for i in range(num)])
