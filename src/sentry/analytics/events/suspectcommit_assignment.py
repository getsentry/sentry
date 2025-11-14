from typing import int
from sentry import analytics


@analytics.eventclass("suspectcommit.assignment")
class SuspectCommitAssignment(analytics.Event):
    organization_id: int
    project_id: int
    group_id: int
    updated_assignment: bool


analytics.register(SuspectCommitAssignment)
